// bench-lifecycle.mjs — V3 缓存命中下的生命周期基准
// 锚点无关：注入前置 window.__zhxDiagOn = true，经 __zhxDiagRecord() 读取（不依赖 dist 文本注入；
//   dist 形态变化不影响本基准——与 bench-read-path 的文本锚方案互补）。
// 覆盖：boot / finalize / ready / fireDone，以及 DOM、resolver、缓存命中与词典规模
//   + 处理统计（dom / obs）+ 数据来源（dl）+ resolver / cache / 数据规模 / 词典规模
//   + 就绪后 mutation 波形（插入节点触发观察器一批，量测处理增量）。
// 用法：node tests/benchmark/bench-lifecycle.mjs [--save]（--save 另存 baseline/lifecycle-ec.json）
// 环境变量：ZHX_BENCH_ROUNDS（默认 3）/ ZHX_CDP_PORT（默认 9223）
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { distFile, fixtureUrl } from '../helpers/paths.mjs';
import { seedV3Browser } from '../helpers/v3-cache.mjs';
import { writeReport } from './report.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const SAVE = process.argv.includes('--save');
const ROUNDS = Number(process.env.ZHX_BENCH_ROUNDS || 3);
const FIXTURE = fixtureUrl('ec-page.html');
const GF = fs.readFileSync(distFile, 'utf8');

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

const clear = `(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`;

const MUT_JS = `(() => {
  const box = document.createElement('div'); box.id = 'zhx-bench-mut';
  for (let i = 0; i < 20; i++) {
    const a = document.createElement('a');
    a.className = 'eorzeadb_link';
    a.setAttribute('href', 'https://na.finalfantasyxiv.com/lodestone/playguide/db/item/0102030405060708' + i + '/');
    a.textContent = 'Ao Dai';
    box.appendChild(a);
  }
  document.body.appendChild(box);
  return 1;
})()`;

const runOne = async (round) => {
  const t = await newPage(PORT, FIXTURE);
  const c = t.cdp;
  try {
    await sleep(400);
    await c.eval(clear);
    await c.eval("window.__zhxTestSite = 'ec'; window.__zhxTestTables = ['items','dict']; window.__zhxTestIndexes = ['nameMap','itemHash']; window.__zhxDiagOn = true;");
    await seedV3Browser(c, 'ec');
    await c.eval(gmStub);
    await c.eval(wrap(GF));
    let rec1 = null;
    for (let i = 0; i < 400; i++) {
      await sleep(150);
      const ok = await c.eval("(typeof window.__zhxDiagRecord === 'function') && !!(window.__zhxDiagRecord().marks || {}).fireDone");
      if (ok) { rec1 = await c.eval('window.__zhxDiagRecord()'); break; }
    }
    if (!rec1) throw new Error('未就绪（fireDone 未记录）');
    // mutation 波形：就绪后插入 20 个物品链接 → 观察器一批（EC 物品链）
    await c.eval(MUT_JS);
    await sleep(1500);
    const rec2 = await c.eval('window.__zhxDiagRecord()');
    const m = rec1.marks || {};
    const o1 = rec1.obs || {};
    const o2 = rec2.obs || {};
    const mutMs = (o2.ms || 0) - (o1.ms || 0);
    console.log(`  [#${round}] boot=${rec1.boot}ms finalize=${m.finalize} ready=${m.ready} fireDone=${m.fireDone} | dom=${(rec1.dom || {}).calls}次 | 变异批=${(o2.ticks || 0) - (o1.ticks || 0)} 用 ${mutMs.toFixed(1)}ms`);
    return { rec1, rec2 };
  } finally {
    try { await closePage(PORT, t.target.id); } catch (e) {}
  }
};

const med = (arr) => { const a = [...arr].filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };

console.log('\n════ lifecycle @ ec（items+dict，缓存命中；锚点无关读取）════');
const runs = [];
for (let r = 1; r <= ROUNDS; r++) {
  try { runs.push(await runOne(r)); } catch (e) { console.log(`  [#${r}] 失败: ${e.message}`); }
}
const good = runs.filter((r) => r && r.rec1);
if (!good.length) {
  console.log('全部轮次失败');
  process.exit(1);
}

const pick = (fn) => med(good.map(fn));
const mOf = (r) => r.rec1.marks || {};
const sum = {
  boot: pick((r) => r.rec1.boot),
  finalize: pick((r) => mOf(r).finalize),
  ready: pick((r) => mOf(r).ready),
  fireDone: pick((r) => mOf(r).fireDone),
  domCalls: pick((r) => (r.rec1.dom || {}).calls),
  domFirstMs: pick((r) => (r.rec1.dom || {}).firstMs),
  domMs: pick((r) => (r.rec1.dom || {}).ms),
  obsMs: pick((r) => (r.rec1.obs || {}).ms),
  mutTicks: pick((r) => ((r.rec2.obs || {}).ticks || 0) - ((r.rec1.obs || {}).ticks || 0)),
  mutMs: pick((r) => ((r.rec2.obs || {}).ms || 0) - ((r.rec1.obs || {}).ms || 0)),
  dlCache: pick((r) => (r.rec1.dl || {}).cache),
  dlNet: pick((r) => (r.rec1.dl || {}).net),
  resHit: pick((r) => (r.rec1.res || {}).hit),
  resMiss: pick((r) => (r.rec1.res || {}).miss),
  nameKeys: pick((r) => (r.rec1.data || {}).names),
  dictChars: pick((r) => (r.rec1.dict || {}).chars),
  runs: good.length,
};

console.log('\n════════ lifecycle 汇总（中位数）════════');
console.log('阶段 | boot | finalize | ready | fireDone');
console.log('     | ' + [sum.boot, sum.finalize, sum.ready, sum.fireDone].map((x) => (Number.isFinite(x) ? x.toFixed(1) : '-').padStart(8)).join(' | '));
console.log('DOM=' + sum.domCalls + '次(首' + sum.domFirstMs + 'ms/计' + sum.domMs + 'ms) obs=' + sum.obsMs
  + 'ms 变异批=' + sum.mutTicks + '(用' + sum.mutMs + 'ms) | dl: cache=' + sum.dlCache + ' net=' + sum.dlNet
  + ' | resolver: hit=' + sum.resHit + ' miss=' + sum.resMiss + ' | nameKeys=' + sum.nameKeys + ' dict=' + sum.dictChars);

writeReport('lifecycle-ec', {
  summary: sum,
  runs: good.map((r, i) => ({ i: i + 1, marks: r.rec1.marks, dom: r.rec1.dom, obs1: r.rec1.obs, obs2: r.rec2.obs, dl: r.rec1.dl, res: r.rec1.res, cache: r.rec1.cache, data: r.rec1.data, dict: r.rec1.dict })),
}, { save: SAVE, args: ['rounds=' + ROUNDS] });
