// ACL 站 详情页（装备名翻译 + wiki 链接机制 + 装备名点击）· 阶段2（Phase 20：断言强化）
// 断言：标题汉化 / 界面词 / lodestone 链接全替换（零残留） / data-zhx-item 标记 /
//       点击装备名 → window.open 灰机 wiki（捕获式） / 无注入错误
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';
import { CLEAN_BODY_TEXT } from '../helpers/clean-text.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();
const DETAIL = 'https://www.ffxivcollection.com/quetzalli-jacket-of-striking/?nav=1&';
const WIKI_ITEM = 'https://ff14.huijiwiki.com/wiki/物品:';

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
// 初始等 7s，再轮询至替换完成（对抗页面加载波动与偶发竞态；上限约 37s）
// 背景：2026-10-08 复跑实测「护腿」卡偶发晚于 7s 窗口完成（探针显示正常时 5s 内全完成）
for (let i = 0; i < 12; i++) {
  await sleep(i === 0 ? 7000 : 2500);
  const left = await c.eval(`document.querySelectorAll('a[href*="lodestone"]').length`).catch(() => -1);
  if (left === 0) break;
}

const r = await c.eval(`(() => {
  const T = ${CLEAN_BODY_TEXT};
  const has = (s) => T.indexOf(s) >= 0;
  let ja = 0; for (const ch of T) { const cc = ch.codePointAt(0); if (cc >= 0x3040 && cc <= 0x30ff) ja++; }
  const h = (sel) => { const e = document.querySelector(sel); return e ? (e.textContent || '').trim().slice(0, 80) : null; };
  const ui = {
    '规格': has('规格'), '残留 スペック': has('スペック'),
    '职业 / 特职': has('职业 / 特职'), '残留 クラス': has('クラス'),
  };
  // lodestone / huijiwiki 链接机制采样
  const ld = [];
  for (const a of document.querySelectorAll('a[href*="lodestone"], a[href*="huijiwiki"]')) {
    if (ld.length >= 10) break;
    const img = a.querySelector('img');
    ld.push({
      href: decodeURIComponent(a.getAttribute('href') || '').slice(0, 110),
      text: (a.textContent || '').trim().slice(0, 30),
      title: a.getAttribute('title') || '',
      imgAlt: img ? img.getAttribute('alt') || '' : null,
    });
  }
  const ldLeft = document.querySelectorAll('a[href*="lodestone"]').length;
  const zhx = [...document.querySelectorAll('[data-zhx-item]')].map((x) => (x.dataset.zhxItem || '').slice(0, 50));
  const samples = [];
  for (const el of document.querySelectorAll('h1,h2,h3,h4,a,p,span,li')) {
    if (samples.length >= 12) break;
    const s = (el.textContent || '').trim();
    if (s && s.length >= 2 && s.length <= 40 && /[\u3040-\u30ff]/.test(s)) samples.push(s);
  }
  return { title: document.title.slice(0, 110), h1: h('h1'), jaCount: ja, ui, ld, ldLeft, zhx, samples, reqUrls: (window.__reqLog || []) };
})()`);
console.log('\n--- 结果 ---');
console.log(JSON.stringify(r, null, 1).slice(0, 3600));

// ── 点击装备名 → window.open 捕获 ──
await c.eval(`(() => {
  window.__opened = [];
  window.open = (u) => { window.__opened.push(String(u)); return null; };
  const el = document.querySelector('[data-zhx-item]');
  if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return 1;
})()`);
await sleep(700);
const opened = await c.eval(`window.__opened || []`);
const firstZh = r.zhx[0] || '';
const expectOpen = WIKI_ITEM + encodeURIComponent(firstZh);
console.log('\n点击捕获:', JSON.stringify(opened), '期望首条:', expectOpen);

console.log('\n--- 断言 ---');
const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
const checks = [
  ['① 标题已汉化且无假名残留', r.title.indexOf('FFXIV ARMOURY COLLECTION') >= 0 && !/[\u3040-\u30ff]/.test(r.title), r.title],
  ['② 界面词 规格 / 职业 / 特职', r.ui['规格'] === true && r.ui['职业 / 特职'] === true],
  ['③ 无「スペック」「クラス」残留', r.ui['残留 スペック'] === false && r.ui['残留 クラス'] === false],
  ['④ lodestone 链接零残留（全部替换）', r.ldLeft === 0, '剩 ' + r.ldLeft],
  ['⑤ 灰机链接 ≥ 3 且指向「物品:」', r.ld.filter((x) => x.href.indexOf('/wiki/物品:') >= 0).length >= 3, JSON.stringify(r.ld.slice(0, 2))],
  ['⑥ 灰机链接含中文名（如 绿咬鹃）', r.ld.some((x) => /绿咬鹃/.test(x.href + x.title + x.text)), JSON.stringify(r.ld.slice(0, 1))],
  ['⑦ data-zhx-item 标记 ≥ 3 条', r.zhx.length >= 3, '实际 ' + r.zhx.length],
  ['⑧ 点击装备名 → window.open 灰机 wiki', opened.length >= 1 && opened[0] === expectOpen, JSON.stringify(opened)],
  ['⑨ 无 [TEST-INJECT] 错误', !testErr],
];
let pass = 0;
for (const [name, okf, extra] of checks) {
  console.log((okf ? '✅' : '❌') + ' ' + name + (okf || !extra ? '' : '  实际: ' + extra));
  if (okf) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);
console.log('\nconsole:', c.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join(' | ').slice(0, 800));
await closePage(PORT, t.target.id);
process.exit(pass === checks.length ? 0 : 1);
