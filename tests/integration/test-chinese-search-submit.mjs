// tests/integration/test-chinese-search-submit.mjs — 1.4.2 后续修复：mirapri 中文搜索提交回归（离线夹具）
//
// 背景：v1.4.2 中文搜索在日服幻化站（mirapri）实测「搜不到装备」。
//       根因（2026-10-07 云端真站实测）：表单的空值筛选参数（cl/j/r/t/c/fav 等）被原样带进
//       搜索 URL，站方把空参数视为「生效的无效筛选」→ 结果恒为 0 条；剔除空值后 ?keyword=X
//       正常返回（25 条/页）。
// 本测试：用与真站同构的表单夹具 + 真实物品总表（zh→ja），冻结提交链路的两个契约：
//   ① 中文全名 → 日文名替换；② 空值参数剔除（有效筛选保留）。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();
const FIXTURE = fixtureUrl('mirapri-search.html');

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

const itemsTsv = fs.readFileSync(itemsTsvPath, 'utf8');
// 数据指纹行：与既有集成夹具（test-mirapri）同源；缺少指纹会令缓存被视为过期 → 触发远端下载。
const FP = 'testfp000001';
const EXPECT_ZH = '特罗亚精准缠头巾';
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
console.log('预置 items:', await c.callFn('function (k, v) { localStorage.setItem(k, v); return 1; }', ['gm:zhx.dt.items', FP + '\n' + itemsTsv]));
console.log('预置 meta:', await c.callFn('function (v) { localStorage.setItem("gm:zhx.meta", v); return 1; }', [JSON.stringify({ v: 'test', t: Date.now() })]));
console.log('预置 v3 缓存:', await c.callFn('function (v) { localStorage.setItem("gm:zhx.v3.manifest", v); return 1; }', [String(Date.now()) + '\n' + JSON.stringify({ schema: 3, sites: {} })]));
await c.eval("window.__zhxTestSite = 'mirapri';");
await c.eval("window.__zhxTestTables = ['items'];");
await c.eval('window.__zhxDiagOn = true;');
await c.eval(gmStub);
await c.eval(wrap(GF));
await sleep(1500);
console.log('注入诊断:', JSON.stringify(await c.eval(`({
  bound: !!window.__zhxChineseSearchBound,
  title: document.title,
  req: (window.__reqLog || []).length,
  dt: String(localStorage.getItem('gm:zhx.dt.items') || '').length,
})`)));
await sleep(1200);

// ── 就绪门：输入「特罗」→ 候选行出现即数据就绪 ──
const suggestState = `(() => {
  const box = document.getElementById('zhx-chinese-suggest-list');
  const rows = box ? box.querySelectorAll('button[data-zhx-index]') : [];
  return { rows: rows.length, texts: [...rows].slice(0, 3).map((b) => (b.textContent || '').trim()) };
})()`;
await c.eval(`(() => { const i = document.getElementById('equip-name-field'); i.value = '特罗'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
let ready = { rows: 0 };
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  ready = await c.eval(suggestState);
  if (ready && ready.rows > 0) break;
}
console.log('候选就绪:', JSON.stringify(ready).slice(0, 240));
ok('① 中文候选出现（数据就绪 + UI 装配）', ready.rows > 0, JSON.stringify(ready));

// ── 捕获装置：Fetch 域拦截 mirapri.com 导航，读取 URL 后中止（保持离线） ──
let captured = null;
c.on('Page.frameRequestedNavigation', (p) => { if (!captured && p && p.url) captured = p.url; });
c.on('Fetch.requestPaused', async (p) => {
  if (!captured && p && p.request && p.request.url) captured = p.request.url;
  try { await c.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Aborted' }); } catch (e) { /* 已中止 */ }
});
await c.send('Fetch.enable', { patterns: [{ urlPattern: 'https://mirapri.com/*', requestStage: 'Request' }] });

const submitOnce = async (zhName, filters = {}) => {
  captured = null;
  await c.eval(`(() => {
    const f = document.querySelector('form[name="side-filter-form"]');
    for (const [k, v] of Object.entries(${JSON.stringify(filters)})) { const el = f.elements[k]; if (el) el.value = v; }
    const i = document.getElementById('equip-name-field');
    i.value = ${JSON.stringify(zhName)};
    f.requestSubmit();
    return 1;
  })()`);
  for (let i = 0; i < 16 && !captured; i++) await sleep(500);
  return captured || '';
};

// ── Round 1：无筛选 → 仅剩 keyword（空值剔除） ──
const url1 = await submitOnce(EXPECT_ZH);
console.log('\nRound1 捕获:', url1 || '(未捕获)');
let u1 = null;
try { u1 = new URL(url1); } catch (e) { /* 捕获失败走断言 */ }
ok('② 提交被拦截并请求导航（URL 可解析）', !!u1, url1);
if (u1) {
  ok('③ 目标为 mirapri 搜索根路径', u1.origin === 'https://mirapri.com' && u1.pathname === '/', u1.origin + u1.pathname);
  ok('④ keyword 已替换为日文名', u1.searchParams.get('keyword') === expectJa, String(u1.searchParams.get('keyword')));
  ok('⑤ 空值参数全部剔除（仅剩 keyword）', [...u1.searchParams.keys()].join(',') === 'keyword', [...u1.searchParams.keys()].join(','));
}

// ── Round 2：带有效筛选 j=15 → 保留 j、剔除其余空值 ──
await sleep(400);
const url2 = await submitOnce(EXPECT_ZH, { j: '15' });
console.log('Round2 捕获:', url2 || '(未捕获)');
let u2 = null;
try { u2 = new URL(url2); } catch (e) { /* 捕获失败走断言 */ }
ok('⑥ 带筛选提交可捕获', !!u2, url2);
if (u2) {
  const keys = [...u2.searchParams.keys()].sort().join(',');
  ok('⑦ 保留 j=15、剔除空值、keyword 就位', keys === 'j,keyword' && u2.searchParams.get('j') === '15' && u2.searchParams.get('keyword') === expectJa, keys);
}

// ── Round 3：中文名不在总表 → 不拦截（放行原生行为） ──
await sleep(400);
captured = null;
const r3prevented = await c.eval(`(() => {
  const i = document.getElementById('equip-name-field');
  i.value = '不存在的装备名称xyz';
  const f = document.querySelector('form[name="side-filter-form"]');
  const ev = new Event('submit', { bubbles: true, cancelable: true });
  f.dispatchEvent(ev);
  return ev.defaultPrevented;
})()`);
await sleep(1200);
ok('⑧ 未知中文名不拦截（不产生 mirapri 导航）', r3prevented === false && !captured, `prevented=${r3prevented} captured=${captured || ''}`);

const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
ok('⑨ 无 [TEST-INJECT] 错误', !testErr);

console.log(`\n${pass} / ${pass + fail} 通过`);
await closePage(PORT, t.target.id);
process.exit(fail === 0 ? 0 : 1);
