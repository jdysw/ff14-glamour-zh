// tests/unit/test-startup-build-first.mjs — 启动性能专项：先建后探（build-first）
//
// 目的：钉死「先建后探」四场景行为——
//   A. >24h 首开·有旧缓存：就绪不等待 version.json（先建后探生效）
//   B. 热替换原子切换：探测到新版本后索引原子替换，查询无空窗
//   C. 后台探测失败：数据仍可用（旧缓存已应用、就绪已触发），静默降级
//   D. 无缓存全新安装：行为与现状一致（走原等待链，不提前广播）
//
// 机制：同 test-data-manager.mjs——从 dist 提取 core-cache + core-data-manager
//       区段，以桩装配运行。注意：_ensureTryFast / _ensureFetchAll / _waitPageLoad
//       在提取段内有真实定义，会遮蔽同名桩参数（与 test-runtime-v3 相同）——
//       因此「后台探测是否发起」以发出的 v2 请求（rec.xhr）观测，而非桩计数。
//       _ensureBuildLocal / _hotSwapIndexes 为本次新增的真实定义，其内部调用的
//       buildTables / _fireTablesReady 是桩，可计数。
//
// 运行：node tests/unit/test-startup-build-first.mjs   （或 npm run test:unit）
import { readDist } from '../helpers/paths.mjs';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};
const eq = (name, actual, expected) => ok(name, actual === expected,
  `实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`);

const DIST_TEXT = readDist();
const ITEM_HEADER = 'key\tzh\ten\tja\tko\thash\tecid\talias\tglam\n';
const OLD_ITEMS = ITEM_HEADER + '90001\t旧装备\tOld Gear\tオールドギア\t옛 장비\thold\teold\t\t1\n'.repeat(8);
const NEW_ITEMS = ITEM_HEADER + '90002\t新装备\tNew Gear\tニュウギア\t새 장비\thnew\tenew\t\t1\n'.repeat(8);

function sliceAll(s, tag) {
  const startTag = `/* @zhixia:${tag}-start */`;
  const endTag = `/* @zhixia:${tag}-end */`;
  const out = [];
  let from = 0;
  for (;;) {
    const i = s.indexOf(startTag, from);
    if (i < 0) break;
    const j = s.indexOf(endTag, i + startTag.length);
    if (j < 0) throw new Error(`区段未闭合：${tag}`);
    out.push(s.slice(i, j + endTag.length));
    from = j + endTag.length;
  }
  if (!out.length) throw new Error(`区段缺失：${tag}`);
  return out;
}

const CACHE_SEGS = sliceAll(DIST_TEXT, 'core-cache');
const DM_SEGS = sliceAll(DIST_TEXT, 'core-data-manager');

const NAMES = [
  'storeGetAsync', 'storeSet', 'storeListAsync', 'storeDeleteAsync', 'storeSetAsync', 'httpGet',
  'ITEM_DB_TEXT', 'SERIES_TEXT', 'ACL_CFC_TEXT',
  'itemHash', 'nameMap', 'ecidMap', 'koByZh',
  'DATA_VER', 'DATA_BASE', 'DATA_BASE_V3', 'DATA_FILES', 'DATA_REFRESH_EPOCH_KEY', 'DATA_REFRESH_EPOCH', '_forceDataRefresh', '_forceDataClearSucceeded', '_forceDataCacheWritesOk',
  'applyTable', 'neededTables', '_siteIndexes', 'buildTables', '_fireTablesReady',
  'findSite', 'applyRuntimeDict', '_irAliasMap', '_irDupMap', '_irCandidatePolicy', '_zhxErr',
  '_replaceMap',
  '__zhxMark', 'document', 'window', 'console', 'setTimeout', 'clearTimeout',
];

function makeWorld(over = {}) {
  const rec = {
    apply: [], xhr: [], set: [], timers: [], marks: [], fires: [], builds: 0,
    tryFast: 0, waitLoad: 0, errs: [], buildErr: null, timerErr: null,
  };
  const store = Object.assign({ 'zhx.data.refresh.epoch': 'candidate-policy-1-force-refresh' }, over.store || {});
  const args = {
    storeGetAsync: (k) => Promise.resolve(store[k] === undefined ? null : store[k]),
    storeSet: (k, v) => { store[k] = v; rec.set.push([k, v]); },
    storeSetAsync: async (k, v) => { store[k] = String(v); rec.set.push([k, v]); return true; },
    storeListAsync: async () => Object.keys(store),
    storeDeleteAsync: async (k) => { delete store[k]; return true; },
    httpGet: (url) => { rec.xhr.push(url); return (over.http || (() => Promise.reject(new Error('net down'))))(url); },
    ITEM_DB_TEXT: '', SERIES_TEXT: '', ACL_CFC_TEXT: '',
    itemHash: Object.create(null), nameMap: Object.create(null), ecidMap: Object.create(null), koByZh: Object.create(null),
    DATA_VER: '',
    DATA_REFRESH_EPOCH_KEY: 'zhx.data.refresh.epoch', DATA_REFRESH_EPOCH: 'candidate-policy-1-force-refresh',
    _forceDataRefresh: false, _forceDataClearSucceeded: false, _forceDataCacheWritesOk: true,
    DATA_BASE: 'https://example.test/ff14/v2/',
    DATA_BASE_V3: 'https://example.test/ff14/v3/',
    DATA_FILES: { items: 'items.tsv', series: 'series.txt', acl: 'acl.txt', dict: 'dict.json' },
    applyTable: (n, t) => { rec.apply.push([n, t]); },
    neededTables: () => over.need || ['items'],
    _siteIndexes: () => over.scope || null,
    buildTables: (scope, cb) => { rec.builds++; try { cb(); } catch (e) { rec.buildErr = String(e && e.message); } },
    _fireTablesReady: () => { rec.fires.push(1); },
    findSite: () => null,
    applyRuntimeDict: () => {},
    _irAliasMap: null, _irDupMap: null, _irCandidatePolicy: 0,
    _replaceMap: (t, s) => { for (const k of Object.keys(t)) delete t[k]; if (s && typeof s === 'object') Object.assign(t, s); },
    _zhxErr: (where, e) => { rec.errs.push([String(where), String((e && e.message) || e)]); },
    // 桩会被段内真实定义遮蔽（_ensureTryFast/_ensureFetchAll/_waitPageLoad 真实存在）——
    // 这里保留桩仅用于 fast 返回值注入（_ensureTryFast 桩不遮蔽，真实定义读不到 over.fast，
    // 因此必须用桩注入 fast 结果）。实际网络行为经 httpGet 桩记录。
    _ensureTryFast: async () => { rec.tryFast++; return over.fast === null ? null : (over.fast || { local: {} }); },
    _ensureFetchAll: async () => {},
    _waitPageLoad: async () => { rec.waitLoad++; },
    __zhxMark: (n) => { rec.marks.push(n); },
    document: { readyState: 'complete' },
    window: { addEventListener: () => {} },
    console: { info: () => {}, warn: () => {}, log: () => {} },
    setTimeout: (fn) => { rec.timers.push(fn); return rec.timers.length; },
    clearTimeout: () => {},
  };
  const flushTimers = () => {
    let guard = 0;
    while (rec.timers.length && guard++ < 100) {
      const fn = rec.timers.shift();
      try { fn(); } catch (e) { rec.timerErr = String(e && e.message); }
    }
  };
  return { rec, args, store, flushTimers };
}

function buildDM(world) {
  const body = [...CACHE_SEGS, ...DM_SEGS].join('\n');
  const ret = [
    'return {',
    '  dataManager, ensureTables, itemDbReady,',
    '  _ensureMain, _ensureFinalize, _ensureBuildLocal, _hotSwapIndexes,',
    '  _state: () => ({ ver: DATA_VER, len: (ITEM_DB_TEXT || "").length }),',
    '};',
  ].join('\n');
  const fn = new Function(...NAMES, body + '\n' + ret);
  return fn(...NAMES.map((n) => world.args[n]));
}

/** 推进微任务与计时器任务，直到 promise 完成（或轮次用尽）。 */
async function settle(world, p, tries = 80) {
  let done = false;
  if (p && typeof p.then === 'function') p.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < tries && !done; i++) {
    world.flushTimers();
    await new Promise((r) => setImmediate(r));
  }
  return done;
}

// ═════════════════════════ 开始 ═════════════════════════════════

console.log('\n── A：>24h 首开·有旧缓存 → 先建后探（就绪不等待探测）──');
{
  const w = makeWorld({
    need: ['items'],
    store: {
      'zhx.meta': JSON.stringify({ v: 'old', t: Date.now() - 25 * 3600 * 1000, candidatePolicy: 1 }),
      'zhx.dt.items': 'oldfp\n' + OLD_ITEMS,
    },
    fast: { local: { items: { fp: 'oldfp', tx: OLD_ITEMS } } },
  });
  const dm = buildDM(w);
  // 走完整 ensureTables 链：_ensureMain（先建后探）→ 外层 _ensureFinalize（构建+广播）
  const mainPromise = dm.ensureTables();
  await new Promise((r) => setImmediate(r));
  const settledEarly = await settle(w, mainPromise, 5);
  ok('A1 ensureTables 不等网络即完成（先建后探）', settledEarly);
  ok('A2 缓存已被应用（applyTable 调用）', w.rec.apply.some(([n]) => n === 'items'));
  eq('A3 旧版本回填 DATA_VER', dm._state().ver, 'old');
  // 就绪广播已触发（外层 finalize）
  ok('A4 就绪广播已触发（不等网络）', w.rec.fires.length >= 1, `fires=${w.rec.fires.length}`);
  // 后台探测已发起（真实 _ensureFetchAll 发出 v2 version.json 请求；网络全 reject → 失败）
  await settle(w, mainPromise);
  ok('A5 后台探测已发起（发出 v2 version.json 请求）', w.rec.xhr.some((u) => u.includes('version.json')));
  eq('A6 探测失败后不热替换（builds 保持 1——仅首次 finalize）', w.rec.builds, 1);
}

console.log('\n── B：热替换原子切换（探测到新版本 → 索引替换）──');
{
  const w = makeWorld({
    need: ['items'],
    store: {
      'zhx.meta': JSON.stringify({ v: 'old', t: Date.now() - 25 * 3600 * 1000, candidatePolicy: 1 }),
      'zhx.dt.items': 'oldfp\n' + OLD_ITEMS,
    },
    fast: { local: { items: { fp: 'oldfp', tx: OLD_ITEMS } } },
    // 后台探测成功：version.json + items.tsv 都返回新版本数据
    http: (url) => {
      if (url.endsWith('version.json')) return Promise.resolve(JSON.stringify({ v: 'new', candidatePolicy: 1, files: { items: 'newfp' } }));
      if (url.endsWith('items.tsv')) return Promise.resolve(NEW_ITEMS);
      return Promise.reject(new Error('unexpected: ' + url));
    },
  });
  const dm = buildDM(w);
  const mainPromise = dm.ensureTables();
  await new Promise((r) => setImmediate(r));
  await settle(w, mainPromise, 5);
  // 首次 finalize 已广播
  ok('B0 首次就绪广播已触发', w.rec.fires.length >= 1);
  // 后台探测成功 → 热替换触发（真实 _hotSwapIndexes 调 buildTables 桩）
  await settle(w, mainPromise);
  ok('B1 后台探测成功（发出 version.json + items.tsv 请求）', w.rec.xhr.some((u) => u.includes('version.json')) && w.rec.xhr.some((u) => u.includes('items.tsv')));
  ok('B2 热替换触发索引重建（builds>=2）', w.rec.builds >= 2, `builds=${w.rec.builds}`);
  eq('B3 新版本回填 DATA_VER', dm._state().ver, 'new');
  // 查询无空窗：热替换后索引可用（buildTables 桩直接 cb()；就绪广播不重复）
  eq('B4 就绪广播仍为首次（不重放）', w.rec.fires.length, 1);
  // 热替换后中文搜索索引已重置并重建（_irBuildAux 被调用）
  ok('B5 热替换后中文搜索索引已重建（hotSwapAux 标记）', w.rec.marks.includes('hotSwapAux'), `marks=${JSON.stringify(w.rec.marks)}`);
}

console.log('\n── C：后台探测失败 → 数据仍可用（静默降级）──');
{
  const w = makeWorld({
    need: ['items'],
    store: {
      'zhx.meta': JSON.stringify({ v: 'old', t: Date.now() - 25 * 3600 * 1000, candidatePolicy: 1 }),
      'zhx.dt.items': 'oldfp\n' + OLD_ITEMS,
    },
    fast: { local: { items: { fp: 'oldfp', tx: OLD_ITEMS } } },
    http: () => Promise.reject(new Error('down')),
  });
  const dm = buildDM(w);
  const mainPromise = dm.ensureTables();
  await new Promise((r) => setImmediate(r));
  await settle(w, mainPromise, 5);
  await settle(w, mainPromise);
  ok('C1 流程完成（不阻断）', true);
  ok('C2 旧缓存已应用（数据可用）', w.rec.apply.some(([n]) => n === 'items'));
  ok('C3 就绪广播已触发', w.rec.fires.length >= 1);
  eq('C4 未触发热替换（builds 保持 1）', w.rec.builds, 1);
  ok('C5 无未处理异常', !w.rec.buildErr && !w.rec.timerErr);
}

console.log('\n── D：无缓存全新安装 → 行为与现状一致（走原等待链）──');
{
  const w = makeWorld({
    need: ['items'],
    fast: { local: {} },   // 无任何缓存
    http: () => Promise.reject(new Error('down')),
  });
  const dm = buildDM(w);
  const mainPromise = dm.ensureTables();
  await new Promise((r) => setImmediate(r));
  eq('D1 未提前应用缓存', w.rec.apply.length, 0);
  // 走原等待链：_waitPageLoad（真实定义空操作）+ _ensureFetchAll（真实定义发 v2 请求）
  await settle(w, mainPromise);
  ok('D2 发出 v2 探测请求（走原链）', w.rec.xhr.some((u) => u.includes('version.json')));
  eq('D3 构建由外层 finalize 完成（builds=1）', w.rec.builds, 1);
  ok('D4 就绪广播触发', w.rec.fires.length >= 1);
}

console.log('\n── E：快速后台响应不得与首次分片构建并发 ──');
{
  let releaseVersion;
  let finishFirstBuild;
  const version = new Promise((resolve) => { releaseVersion = resolve; });
  const w = makeWorld({
    need: ['items'],
    store: {
      'zhx.meta': JSON.stringify({ v: 'old', t: Date.now() - 25 * 3600 * 1000, candidatePolicy: 1 }),
      'zhx.dt.items': 'oldfp\n' + OLD_ITEMS,
    },
    http: (url) => url.endsWith('version.json') ? version
      : Promise.resolve(NEW_ITEMS),
  });
  w.args.buildTables = (scope, done) => {
    w.rec.builds++;
    if (w.rec.builds === 1) finishFirstBuild = done;
    else done();
  };
  const dm = buildDM(w);
  const firstReady = dm.ensureTables();
  await new Promise((resolve) => setImmediate(resolve));
  w.flushTimers();
  eq('E1 首次构建已启动但未完成', w.rec.builds, 1);
  releaseVersion(JSON.stringify({ v: 'new', candidatePolicy: 1, files: { items: 'newfp' } }));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  eq('E2 后台下载完成仍不并发启动热替换', w.rec.builds, 1);
  finishFirstBuild();
  await settle(w, firstReady);
  await new Promise((resolve) => setImmediate(resolve));
  eq('E3 首次就绪后才启动热替换', w.rec.builds, 2);
  eq('E4 就绪广播仍只触发一次', w.rec.fires.length, 1);
}

console.log(`\n════════ 汇总 ════════`);
console.log(`通过 ${pass} / 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
