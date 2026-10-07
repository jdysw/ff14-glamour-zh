// bench-read-path.mjs v2 — 缓存读取路径细分基准（ec：items+dict）
// 细分埋点：injectAt → readEnd（读缓存）→ applied（applyTable 完）→ schedAt（调度发出）→ buildStart → ready → fireDone
// 说明：v1.4 起分片调度已内建（_btNext：MC 优先 + setTimeout 兜底），历史变体（mc2/full2）退役（见 git 历史）；
//       基准预置「空 sites 的 v3 manifest」→ v3 探测静默回退 v2 读路径（零网络、确定行为）。
// CPU 节流 1x/4x/8x；每档 3 轮
// 提取锚维护（哨兵）：Phase 15 起 dist 为 rollup IIFE 输出——模块内容整体 +2 缩进；
//   多行锚点须按「当前产物形态」维护，失配即报「锚点计数异常」（有意哨兵，见 tests/README）。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { distFile, itemsTsvPath, fixtureUrl, cachePath } from '../helpers/paths.mjs';
import { ensureDictJson } from '../helpers/dict.mjs';
import { writeReport } from './report.mjs';

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
s = repl1(s, "      for (const t of need) applyTable(t, local[t].tx);\n      DATA_VER = (meta.v ? String(meta.v) : '');", "      for (const t of need) applyTable(t, local[t].tx);\n      DATA_VER = (meta.v ? String(meta.v) : '');\n      try { (window.__zhxT = window.__zhxT || {}).applied = performance.now(); } catch (e) {}", 't-applied');
s = repl1(s, "function _ensureFinalize() {", "function _ensureFinalize() {\n    try { (window.__zhxT = window.__zhxT || {}).finEntry = performance.now(); } catch (e) {}", 't-finEntry');
s = repl1(s, "      else setTimeout(go, 50);", "      else setTimeout(go, 50);\n      try { (window.__zhxT = window.__zhxT || {}).schedAt = performance.now(); } catch (e) {}", 't-schedAt');
s = repl1(s, "        const go = () => {\n          __zhxMark('buildStart');", "        const go = () => {\n          try { (window.__zhxT = window.__zhxT || {}).buildStart = performance.now(); } catch (e) {}\n          __zhxMark('buildStart');", 't-buildStart');
s = repl1(s, "    _tablesReady = true;", "    _tablesReady = true;\n    try { (window.__zhxT = window.__zhxT || {}).ready = performance.now(); } catch (e) {}", 't-ready');
s = repl1(s, "      const cbs = _readyCbs.splice(0);\n      for (const f of cbs) { try { f(); } catch (e) { _zhxErr('readyCb', e); } }", "      const cbs = _readyCbs.splice(0);\n      for (const f of cbs) { try { f(); } catch (e) { _zhxErr('readyCb', e); } }\n      try { (window.__zhxT = window.__zhxT || {}).fireDone = performance.now(); } catch (e) {}", 't-fireDone');

// v1.4：分片调度已内建（_btNext：MC 优先 + setTimeout 兜底），历史变体（mc2/full2）退役（见 git 历史）。
const variant = 'base2';

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
    // v3 探测预置：新鲜 manifest + 空 sites → 静默回退 v2（零网络；Phase 12 起的行为）
    await c.eval(`(() => { localStorage.setItem('gm:zhx.v3.manifest', ${JSON.stringify(String(Date.now()) + '\n' + JSON.stringify({ schema: 3, sites: {} }))}); return 1; })()`);
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

// ── 报告（v1.4 Phase 19）：标准 JSON（zhx-bench/1）→ tests/.cache/bench/；--save 另存基线 ──
const report = { rates: {} };
for (const rate of rates) {
  const runs = all[rate].filter((z) => z && z.fireDone);
  if (!runs.length) { report.rates[rate] = null; continue; }
  const m2 = (a, b) => med(runs.map((z) => z[b] - z[a]));
  report.rates[rate] = {
    total: m2('injectAt', 'fireDone'), read: m2('injectAt', 'readEnd'), apply: m2('readEnd', 'applied'),
    sched: m2('applied', 'schedAt'), wait: m2('schedAt', 'buildStart'), build: m2('buildStart', 'ready'),
    fire: m2('ready', 'fireDone'), runs: runs.length,
  };
}
writeReport('read-path-ec', report, { save: process.argv.includes('--save'), args: ['rates=' + rates.join('/'), 'rounds=3'] });
