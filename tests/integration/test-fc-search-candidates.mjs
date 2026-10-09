// tests/integration/test-fc-search-candidates.mjs — 1.4.2 后续修复：fc 候选原生名不被汉化翻译改写（离线夹具）
//
// 背景：fc（ff14-fc.com）全站汉化会把页面中的日文装备名翻译为中文（设计行为）。
//       中文搜索的候选行「原生名」span 故意展示日文原名供确认；真站实测
//       （2026-10-07 云端环境）：候选创建时 native span = 正确日文，随后被汉化
//       observer 扫描翻译 → 显示成「中文＋中文」（×2）。修复：汉化扫描跳过
//       候选 UI（#zhx-chinese-suggest-list）。
// 本测试：以同构夹具冻结两个契约：
//   ① 汉化翻译器在此环境下活跃（对照：插入普通 div 的日文装备名被翻译）；
//   ② 候选行 native span 不被改写（native ≠ zh，且含假名）。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();
const FIXTURE = fixtureUrl('fc-search.html');

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
await c.eval("window.__zhxTestSite = 'fc';");
await c.eval("window.__zhxTestTables = ['items'];");
await c.eval('window.__zhxDiagOn = true;');
await c.eval(gmStub);
await c.eval(wrap(GF));
await sleep(1500);

const suggestState = `(() => {
  const box = document.getElementById('zhx-chinese-suggest-list');
  const rows = box ? box.querySelectorAll('button[data-zhx-index]') : [];
  return rows.length;
})()`;

// ── 就绪门：输入「女仆」→ 候选行出现即数据就绪 ──
await c.eval(`(() => { const i = document.querySelector('input[name="_sf_search[]"]'); i.focus(); i.value = '女仆'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
let rows = 0;
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  rows = await c.eval(suggestState).catch(() => 0);
  if (rows > 0) break;
}
console.log('候选行数:', rows);
ok('① 中文候选出现（数据就绪 + UI 装配）', rows > 0, String(rows));

// ── ② 对照：翻译器活跃性——普通 div 的日文装备名应被汉化翻译 ──
await c.callFn('function (value) { const d = document.createElement("div"); d.id = "__probe_ja"; d.textContent = value; document.body.appendChild(d); return 1; }', [expectJa]);
let translated = null;
for (let i = 0; i < 12; i++) {
  await sleep(800);
  translated = await c.eval(`(() => { const d = document.getElementById('__probe_ja'); return d ? d.textContent : null; })()`).catch(() => null);
  if (translated === EXPECT_ZH) break;
}
ok('② 对照：普通 div 的日文装备名被汉化翻译（翻译器活跃）', translated === EXPECT_ZH, `实际=${JSON.stringify(translated)}`);

// ── ③ 候选行 native span 不被改写：native ≠ zh 且含假名 ──
await sleep(1500);   // 等 observer 再扫一轮（若修复缺失，此窗口内候选会被翻译）
const rowDump = await c.eval(`(() => {
  const box = document.getElementById('zhx-chinese-suggest-list');
  if (!box) return null;
  const bs = [...box.querySelectorAll('button[data-zhx-index]')];
  return bs.slice(0, 8).map((b) => {
    const zs = b.querySelector('.zhx-suggest-zh');
    const ns = b.querySelector('.zhx-suggest-native');
    return { zh: zs ? zs.textContent : null, native: ns ? ns.textContent : null };
  });
})()`).catch(() => null);
console.log('候选行 dump:', JSON.stringify(rowDump).slice(0, 420));
const rowsArr = Array.isArray(rowDump) ? rowDump : [];
ok('③ 候选行存在（复读）', rowsArr.length > 0, String(rowsArr.length));
const allNativeDiffer = rowsArr.length > 0 && rowsArr.every((r) => r.native && r.zh && r.native !== r.zh);
ok('④ 候选 native 不被翻译改写（native ≠ zh）', allNativeDiffer, JSON.stringify(rowsArr.slice(0, 3)));
const anyKana = rowsArr.some((r) => r.native && /[\u30a0-\u30ff]/.test(r.native));
ok('⑤ 至少一行 native 含日文假名（保留原生名）', anyKana, JSON.stringify(rowsArr.slice(0, 2)));

const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
ok('⑥ 无 [TEST-INJECT] 错误', !testErr);

console.log(`\n${pass} / ${pass + fail} 通过`);
await closePage(PORT, t.target.id);
process.exit(fail === 0 ? 0 : 1);
