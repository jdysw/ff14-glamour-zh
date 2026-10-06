// check-fc-banners.mjs — fc 首页 6 条 banner 实测（v1.1.4 语序修复验证）
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';

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

const EXPECT = [
  '前往装备特辑一览',
  // 「装備パーツごとの一覧へ」在源 HTML 注释中不渲染（2026-10-05 核实）——不列入页面断言
  '前往装备系列一览',
  '前往武器一览',
  '前往发型图鉴一览',
  '前往时尚配饰一览',
];

const t = await newPage(PORT, 'about:blank');
const c = t.cdp;
await c.send('Network.enable');
await c.send('Network.setBlockedURLs', {
  urls: ['*googleapis.com*', '*gstatic.com*', '*typesquare.com*', '*cdnjs.cloudflare.com*',
         '*twitter.com*', '*valuecommerce.com*', '*doubleclick.net*', '*google-analytics*',
         '*googletagmanager*', '*google.com*', '*facebook.net*', '*facebook.com*'],
});
await c.send('Page.navigate', { url: 'https://ff14-fc.com/' });
let bodyOk = false;
for (let i = 0; i < 25; i++) {
  await sleep(3000);
  const st = await c.eval(`(() => ({ len: document.body ? document.body.innerText.length : 0 }))()`).catch(() => ({}));
  if (st && st.len > 50) { bodyOk = true; console.log(`body 就绪（${3 * (i + 1)}s）`); break; }
}
if (!bodyOk) console.log('⚠️ body 超时');
await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
await c.eval(gmStub);
await c.eval(wrap(GF));
for (let i = 0; i < 50; i++) {
  await sleep(1500);
  const st = await c.eval(`({ jp: !!localStorage.getItem('gm:zhx.dt.items'), se: !!localStorage.getItem('gm:zhx.dt.series') })`).catch(() => ({}));
  if (st && st.jp && st.se) { console.log('数据就绪 ✓'); break; }
}
await sleep(8000);

const r = await c.eval(`(() => {
  const links = [...document.querySelectorAll('a')].map((a) => (a.textContent || '').replace(/\\s+/g, ' ').trim());
  const bannerish = [...new Set(links.filter((t) => t.includes('一览') || t.includes('一覧')))];
  const all = document.body.innerText;
  const badSamples = (all.match(/[^\\n]{0,25}の前往[^\\n]{0,25}/g) || []).slice(0, 5);
  const badJp = (all.match(/[^\\n]{0,25}一覧[^\\n]{0,25}/g) || []).slice(0, 8);
  return { bannerish, hasNoChien: all.includes('の前往'), badSamples, badJp };
})()`);

console.log('══ 页面含「一览」的链接文本 ══');
console.log(JSON.stringify(r.bannerish, null, 1));
let pass = 0, fail = 0;
for (const e of EXPECT) {
  if (r.bannerish.some((t) => t.includes(e))) { console.log('  ✅', e); pass++; }
  else { console.log('  ❌ 未找到:', e); fail++; }
}
console.log('── 反例检查 ──');
if (r.hasNoChien) { console.log('  ❌ 仍含「の前往」:', JSON.stringify(r.badSamples)); fail++; }
else console.log('  ✅ 无「の前往」残留');
if (r.badJp.length) console.log('  ⚠️ 仍含「一覧」字符的文本:', JSON.stringify(r.badJp));
else console.log('  ✅ 无「一覧」残留');

console.log(`\n═══ 结果: ${pass} 通过 / ${fail} 失败 ═══`);
await closePage(PORT, t.target.id);
process.exit(fail ? 1 : 0);
