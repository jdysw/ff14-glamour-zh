// tests/integration/test-ec-search-inline.mjs — 1.4.2 后续修复（b 方案）：EC 部位筛选器（vue-select）（离线夹具）
//
// 背景：ffxiv.eorzeacollection.com（英文站）的部位筛选器是 vue-select 组件（class="vs__search"），
//       输入即触发站点装备检索（云真站实测 2026-10-08：POST /gear/<slot>/search，body {"search":"输入值"}）。
//       b 方案（2026-10-08）：输入停顿不再自动转换（禁止输入即搜索）；vue-select 与独立搜索框统一——
//       挂候选面板，点选候选才做「转换式搜索」（英文名触发站内检索）。
//       EC 的 Vue 受控框必须保持英文原生名和 v-model 同步；不可定时回写中文。
// 本测试：用同构夹具（form 内 vue-select 框 + 有 name 的对照框）冻结契约：
//   ① 独立搜索框出现智能候选面板（数据就绪门）；② 输入中文不自动转换；
//   ③ 点选候选：转换式搜索（派发原生名），输入框与 Vue 保持原生查询值；
//      验证之后可输入新词且不会被恢复定时器覆盖；
//   ④ 未知中文名保持原样；⑤ form 内有 name 的搜索框不触发独立转换（回归保护）。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { seedV3Browser } from '../helpers/v3-cache.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();
const FIXTURE = fixtureUrl('ec-search.html');

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
// 数据指纹行：与既有集成夹具同源；缺少指纹会令缓存被视为过期。
const FP = 'testfp000001';
const EXPECT_ZH = '女仆腕带';
const expectEn = (() => {
  for (const ln of itemsTsv.split('\n')) {
    const p = ln.split('\t');
    if (p[1] === EXPECT_ZH) return p[2];
  }
  throw new Error('物品总表中未找到：' + EXPECT_ZH);
})();
console.log('期望英文名:', expectEn);

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
await c.eval("window.__zhxTestSite = 'ec';");
await seedV3Browser(c, 'ec');
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
// Simulate the actual two-stage vue-select on EC. Remote search arrives
// asynchronously; selecting a native li via click commits its option.
await c.eval(`(() => {
  const input = document.getElementById('vs-head');
  const toggle = input.parentElement;
  const host = document.createElement('div');
  host.className = 'v-select';
  toggle.parentNode.insertBefore(host, toggle);
  host.appendChild(toggle);
  const selected = document.createElement('span');
  selected.className = 'vs__selected';
  toggle.prepend(selected);
  const menu = document.createElement('ul');
  menu.className = 'vs__dropdown-menu';
  host.appendChild(menu);
  window.__nativePickCount = 0;
  window.__nativePickWrong = 0;
  window.__wikiOpenAttempts = [];
  const realOpen = window.open;
  window.open = function (...args) {
    window.__wikiOpenAttempts.push(args[0]);
    return null;
  };
  window.addEventListener('beforeunload', () => { window.open = realOpen; });
  const original = ${JSON.stringify(expectEn)};
  input.addEventListener('input', () => {
    if (input.value !== original) return;
    // Deliberately do not cancel a delayed response when user input changes:
    // the custom code must reject stale options from a racing XHR.
    setTimeout(() => {
      menu.replaceChildren();
      const decoy = document.createElement('li');
      decoy.className = 'vs__dropdown-option';
      decoy.textContent = '女仆腕带';
      decoy.dataset.zhixiaSourceText = 'Incorrect Native Equipment';
      decoy.addEventListener('click', () => { window.__nativePickWrong++; });
      const option = document.createElement('li');
      option.className = 'vs__dropdown-option';
      option.textContent = original; // English option must not trigger the global Wiki click hijack.
      option.dataset.zhixiaSourceText = original;
      option.addEventListener('click', event => {
        event.preventDefault();
        window.__nativePickCount++;
        selected.textContent = original;
        input.value = '';
        menu.replaceChildren();
      });
      menu.append(decoy, option);
    }, 220);
  });
})()`);
await c.eval(wrap(GF));
await sleep(1500);

const setInput = (selector, value) => c.callFn(
  'function (selector, value) { const i = document.querySelector(selector); if (!i) throw new Error("Input missing: " + selector); i.focus(); i.value = value; i.dispatchEvent(new Event("input", { bubbles: true })); return 1; }',
  [selector, value]);
const setVs = (id, val) => setInput('#' + id, val);
const readVs = (id) => c.callFn('function (id) { const i = document.getElementById(id); return i ? i.value : null; }', [id]);

// ── 就绪门：vue-select 框输入「女仆」→ 候选面板出现（数据就绪 + 功能装配），最多重试 30 次 ──
const suggestState = `(() => {
  const b = document.querySelector('#zhx-chinese-suggest-list');
  return b ? { hidden: b.hidden, n: b.querySelectorAll('button[data-zhx-index]').length } : null;
})()`;
let ready = null;
for (let i = 0; i < 30; i++) {
  await setVs('vs-head', '女仆');
  await sleep(1000);
  ready = await c.eval(suggestState);
  if (ready && ready.hidden === false && ready.n > 0) break;
}
ok('① vue-select 出现智能候选面板（数据就绪门）', !!ready && ready.hidden === false && ready.n > 0, JSON.stringify(ready));

// ── ② 输入中文全名：不自动转换（b 方案：禁止输入即搜索）──
await setVs('vs-head', EXPECT_ZH);
await sleep(1200);
const v2 = await readVs('vs-head');
ok('② 输入中文全名后值保持原样（不自动转换）', v2 === EXPECT_ZH, JSON.stringify(v2));

// ── ③ 点选候选：派发原生名并与 EC Vue 的 v-model 保持同步 ──
await setVs('vs-head', EXPECT_ZH);
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
const v3 = await readVs('vs-head');
const closedAfterPick = await c.eval("document.querySelector('#zhx-chinese-suggest-list')?.hidden === true");
ok('③a EC 候选选中后中文浮层关闭，不遮住原生下拉', closedAfterPick === true);
const nativeSelected = await c.eval(`(() => ({
  name: document.querySelector('#vs-head').closest('.v-select')
    .querySelector('.vs__selected')?.textContent,
  pickCount: window.__nativePickCount,
  wrongCount: window.__nativePickWrong,
  wikiOpens: window.__wikiOpenAttempts,
}))()`);
ok('③ EC 点击中文候选一次即选中真正的原生装备（而非只搜索），并清空 Vue 搜索框',
  picked !== null && v3 === '' && nativeSelected?.name === expectEn
    && nativeSelected.pickCount === 1 && nativeSelected.wrongCount === 0
    && nativeSelected.wikiOpens.length === 0,
  JSON.stringify({ picked, v3, nativeSelected, expectEn }));
const seenVals = await c.eval('window.__inputVals').catch(() => null);
const convHit = Array.isArray(seenVals) && picked && picked.nativeText
  && seenVals.some((v) => v && v.length >= 2 && (v === picked.nativeText || v.includes(picked.nativeText) || picked.nativeText.includes(v)));
ok('③b 转换式搜索派发原生名 input（站内搜索生效）', convHit === true, JSON.stringify({ picked, seenVals: (seenVals || []).slice(-4) }));

ok('③g EC 原生选项确认不得打开灰机 Wiki',
  (await c.eval('window.__wikiOpenAttempts')).length === 0,
  JSON.stringify(await c.eval('window.__wikiOpenAttempts')));

// Late search responses must not select an old item after the user starts
// typing a different query.
await setVs('vs-head', EXPECT_ZH);
await sleep(500);
const beforeStale = await c.eval('window.__nativePickCount');
const initiated = await c.eval(`(() => {
  const b = document.querySelector('#zhx-chinese-suggest-list');
  const btn = b && !b.hidden ? b.querySelector('button[data-zhx-index]') : null;
  if (!btn) return false;
  btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  const input = document.getElementById('vs-head');
  input.value = '新的检索项';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(650);
const afterStale = await c.eval('window.__nativePickCount');
ok('③f 新输入使旧原生选择失效，即使旧 XHR 较晚返回',
  initiated && beforeStale === afterStale
    && await readVs('vs-head') === '新的检索项',
  JSON.stringify({ initiated, beforeStale, afterStale }));

// 检查已选择过中文候选的真实浏览器输入框仍可输入新词。
await setVs('vs-head', '新的检索项');
await sleep(800);
ok('③c 选中中文候选后重新键入不被旧值覆盖',
  await readVs('vs-head') === '新的检索项');

// Outside pointer events must close the overlay without canceling the
// native target's pointerdown, and subsequent typing should reopen it.
await setVs('vs-head', '女仆');
await sleep(500);
const outsideState = await c.eval(`(() => {
  const box = document.querySelector('#zhx-chinese-suggest-list');
  const nativeInput = document.querySelector('#legacy-search input[name="keyword"]');
  if (!box || !nativeInput || box.hidden) return null;
  let reached = false;
  nativeInput.addEventListener('pointerdown', () => { reached = true; }, { once: true });
  const allowed = nativeInput.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  return { hidden: box.hidden, allowed, reached };
})()`);
ok('③d 点击原生控件关闭中文候选且不拦截 pointerdown',
  outsideState?.hidden === true && outsideState.allowed === true && outsideState.reached === true,
  JSON.stringify(outsideState));
await setVs('vs-head', '女仆');
await sleep(500);
ok('③e 外部关闭后继续输入可以再次弹出候选',
  (await c.eval(suggestState))?.hidden === false);

// ── ④ 未知中文名不转换 ──
await setVs('vs-head', '不存在的装备名称xyz');
await sleep(1300);
const v4 = await readVs('vs-head');
ok('④ 未知中文名保持原样', v4 === '不存在的装备名称xyz', JSON.stringify(v4));

// ── ⑤ 对照一："Search by title"（form 内、有 name）不触发独立转换 ──
await setInput('form[name="filter"] input[name="search"]', EXPECT_ZH);
await sleep(1300);
const v5 = await c.eval(`(() => { const i = document.querySelector('form[name="filter"] input[name="search"]'); return i ? i.value : null; })()`);
ok('⑤ "Search by title" 框不触发独立转换（中文保留）', v5 === EXPECT_ZH, JSON.stringify(v5));

// ── ⑥ 对照二：传统表单搜索框（#legacy-search keyword）不触发独立转换 ──
await setInput('#legacy-search input[name="keyword"]', EXPECT_ZH);
await sleep(1300);
const v6 = await c.eval(`(() => { const i = document.querySelector('#legacy-search input[name="keyword"]'); return i ? i.value : null; })()`);
ok('⑥ 传统表单搜索框不触发独立转换（中文保留）', v6 === EXPECT_ZH, JSON.stringify(v6));

// ── ⑦ 部分词「女仆」：同样不自动转换（b 方案；部分词兜底仅保留在提交路径）──
await setVs('vs-head', '女仆');
await sleep(1600);
const v7 = await readVs('vs-head');
ok('⑦ 部分词「女仆」输入停顿保持原样', v7 === '女仆', JSON.stringify(v7));

const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
ok('⑧ 无 [TEST-INJECT] 错误', !testErr);

// Live EC uses /glamours routes. The offline file fixture uses this
// pre-existing test-site hook to exercise the same route gating.
await c.eval(`(() => {
  window.__zhxTestECResetPath = '/glamours/head/28453';
  history.replaceState({}, '', '?filterjob=PLD&search=maid&page=8');
})()`);
// ── ③h EC 站点“重置筛选”按钮必须由原生逻辑执行 ──
// Verify against the injected userscript AND the fixture's existing handlers,
// rather than accepting a simulated reset performed by the translation script.
const nativeReset = await c.eval(`(() => {
  const reset = document.getElementById('ec-reset-filters');
  const apply = document.getElementById('ec-apply-filters');
  const job = document.getElementById('ec-filter-job');
  if (!reset || !apply || !job) return null;
  job.value = 'PLD';
  const beforeWiki = window.__wikiOpenAttempts.length;
  const resetClick = new MouseEvent('click', { bubbles: true, cancelable: true });
  const allowed = reset.dispatchEvent(resetClick);
  const applyClick = new MouseEvent('click', { bubbles: true, cancelable: true });
  const applyAllowed = apply.dispatchEvent(applyClick);
  return {
    label: reset.textContent.trim(),
    resetCount: window.__ecResetClicks, applyCount: window.__ecApplyClicks,
    value: job.value, allowed, applyAllowed,
    resetBlocked: resetClick.defaultPrevented, applyBlocked: applyClick.defaultPrevented,
    wikiCalls: window.__wikiOpenAttempts.length - beforeWiki,
  };
})()`);
ok('③h EC 重置筛选一次点击执行站点原生逻辑并清空当前筛选', nativeReset !== null
  && nativeReset.resetCount === 1 && nativeReset.value === ''
  && nativeReset.allowed && !nativeReset.resetBlocked && nativeReset.wikiCalls === 0,
  JSON.stringify(nativeReset));
ok('③i EC 应用筛选保持原生 click 与状态处理，不被 Wiki 跳转拦截',
  nativeReset?.applyCount === 1 && nativeReset.applyAllowed && !nativeReset.applyBlocked,
  JSON.stringify(nativeReset));


await sleep(750);
const afterReset = await c.eval(`(() => ({
  query: location.search,
  path: location.pathname,
  job: document.getElementById('ec-filter-job')?.value,
  resetButton: !!document.getElementById('ec-reset-filters'),
}))()`);
ok('③j EC 重置筛选的兜底使浏览器 URL 恢复无筛选状态并重新初始化控件',
  afterReset?.query === '' && afterReset?.job === ''
    && afterReset.resetButton === true,
  JSON.stringify(afterReset));


console.log(`\n${pass} / ${pass + fail} 通过`);
await closePage(PORT, t.target.id);
process.exitCode = fail === 0 ? 0 : 1;
