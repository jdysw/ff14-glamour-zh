// test-dict-rt.mjs — 词库运行时更新（v1.2.0）端到端测试（v2：抗导航干扰；v3 增长期：预置空 v3 manifest 静默回退 v2）
// 场景 A（下载路径）：无缓存首访 → mock version.json 指纹不同 → 下载 mock dict.json
//   断言 T1 修正重译：「装備シリーズ」新译「装备系列Q」替换页面上旧译「装备系列」
//   断言 T2 新增词补扫：mock 新增「ランダム→随机Q」，补扫后出现于 option 文本
// 场景 B（缓存路径）：第二页加载 → fresh 缓存直接应用 → 同样断言通过
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, dataDirPath } from '../helpers/paths.mjs';
import { ensureDictJson } from '../helpers/dict.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const BASE = 'http://mock.local/ff14/v2/';

// ── mock 数据 ──
const dataDir = dataDirPath;
const itemsTxt = fs.readFileSync(`${dataDir}/ff14-items.tsv`, 'utf8');
const seriesTxt = fs.readFileSync(`${dataDir}/ff14-series.txt`, 'utf8');
const aclTxt = fs.readFileSync(`${dataDir}/acl-cfc.txt`, 'utf8');
const dictObj = JSON.parse(ensureDictJson());

const origSeries = dictObj.fc['装備シリーズ'];
if (origSeries !== '装备系列') { console.error(`防呆失败：「装備シリーズ」当前译 = ${JSON.stringify(origSeries)}`); process.exit(1); }
if (dictObj.fc['ランダム'] !== undefined) { console.error('防呆失败：「ランダム」已存在于词典'); process.exit(1); }
dictObj.fc['装備シリーズ'] = '装备系列Q';
dictObj.fc['ランダム'] = '随机Q';

const mock = {
  [BASE + 'version.json']: JSON.stringify({ v: '20261005t', files: { items: 'tt01', series: 'tt02', acl: 'tt03', dict: 'tt04' } }),
  [BASE + 'items.tsv']: itemsTxt,
  [BASE + 'series.txt']: seriesTxt,
  [BASE + 'acl.txt']: aclTxt,
  [BASE + 'dict.json']: JSON.stringify(dictObj),
  // v3 兜底：预置缓存失效时也返回空 sites（静默回退 v2，避免真网络干扰本测试）
  'https://zhixia-data.pages.dev/ff14/v3/manifest.json': JSON.stringify({ schema: 3, sites: {} }),
};

const GF_REAL = readDist();
const GF = GF_REAL.replace('https://zhixia-data.pages.dev/ff14/v2/', BASE);
if (GF === GF_REAL) { console.error('DATA_BASE 替换失败'); process.exit(1); }

const gmStub = `(() => {
  if (window.__gmStub) return; window.__gmStub = true;
  const P = 'gm:';
  window.__mockHits = { version: 0, dict: 0 };
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  // v3 已上线：预置「新鲜 manifest + 本站不在列」→ v3 静默回退 v2（本测试聚焦 v2 词库运行时链）
  try { localStorage.setItem(P + 'zhx.v3.manifest', Date.now() + '\\n' + JSON.stringify({ schema: 3, sites: {}, shared: {} })); } catch (e) {}
  const MOCK = ${JSON.stringify(mock)};
  window.GM_xmlhttpRequest = (opt) => {
    const body = MOCK[opt.url];
    if (body !== undefined) {
      if (opt.url.indexOf('version.json') >= 0) window.__mockHits.version++;
      if (opt.url.indexOf('dict.json') >= 0) window.__mockHits.dict++;
      setTimeout(() => { try { opt.onload && opt.onload({ status: 200, responseText: body }); } catch (e) {} }, 15);
      return;
    }
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} })).catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;
const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

async function bootPage(clearCache, label) {
  const t = await newPage(PORT, 'about:blank');
  const c = t.cdp;
  await c.send('Network.enable');
  await c.send('Network.setBlockedURLs', {
    urls: ['*googleapis.com*', '*gstatic.com*', '*typesquare.com*', '*cdnjs.cloudflare.com*',
           '*twitter.com*', '*valuecommerce.com*', '*doubleclick.net*', '*google-analytics*',
           '*googletagmanager*', '*google.com*', '*facebook.net*', '*facebook.com*'],
  });
  await c.send('Page.navigate', { url: 'https://ff14-fc.com/equipment_series_search/' });
  // 等 body 稳定（连续两次长度一致且 > 200）
  let stable = 0, lastLen = -1;
  for (let i = 0; i < 40; i++) {
    await sleep(2500);
    let st = null;
    try { st = await c.eval(`(() => { const b = document.body; return { len: (b && b.innerText) ? b.innerText.length : -1 }; })()`); } catch (e) {}
    const len = st ? st.len : -1;
    if (len > 200 && len === lastLen) { stable++; if (stable >= 2) break; } else stable = 0;
    lastLen = len;
  }
  console.log(`  [${label}] body 稳定（len=${lastLen}）`);
  if (clearCache) await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
  const inject = async () => { await c.eval(gmStub).catch(() => {}); await c.eval(wrap(GF)).catch(() => {}); };
  await inject();
  // 等待就绪（含导航自愈：__gmStub 消失 = 文档被换 → 重注入）
  let injCount = 1;
  for (let i = 0; i < 70; i++) {
    await sleep(1500);
    let st = null;
    try { st = await c.eval(`({ stub: !!window.__gmStub, dict: !!localStorage.getItem('gm:zhx.dt.dict') })`); } catch (e) {}
    if (!st) continue;
    if (!st.stub) { if (injCount < 4) { injCount++; console.log(`  [${label}] 导航自愈：重注入 #${injCount}`); await inject(); } continue; }
    if (st.dict && injCount === 1) return { t, c, reinjected: false };
    if (st.dict && injCount > 1) return { t, c, reinjected: true };
  }
  return { t, c, reinjected: injCount > 1, timeout: true };
}

async function probe(c) {
  try {
    return await c.eval(`(() => {
      if (!document.body) return { noBody: true, hasFix: false, hasNew: false, randLeft: -1, qContext: '(no body)', hits: window.__mockHits || {} };
      const parts = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) parts.push(w.currentNode.nodeValue || '');
      const joined = parts.join('\\n');
      const opts = [...document.querySelectorAll('option')].map((o) => (o.textContent || '').trim());
      const qc = (joined.match(/.{0,26}装备系列Q.{0,26}/) || [''])[0].replace(/\\s+/g, ' ');
      return {
        noBody: false,
        hasFix: joined.indexOf('装备系列Q') >= 0,
        hasNew: joined.indexOf('随机Q') >= 0,
        randLeft: opts.filter((s) => s.indexOf('ランダム') >= 0).length,
        qContext: qc,
        hits: window.__mockHits || {},
      };
    })()`);
  } catch (e) {
    return { noBody: true, hasFix: false, hasNew: false, randLeft: -1, qContext: '(eval fail: ' + e.message.slice(0, 80) + ')', hits: {} };
  }
}

// 轮询「两个断言都出现」最多 waitSec 秒（抗导航/慢补扫）
async function waitBoth(c, waitSec) {
  for (let i = 0; i < Math.ceil(waitSec / 4); i++) {
    await sleep(4000);
    const r = await probe(c);
    if (r.hasFix && r.hasNew) return r;
  }
  return await probe(c);
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); } };

console.log('╔══ 场景 A：下载路径（无缓存）══╗');
{
  const { t, c, timeout } = await bootPage(true, 'A');
  if (timeout) console.log('  ⚠️ 就绪等待超时');
  const r = await waitBoth(c, 40);
  console.log('  mock 命中:', JSON.stringify(r.hits), '｜上下文:', JSON.stringify(r.qContext));
  ok('A1 修正重译：旧译「装备系列」→「装备系列Q」', r.hasFix);
  ok('A2 新增词补扫：「ランダム」→「随机Q」', r.hasNew);
  ok('A3 旧文本无残留（option 无「ランダム」）', r.randLeft === 0, `残留 ${r.randLeft}`);
  await closePage(PORT, t.target.id);
}

console.log('╔══ 场景 B：缓存路径（不清缓存，fresh 直接用缓存）══╗');
{
  const { t, c, timeout } = await bootPage(false, 'B');
  if (timeout) console.log('  ⚠️ 就绪等待超时');
  const r = await waitBoth(c, 40);
  console.log('  mock 命中:', JSON.stringify(r.hits));
  ok('B1 修正重译（缓存数据同样生效）', r.hasFix);
  ok('B2 新增词补扫（缓存数据同样生效）', r.hasNew);
  ok('B3 旧文本无残留', r.randLeft === 0, `残留 ${r.randLeft}`);
  await closePage(PORT, t.target.id);
}

console.log();
console.log(`总计: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
