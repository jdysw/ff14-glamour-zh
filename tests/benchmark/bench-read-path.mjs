// bench-read-path.mjs v2 — 缓存读取路径细分基准（mirapri：items+dict）
// 细分埋点：injectAt → readEnd（读缓存）→ applied（applyTable 完）→ schedAt（调度发出）→ buildStart → ready → fireDone
// 变体：base2（原版）/ mc2（仅分片间隙 MessageChannel）/ full2（启动 MC + 分片 MC）
// CPU 节流 1x/4x/8x；每档 3 轮
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { distFile, itemsTsvPath, fixtureUrl, cachePath } from '../helpers/paths.mjs';
import { ensureDictJson } from '../helpers/dict.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const FIXTURE = fixtureUrl('ec-page.html');
const DIST = distFile;

let s = fs.readFileSync(DIST, 'utf8');
const repl1 = (src, oldS, newS, tag) => {
  const n = src.split(oldS).length - 1;
  if (n !== 1) throw new Error(`${tag} 锚点计数异常: ${n}`);
  return src.split(oldS).join(newS);
};
// ── 埋点注入 ──（v1.4 Phase 3：__zhxTestSite / __zhxTestTables 已内建于 src，无需文本注入）
s = repl1(s, "const local = await _ensureReadLocal(need);", "const local = await _ensureReadLocal(need);\n    try { (window.__zhxT = window.__zhxT || {}).readEnd = performance.now(); } catch (e) {}", 't-readEnd');
s = repl1(s, "for (const t of need) applyTable(t, local[t].tx);\n    DATA_VER = (meta.v ? String(meta.v) : '');", "for (const t of need) applyTable(t, local[t].tx);\n    DATA_VER = (meta.v ? String(meta.v) : '');\n    try { (window.__zhxT = window.__zhxT || {}).applied = performance.now(); } catch (e) {}", 't-applied');
s = repl1(s, "function _ensureFinalize() {", "function _ensureFinalize() {\n    try { (window.__zhxT = window.__zhxT || {}).finEntry = performance.now(); } catch (e) {}", 't-finEntry');
s = repl1(s, "      else setTimeout(go, 50);", "      else setTimeout(go, 50);\n      try { (window.__zhxT = window.__zhxT || {}).schedAt = performance.now(); } catch (e) {}", 't-schedAt');
s = repl1(s, "      const go = () => {\n        buildTables(_buildScope, () => {", "      const go = () => {\n        try { (window.__zhxT = window.__zhxT || {}).buildStart = performance.now(); } catch (e) {}\n        buildTables(_buildScope, () => {", 't-buildStart');
s = repl1(s, "    _tablesReady = true;", "    _tablesReady = true;\n    try { (window.__zhxT = window.__zhxT || {}).ready = performance.now(); } catch (e) {}", 't-ready');
s = repl1(s, "const cbs = _readyCbs.splice(0);\n    for (const f of cbs) { try { f(); } catch (e) {} }", "const cbs = _readyCbs.splice(0);\n    for (const f of cbs) { try { f(); } catch (e) {} }\n    try { (window.__zhxT = window.__zhxT || {}).fireDone = performance.now(); } catch (e) {}", 't-fireDone');

// ── 变体 ──
const addMc = (x) => repl1(x, "function buildTables(scope, done) {\n    const t = _btTargets(scope);", "function buildTables(scope, done) {\n    let mc = null;\n    try { mc = new MessageChannel(); mc.port2.onmessage = () => step(); } catch (e) { mc = null; }\n    const t = _btTargets(scope);", 'v-mc-def');
const mcStep = (x) => repl1(x, "if (i < lines.length) { setTimeout(step, 0); return; }", "if (i < lines.length) { if (mc) { mc.port1.postMessage(0); } else { setTimeout(step, 0); } return; }", 'v-mc-step');
const variant = process.argv[2] || 'base2';
const VARIANTS = {
  base2: (x) => x,
  mc2: (x) => mcStep(addMc(x)),
  full2: (x) => {
    x = repl1(x, "      if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 2000 });\n      else setTimeout(go, 50);", "      try { const _mc = new MessageChannel(); _mc.port2.onmessage = () => go(); _mc.port1.postMessage(0); } catch (e) { setTimeout(go, 50); }", 'v-f-go');
    return mcStep(addMc(x));
  },
};
s = VARIANTS[variant](s);
console.log('变体:', variant);

fs.writeFileSync(cachePath('gf-bench-read.user.js'), s);
const GF = s;
console.log('测试副本已生成');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  window.__gmAcc = 0;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { const t = performance.now(); try { const v = localStorage.getItem(P + k); window.__gmAcc += performance.now() - t; return v == null ? d : v; } catch (e) { window.__gmAcc += performance.now() - t; return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => {
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const itemsTsv = fs.readFileSync(itemsTsvPath, 'utf8');
const dictJson = ensureDictJson();

const FP = 'benchfp0001';
const preset = (k, txt) => `(() => { localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(FP + '\n' + txt)}); return 1; })()`;
const clear = `(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`;

const runOne = async (rate, round) => {
  const t = await newPage(PORT, FIXTURE);
  const c = t.cdp;
  try {
    await sleep(400);
    await c.send('Emulation.setCPUThrottlingRate', { rate });
    await c.eval(clear);
    await c.eval(`window.__zhxTestSite = 'ec'; window.__zhxTestTables = ['items','dict']; window.__zhxTestIndexes = ['nameMap','itemHash'];`);
    await c.eval(preset('gm:zhx.dt.items', itemsTsv));
    await c.eval(preset('gm:zhx.dt.dict', dictJson));
    await c.eval(`(() => { localStorage.setItem('gm:zhx.meta', JSON.stringify({ v: 'bench', t: Date.now() })); return 1; })()`);
    await c.eval(gmStub);
    // 注入（同一次 eval：先记 injectAt，再执行脚本）
    await c.eval(`window.__zhxT = { injectAt: performance.now() };\n` + wrap(GF));
    // 轮询等待就绪
    let ok = false;
    for (let i = 0; i < 400; i++) {
      await sleep(150);
      const st = await c.eval(`!!(window.__zhxT && window.__zhxT.fireDone)`);
      if (st) { ok = true; break; }
    }
    const z = await c.eval(`(() => { const z = window.__zhxT || {}; return { injectAt: z.injectAt, readEnd: z.readEnd, applied: z.applied, finEntry: z.finEntry, schedAt: z.schedAt, buildStart: z.buildStart, ready: z.ready, fireDone: z.fireDone, gmAcc: window.__gmAcc || 0 }; })()`);
    if (!ok || !z.fireDone) throw new Error('未就绪: ' + JSON.stringify(z));
    const g = (a, b) => (Number.isFinite(a) && Number.isFinite(b)) ? (b - a).toFixed(1) : '-';
    console.log(`  [${rate}x #${round}] 总=${(z.fireDone - z.injectAt).toFixed(1)}ms | 读=${g(z.injectAt, z.readEnd)} apply=${g(z.readEnd, z.applied)} 调度前=${g(z.applied, z.schedAt)} 等调度=${g(z.schedAt, z.buildStart)} 构建=${g(z.buildStart, z.ready)} 广播=${g(z.ready, z.fireDone)} | gmAcc=${z.gmAcc.toFixed(1)}`);
    return z;
  } finally {
    try { await closePage(PORT, t.target.id); } catch (e) {}
  }
};

const rates = [1, 4, 8];
const med = (arr) => { const a = [...arr].filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };

const all = {};
for (const rate of rates) {
  console.log(`\n════ ${variant} @ ${rate}x ════`);
  all[rate] = [];
  for (let r = 1; r <= 3; r++) {
    try { all[rate].push(await runOne(rate, r)); } catch (e) { console.log(`  [${rate}x #${r}] 失败: ${e.message}`); }
  }
}

console.log(`\n════════ ${variant} 汇总（中位数，ms）════════`);
console.log('档位 | 读(→readEnd) | apply | 调度前 | 等调度 | 构建 | 广播 | 总计');
for (const rate of rates) {
  const runs = all[rate].filter((z) => z && z.fireDone);
  if (!runs.length) { console.log(`${rate}x | 无数据`); continue; }
  const m = (a, b) => med(runs.map((z) => z[b] - z[a]));
  const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-').padStart(7);
  console.log(`${rate}x  | ${f1(m('injectAt', 'readEnd'))} | ${f1(m('readEnd', 'applied'))} | ${f1(m('applied', 'schedAt'))} | ${f1(m('schedAt', 'buildStart'))} | ${f1(m('buildStart', 'ready'))} | ${f1(m('ready', 'fireDone'))} | ${f1(m('injectAt', 'fireDone'))}`);
}
