// tests/integration/test-ec-search-inline.mjs — 1.4.2 后续修复：EC 部位筛选器（vue-select）中文自动转换（离线夹具）
//
// 背景：ffxiv.eorzeacollection.com（英文站）的部位筛选器是 vue-select 组件（class="vs__search"），
//       输入即触发站点装备检索（云真站实测 2026-10-08：POST /gear/<slot>/search，body {"search":"输入值"}）。
//       中文输入原样发送 → 无匹配；修复 = 完整中文装备名自动替换为英文名（native setter + input 事件）。
// 本测试：用同构夹具（form 内 vue-select 框 + 有 name 的对照框）冻结三个契约：
//   ① vue-select 框：完整中文名 → 英文名自动替换（并派发 input 事件通知页面）；
//   ② 未知中文名保持原样；
//   ③ form 内有 name 的搜索框（"Search by title" / 传统 keyword）不触发独立转换（回归保护）。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();
const FIXTURE = fixtureUrl('ec-search.html');

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
await c.callFn('function (k, v) { localStorage.setItem(k, v); return 1; }', ['gm:zhx.dt.items', FP + '\n' + itemsTsv]);
await c.callFn('function (v) { localStorage.setItem("gm:zhx.meta", v); return 1; }', [JSON.stringify({ v: 'test', t: Date.now() })]);
await c.callFn('function (v) { localStorage.setItem("gm:zhx.v3.manifest", v); return 1; }', [String(Date.now()) + '\n' + JSON.stringify({ schema: 3, sites: {} })]);
await c.eval("window.__zhxTestSite = 'ec';");
await c.eval("window.__zhxTestTables = ['items'];");
await c.eval('window.__zhxDiagOn = true;');
await c.eval(gmStub);
// 观察装置：记录「因自动转换而产生的 input 事件」（值为英文名的那一刻）
await c.eval(`(() => {
  window.__convEvt = false;
  document.addEventListener('input', function (e) {
    try { if (e && e.target && e.target.value === ${JSON.stringify(expectEn)}) window.__convEvt = true; } catch (x) {}
  }, true);
  return 1;
})()`);
await c.eval(wrap(GF));
await sleep(1500);

const setVs = (id, val) => c.eval(`(() => { const i = document.getElementById(${JSON.stringify(id)}); i.focus(); i.value = ${JSON.stringify(val)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const readVs = (id) => c.eval(`(() => { const i = document.getElementById(${JSON.stringify(id)}); return i ? i.value : null; })()`);

// ── 就绪门：vue-select 框输入中文全名 → 等自动转换（数据就绪 + 功能装配），最多重试 30 次 ──
let converted = false;
let lastVal = null;
for (let i = 0; i < 30; i++) {
  await setVs('vs-head', EXPECT_ZH);
  await sleep(1000);
  lastVal = await readVs('vs-head');
  if (lastVal === expectEn) { converted = true; break; }
}
ok('① vue-select 部位筛选器：完整中文名 → 英文名自动替换', converted, `实际=${JSON.stringify(lastVal)}`);
const convEvt = await c.eval('window.__convEvt === true').catch(() => false);
ok('② 转换后派发 input 事件（页面可刷新建议）', convEvt === true, String(convEvt));

// ── ③ 防抖：连续输入（先前缀后全名）→ 只按最终全名转换 ──
await sleep(300);
await setVs('vs-hands', '女仆');
await sleep(150);
await setVs('vs-hands', EXPECT_ZH);
await sleep(1200);
const v3 = await readVs('vs-hands');
ok('③ 连续输入防抖后按最终全名转换（第二个筛选器）', v3 === expectEn, JSON.stringify(v3));

// ── ④ 未知中文名不转换 ──
await setVs('vs-head', '不存在的装备名称xyz');
await sleep(1300);
const v4 = await readVs('vs-head');
ok('④ 未知中文名保持原样', v4 === '不存在的装备名称xyz', JSON.stringify(v4));

// ── ⑤ 对照一："Search by title"（form 内、有 name）不触发独立转换 ──
await c.eval(`(() => { const i = document.querySelector('form[name="filter"] input[name="search"]'); i.focus(); i.value = ${JSON.stringify(EXPECT_ZH)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
await sleep(1300);
const v5 = await c.eval(`(() => { const i = document.querySelector('form[name="filter"] input[name="search"]'); return i ? i.value : null; })()`);
ok('⑤ "Search by title" 框不触发独立转换（中文保留）', v5 === EXPECT_ZH, JSON.stringify(v5));

// ── ⑥ 对照二：传统表单搜索框（#legacy-search keyword）不触发独立转换 ──
await c.eval(`(() => { const i = document.querySelector('#legacy-search input[name="keyword"]'); i.focus(); i.value = ${JSON.stringify(EXPECT_ZH)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
await sleep(1300);
const v6 = await c.eval(`(() => { const i = document.querySelector('#legacy-search input[name="keyword"]'); return i ? i.value : null; })()`);
ok('⑥ 传统表单搜索框不触发独立转换（中文保留）', v6 === EXPECT_ZH, JSON.stringify(v6));

const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
ok('⑦ 无 [TEST-INJECT] 错误', !testErr);

console.log(`\n${pass} / ${pass + fail} 通过`);
await closePage(PORT, t.target.id);
process.exit(fail === 0 ? 0 : 1);
