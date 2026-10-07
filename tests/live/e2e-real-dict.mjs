// e2e-real-dict.mjs — 真实环境 e2e：真 dist + 真数据站（zhixia-data.pages.dev）拉取 v3 数据链
// 验证：① v3 manifest + 站点文件（含 dict）真下载并写入缓存（zhx.v3.f.fc.*）② dict 结构完整
//       ③ 页面翻译正常。v3 已上线（2026-10-06）：fc 站以 v3 链为首选路径，v2 为回退。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();

const gmStub = `(() => {
  if (window.__gmStub) return; window.__gmStub = true;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.__net = [];
  window.GM_xmlhttpRequest = (opt) => {
    fetch(opt.url).then((r) => r.text().then((t) => {
      try { window.__net.push({ url: opt.url.slice(0, 90), status: r.status, len: t.length }); } catch (e) {}
      try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {}
    })).catch((e) => { try { window.__net.push({ url: opt.url.slice(0, 90), status: 'ERR' }); } catch (e2) {} try { opt.onerror && opt.onerror(e); } catch (e2) {} });
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
await c.send('Page.navigate', { url: 'https://ff14-fc.com/equipment_series_search/' });
let stable = 0, lastLen = -1;
for (let i = 0; i < 40; i++) {
  await sleep(2500);
  let st = null;
  try { st = await c.eval(`(() => { const b = document.body; return { len: (b && b.innerText) ? b.innerText.length : -1 }; })()`); } catch (e) {}
  const len = st ? st.len : -1;
  if (len > 200 && len === lastLen) { stable++; if (stable >= 2) break; } else stable = 0;
  lastLen = len;
}
console.log(`  body 稳定（len=${lastLen}）`);
await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
await c.eval(gmStub);
await c.eval(wrap(GF));

let dictOk = false;
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  const st = await c.eval(`({ v3dict: !!localStorage.getItem('gm:zhx.v3.f.fc.dict'), man: !!localStorage.getItem('gm:zhx.v3.manifest') })`).catch(() => null);
  if (st && st.v3dict) { dictOk = true; if (st.man) break; }
}
await sleep(6000);

const r = await c.eval(`(() => {
  const dictRaw = localStorage.getItem('gm:zhx.v3.f.fc.dict') || '';
  const manRaw = localStorage.getItem('gm:zhx.v3.manifest') || '';
  const v3Keys = Object.keys(localStorage).filter((k) => k.startsWith('gm:zhx.v3.f.fc.'));
  const parts = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) parts.push(w.currentNode.nodeValue || '');
  const joined = parts.join('\\n');
  let dictInfo = null;
  try {
    const body = dictRaw.slice(dictRaw.indexOf('\\n') + 1);
    const d = JSON.parse(body);
    dictInfo = { layers: Object.keys(d), fcLen: d.fc ? Object.keys(d.fc).length : 0 };
  } catch (e) { dictInfo = { err: String(e).slice(0, 120) }; }
  return {
    net: window.__net || [],
    dictCached: !!dictRaw,
    dictLen: dictRaw.length,
    dictInfo,
    manOk: manRaw.length > 10,
    v3KeyCount: v3Keys.length,
    pageHas系列: joined.indexOf('装备系列') >= 0,
    kanaLeft: (joined.match(/[\\u30A1-\\u30FA]{2,}/g) || []).length,
  };
})()`);

console.log('  网络请求:', JSON.stringify(r.net, null, 1));
console.log('  dict 缓存（v3）:', r.dictCached, '| 长度:', r.dictLen);
console.log('  dict 结构:', JSON.stringify(r.dictInfo));
console.log('  manifest 缓存:', r.manOk, '| v3 站点文件键数:', r.v3KeyCount);
console.log('  页面「装备系列」:', r.pageHas系列, '| 残留假名串:', r.kanaLeft);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); } };
ok('R1 v3 dict 真站下载并写缓存（zhx.v3.f.fc.dict）', r.dictCached && r.dictLen > 40000, `len=${r.dictLen}`);
ok('R2 dict 结构完整（6 层、fc 692 条）', r.dictInfo && r.dictInfo.fcLen === 692 && r.dictInfo.layers && r.dictInfo.layers.length === 6, JSON.stringify(r.dictInfo));
ok('R3 v3 缓存写入（manifest + 站点文件 ≥5）', r.manOk && r.v3KeyCount >= 5, `man=${r.manOk} keys=${r.v3KeyCount}`);
ok('R4 页面翻译正常（含「装备系列」）', r.pageHas系列);
console.log();
console.log(`总计: ${pass} 通过 / ${fail} 失败`);
await closePage(PORT, t.target.id);
process.exit(fail ? 1 : 0);
