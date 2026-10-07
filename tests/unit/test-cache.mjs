// tests/unit/test-cache.mjs — Phase 14：Core Cache Registry（缓存体系集中登记）
//
// 目的：把「每类缓存的职责 / 生命周期 / 容量 / 失效」的登记机制用断言钉死：
//   - 登记完整性（8 个缓存实体、三类 kind 的计数、登记名单）
//   - 按类清理 / 全清 / 隔离 kind（任意字符串）
//   - 观测 cacheInfo（条目数 + data / dict 修订号）
//   - 容量防线 cacheGuard（Map 型 / 对象型 + 计数器 / for-in 回落）
//   - 异常安全（单个 reset 抛错不阻断其余）与同名覆盖语义
//
// 机制：从构建产物（dist）提取 @zhixia:core-cache-registry 区段，以桩装配运行——
//       8 个缓存实体以最小桩（Map / 对象 / null）替代；不依赖 Chrome / 外网。
//
// 说明：真实调用链（_fireTablesReady 按类清 / dictInvalidate → translate 类 /
//       三个查找缓存的容量防线）由 test-data-layer / test-dictionary 与
//       integration 覆盖；本文件冻结注册表机制本身的契约。
//
// 运行：node tests/unit/test-cache.mjs   （或 npm run test:unit）
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

const REG_SEG = sliceAll(DIST_TEXT, 'core-cache-registry');

// ── 桩：8 个缓存实体（最小可断言形态；必须先于区段：值捕获纪律）──
const STUB_LINES = [
  'let _en2zhCache = new Map(), _jp2zhCache = new Map();',
  'const RONKA_ITEM_CACHE = Object.create(null);',
  'let _ronkaCacheN = 0;',
  'let _seriesMap = null, _seriesPfxCache = null, _itemPfxCache = null;',
  'let _fcSubstrCache = null, _allKeysCache = null;',
  'const DATA_VER = "TESTV-1";',
  'function dictGetRevision() { return 42; }',
];

const RETURN_STMT = [
  'return { cacheRegister, cacheReset, cacheInfo, cacheGuard, CACHE_CAP_LOOKUP,',
  '  reg: _cacheReg,',
  '  fill: () => {',
  '    _en2zhCache.set("a", 1); _jp2zhCache.set("b", 2);',
  '    RONKA_ITEM_CACHE["z"] = 3; _ronkaCacheN = 1;',
  '    _seriesMap = new Map([["x", 1]]); _seriesPfxCache = new Map([["y", 1]]); _itemPfxCache = new Map([["z", 1]]);',
  '    _fcSubstrCache = ["k"]; _allKeysCache = ["k"];',
  '  },',
  '  peek: () => ({ en: _en2zhCache.size, jp: _jp2zhCache.size, ronkaN: _ronkaCacheN, ronkaKeys: Object.keys(RONKA_ITEM_CACHE).length,',
  '    sm: _seriesMap !== null, sp: _seriesPfxCache !== null, ip: _itemPfxCache !== null, fc: _fcSubstrCache, ak: _allKeysCache }),',
  '  allEmpty: () => _en2zhCache.size === 0 && _jp2zhCache.size === 0 && Object.keys(RONKA_ITEM_CACHE).length === 0 && _ronkaCacheN === 0',
  '    && _seriesMap === null && _seriesPfxCache === null && _itemPfxCache === null && _fcSubstrCache === null && _allKeysCache === null };',
].join('\n');

function buildReg() {
  const body = [...STUB_LINES, ...REG_SEG, RETURN_STMT].join('\n');
  try {
    const fn = new Function(body);
    return fn();
  } catch (e) {
    throw new Error('CacheRegistry 装配失败：' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// A. 登记完整性
// ─────────────────────────────────────────────────────────────
console.log('── A：登记完整性 ──');
{
  const api = buildReg();
  eq('登记数量 = 8', api.reg.size, 8);
  const kinds = {};
  for (const [, e] of api.reg) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  eq('lookup 类 = 3', kinds.lookup, 3);
  eq('derived 类 = 3', kinds.derived, 3);
  eq('translate 类 = 2', kinds.translate, 2);
  eq('kind 种类 = 3（无未归类条目）', Object.keys(kinds).length, 3);
  const names = [...api.reg.keys()].sort().join(',');
  eq('登记名单', names, 'allKeys,en2zh,fcSubstr,itemPfx,jp2zh,ronkaItems,seriesMap,seriesPfx');
}

// ─────────────────────────────────────────────────────────────
// B. 按类清理（互不影响）
// ─────────────────────────────────────────────────────────────
console.log('── B：按类清理 ──');
{
  const api = buildReg();

  api.fill();
  api.cacheReset('lookup');
  const p1 = api.peek();
  ok('lookup 清理：en2zh / jp2zh 清空', p1.en === 0 && p1.jp === 0);
  ok('lookup 清理：ronkaItems 清空且计数归零', p1.ronkaKeys === 0 && p1.ronkaN === 0);
  ok('lookup 清理：不影响 derived', p1.sm && p1.sp && p1.ip);
  ok('lookup 清理：不影响 translate', p1.fc !== null && p1.ak !== null);

  api.fill();
  api.cacheReset('translate');
  const p2 = api.peek();
  ok('translate 清理：fcSubstr / allKeys 置空', p2.fc === null && p2.ak === null);
  ok('translate 清理：不影响 lookup', p2.en === 1 && p2.jp === 1 && p2.ronkaKeys === 1);
  ok('translate 清理：不影响 derived', p2.sm && p2.sp && p2.ip);

  api.fill();
  api.cacheReset('derived');
  const p3 = api.peek();
  ok('derived 清理：seriesMap / seriesPfx / itemPfx 置空', !p3.sm && !p3.sp && !p3.ip);
  ok('derived 清理：不影响 lookup', p3.en === 1 && p3.jp === 1);
  ok('derived 清理：不影响 translate', p3.fc !== null && p3.ak !== null);
}

// ─────────────────────────────────────────────────────────────
// C. 全清（无参）
// ─────────────────────────────────────────────────────────────
console.log('── C：全清 ──');
{
  const api = buildReg();
  api.fill();
  api.cacheReset();
  ok('全清：所有缓存实体归空', api.allEmpty());
}

// ─────────────────────────────────────────────────────────────
// D. 观测 cacheInfo
// ─────────────────────────────────────────────────────────────
console.log('── D：观测 cacheInfo ──');
{
  const api0 = buildReg();
  const info0 = api0.cacheInfo();
  eq('未建时 seriesMap = 0（空态不抛）', info0.entries.seriesMap, 0);
  eq('未建时 fcSubstr = 0', info0.entries.fcSubstr, 0);

  const api = buildReg();
  api.fill();
  const info = api.cacheInfo();
  eq('cacheInfo：en2zh = 1', info.entries.en2zh, 1);
  eq('cacheInfo：jp2zh = 1', info.entries.jp2zh, 1);
  eq('cacheInfo：ronkaItems = 1', info.entries.ronkaItems, 1);
  eq('cacheInfo：seriesMap = 1', info.entries.seriesMap, 1);
  eq('cacheInfo：fcSubstr = 1', info.entries.fcSubstr, 1);
  eq('cacheInfo：data 修订号', info.rev.data, 'TESTV-1');
  eq('cacheInfo：dict 修订号', info.rev.dict, 42);
  api.cacheReset();
  const info2 = api.cacheInfo();
  eq('cacheInfo：清空后 en2zh = 0', info2.entries.en2zh, 0);
  eq('cacheInfo：清空后 fcSubstr = 0', info2.entries.fcSubstr, 0);
}

// ─────────────────────────────────────────────────────────────
// E. 容量防线 cacheGuard
// ─────────────────────────────────────────────────────────────
console.log('── E：容量防线 cacheGuard ──');
{
  const api = buildReg();
  const m2 = new Map([['a', 1], ['b', 2]]);
  ok('Map 2/3：不清', api.cacheGuard(m2, 3) === false && m2.size === 2);
  const m3 = new Map([['a', 1], ['b', 2], ['c', 3]]);
  ok('Map 3/3：清空', api.cacheGuard(m3, 3) === true && m3.size === 0);
  const o = Object.create(null);
  o.a = 1; o.b = 2;
  ok('对象 2/3（计数器）：不清', api.cacheGuard(o, 3, 2) === false && Object.keys(o).length === 2);
  ok('对象 3/3（计数器）：清空', api.cacheGuard(o, 3, 3) === true && Object.keys(o).length === 0);
  const o2 = Object.create(null);
  o2.a = 1; o2.b = 2; o2.c = 3;
  ok('对象 3/3（无计数器，for-in 计数）：清空', api.cacheGuard(o2, 3) === true && Object.keys(o2).length === 0);
  ok('空引用：false 且不抛', api.cacheGuard(null, 3) === false);
  ok('默认上限常量存在且为正整数', api.CACHE_CAP_LOOKUP > 0 && Number.isInteger(api.CACHE_CAP_LOOKUP));
}

// ─────────────────────────────────────────────────────────────
// F. 异常安全与隔离 kind
// ─────────────────────────────────────────────────────────────
console.log('── F：异常安全与隔离 kind ──');
{
  const api = buildReg();
  api.fill();
  let goodCalled = false;
  api.cacheRegister('good-x', '__t__', () => { goodCalled = true; });
  api.cacheRegister('boom-x', '__t__', () => { throw new Error('boom'); });
  let threw = false;
  try { api.cacheReset('__t__'); } catch (e) { threw = true; }
  ok('reset：单个抛错不阻断其余', !threw && goodCalled);
  eq('隔离 kind 后登记数 = 10', api.reg.size, 10);
  const p = api.peek();
  ok('隔离 kind 不影响真实缓存', p.en === 1 && p.fc !== null && p.sm && p.ronkaN === 1);
}

// ─────────────────────────────────────────────────────────────
// G. 同名重复注册 = 覆盖
// ─────────────────────────────────────────────────────────────
console.log('── G：同名重复注册 ──');
{
  const api = buildReg();
  let called = false;
  api.cacheRegister('__dup__', '__t2__', () => { called = true; });
  api.cacheRegister('__dup__', '__t2__', () => { called = false; });
  api.cacheReset('__t2__');
  ok('重复注册为覆盖：后注册者生效', called === false);
  eq('重复注册不新增条目', api.reg.size, 9);
}

// ─────────────────────────────────────────────────────────────
// 汇总
// ─────────────────────────────────────────────────────────────
console.log('\n════════ 汇总 ════════');
console.log(`通过 ${pass} / 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
