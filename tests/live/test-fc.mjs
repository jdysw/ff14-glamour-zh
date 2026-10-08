// fc 站（ミラプリライフ）真站测试：GF 版端到端（Phase 20：dump → 断言强化）
// 覆盖：数据下载（v3 fc 文件集；回退 v2）→ 首扫 → 补扫（数据到后重扫）→ 界面词翻译
// 断言：数据键 / 界面词 3 项 / 无残留 2 项 / 请求数 / 无注入错误（全程 dump 保留供诊断）
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';
import { CLEAN_BODY_TEXT } from '../helpers/clean-text.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.__reqLog = [];
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) { window.__setFail = (window.__setFail || 0) + 1; } };
  window.GM_xmlhttpRequest = (opt) => {
    window.__reqLog.push(opt.url);
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const t = await newPage(PORT, 'about:blank');
const c = t.cdp;
await c.send('Network.enable');
await c.send('Network.setBlockedURLs', {
  urls: ['*googleapis.com*', '*gstatic.com*', '*typesquare.com*', '*cdnjs.cloudflare.com*',
         '*twitter.com*', '*valuecommerce.com*', '*doubleclick.net*', '*google-analytics*',
         '*googletagmanager*', '*google.com*', '*facebook.net*', '*facebook.com*'],
});
console.log('已设置外链阻断，导航 fc 站 ...');
await c.send('Page.navigate', { url: 'https://ff14-fc.com/' });

// 等 body 出现（fc 慢，最多 75 秒）
let bodyOk = false;
for (let i = 0; i < 25; i++) {
  await sleep(3000);
  const st = await c.eval(`(() => ({ ready: document.readyState, len: document.body ? document.body.innerText.length : 0 }))()`).catch(() => ({}));
  if (st && st.len > 50) { bodyOk = true; console.log(`body 就绪（${3 * (i + 1)}s）: len=${st.len}`); break; }
}
if (!bodyOk) console.log('⚠️ body 等待超时，继续注入试试');

// 清 gm 键 + 注入
await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.indexOf('gm:') === 0) localStorage.removeItem(k); return 1; })()`);
await c.eval(gmStub);
const t0 = Date.now();
await c.eval(wrap(GF));
console.log('脚本已注入，等待数据流程 ...');
let done = false;
for (let i = 0; i < 50; i++) {
  await sleep(1500);
  const st = await c.eval(`({ v3n: !!(localStorage.getItem('gm:zhx.v3.f.fc.names')), meta: !!localStorage.getItem('gm:zhx.meta'), jp: !!localStorage.getItem('gm:zhx.dt.items') })`).catch(() => ({}));
  if (st && (st.v3n || st.meta || st.jp)) { done = true; console.log(`数据流程完成（${((Date.now() - t0) / 1000).toFixed(1)}s）:`, JSON.stringify(st)); break; }
}
if (!done) console.log('⚠️ 数据等待超时');
await sleep(6000); // 留时间补扫

const r = await c.eval(`(() => {
  const T = ${CLEAN_BODY_TEXT};
  const has = (s) => T.indexOf(s) >= 0;
  let ja = 0; for (const ch of T) { const cc = ch.codePointAt(0); if (cc >= 0x3040 && cc <= 0x30ff) ja++; }
  const ui = {
    '按部位': has('按部位'), '系列': has('系列'), '发型图鉴': has('发型图鉴'),
    '残留 部位別': has('部位別'), '残留 ヘアカタログ': has('ヘアカタログ'),
  };
  const samples = [];
  const els = document.querySelectorAll('h1,h2,h3,h4,a,p,span,li,button,label');
  for (const el of els) {
    if (samples.length >= 12) break;
    const s = (el.textContent || '').trim();
    if (s && s.length >= 2 && s.length <= 40 && /[\u3040-\u30ff]/.test(s)) samples.push(s);
  }
  return {
    reqUrls: (window.__reqLog || []),
    jaCount: ja,
    ui, samples,
    stKeys: Object.keys(localStorage).filter((k) => k.indexOf('gm:') === 0).map((k) => k + '=' + String(localStorage.getItem(k)).length),
    data: {
      v3n: String(localStorage.getItem('gm:zhx.v3.f.fc.names') || '').length,
      v3s: String(localStorage.getItem('gm:zhx.v3.f.fc.series') || '').length,
      meta: !!localStorage.getItem('gm:zhx.meta'),
      jp: !!localStorage.getItem('gm:zhx.dt.items'),
    },
  };
})()`);
console.log('\n--- 结果 ---');
console.log(JSON.stringify(r, null, 1));
console.log('\n--- console（脚本/TEST）---');
console.log(c.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join('\n').slice(0, 1200));

console.log('\n--- 断言 ---');
const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
const checks = [
  ['① 数据流程（v3 names 或回退键）', r.data.v3n > 0 || r.data.meta || r.data.jp, JSON.stringify(r.data)],
  ['② 界面词 按部位', r.ui['按部位'] === true],
  ['③ 界面词 系列', r.ui['系列'] === true],
  ['④ 界面词 发型图鉴', r.ui['发型图鉴'] === true],
  ['⑤ 无「部位別」残留', r.ui['残留 部位別'] === false],
  ['⑥ 无「ヘアカタログ」残留', r.ui['残留 ヘアカタログ'] === false],
  ['⑦ 下载请求 ≥ 3', r.reqUrls.length >= 3, '实际 ' + r.reqUrls.length],
  ['⑧ 含 fc 数据文件请求或 v3 键', r.reqUrls.some((u) => u.indexOf('/fc/') >= 0) || r.data.v3s > 0, JSON.stringify(r.reqUrls.slice(0, 8))],
  ['⑨ 无 [TEST-INJECT] 错误', !testErr],
];
let pass = 0;
for (const [name, okf, extra] of checks) {
  console.log((okf ? '✅' : '❌') + ' ' + name + (okf || !extra ? '' : '  实际: ' + extra));
  if (okf) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);
await closePage(PORT, t.target.id);
process.exit(pass === checks.length ? 0 : 1);
