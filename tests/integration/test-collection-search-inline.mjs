// tests/integration/test-collection-search-inline.mjs — 1.4.2 后续修复：collection 独立搜索框中文自动转换（离线夹具）
//
// 背景：ffxivcollection.com 搜索框位于侧栏 widget、不属于任何 form；站内汉化会把
//       placeholder 改为「输入想查询的关键词」（不再含日文「キーワード」，真站实测
//       2026-10-07）。修复 = 独立搜索框词样元扩展（关键词/關鍵詞/keyword），输入停止后
//       把完整中文装备名自动替换为日文原生名。
// 本测试：以同构夹具（侧栏 widget 无 form 搜索框）冻结两个契约：
//   ① 汉化后的 placeholder 场景仍触发转换（中文全名 → 日文原生名）；
//   ② 转换派发 input 事件（页面可刷新建议）。
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
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
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
await c.callFn('function (v) { localStorage.setItem("gm:zhx.meta", v); return 1; }', [JSON.stringify({ v: 'test', t: Date.now() })]);
await c.callFn('function (v) { localStorage.setItem("gm:zhx.v3.manifest", v); return 1; }', [String(Date.now()) + '\n' + JSON.stringify({ schema: 3, sites: {} })]);
await c.eval("window.__zhxTestSite = 'collection';");
await c.eval("window.__zhxTestTables = ['items'];");
await c.eval('window.__zhxDiagOn = true;');
await c.eval(gmStub);
// 观察装置：记录「因自动转换而产生的 input 事件」（值为日文名的那一刻）
await c.eval(`(() => {
  window.__convEvt = false;
  document.addEventListener('input', function (e) {
    try { if (e && e.target && e.target.value === ${JSON.stringify(expectJa)}) window.__convEvt = true; } catch (x) {}
  }, true);
  return 1;
})()`);
await c.eval(wrap(GF));
await sleep(1500);

// ── 模拟站内汉化产物：placeholder 改为中文（真身状态；词样元须仍能识别）──
const phNow = await c.eval(`(() => { const i = document.querySelector('input[name="keyword"]'); i.setAttribute('placeholder', '输入想查询的关键词'); return i.getAttribute('placeholder'); })()`);
console.log('模拟汉化后 placeholder:', JSON.stringify(phNow));

const setInline = (val) => c.eval(`(() => { const i = document.querySelector('input[name="keyword"]'); i.focus(); i.value = ${JSON.stringify(val)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const readInline = () => c.eval(`(() => { const i = document.querySelector('input[name="keyword"]'); return i ? i.value : null; })()`);

// ── 就绪门：汉化后 placeholder 场景，输入中文全名 → 等自动转换（数据就绪 + 功能装配），最多重试 30 次 ──
let converted = false;
let lastVal = null;
for (let i = 0; i < 30; i++) {
  await setInline(EXPECT_ZH);
  await sleep(1000);
  lastVal = await readInline();
  if (lastVal === expectJa) { converted = true; break; }
}
ok('① 汉化后 placeholder 下仍触发转换（中文全名 → 日文原生名）', converted, `实际=${JSON.stringify(lastVal)}`);
const convEvt = await c.eval('window.__convEvt === true').catch(() => false);
ok('② 转换后派发 input 事件（页面可刷新建议）', convEvt === true, String(convEvt));

// ── ③ 防抖：连续输入（先前缀后全名）→ 只按最终全名转换 ──
await sleep(300);
await setInline('女仆');
await sleep(150);
await setInline(EXPECT_ZH);
await sleep(1200);
const v3 = await readInline();
ok('③ 连续输入防抖后按最终全名转换', v3 === expectJa, JSON.stringify(v3));

// ── ④ 未知中文名不转换 ──
await setInline('不存在的装备名称xyz');
await sleep(1300);
const v4 = await readInline();
ok('④ 未知中文名保持原样', v4 === '不存在的装备名称xyz', JSON.stringify(v4));

// ── ⑤⑥ 智能输入：独立搜索框候选面板 + 点击候选自动转换（1.4.2 后续修复）──
await setInline('女仆');
await sleep(600);
const boxInfo = await c.eval(`(() => {
  const b = document.querySelector('#zhx-chinese-suggest-list');
  return b ? { hidden: b.hidden, n: b.querySelectorAll('button[data-zhx-index]').length } : null;
})()`);
ok('⑤ 独立搜索框出现智能候选面板', !!boxInfo && boxInfo.hidden === false && boxInfo.n > 0, JSON.stringify(boxInfo));
const clicked = await c.eval(`(() => {
  const b = document.querySelector('#zhx-chinese-suggest-list');
  if (!b || b.hidden) return null;
  const btn = b.querySelector('button[data-zhx-index]');
  if (!btn) return null;
  btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  return btn.textContent;
})()`);
await sleep(1400);
const v6 = await readInline();
ok('⑥ 点击候选后自动转换为日文原生名', clicked !== null && /[\u30a0-\u30ff]/.test(v6 || ''), JSON.stringify({ clicked, v6 }));

const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
ok('⑦ 无 [TEST-INJECT] 错误', !testErr);

console.log(`\n${pass} / ${pass + fail} 通过`);
await closePage(PORT, t.target.id);
process.exit(fail === 0 ? 0 : 1);
