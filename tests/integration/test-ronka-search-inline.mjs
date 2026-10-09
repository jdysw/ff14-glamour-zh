// tests/integration/test-ronka-search-inline.mjs — 1.4.2 后续修复（b 方案）：ronka 独立搜索框（无 form）（离线夹具）
//
// 背景：lookbook.ronkacloset.com（React SPA）的搜索框不属于任何 form，站点搜索是「输入即出建议面板」
//       的本地过滤，无提交事件可拦截；中文输入 →「검색 결과가 없어요」（真站实测 2026-10-07）。
//       b 方案（2026-10-08）：输入停顿不再自动转换（禁止输入即搜索）；点选候选面板才做
//       「转换式搜索」（原生名触发站内检索），随后输入框显示恢复为中文。
// 本测试：用同构夹具（无 form 独立搜索框 + 普通表单搜索框作对照）冻结契约：
//   ① 独立搜索框出现智能候选面板（数据就绪门）；② 输入中文不自动转换；
//   ③ 点选候选：转换式搜索（派发原生名）且输入框保留中文；④ 表单内搜索框不触发独立转换。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { seedV3Browser } from '../helpers/v3-cache.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();
const FIXTURE = fixtureUrl('ronka-search.html');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? (k === 'zhx.data.refresh.epoch' ? 'v3-only-1-force-refresh' : d) : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => {
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const itemsTsv = fs.readFileSync(itemsTsvPath, 'utf8');
// 数据指纹行：与既有集成夹具（test-mirapri / test-chinese-search-submit）同源；缺少指纹会令缓存被视为过期。
const FP = 'testfp000001';
const EXPECT_ZH = '伴娘礼裙';
const expectKo = (() => {
  for (const ln of itemsTsv.split('\n')) {
    const p = ln.split('\t');
    if (p[1] === EXPECT_ZH) return p[4];
  }
  throw new Error('物品总表中未找到：' + EXPECT_ZH);
})();
console.log('期望韩文名:', expectKo);

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

const t = await newPage(PORT, FIXTURE);
const c = t.cdp;
await sleep(800);
await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.indexOf('gm:') === 0) localStorage.removeItem(k); return 1; })()`);
await c.eval("window.__zhxTestSite = 'ronka';");
await seedV3Browser(c, 'ronka');
await c.eval("window.__zhxTestTables = ['items'];");
await c.eval('window.__zhxDiagOn = true;');
await c.eval(gmStub);
// 观察装置：记录「转换式搜索派发的 input 事件」（值为候选韩文原生名的那一刻）
await c.eval(`(() => {
  window.__convEvt = false;
  document.addEventListener('input', function (e) {
    try { if (e && e.target && /[가-힣]/.test(String(e.target.value || ''))) window.__convEvt = true; } catch (x) {}
  }, true);
  return 1;
})()`);
await c.eval(wrap(GF));
await sleep(1500);

const setInline = (val) => c.callFn(
  'function (value) { const i = document.getElementById("search-input"); if (!i) throw new Error("Ronka search input missing"); i.focus(); i.value = value; i.dispatchEvent(new Event("input", { bubbles: true })); return 1; }',
  [val]);
const readInline = () => c.eval(`(() => { const i = document.getElementById('search-input'); return i ? i.value : null; })()`);

// ── 就绪门：输入「伴娘」→ 候选面板出现（数据就绪 + 功能装配），最多重试 30 次 ──
const suggestState = `(() => {
  const b = document.querySelector('#zhx-chinese-suggest-list');
  return b ? { hidden: b.hidden, n: b.querySelectorAll('button[data-zhx-index]').length } : null;
})()`;
let ready = null;
for (let i = 0; i < 30; i++) {
  await setInline('伴娘');
  await sleep(1000);
  ready = await c.eval(suggestState);
  if (ready && ready.hidden === false && ready.n > 0) break;
}
ok('① 独立搜索框出现智能候选面板（数据就绪门）', !!ready && ready.hidden === false && ready.n > 0, JSON.stringify(ready));

// ── ② 输入中文全名：不自动转换（b 方案：禁止输入即搜索）──
await setInline(EXPECT_ZH);
await sleep(1200);
const v2 = await readInline();
ok('② 输入中文全名后值保持原样（不自动转换）', v2 === EXPECT_ZH, JSON.stringify(v2));

// ── ③ 点选候选：转换式搜索（派发原生名）+ 输入框保留中文（b 方案）──
await setInline(EXPECT_ZH);
await sleep(700);
const picked = await c.eval(`(() => {
  const b = document.querySelector('#zhx-chinese-suggest-list');
  if (!b || b.hidden) return null;
  const btn = b.querySelector('button[data-zhx-index]');
  if (!btn) return null;
  const zhEl = btn.querySelector('.zhx-suggest-zh');
  const zhText = zhEl ? zhEl.textContent : btn.textContent;
  btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  return zhText;
})()`);
await sleep(800);
const v3 = await readInline();
ok('③ 点选候选后输入框保留中文（显示恢复）', picked !== null && v3 === picked, JSON.stringify({ picked, v3 }));
const convEvt = await c.eval('window.__convEvt === true').catch(() => false);
ok('③b 转换式搜索派发原生名 input（站内搜索生效）', convEvt === true, String(convEvt));

// ── ④ 未知中文名不转换 ──
await setInline('不存在的装备名称xyz');
await sleep(1300);
const v4 = await readInline();
ok('④ 未知中文名保持原样', v4 === '不存在的装备名称xyz', JSON.stringify(v4));

// ── ⑤ 表单内搜索框不走独立转换 ──
await c.callFn('function (value) { const i = document.querySelector(\'#legacy-search input[name="keyword"]\'); if (!i) throw new Error("Legacy search missing"); i.focus(); i.value = value; i.dispatchEvent(new Event("input", { bubbles: true })); return 1; }', [EXPECT_ZH]);
await sleep(1300);
const v5 = await c.eval(`(() => { const i = document.querySelector('#legacy-search input[name="keyword"]'); return i ? i.value : null; })()`);
ok('⑤ 表单内搜索框不触发独立转换（中文保留）', v5 === EXPECT_ZH, JSON.stringify(v5));

// ── ⑥ 部分词「女仆」：同样不自动转换（b 方案；部分词兜底仅保留在提交路径）──
await setInline('女仆');
await sleep(1600);
const v6 = await readInline();
ok('⑥ 部分词「女仆」输入停顿保持原样', v6 === '女仆', JSON.stringify(v6));

const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
ok('⑦ 无 [TEST-INJECT] 错误', !testErr);

console.log(`\n${pass} / ${pass + fail} 通过`);
await closePage(PORT, t.target.id);
process.exit(fail === 0 ? 0 : 1);
