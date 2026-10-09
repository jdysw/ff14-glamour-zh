// EC 夹具测试：物品翻译链 5 条通道（链接/纯文本/卡片/染剂/占位符）
// 预置 items 缓存 → 快速路径（零网络）→ 数据就绪 → applyItemZh 全链路
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { seedV3Browser } from '../helpers/v3-cache.mjs';
import { readDist, itemsTsvPath, fixtureUrl, cachePath } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const FIXTURE = fixtureUrl('ec-page.html');

const s = readDist();
fs.writeFileSync(cachePath('gf-ec-test.user.js'), s);
const GF = s;
console.log('测试副本已生成（hook 已内建于 src）');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.__reqLog = [];
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? (k === 'zhx.data.refresh.epoch' ? 'v3-only-1-force-refresh' : d) : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) { window.__setFail = (window.__setFail || 0) + 1; } };
  window.GM_xmlhttpRequest = (opt) => {
    window.__reqLog.push(opt.url);
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const ZH = '特罗亚精准缠头巾';
const WIKI = 'https://ff14.huijiwiki.com/wiki/物品:' + encodeURIComponent(ZH);

const dump = `(() => {
  const a = document.querySelector('a.eorzeadb_link');
  const pal = document.querySelector('a.has-text-rarity-4') || document.querySelector('span.has-text-rarity-4');
  const card = document.querySelector('p.title.has-text-text.is-5');
  const dye = document.querySelector('div.tag');
  const ph = document.querySelector('input[placeholder]');
  return {
    link: a ? { text: (a.textContent || '').trim(), href: a.getAttribute('href') } : null,
    plain: pal ? { tag: pal.tagName, text: (pal.textContent || '').trim(), href: pal.getAttribute('href') } : null,
    card: card ? { text: (card.textContent || '').trim(), flag: card.dataset.zhixiaCard || '' } : null,
    dyes: [...document.querySelectorAll('div.tag, span.tag')].map((d) => (d.textContent || '').trim()),
    ph: ph ? ph.getAttribute('placeholder') : null,
    attrs: (() => { const n = document.querySelector('img.nav-ic'); return n ? { alt: n.getAttribute('alt'), aria: n.getAttribute('aria-label'), title: n.getAttribute('title') } : null; })(),
    reqUrls: (window.__reqLog || []),
  };
})()`;

const itemsTsv = fs.readFileSync(itemsTsvPath, 'utf8');
const FP = 'testfp000001';
const setCache = (k, v) => c.callFn('function (key, value) { localStorage.setItem(key, value); return 1; }', [k, v]);

const t = await newPage(PORT, FIXTURE);
const c = t.cdp;
await sleep(800);
await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); localStorage.setItem('gm:zhx.data.refresh.epoch', 'v3-only-1-force-refresh'); return 1; })()`);
// v3 探测节流（v1.4 Phase 12）：预置 v3 manifest 缓存（本站不在其中 → v3 静默跳过；24h 内不再探测）→ 零网络成立
await c.eval("window.__zhxTestSite = 'ec';");
await seedV3Browser(c, 'ec');
await c.eval("window.__zhxTestTables = ['items'];" );
await c.eval(gmStub);
await c.eval(wrap(GF));
await sleep(9000);
const r = await c.eval(dump);
console.log('\n--- 结果 ---');
console.log(JSON.stringify(r, null, 1));

// Phase 20：卡片点击 → 灰机 wiki（window.open 捕获；zhApplyCards 绑定）
await c.eval(`(() => {
  window.__opened = [];
  window.open = (u) => { window.__opened.push(String(u)); return null; };
  const card = document.querySelector('p.title.has-text-text.is-5');
  if (card) card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return 1;
})()`);
await sleep(600);
const opened = await c.eval(`window.__opened || []`);

console.log('\n--- 断言 ---');
const checks = [
  ['① 链接文本 → 中文', r.link && r.link.text === ZH, r.link && r.link.text],
  ['① 链接 href → wiki', r.link && r.link.href === WIKI, r.link && r.link.href],
  ['② 纯文本风 span → a 标签', r.plain && r.plain.tag === 'A', r.plain && r.plain.tag],
  ['② 纯文本 → 中文', r.plain && r.plain.text === ZH, r.plain && r.plain.text],
  ['② href → wiki', r.plain && r.plain.href === WIKI, r.plain && r.plain.href],
  ['③ 卡片标题 → 中文', r.card && r.card.text === ZH, r.card && r.card.text],
  ['③ 卡片标记', r.card && r.card.flag === '1', r.card && r.card.flag],
  ['④ 染剂全名 → 中文', r.dyes && r.dyes[0] === '⬤ 深渊蓝染剂', r.dyes && r.dyes[0]],
  ['④b 色名回退 → 中文', r.dyes && r.dyes[1] === '⬤ 油墨蓝染剂', r.dyes && r.dyes[1]],
  ['⑤ 占位符 → 中文', r.ph === '按标题搜索', r.ph],
  ['⑥ 零网络（缓存路径）', r.reqUrls.length === 0, JSON.stringify(r.reqUrls)],
  ['⑦ 卡片点击 → 灰机 wiki', opened.length >= 1 && opened[0] === WIKI, JSON.stringify(opened)],
  ['⑧ alt 属性 → 加载中…', r.attrs && r.attrs.alt === '加载中…', JSON.stringify(r.attrs)],
  ['⑨ aria-label 属性 → 第 2 页', r.attrs && r.attrs.aria === '第 2 页', JSON.stringify(r.attrs)],
  ['⑩ title 属性 → 5 点赞', r.attrs && r.attrs.title === '5 点赞', JSON.stringify(r.attrs)],
];
let pass = 0;
for (const [name, ok, got] of checks) {
  console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : '  实际: ' + JSON.stringify(got)));
  if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);
console.log('\nconsole:', c.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join(' | ').slice(0, 900));
await closePage(PORT, t.target.id);
process.exit(pass === checks.length ? 0 : 1);
