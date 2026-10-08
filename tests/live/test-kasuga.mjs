// test-kasuga.mjs — v1.2.1 修复验证
// A（kasuga 页）：① 5 个 lodestone 外链 → huijiwiki ② href 指向「物品:理想化的春日××」
//   ③ 页面文本汉化「理想化的春日」≥5 ④ h3 无「半頬/長羽織/筒袴/草履/篭手」残留
// B（phantom 页回归）：灰机链接 ≥5、无「ファントムヴィジョン」残留
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';
import { CLEAN_BODY_TEXT } from '../helpers/clean-text.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => {
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;
const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

async function probe(url) {
  const t = await newPage(PORT, 'about:blank');
  const c = t.cdp;
  await c.send('Network.enable');
  await c.send('Network.setBlockedURLs', {
    urls: ['*googleapis.com*', '*gstatic.com*', '*typesquare.com*', '*cdnjs.cloudflare.com*',
           '*twitter.com*', '*valuecommerce.com*', '*doubleclick.net*', '*google-analytics*',
           '*googletagmanager*', '*google.com*', '*facebook.net*', '*facebook.com*'],
  });
  await c.send('Page.navigate', { url });
  for (let i = 0; i < 25; i++) {
    await sleep(3000);
    const st = await c.eval(`(() => ({ len: document.body ? document.body.innerText.length : 0 }))()`).catch(() => ({}));
    if (st && st.len > 50) break;
  }
  await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
  await c.eval(gmStub);
  await c.eval(wrap(GF));
  for (let i = 0; i < 50; i++) {
    await sleep(1500);
    const st = await c.eval(`({ jp: !!localStorage.getItem('gm:zhx.dt.items') })`).catch(() => ({}));
    if (st && st.jp) break;
  }
  await sleep(8000);
  const r = await c.eval(`(() => {
    const out = {};
    const T = ${CLEAN_BODY_TEXT};
    const wiki = [...document.querySelectorAll('a[href*="huijiwiki.com"]')];
    out.wikiCount = wiki.length;
    out.wikiHrefs = wiki.map((a) => decodeURIComponent(a.getAttribute('href') || '')).slice(0, 8);
    out.wikiTexts = wiki.map((a) => (a.textContent || '').trim()).slice(0, 8);
    out.zhKasuga = (T.match(/理想化的春日/g) || []).length;
    const h3s = [...document.querySelectorAll('h3')].map((h) => (h.textContent || '').trim());
    out.h3 = h3s;
    out.h3Left = h3s.filter((s) => /半頬|長羽織|筒袴|草履|篭手|【想】の/.test(s) && !/理想化/.test(s)).length;
    out.kanaLeft = (T.match(/ファントムヴィジョン/g) || []).length;
    return out;
  })()`);
  await closePage(PORT, t.target.id);
  return r;
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); } };

console.log('╔══ A: equipment/idealized_kasuga（v1.2.1 修复）══╗');
const A = await probe('https://ff14-fc.com/equipment/idealized_kasuga/');
console.log('  灰机链接:', A.wikiCount, '｜「理想化的春日」:', A.zhKasuga, '次');
console.log('  href 样本:', JSON.stringify(A.wikiHrefs.slice(0, 3), null, 1));
console.log('  h3:', JSON.stringify(A.h3, null, 1));
ok('A1 灰机链接 ≥ 5（修复前 0）', A.wikiCount >= 5, `实际 ${A.wikiCount}`);
ok('A2 href 指向「物品:理想化的春日××」', A.wikiHrefs.filter((h) => h.indexOf('物品:理想化的春日') >= 0).length >= 5);
ok('A3 页面文本「理想化的春日」≥ 5', A.zhKasuga >= 5, `实际 ${A.zhKasuga}`);
ok('A4 h3 无日文残留（半頬/長羽織/筒袴/草履/篭手）', A.h3Left === 0, `残留 ${A.h3Left} 个: ${JSON.stringify(A.h3.filter((s) => /半頬|長羽織|筒袴|草履|篭手/.test(s)))}`);

console.log('╔══ B: equipment/phantom_vision_of_casting（回归）══╗');
const B = await probe('https://ff14-fc.com/equipment/phantom_vision_of_casting/');
console.log('  灰机链接:', B.wikiCount, '｜「ファントムヴィジョン」残留:', B.kanaLeft);
ok('B1 灰机链接 ≥ 5（保持）', B.wikiCount >= 5, `实际 ${B.wikiCount}`);
ok('B2 无「ファントムヴィジョン」残留', B.kanaLeft === 0, `实际 ${B.kanaLeft}`);

console.log();
console.log(`总计: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
