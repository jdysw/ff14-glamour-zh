// ACL 站（ffxivcollection.com）真站测试 · 阶段1：主页（数据加载 + 界面词 + 链接结构探测）
import fs from 'node:fs';
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

await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
await c.eval(gmStub);
const t0 = Date.now();
await c.eval(wrap(GF));
console.log('脚本已注入，等待数据 ...');
let done = false;
for (let i = 0; i < 60; i++) {
  await sleep(1500);
  const st = await c.eval(`({ meta: !!localStorage.getItem('gm:zhx.meta'), jp: !!localStorage.getItem('gm:zhx.dt.items'), se: !!localStorage.getItem('gm:zhx.dt.series'), acl: !!localStorage.getItem('gm:zhx.dt.acl') })`).catch(() => ({}));
  if (st && st.meta && st.jp && st.acl) { done = true; console.log(`数据完成（${((Date.now() - t0) / 1000).toFixed(1)}s）:`, JSON.stringify(st)); break; }
}
await sleep(6000);

const r = await c.eval(`(() => {
  const T = document.body ? document.body.innerText : '';
  const has = (s) => T.indexOf(s) >= 0;
  const ja = (T.match(/[\\u3040-\\u30ff]/g) || []).length;
  const ui = {
    '职业 / 特职': has('职业 / 特职'), '物品': has('物品'), '规格': has('规格'),
    '残留 クラス / ジョブ': has('クラス / ジョブ'), '残留 アイテム': has('アイテム'),
  };
  const hrefs = [];
  for (const a of document.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href') || '';
    if (h && h.length > 3 && !h.startsWith('#') && !h.startsWith('javascript') && !h.includes('twitter') && !h.includes('facebook')) {
      if (hrefs.indexOf(h) < 0) hrefs.push(h);
    }
    if (hrefs.length >= 40) break;
  }
  const samples = [];
  const els = document.querySelectorAll('h1,h2,h3,h4,a,p,span,li,button,label');
  for (const el of els) {
    if (samples.length >= 12) break;
    const s = (el.textContent || '').trim();
    if (s && s.length >= 2 && s.length <= 40 && /[\\u3040-\\u30ff]/.test(s)) samples.push(s);
  }
  return {
    reqUrls: (window.__reqLog || []),
    title: document.title,
    jaCount: ja, ui, hrefs, samples,
    stKeys: Object.keys(localStorage).filter((k) => k.startsWith('gm:')).map((k) => k + '=' + localStorage.getItem(k).length),
  };
})()`);
console.log('\n--- 结果 ---');
console.log(JSON.stringify(r, null, 1));
console.log('\nconsole:', c.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join(' | ').slice(0, 800));
await closePage(PORT, t.target.id);
process.exit(0);
