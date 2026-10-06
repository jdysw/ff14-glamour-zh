// ACL 站（ffxivcollection.com）真站测试 · 阶段2：详情页（装备名翻译 + wiki 链接机制）
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();
const DETAIL = 'https://www.ffxivcollection.com/quetzalli-jacket-of-striking/?nav=1&';

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
await c.send('Page.navigate', { url: DETAIL });
console.log('导航详情页 ...');
let bodyOk = false;
for (let i = 0; i < 20; i++) {
  await sleep(3000);
  const st = await c.eval(`({ ready: document.readyState, len: document.body ? document.body.innerText.length : 0 })`).catch(() => ({}));
  if (st && st.len > 50) { bodyOk = true; console.log(`body 就绪（${3 * (i + 1)}s）: len=${st.len}`); break; }
}
if (!bodyOk) console.log('⚠️ body 等待超时');
await c.eval(gmStub);
const t0 = Date.now();
await c.eval(wrap(GF));
await sleep(7000);

const r = await c.eval(`(() => {
  const T = document.body ? document.body.innerText : '';
  const has = (s) => T.indexOf(s) >= 0;
  const ja = (T.match(/[\\u3040-\\u30ff]/g) || []).length;
  const h = (sel) => { const e = document.querySelector(sel); return e ? (e.textContent || '').trim().slice(0, 80) : null; };
  const ui = {
    '规格': has('规格'), '残留 スペック': has('スペック'),
    '职业 / 特职': has('职业 / 特职'), '残留 クラス': has('クラス'),
  };
  // lodestone 链接机制采样
  const ld = [];
  for (const a of document.querySelectorAll('a[href*="lodestone"], a[href*="huijiwiki"]')) {
    if (ld.length >= 8) break;
    const img = a.querySelector('img');
    ld.push({
      href: (a.getAttribute('href') || '').slice(0, 90),
      text: (a.textContent || '').trim().slice(0, 30),
      title: a.getAttribute('title') || '',
      imgAlt: img ? img.getAttribute('alt') || '' : null,
      imgSrc: img ? (img.getAttribute('src') || '').slice(-40) : null,
    });
  }
  const samples = [];
  const els = document.querySelectorAll('h1,h2,h3,h4,a,p,span,li');
  for (const el of els) {
    if (samples.length >= 14) break;
    const s = (el.textContent || '').trim();
    if (s && s.length >= 2 && s.length <= 40 && /[\\u3040-\\u30ff]/.test(s)) samples.push(s);
  }
  return { title: document.title.slice(0, 100), h1: h('h1'), jaCount: ja, ui, ld, samples, reqUrls: (window.__reqLog || []) };
})()`);
console.log('\n--- 结果 ---');
console.log(JSON.stringify(r, null, 1));
console.log('\nconsole:', c.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join(' | ').slice(0, 800));
await closePage(PORT, t.target.id);
process.exit(0);
