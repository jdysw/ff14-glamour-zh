// tests/unit/test-data-manager.mjs — Phase 11：冻结 DataManager（统一数据管理 API）行为
//
// 目的：把数据链集中管理层（ensure / ready / getTable / getIndex / invalidate）
//       与既有链路行为（缓存快路径 / 版本探测 / 下载失败兜底 / 无数据降级）
//       用断言钉死。后续模块化（Phase 15）与任何重构必须保持这些行为不变。
//
// 机制：从构建产物（dist）提取 @zhixia:core-cache（2 段）与 @zhixia:core-data-manager
//       区段，以桩装配运行——GM 存储 / HTTP / 建表 / 就绪广播 / 计时器全部桩化
//       （记录调用、手动 flush），不依赖 Chrome / 外网。
//
// 说明：
//   - 快路径（24 小时内已对齐 + 缓存齐全）必须零网络——「每日至多一次版本检查」。
//   - 下载失败：有旧缓存 → 继续用旧缓存；无缓存 → 流程仍完成（界面翻译不受影响）。
//   - setTimeout 为手动装配桩：flushTimers() 驱动分片/推迟任务；setImmediate 用于
//     微任务轮转（真实 Node 全局，不受桩影响）。
//
// 运行：node tests/unit/test-data-manager.mjs   （或 npm run test:unit）
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
  if (!out.length) throw new Error(`区段缺失：${tag}（src 结构可能已变化）`);
  return out;
}

const CACHE_SEGS = sliceAll(DIST_TEXT, 'core-cache');
const DM_SEGS = sliceAll(DIST_TEXT, 'core-data-manager');

// 外部依赖注入清单（data-manager / cache 段内未定义、被引用的标识符）
const NAMES = [
  'storeGetAsync', 'storeSet', 'httpGet',
  'ITEM_DB_TEXT', 'SERIES_TEXT', 'ACL_CFC_TEXT',
  'itemHash', 'nameMap', 'ecidMap', 'koByZh',
  'DATA_VER', 'DATA_BASE', 'DATA_BASE_V3', 'DATA_FILES',
  'applyTable', 'neededTables', '_siteIndexes', 'buildTables', '_fireTablesReady',
  'findSite', 'applyRuntimeDict', '_irAliasMap', '_irDupMap', '_zhxErr',
  '__zhxMark', 'document', 'window', 'console', 'setTimeout', 'clearTimeout',
];

/** 构造桩世界：记录器 + 参数值 + flushTimers。 */
function makeWorld(over = {}) {
  const rec = { apply: [], xhr: [], set: [], timers: [], marks: [], fires: [], builds: 0, need: 0, errs: [] };
  const store = Object.assign({}, over.store || {});
  const args = {
    storeGetAsync: (k) => Promise.resolve(store[k] === undefined ? null : store[k]),
    storeSet: (k, v) => { store[k] = v; rec.set.push([k, v]); },
    httpGet: (url) => { rec.xhr.push(url); return (over.http || (() => Promise.reject(new Error('net down'))))(url); },
    ITEM_DB_TEXT: '',
    SERIES_TEXT: '',
    ACL_CFC_TEXT: '',
    itemHash: null, nameMap: null, ecidMap: null, koByZh: null,
    DATA_VER: '',
    DATA_BASE: 'https://example.test/ff14/v2/',
    DATA_BASE_V3: 'https://example.test/ff14/v3/',
    // v3：不在此测试覆盖（由 test-runtime-v3.mjs 专测）；findSite 返回 null 使 v3 直接跳过
    findSite: () => null,
    applyRuntimeDict: () => {},
    _irAliasMap: null, _irDupMap: null,
    _zhxErr: (where, e) => { rec.errs.push([String(where), String((e && e.message) || e)]); },
    DATA_FILES: { items: 'items.tsv', series: 'series.txt', acl: 'acl.txt', dict: 'dict.json' },
    applyTable: (n, t) => { rec.apply.push([n, t]); },
    neededTables: () => { rec.need++; return over.need || ['items']; },
    _siteIndexes: () => over.scope || null,
    buildTables: (scope, cb) => { rec.builds++; try { cb(); } catch (e) { rec.buildErr = String(e && e.message); } },
    _fireTablesReady: () => { rec.fires.push(1); },
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

/** 装配 data-manager 区段（含 cache 两段）。 */
function buildDM(world) {
  const body = [...CACHE_SEGS, ...DM_SEGS].join('\n');
  const ret = [
    'return {',
    '  dataManager, dataGetTable, dataGetIndex, dataInvalidate, ensureTables, itemDbReady,',
    '  _setTable: (n, v) => { if (n === "items") ITEM_DB_TEXT = v; else if (n === "series") SERIES_TEXT = v; else if (n === "acl") ACL_CFC_TEXT = v; },',
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

console.log('\n── A：段标记与 API 形状 ──');
{
  eq('段标记：core-cache 2 段', CACHE_SEGS.length, 2);
  eq('段标记：core-data-manager 1 段', DM_SEGS.length, 1);

  const { api } = (() => { const w = makeWorld(); return { api: buildDM(w), w }; })();
  ok('dataManager 对象存在', api.dataManager && typeof api.dataManager === 'object');
  eq('dataManager.ensure 函数', typeof api.dataManager.ensure, 'function');
  eq('dataManager.ready 函数', typeof api.dataManager.ready, 'function');
  eq('dataManager.getTable 函数', typeof api.dataManager.getTable, 'function');
  eq('dataManager.getIndex 函数', typeof api.dataManager.getIndex, 'function');
  eq('dataManager.invalidate 函数', typeof api.dataManager.invalidate, 'function');
  eq('getTable 未知表 → null', api.dataManager.getTable('nope'), null);
  eq('getIndex 未知索引 → null', api.dataManager.getIndex('nope'), null);
  eq('getTable 未加载 → null', api.dataManager.getTable('items'), null);
  eq('getIndex 未加载 → null', api.dataManager.getIndex('itemHash'), null);
  ok('既有入口保留：ensureTables / itemDbReady', typeof api.ensureTables === 'function' && typeof api.itemDbReady === 'function');
}

console.log('\n── B：getTable / getIndex 引用语义 ──');
{
  const w = makeWorld();
  const api = buildDM(w);
  api._setTable('items', 'A'.repeat(200));
  api._setTable('series', '\n系列');
  eq('getTable(items) 返回文本', api.dataManager.getTable('items').length, 200);
  eq('getTable(series) 返回文本', api.dataManager.getTable('series'), '\n系列');
  eq('getTable(acl) 未设置 → null', api.dataManager.getTable('acl'), null);
}

console.log('\n── C：invalidate（失效就绪状态）──');
{
  const w = makeWorld({ need: ['items'] });
  const api = buildDM(w);

  api.dataInvalidate();
  eq('invalidate 后 ensure 可重新触发', w.rec.set.some(([k, v]) => k === 'zhx.meta' && v === ''), true);

  const p1 = api.dataManager.ensure();
  const p2 = api.dataManager.ensure();
  ok('两次 ensure 复用同一 Promise', p1 === p2);
  eq('neededTables 仅 1 次', w.rec.need, 1);
  await settle(w, p1);

  api.dataInvalidate();
  const p3 = api.dataManager.ensure();
  ok('invalidate 后新 Promise', p3 !== p1);
  eq('neededTables 第 2 次调用', w.rec.need, 2);
  await settle(w, p3);
}

console.log('\n── D：快路径（24 小时内已对齐 + 缓存齐全 → 零网络）──');
{
  const w = makeWorld({
    need: ['items'],
    store: {
      'zhx.meta': JSON.stringify({ v: 'v1', t: Date.now() }),
      'zhx.dt.items': 'fp1\n' + 'z'.repeat(150),
    },
  });
  const api = buildDM(w);
  const done = await settle(w, api.dataManager.ready());
  ok('ensure 完成', done);
  eq('零网络请求', w.rec.xhr.length, 0);
  eq('缓存直接应用（一次）', w.rec.apply.length, 1);
  eq('缓存应用的是 items', w.rec.apply[0][0], 'items');
  ok('缓存文本已应用', String(w.rec.apply[0][1]).startsWith('z'));
  eq('数据版本回填', api._state().ver, 'v1');
  eq('buildTables 执行', w.rec.builds, 1);
  eq('就绪广播触发', w.rec.fires.length, 1);
}

console.log('\n── E：版本变更 + 下载成功（完整链）──');
{
  const w = makeWorld({
    need: ['items'],
    http: (url) => {
      if (url.endsWith('version.json')) return Promise.resolve(JSON.stringify({ v: 'v9', files: { items: 'fp9' } }));
      if (url.endsWith('items.tsv')) return Promise.resolve('1\t甲\n' + 'y'.repeat(150));
      return Promise.reject(new Error('unexpected: ' + url));
    },
  });
  const api = buildDM(w);
  const cbSeen = [];
  const done = await settle(w, api.dataManager.ready(() => cbSeen.push(1)));
  ok('ensure 完成', done);
  ok('请求 version.json', w.rec.xhr.some((u) => u.endsWith('version.json')));
  ok('请求 items.tsv', w.rec.xhr.some((u) => u.endsWith('items.tsv')));
  eq('applyTable 收到 items', w.rec.apply.length >= 1 ? w.rec.apply[0][0] : null, 'items');
  ok('文本长度符合下载', w.rec.apply[0][1].length > 100);
  eq('buildTables 执行', w.rec.builds, 1);
  eq('就绪广播触发', w.rec.fires.length, 1);
  eq('ready 回调被调用', cbSeen.length, 1);
  eq('DATA_VER 更新为 v9', api._state().ver, 'v9');
  ok('meta 记录版本', w.rec.set.some(([k, v]) => k === 'zhx.meta' && String(v).includes('v9')));
}

console.log('\n── F：服务器不可用（无缓存 → 降级仍完成）──');
{
  const w = makeWorld({ need: ['items'], http: () => Promise.reject(new Error('down')) });
  const api = buildDM(w);
  const done = await settle(w, api.dataManager.ensure());
  ok('流程完成（不阻断）', done);
  eq('无表应用', w.rec.apply.length, 0);
  eq('就绪广播仍触发（界面翻译不受影响）', w.rec.fires.length, 1);
  eq('未写 meta', w.rec.set.filter(([k]) => k === 'zhx.meta').length, 0);
}

console.log('\n── G：下载失败 → 旧缓存兜底 ──');
{
  const w = makeWorld({
    need: ['items'],
    store: { 'zhx.dt.items': 'oldfp\n' + 'q'.repeat(150) },
    http: (url) => {
      if (url.endsWith('version.json')) return Promise.resolve(JSON.stringify({ v: 'v10', files: { items: 'newfp' } }));
      return Promise.reject(new Error('down'));
    },
  });
  const api = buildDM(w);
  const done = await settle(w, api.dataManager.ensure());
  ok('流程完成', done);
  eq('旧缓存被兜底应用（items）', w.rec.apply.length >= 1 ? w.rec.apply[0][0] : null, 'items');
  ok('应用的是旧缓存文本', String(w.rec.apply[0][1]).startsWith('q'));
  eq('就绪广播触发', w.rec.fires.length, 1);
}

console.log(`\n════════ 汇总 ════════`);
console.log(`通过 ${pass} / 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
