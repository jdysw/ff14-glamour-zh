// tests/integration/test-collection-search-inline.mjs — 1.4.2 后续修复（b 方案）：collection 独立搜索框（离线夹具）
//
// 背景：ffxivcollection.com 搜索框位于侧栏 widget、不属于任何 form；站内汉化会把
//       placeholder 改为「输入想查询的关键词」（不再含日文「キーワード」，真站实测
//       2026-10-07）。b 方案（2026-10-08）：输入停顿不再自动转换（禁止输入即搜索）；
//       点选候选面板才做「转换式搜索」（原生名触发站内检索），随后输入框显示恢复为中文。
// 本测试：以同构夹具（侧栏 widget 无 form 搜索框）冻结契约：
//   ① 独立搜索框出现智能候选面板（数据就绪门）；② 输入中文不自动转换；
//   ③ 点选候选：转换式搜索（派发原生名）且输入框保留中文；④ 表单内搜索框不触发独立转换。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();
const FIXTURE = fixtureUrl('collection-search.html');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? (k === 'zhx.data.refresh.epoch' ? 'candidate-policy-1-force-refresh' : d) : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => {
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const itemsTsv = fs.readFileSync(itemsTsvPath, 'utf8');
// 数据指纹行：与既有集成夹具（test-mirapri / test-ronka-search-inline）同源；缺少指纹会令缓存被视为过期。
const FP = 'testfp000001';
const EXPECT_ZH = '女仆腕带';
const expectJa = (() => {
  for (const ln of itemsTsv.split('\n')) {
    const p = ln.split('\t');
    if (p[1] === EXPECT_ZH) return p[3];
  }
  throw new Error('物品总表中未找到：' + EXPECT_ZH);
})();
console.log('期望日文名:', expectJa);

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
await c.callFn('function (k, v) { localStorage.setItem(k, v); return 1; }', ['gm:zhx.dt.items', FP + '\n' + itemsTsv]);
await c.callFn('function (v) { localStorage.setItem("gm:zhx.meta", v); return 1; }', [JSON.stringify({ v: 'test', t: Date.now(), candidatePolicy: 1 })]);
await c.callFn('function (v) { localStorage.setItem("gm:zhx.v3.manifest", v); return 1; }', [String(Date.now()) + '\n' + JSON.stringify({ schema: 3, candidatePolicy: 1, sites: {} })]);
await c.eval("window.__zhxTestSite = 'collection';");
await c.eval("window.__zhxTestTables = ['items'];");
await c.eval('window.__zhxDiagOn = true;');
await c.eval(gmStub);
// 观察装置：记录所有 input 事件的值（供「转换式搜索派发原生名」精确核验）
await c.eval(`(() => {
  window.__inputVals = [];
  document.addEventListener('input', function (e) {
    try { window.__inputVals.push(String(e.target.value || '')); } catch (x) {}
  }, true);
  return 1;
})()`);
await c.eval(wrap(GF));
await sleep(1500);

// ── 模拟站内汉化产物：placeholder 改为中文（真身状态；词样元须仍能识别）──
const phNow = await c.eval(`(() => { const i = document.querySelector('input[name="keyword"]'); i.setAttribute('placeholder', '输入想查询的关键词'); return i.getAttribute('placeholder'); })()`);
console.log('模拟汉化后 placeholder:', JSON.stringify(phNow));

const setInline = (val) => c.callFn(
  'function (value) { const i = document.querySelector(\'input[name="keyword"]\'); if (!i) throw new Error("Search input missing"); i.focus(); i.value = value; i.dispatchEvent(new Event("input", { bubbles: true })); return 1; }',
  [val]);
const readInline = () => c.eval(`(() => { const i = document.querySelector('input[name="keyword"]'); return i ? i.value : null; })()`);

// ── 就绪门：汉化后 placeholder 场景，输入「女仆」→ 候选面板出现（数据就绪 + 功能装配），最多重试 30 次 ──
const suggestState = `(() => {
  const b = document.querySelector('#zhx-chinese-suggest-list');
  return b ? { hidden: b.hidden, n: b.querySelectorAll('button[data-zhx-index]').length } : null;
})()`;
let ready = null;
for (let i = 0; i < 30; i++) {
  await setInline('女仆');
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
  const nativeEl = btn.querySelector('.zhx-suggest-native');
  const zhText = zhEl ? zhEl.textContent : btn.textContent;
  const nativeText = nativeEl ? nativeEl.textContent : null;
  btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  return { zhText, nativeText };
})()`);
await sleep(800);
const v3 = await readInline();
ok('③ 点选候选后输入框保留中文（显示恢复）', picked !== null && v3 === picked.zhText, JSON.stringify({ picked, v3 }));
const seenVals = await c.eval('window.__inputVals').catch(() => null);
const convHit = Array.isArray(seenVals) && picked && picked.nativeText
  && seenVals.some((v) => v && v.length >= 2 && (v === picked.nativeText || v.includes(picked.nativeText) || picked.nativeText.includes(v)));
ok('③b 转换式搜索派发原生名 input（站内搜索生效）', convHit === true, JSON.stringify({ picked, seenVals: (seenVals || []).slice(-4) }));

// ── ④ 未知中文名不转换 ──
await setInline('不存在的装备名称xyz');
await sleep(1300);
const v4 = await readInline();
ok('④ 未知中文名保持原样', v4 === '不存在的装备名称xyz', JSON.stringify(v4));

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
