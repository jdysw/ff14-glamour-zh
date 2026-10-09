// test-dict-rt.mjs — V3 字典下载与内容寻址缓存端到端测试。
// 场景 A：清缓存后由 V3 manifest/site files/shared.dict 拉取更新词典。
// 场景 B：再次运行时命中同一份 V3 缓存，不发出数据请求。
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import http from 'node:http';
import { readDist, fixturePath } from '../helpers/paths.mjs';
import fs from 'node:fs';
import { readRuntimeV3, sha256Text } from '../helpers/v3-cache.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const BASE = 'http://mock.local/ff14/v3/';
const fixture = fs.readFileSync(fixturePath('fc-search.html'));
const pageServer = http.createServer((req, res) => {
  if (req.url === '/fc-search.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fixture);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise((resolve, reject) => { pageServer.once('error', reject); pageServer.listen(0, '127.0.0.1', resolve); });
const FIXTURE = 'http://127.0.0.1:' + pageServer.address().port + '/fc-search.html';
const runtime = readRuntimeV3('fc');
const manifest = structuredClone(runtime.manifest);
const dictObj = JSON.parse(runtime.dict.text);

const origSeries = dictObj.fc['装備シリーズ'];
if (origSeries !== '装备系列') { console.error('防呆失败：「装備シリーズ」当前译 = ' + JSON.stringify(origSeries)); process.exit(1); }
if (dictObj.fc['ランダム'] !== undefined) { console.error('防呆失败：「ランダム」已存在于词典'); process.exit(1); }
dictObj.fc['装備シリーズ'] = '装备系列Q';
dictObj.fc['ランダム'] = '随机Q';

const dictText = JSON.stringify(dictObj);
const dictSha = sha256Text(dictText);
manifest.shared.dict = { ...manifest.shared.dict, sha256: dictSha, bytes: Buffer.byteLength(dictText) };
const mock = {
  [BASE + 'manifest.json']: JSON.stringify(manifest),
  [BASE + manifest.shared.dict.url]: dictText,
};
for (const [name, meta] of Object.entries(manifest.sites.fc.files)) {
  mock[BASE + meta.url] = runtime.siteFiles[name].text;
}

const GF_REAL = readDist();
const GF = GF_REAL.replace('https://zhixia-data.pages.dev/ff14/v3/', BASE);
if (GF === GF_REAL) { console.error('V3 DATA_BASE 替换失败'); process.exit(1); }

const gmStub = `(() => {
  if (window.__gmStub) return; window.__gmStub = true;
  const P = 'gm:';
  window.__mockHits = { manifest: 0, dict: 0, files: 0, unexpected: [] };
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_listValues = () => Object.keys(localStorage).filter((k) => k.startsWith(P)).map((k) => k.slice(P.length));
  window.GM_deleteValue = (k) => { try { localStorage.removeItem(P + k); } catch (e) {} };
  const MOCK = ${JSON.stringify(mock)};
  window.GM_xmlhttpRequest = (opt) => {
    const url = opt.url.split('?')[0];
    const body = MOCK[url];
    if (body === undefined) window.__mockHits.unexpected.push(url);
    else if (url.endsWith('/manifest.json')) window.__mockHits.manifest++;
    else if (url.endsWith('/dict.json')) window.__mockHits.dict++;
    else window.__mockHits.files++;
    setTimeout(() => { try { opt.onload && opt.onload({ status: body === undefined ? 404 : 200, responseText: body || '' }); } catch (e) {} }, 15);
  };
})();`;
const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

async function bootPage(clearCache, label) {
  const t = await newPage(PORT, FIXTURE);
  const c = t.cdp;
  await c.eval("(() => { const p = document.createElement('p'); p.textContent = '装備シリーズ'; document.body.appendChild(p); const select = document.createElement('select'); const option = document.createElement('option'); option.textContent = 'ランダム'; select.appendChild(option); document.body.appendChild(select); return 1; })()");
  console.log(`  [${label}] 本地 FC 夹具已就绪`);
  await c.eval("window.__zhxTestSite = 'fc';");
  if (clearCache) await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
  const inject = async () => { await c.eval(gmStub).catch(() => {}); await c.eval(wrap(GF)).catch(() => {}); };
  await inject();
  // 等待就绪（含导航自愈：__gmStub 消失 = 文档被换 → 重注入）
  let injCount = 1;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    let st = null;
    try { st = await c.eval(`({ stub: !!window.__gmStub, dict: Object.keys(localStorage).some((k) => k.startsWith('gm:zhx.v3.f.fc.dict.')) })`); } catch (e) {}
    if (!st) continue;
    if (!st.stub) { if (injCount < 4) { injCount++; console.log(`  [${label}] 导航自愈：重注入 #${injCount}`); await inject(); } continue; }
    if (st.dict && injCount === 1) return { t, c, reinjected: false };
    if (st.dict && injCount > 1) return { t, c, reinjected: true };
  }
  const state = await c.eval("({ stub:!!window.__gmStub, site:window.__zhxTestSite, tables:window.__zhxTestTables, manifest:!!localStorage.getItem('gm:zhx.v3.manifest'), keys:Object.keys(localStorage).filter((k)=>k.startsWith('gm:')).map((k)=>k.slice(3,70)), diag:typeof window.__zhxDiagRecord })").catch((e) => ({ error:e.message }));
  console.log(`  [${label}] V3 状态诊断:`, JSON.stringify(state));
  console.log(`  [${label}] 脚本日志:`, c.consoleLines.filter((l) => l.includes('TEST') || l.includes('zhx') || l.includes('error')).slice(-8).join(' | '));
  return { t, c, reinjected: injCount > 1, timeout: true };
}

async function probe(c) {
  try {
    return await c.eval(`(() => {
      if (!document.body) return { noBody: true, hasFix: false, hasNew: false, randLeft: -1, qContext: '(no body)', hits: window.__mockHits || {}, dictCached: false, dictSha: '' };
      const parts = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) parts.push(w.currentNode.nodeValue || '');
      const joined = parts.join('\\n');
      const dictKey = Object.keys(localStorage).find((k) => k.startsWith('gm:zhx.v3.f.fc.dict.'));
      const dictEntry = dictKey ? localStorage.getItem(dictKey) || '' : '';
      const opts = [...document.querySelectorAll('option')].map((o) => (o.textContent || '').trim());
      const qc = (joined.match(/.{0,26}装备系列Q.{0,26}/) || [''])[0].replace(/\\s+/g, ' ');
      return {
        noBody: false,
        hasFix: joined.indexOf('装备系列Q') >= 0,
        hasNew: joined.indexOf('随机Q') >= 0,
        randLeft: opts.filter((s) => s.indexOf('ランダム') >= 0).length,
        qContext: qc,
        hits: window.__mockHits || {},
        dictCached: !!dictKey,
        dictSha: dictEntry.slice(0, dictEntry.indexOf(String.fromCharCode(10))),
      };
    })()`);
  } catch (e) {
    return { noBody: true, hasFix: false, hasNew: false, randLeft: -1, qContext: '(eval fail: ' + e.message.slice(0, 80) + ')', hits: {}, dictCached: false, dictSha: '' };
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
  const r = timeout ? await probe(c) : await waitBoth(c, 40);
  console.log('  mock 命中:', JSON.stringify(r.hits), '｜上下文:', JSON.stringify(r.qContext));
  ok('A1 修正重译：旧译「装备系列」→「装备系列Q」', r.hasFix);
  ok('A2 新增词补扫：「ランダム」→「随机Q」', r.hasNew);
  ok('A3 旧文本无残留（option 无「ランダム」）', r.randLeft === 0, `残留 ${r.randLeft}`);
  ok('A4 V3 manifest 与字典文件已下载', r.hits.manifest > 0 && r.hits.dict > 0, JSON.stringify(r.hits));
  ok('A5 更新词典写入 SHA 内容寻址缓存', r.dictCached && r.dictSha === dictSha);
  ok('A6 请求均来自 V3 manifest 与当前站点文件', r.hits && r.hits.unexpected && r.hits.unexpected.length === 0, JSON.stringify(r.hits.unexpected));
  await closePage(PORT, t.target.id);
}

console.log('╔══ 场景 B：缓存路径（不清缓存，fresh 直接用缓存）══╗');
{
  const { t, c, timeout } = await bootPage(false, 'B');
  if (timeout) console.log('  ⚠️ 就绪等待超时');
  const r = timeout ? await probe(c) : await waitBoth(c, 40);
  console.log('  mock 命中:', JSON.stringify(r.hits));
  ok('B1 修正重译（缓存数据同样生效）', r.hasFix);
  ok('B2 新增词补扫（缓存数据同样生效）', r.hasNew);
  ok('B3 旧文本无残留', r.randLeft === 0, `残留 ${r.randLeft}`);
  ok('B4 再次运行命中缓存且无数据网络请求', r.hits.manifest === 0 && r.hits.dict === 0 && r.hits.files === 0, JSON.stringify(r.hits));
  ok('B5 没有未预期的请求', r.hits && r.hits.unexpected && r.hits.unexpected.length === 0, JSON.stringify(r.hits.unexpected));
  await closePage(PORT, t.target.id);
}

console.log();
console.log(`总计: ${pass} 通过 / ${fail} 失败`);
await new Promise((resolve) => pageServer.close(resolve));
process.exit(fail ? 1 : 0);
