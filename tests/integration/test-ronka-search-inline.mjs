// tests/integration/test-ronka-search-inline.mjs — 1.4.2 后续修复：ronka 独立搜索框（无 form）中文自动转换（离线夹具）
//
// 背景：lookbook.ronkacloset.com（React SPA）的搜索框不属于任何 form，站点搜索是「输入即出建议面板」
//       的本地过滤，无提交事件可拦截；中文输入 →「검색 결과가 없어요」（真站实测 2026-10-07）。
//       修复 = 输入停止后把完整中文装备名自动替换为韩文原生名（native setter + input 事件）。
// 本测试：用同构夹具（无 form 独立搜索框 + 普通表单搜索框作对照）冻结两个契约：
//   ① 独立搜索框：完整中文名 → 韩文名自动替换（并派发 input 事件通知页面）；
//   ② 表单内搜索框不触发独立转换（仍由提交路径处理）。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();
const FIXTURE = fixtureUrl('ronka-search.html');

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
await c.callFn('function (k, v) { localStorage.setItem(k, v); return 1; }', ['gm:zhx.dt.items', FP + '\n' + itemsTsv]);
await c.callFn('function (v) { localStorage.setItem("gm:zhx.meta", v); return 1; }', [JSON.stringify({ v: 'test', t: Date.now() })]);
await c.callFn('function (v) { localStorage.setItem("gm:zhx.v3.manifest", v); return 1; }', [String(Date.now()) + '\n' + JSON.stringify({ schema: 3, sites: {} })]);
await c.eval("window.__zhxTestSite = 'ronka';");
await c.eval("window.__zhxTestTables = ['items'];");
await c.eval('window.__zhxDiagOn = true;');
await c.eval(gmStub);
// 观察装置：记录「因自动转换而产生的 input 事件」（值为韩文名的那一刻）
await c.eval(`(() => {
  window.__convEvt = false;
  document.addEventListener('input', function (e) {
    try { if (e && e.target && e.target.value === ${JSON.stringify(expectKo)}) window.__convEvt = true; } catch (x) {}
  }, true);
  return 1;
})()`);
await c.eval(wrap(GF));
await sleep(1500);

const setInline = (val) => c.eval(`(() => { const i = document.getElementById('search-input'); i.focus(); i.value = ${JSON.stringify(val)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const readInline = () => c.eval(`(() => { const i = document.getElementById('search-input'); return i ? i.value : null; })()`);

// ── 就绪门：输入中文全名 → 等自动转换（数据就绪 + 功能装配），最多重试 30 次 ──
let converted = false;
let lastVal = null;
for (let i = 0; i < 30; i++) {
  await setInline(EXPECT_ZH);
  await sleep(1000);
  lastVal = await readInline();
  if (lastVal === expectKo) { converted = true; break; }
}
ok('① 独立搜索框：完整中文名 → 韩文原生名自动替换', converted, `实际=${JSON.stringify(lastVal)}`);
const convEvt = await c.eval('window.__convEvt === true').catch(() => false);
ok('② 转换后派发 input 事件（页面可刷新建议）', convEvt === true, String(convEvt));

// ── ③ 防抖：连续输入（先前缀后全名）→ 只按最终全名转换 ──
await sleep(300);
await setInline('伴娘');
await sleep(150);
await setInline(EXPECT_ZH);
await sleep(1200);
const v3 = await readInline();
ok('③ 连续输入防抖后按最终全名转换', v3 === expectKo, JSON.stringify(v3));

// ── ④ 未知中文名不转换 ──
await setInline('不存在的装备名称xyz');
await sleep(1300);
const v4 = await readInline();
ok('④ 未知中文名保持原样', v4 === '不存在的装备名称xyz', JSON.stringify(v4));

// ── ⑤ 表单内搜索框不走独立转换 ──
await c.eval(`(() => { const i = document.querySelector('#legacy-search input[name="keyword"]'); i.focus(); i.value = ${JSON.stringify(EXPECT_ZH)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
await sleep(1300);
const v5 = await c.eval(`(() => { const i = document.querySelector('#legacy-search input[name="keyword"]'); return i ? i.value : null; })()`);
ok('⑤ 表单内搜索框不触发独立转换（中文保留）', v5 === EXPECT_ZH, JSON.stringify(v5));

const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
ok('⑥ 无 [TEST-INJECT] 错误', !testErr);

console.log(`\n${pass} / ${pass + fail} 通过`);
await closePage(PORT, t.target.id);
process.exit(fail === 0 ? 0 : 1);
