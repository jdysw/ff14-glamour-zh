// tests/unit/test-item-resolver.mjs — Phase 6：冻结 ItemResolve 行为（golden tests）
//
// 目的：把物品索引统一解析层（hash / 名称 / 重名注册表 / 别名）的当前行为用断言钉死。
//       后续模块化（Phase 15）与任何重构必须保持这些行为不变。
//
// 机制：从构建产物（dist）提取 @zhixia:core-item-resolver 区段，以桩装配运行——
//       itemHash / nameMap 从空对象或预置映射起；物品总表文本为构造样例；
//       tryEnToZh / itemDbReady 用桩替换。不依赖 Chrome / 外网。
//
// 说明：
//   - 「同名键首行胜」是与主索引一致的既有语义（resolveByName 不变）；
//     重名键（同键多译）经 resolveAllByName 取全量，顺序 = TSV 行序（历史优先）。
//   - 同名同译（同键同译）的重复行不登记（不影响任何查询结果）。
//   - 「真实站点译文/链接」由 integration / live 套件端到端覆盖；本文件聚焦解析契约。
//   - 同 test-core：假宿主桩必须在 buildResolver() 之前设置（装配参数为值捕获）。
//
// 运行：node tests/unit/test-item-resolver.mjs   （或 npm run test:unit）
import fs from 'node:fs';
import { readDist, itemsTsvPath } from '../helpers/paths.mjs';

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

const RESOLVER_SEG = sliceAll(DIST_TEXT, 'core-item-resolver')
  .map((seg) => seg.replaceAll('const id = findSite()?.id;', 'const id = __testFindSite()?.id;'));

// 构造样例：含真歧义（A/ア/가 → 甲|乙）、同名同译（B/イ/나 → 丙|丙）、别名（含分号拆分）
const SAMPLE_TSV = [
  'key\tzh\ten\tja\tko\thash\tecid\talias',
  '1\t甲\tA\tア\t가\th1\t100\t',
  '2\t乙\tA\tア\t가\th2\t101\t',
  '3\t丙\tB\tイ\t나\th3\t102\t丙组合',
  '4\t丙\tB\tイ\t나\th4\t103\t丙组合；丙套装',
  '5\t丁\tC\tウ\t다\th5\t104\t',
  '6\t炎灵长袍\tD\tエ\t라\th6\t105\t炎灵袍',
  '7\t炎灵长裤\tE\tオ\t마\th7\t106\t炎灵裤',
  '8\t炎灵\tF\tカ\t바\th8\t107\t',
].join('\n');

// Legacy alias fixture：专门冻结 Phase 6 原有别名注册表契约。
// 中文智能输入新增装备数据不应改变这个 golden test 的覆盖范围。
const LEGACY_SAMPLE_TSV = [
  'key\tzh\ten\tja\tko\thash\tecid\talias',
  '1\t甲\tA\tア\t가\th1\t100\t',
  '2\t乙\tA\tア\t가\th2\t101\t',
  '3\t丙\tB\tイ\t나\th3\t102\t丙组合',
  '4\t丙\tB\tイ\t나\th4\t103\t丙组合；丙套装',
  '5\t丁\tC\tウ\t다\th5\t104\t',
].join('\n');

// nameMap 预置映射（模拟「已按首行胜构建完成」的状态；与样例首行一致）
const PRESET_NAME_MAP = {
  A: '甲', 'ア': '甲', '가': '甲',
  B: '丙', 'イ': '丙', '나': '丙',
  C: '丁', 'ウ': '丁', '다': '丁',
};

/**
 * 装配 Item Resolver 区段。
 * @param {object} env 覆盖项：itemHash / nameMap / text / itemDbReady
 */
function buildResolver(env = {}) {
  const rec = { tryCalls: [], readyCbs: [], errs: [] };
  const stubs = [
    'let _tablesReady = true;',
    'let itemHash = __env.itemHash;',
    'let nameMap = __env.nameMap;',
    'let ecidMap = __env.ecidMap;',
    'let koByZh = __env.koByZh;',
    'let ITEM_DB_TEXT = __env.text || "";',
    'const DATA_TEXT = { get items() { return ITEM_DB_TEXT; } };',
    'let _v3Applied = !!__env.v3Applied;',
    'const __testFindSite = () => __env.site || { id: "mirapri" };',
    'const itemDbReady = __env.itemDbReady;',
    'const tryEnToZh = (n) => { __rec.tryCalls.push(n); return (n === "KNOWN_EN") ? "英文名译" : null; };',
    'const _zhxErr = (where, e) => __rec.errs.push([String(where), String((e && e.message) || e)]);',
  ];
  const ret = [
    'return { resolveByHash, resolveByName, resolveByZh, suggestByZh, resolveAllByName, resolveAlias, resolve, resolveEcId, resolveKo, _irBuildAux, __stats: () => ({ ..._irStats }),',
    '  __maps: () => ({ dup: _irDupMap, ali: _irAliasMap }),',
    '  __setV3: (v) => { _v3Applied = v; } };',
  ].join('\n');
  const body = [...stubs, ...RESOLVER_SEG, ret].join('\n');
  try {
    const fn = new Function('__env', '__rec', body);
    return fn(env, rec);
  } catch (e) {
    throw new Error('Item Resolver 装配失败：' + e.message);
  }
}

const mkEnv = (over = {}) => ({
  itemHash: { h1: '甲', h3: '丙' },
  nameMap: { ...PRESET_NAME_MAP },
  ecidMap: { 甲: 100, 丙: 102 },
  koByZh: { 甲: '가', 丙: '나' },
  text: SAMPLE_TSV,
  itemDbReady: undefined,
  site: { id: 'mirapri' },
  ...over,
});

// ─────────────────────────────────────────────────────────────
// A. 基础查询（同名键首行胜；与主索引一致）
// ─────────────────────────────────────────────────────────────
{
  const api = buildResolver(mkEnv());
  eq('resolveByHash 命中', api.resolveByHash('h1'), '甲');
  eq('resolveByHash 未命中 → null', api.resolveByHash('nope'), null);
  eq('resolveByHash 空输入 → null', api.resolveByHash(''), null);

  eq('resolveByName 命中（首行胜）', api.resolveByName('A'), '甲');
  eq('resolveByName 未命中 → null', api.resolveByName('nope'), null);
  eq('resolveByName 空输入 → null', api.resolveByName(null), null);

  eq('接口函数齐备', ['resolveByHash', 'resolveByName', 'resolveByZh', 'suggestByZh', 'resolveAllByName', 'resolveAlias', 'resolve', 'resolveEcId', 'resolveKo', '_irBuildAux']
    .every((f) => typeof api[f] === 'function'), true);
}

// ─────────────────────────────────────────────────────────────
// A2. EC_ID / 韩文名反查（v1.4 Phase 10：Wiki 唯一数据入口）
// ─────────────────────────────────────────────────────────────
{
  const api = buildResolver(mkEnv());
  eq('resolveEcId 命中（数字值转字符串）', api.resolveEcId('甲'), '100');
  eq('resolveEcId 未命中 → null', api.resolveEcId('无'), null);
  eq('resolveEcId 空输入 → null', api.resolveEcId(''), null);
  eq('resolveKo 命中', api.resolveKo('甲'), '가');
  eq('resolveKo 未命中 → null', api.resolveKo(null), null);

  // 统计计数（新实例，避免上文查询干扰）：resolveByHash / resolveByName / resolveEcId / resolveKo 自增 hit/miss
  const api2 = buildResolver(mkEnv());
  eq('统计：初始 0/0', JSON.stringify(api2.__stats()), JSON.stringify({ hit: 0, miss: 0 }));
  api2.resolveByHash('h1');          // hit
  api2.resolveByName('nope');        // miss
  api2.resolveEcId('丙');            // hit
  api2.resolveKo('无');              // miss
  eq('统计：2 hit / 2 miss', JSON.stringify(api2.__stats()), JSON.stringify({ hit: 2, miss: 2 }));
}

// ─────────────────────────────────────────────────────────────
// B. 重名 / 别名注册表（_irBuildAux）
// ─────────────────────────────────────────────────────────────
{
  const api = buildResolver(mkEnv());
  // 未构建时：回退主索引行为
  eq('未构建：resolveAllByName 回退首行', JSON.stringify(api.resolveAllByName('A')), JSON.stringify(['甲']));

  const r = api._irBuildAux(LEGACY_SAMPLE_TSV);
  eq('_irBuildAux 返回 true', r, true);
  eq('中文装备名 → 当前站点日文名', api.resolveByZh('甲'), 'ア');
  eq('中文别名 → 当前站点日文名', api.resolveByZh('丙组合'), 'イ');
  eq('智能输入：少于 2 个中文字符不提示', JSON.stringify(api.suggestByZh('炎')), JSON.stringify([]));
  eq('智能输入：前缀返回按键序候选', JSON.stringify(api.suggestByZh('炎灵')), JSON.stringify([
    { zh: '炎灵', native: 'カ' },
    { zh: '炎灵袍', native: 'エ' },
    { zh: '炎灵裤', native: 'オ' },
    { zh: '炎灵长袍', native: 'エ' },
    { zh: '炎灵长裤', native: 'オ' },
  ]));
  eq('智能输入：别名也可作为候选', JSON.stringify(api.suggestByZh('炎灵袍')), JSON.stringify([
    { zh: '炎灵袍', native: 'エ' },
  ]));
  eq('智能输入：候选上限 8 条', api.suggestByZh('炎灵', 99).length <= 8, true);
  const maps = api.__maps();

  eq('真歧义登记（en）', JSON.stringify(maps.dup.A), JSON.stringify(['甲', '乙']));
  eq('真歧义登记（ja）', JSON.stringify(maps.dup['ア']), JSON.stringify(['甲', '乙']));
  eq('真歧义登记（ko）', JSON.stringify(maps.dup['가']), JSON.stringify(['甲', '乙']));
  eq('同名同译不登记（en）', maps.dup.B, undefined);
  eq('同名同译不登记（ja）', maps.dup['イ'], undefined);
  eq('同名同译不登记（ko）', maps.dup['나'], undefined);
  eq('无重复键不登记', maps.dup.C, undefined);

  eq('别名登记（单值）', JSON.stringify(maps.ali['丙组合']), JSON.stringify(['丙']));
  eq('别名登记（分号拆分）', JSON.stringify(maps.ali['丙套装']), JSON.stringify(['丙']));
  eq('主体别名含全部拆分键', Object.keys(maps.ali).sort().join(','), '丙套装,丙组合');

  eq('resolveAllByName 真歧义 → 全量（行序）', JSON.stringify(api.resolveAllByName('A')), JSON.stringify(['甲', '乙']));
  eq('resolveAllByName 非重名 → 单值数组', JSON.stringify(api.resolveAllByName('B')), JSON.stringify(['丙']));
  eq('resolveAllByName 未命中 → []', JSON.stringify(api.resolveAllByName('X')), JSON.stringify([]));
  eq('resolveAlias 命中', JSON.stringify(api.resolveAlias('丙组合')), JSON.stringify(['丙']));
  eq('resolveAlias 未命中 → []', JSON.stringify(api.resolveAlias('无')), JSON.stringify([]));

  // 容错与幂等
  eq('_irBuildAux 空文本 → false', api._irBuildAux(''), false);
  eq('_irBuildAux null → false', api._irBuildAux(null), false);
  eq('_irBuildAux 幂等（重复构建同结果）', api._irBuildAux(LEGACY_SAMPLE_TSV) && JSON.stringify(api.__maps().dup.A), JSON.stringify(['甲', '乙']));
  const kept = api.resolveAllByName('A');
  ok('返回数组为副本（修改不污染注册表）', (() => { kept.push('x'); return api.resolveAllByName('A').length === 2; })());
}

// ─────────────────────────────────────────────────────────────
// B2. 中文搜索按站点语言倒排
// ─────────────────────────────────────────────────────────────
{
  for (const [site, expected] of [
    ['mirapri', 'ア'],
    ['fc', 'ア'],
    ['collection', 'ア'],
    ['ronka', '가'],
    ['ec', 'A'],
  ]) {
    const api = buildResolver(mkEnv({ site: { id: site } }));
    api._irBuildAux(SAMPLE_TSV);
    eq(`中文装备名 → ${site} 原生名`, api.resolveByZh('甲'), expected);
  }
}

// ─────────────────────────────────────────────────────────────
// C. resolve 统一优先级
// ─────────────────────────────────────────────────────────────
{
  const api = buildResolver(mkEnv());
  api._irBuildAux(SAMPLE_TSV);

  eq('resolve：hash 优先于 name', api.resolve({ hash: 'h3', name: 'A' }), '丙');
  eq('resolve：hash 未中回退 name', api.resolve({ hash: 'nope', name: 'A' }), '甲');
  eq('resolve：name 命中', api.resolve({ name: 'B' }), '丙');
  eq('resolve：alias 优先位（name 未中时）', api.resolve({ alias: '丙组合' }), '丙');
  eq('resolve：全未中 → null', api.resolve({ hash: 'x', name: 'y', alias: 'z' }), null);
  eq('resolve：空输入 → null', api.resolve(null), null);
  eq('resolve：空对象 → null', api.resolve({}), null);

  // 历史兼容 fallback（latinFallback）
  eq('latinFallback 开启 → 外文名兜底', api.resolve({ name: 'KNOWN_EN' }, { latinFallback: true }), '英文名译');
  eq('latinFallback 关闭（默认）→ 不兜底', api.resolve({ name: 'KNOWN_EN' }), null);
  eq('latinFallback 不覆盖 name 命中', api.resolve({ name: 'A' }, { latinFallback: true }), '甲');
}

// ─────────────────────────────────────────────────────────────
// D. itemDbReady 注册（数据就绪钩子）
// ─────────────────────────────────────────────────────────────
{
  const cbs = [];
  const env = mkEnv({ text: LEGACY_SAMPLE_TSV, itemDbReady: (cb) => { cbs.push(cb); } });
  const api = buildResolver(env);
  eq('装配后注册 1 个就绪回调', cbs.length, 1);
  // 触发回调 → 用 env.text 构建辅助表
  cbs[0]();
  eq('就绪回调触发后注册表可用', JSON.stringify(api.resolveAllByName('A')), JSON.stringify(['甲', '乙']));
}

// ─────────────────────────────────────────────────────────────
// E. 未提供 itemDbReady（如装配/早期环境）时安全跳过
// ─────────────────────────────────────────────────────────────
{
  const api = buildResolver(mkEnv({ itemDbReady: undefined }));
  eq('无就绪钩子：注册表保持 null（查询安全）', JSON.stringify(api.resolveAlias('丙组合')), JSON.stringify([]));
  eq('无就绪钩子：resolveByHash 照常', api.resolveByHash('h1'), '甲');
}

// ─────────────────────────────────────────────────────────────
// F. 真实数据冒烟（data/ff14-items.tsv）：规模与首值一致性
// ─────────────────────────────────────────────────────────────
{
  const real = fs.readFileSync(itemsTsvPath, 'utf8');
  // 测试侧独立重述「首行胜」规范建 nameMap（不依赖被测实现）
  const nm = Object.create(null);
  for (const ln of real.split('\n')) {
    const c0 = ln.codePointAt(0);
    if (c0 !== 45 && (c0 < 48 || c0 > 57)) continue;
    const p = ln.split('\t');
    if (!p[1]) continue;
    for (let ci = 2; ci <= 4 && ci < p.length; ci++) {
      const k = p[ci];
      if (k && nm[k] === undefined) nm[k] = p[1];
    }
  }
  const api = buildResolver(mkEnv({ nameMap: nm, text: real }));
  const t0 = Date.now();
  const built = api._irBuildAux(real);
  const buildMs = Date.now() - t0;
  const maps = api.__maps();
  const dupKeys = Object.keys(maps.dup).length;
  const aliKeys = Object.keys(maps.ali).length;
  console.log(`  真实数据：dup ${dupKeys} 键 / alias ${aliKeys} 键 / 构建 ${buildMs}ms`);
  ok('真实数据：_irBuildAux 成功', built === true);
  ok('真实数据：重名注册表 ≥ 40 键', dupKeys >= 40, `实测 ${dupKeys}`);
  ok('真实数据：重名注册表 ≤ 200 键（防逻辑误伤）', dupKeys <= 200, `实测 ${dupKeys}`);
  ok('真实数据：别名注册表 ≥ 15 键', aliKeys >= 15, `实测 ${aliKeys}`);
  // 首值一致性：全部重名键的首项必须等于主索引现值（= nameMap 直查）
  let bad = '';
  for (const k of Object.keys(maps.dup)) {
    if (nm[k] !== maps.dup[k][0]) { bad = k; break; }
  }
  ok('真实数据：重名键首值 === 主索引值（全量）', bad === '', bad ? `首个不一致：${bad}` : '');
  // 重名数组形状：≥2 项且无重复
  let shapeOk = true;
  for (const k of Object.keys(maps.dup)) {
    const d = maps.dup[k];
    if (d.length < 2 || new Set(d).size !== d.length) { shapeOk = false; bad = k; break; }
  }
  ok('真实数据：重名数组形状（≥2 项且无重复）', shapeOk, shapeOk ? '' : `异常键：${bad}`);
  ok('真实数据：构建耗时 < 1500ms', buildMs < 1500, `实测 ${buildMs}ms`);
}

// ─────────────────────────────────────────────────────────────
// C. v3 守卫（Phase 13）：v3 已直读预构建 dup/alias 时，_irBuildAux 跳过全表二次扫描
// ─────────────────────────────────────────────────────────────
{
  const api = buildResolver(mkEnv({ v3Applied: false }));
  api._irBuildAux(SAMPLE_TSV);
  const before = api.__maps();
  ok('v3 前置：注册表已构建', !!before.dup && !!before.ali);
  api.__setV3(true);
  eq('v3 守卫：_irBuildAux → true（已就绪）', api._irBuildAux(SAMPLE_TSV), true);
  const after = api.__maps();
  ok('v3 守卫：注册表引用未被覆盖', after.dup === before.dup && after.ali === before.ali);
  const api2 = buildResolver(mkEnv({ v3Applied: true }));
  eq('v3 直装：_irBuildAux → true', api2._irBuildAux(SAMPLE_TSV), true);
  const m2 = api2.__maps();
  ok('v3 直装：不新建注册表', m2.dup === null && m2.ali === null);
}

// ─────────────────────────────────────────────────────────────
console.log(`\n════════ 汇总 ════════`);
console.log(`通过 ${pass} / 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
