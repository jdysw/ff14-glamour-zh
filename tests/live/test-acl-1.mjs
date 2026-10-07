// ACL 站（ffxivcollection.com）真站测试 · 阶段1：主页（Phase 20：断言强化）
// 覆盖：数据加载（v3 collection 文件集；回退 v2）+ 界面词翻译
// 断言：数据键 / 界面词 / 残留反例 / 请求数 / 无注入错误（dump 保留供诊断）
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';

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

const t = await newPage(PORT, 'https://www.ffxivcollection.com/');
const c = t.cdp;
console.log('导航 ACL 主页 ...');
let bodyOk = false;
for (let i = 0; i < 20; i++) {
  await sleep(3000);
  const st = await c.eval(`({ ready: document.readyState, len: document.body ? document.body.innerText.length : 0 })`).catch(() => ({}));
  if (st && st.len > 50) { bodyOk = true; console.log(`body 就绪（${3 * (i + 1)}s）: len=${st.len}`); break; }
}
if (!bodyOk) console.log('⚠️ body 等待超时');

await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.indexOf('gm:') === 0) localStorage.removeItem(k); return 1; })()`);
await c.eval(gmStub);
const t0 = Date.now();
await c.eval(wrap(GF));
console.log('脚本已注入，等待数据 ...');
let done = false;
for (let i = 0; i < 60; i++) {
  await sleep(1500);
  const st = await c.eval(`({ v3n: !!(localStorage.getItem('gm:zhx.v3.f.collection.names')), meta: !!localStorage.getItem('gm:zhx.meta') })`).catch(() => ({}));
  if (st && (st.v3n || st.meta)) { done = true; console.log(`数据完成（${((Date.now() - t0) / 1000).toFixed(1)}s）:`, JSON.stringify(st)); break; }
}
if (!done) console.log('⚠️ 数据等待超时');
await sleep(6000);

const r = await c.eval(`(() => {
  const T = document.body ? document.body.innerText : '';
  const has = (s) => T.indexOf(s) >= 0;
  let ja = 0; for (const ch of T) { const cc = ch.codePointAt(0); if (cc >= 0x3040 && cc <= 0x30ff) ja++; }
  const ui = {
    '职业 / 特职': has('职业 / 特职'),
    '残留 クラス / ジョブ': has('クラス / ジョブ'),
    '残留 アイテム': has('アイテム'),
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
    title: document.title,
    jaCount: ja, ui, samples,
    stKeys: Object.keys(localStorage).filter((k) => k.indexOf('gm:') === 0).map((k) => k + '=' + String(localStorage.getItem(k)).length),
    data: {
      v3n: String(localStorage.getItem('gm:zhx.v3.f.collection.names') || '').length,
      v3s: String(localStorage.getItem('gm:zhx.v3.f.collection.series') || '').length,
      v3a: String(localStorage.getItem('gm:zhx.v3.f.collection.acl') || '').length,
      meta: !!localStorage.getItem('gm:zhx.meta'),
    },
  };
})()`);
console.log('\n--- 结果 ---');
console.log(JSON.stringify(r, null, 1).slice(0, 3200));
console.log('\nconsole:', c.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join(' | ').slice(0, 900));

console.log('\n--- 断言 ---');
const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
const checks = [
  ['① 数据流程（v3 或回退键）', r.data.v3n > 0 || r.data.meta, JSON.stringify(r.data)],
  ['② 界面词 职业 / 特职', r.ui['职业 / 特职'] === true],
  ['③ 无「クラス / ジョブ」残留', r.ui['残留 クラス / ジョブ'] === false],
  ['④ 无「アイテム」残留', r.ui['残留 アイテム'] === false],
  ['⑤ 下载请求 ≥ 4', r.reqUrls.length >= 4, '实际 ' + r.reqUrls.length],
  ['⑥ 含 collection 数据文件请求或 v3 键', r.reqUrls.some((u) => u.indexOf('/collection/') >= 0) || r.data.v3s > 0, JSON.stringify(r.reqUrls.slice(0, 8))],
  ['⑦ 无 [TEST-INJECT] 错误', !testErr],
];
let pass = 0;
for (const [name, okf, extra] of checks) {
  console.log((okf ? '✅' : '❌') + ' ' + name + (okf || !extra ? '' : '  实际: ' + extra));
  if (okf) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);
await closePage(PORT, t.target.id);
process.exit(pass === checks.length ? 0 : 1);
