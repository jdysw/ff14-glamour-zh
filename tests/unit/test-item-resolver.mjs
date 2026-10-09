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

// _lcs90 系列辅助（dist 未标记区，cache 模块头部）：满足 resolvePartialByZh 的依赖。
// 段提取不含未标记区，故从 dist 源码单独抽取三个无副作用纯函数注入装配。
const extractFn = (src, name) => {
  const sig = `function ${name}(`;
  const i = src.indexOf(sig);
  if (i < 0) throw new Error(`辅助函数缺失：${name}`);
  let depth = 0;
  let j = i;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  return src.slice(i, j);
};
const SERIES_HELPERS = ['_shortestStr', '_countIncludes', '_lcs90']
  .map((name) => extractFn(DIST_TEXT, name)).join('\n');

// 构造样例：含真歧义（A/ア/가 → 甲|乙）、同名同译（B/イ/나 → 丙|丙）、别名（含分号拆分）
const SAMPLE_TSV = [
  'key\tzh\ten\tja\tko\thash\tecid\talias\tglam',
  '1\t甲\tA\tア\t가\th1\t100\t\t1',
  '2\t乙\tA\tア\t가\th2\t101\t\t1',
  '3\t丙\tB\tイ\t나\th3\t102\t丙组合\t1',
  '4\t丙\tB\tイ\t나\th4\t103\t丙组合；丙套装\t1',
  '5\t丁\tC\tウ\t다\th5\t104\t\t1',
  '6\t炎灵长袍\tD\tエ\t라\th6\t105\t炎灵袍\t1',
  '7\t炎灵长裤\tE\tオ\t마\th7\t106\t炎灵裤\t1',
  '8\t炎灵\tF\tカ\t바\th8\t107\t\t1',].join('\n');

// Legacy alias fixture：专门冻结 Phase 6 原有别名注册表契约。
// 中文智能输入新增装备数据不应改变这个 golden test 的覆盖范围。
const LEGACY_SAMPLE_TSV = [
  'key\tzh\ten\tja\tko\thash\tecid\talias\tglam',
  '1\t甲\tA\tア\t가\th1\t100\t\t1',
  '2\t乙\tA\tア\t가\th2\t101\t\t1',
  '3\t丙\tB\tイ\t나\th3\t102\t丙组合\t1',
  '4\t丙\tB\tイ\t나\th4\t103\t丙组合；丙套装\t1',
  '5\t丁\tC\tウ\t다\th5\t104\t\t1',].join('\n');

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
    'return { resolveByHash, resolveByName, resolveByZh, suggestByZh, resolveAllByName, resolveAlias, resolve, resolveEcId, resolveKo, _irBuildAux, _irBuildSearchFromNames, _irBuildSearchFromText, resolvePartialByZh, __stats: () => ({ ..._irStats }),',
    '  __maps: () => ({ dup: _irDupMap, ali: _irAliasMap }),',
    '  __setV3: (v) => { _v3Applied = v; }, __setPolicy: (v) => { _irCandidatePolicy = v; } };',
  ].join('\n');
  const body = [...stubs, SERIES_HELPERS, ...RESOLVER_SEG, '_irCandidatePolicy = __env.candidatePolicy ?? 1;', ret].join('\n');
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
// B1. 中文智能输入（独立夹具：仅验证新增补全索引契约）
// ─────────────────────────────────────────────────────────────
{
  const api = buildResolver(mkEnv());
  api._irBuildAux(SAMPLE_TSV);

  eq('智能输入：少于 2 个中文字符不提示', JSON.stringify(api.suggestByZh('炎')), JSON.stringify([]));
  eq('智能输入：精确名称优先、正式名称次之、别名最后', JSON.stringify(api.suggestByZh('炎灵')), JSON.stringify([
    { zh: '炎灵', native: 'カ' },
    ...[
    { zh: '炎灵长袍', native: 'エ' },
    { zh: '炎灵长裤', native: 'オ' },
    ].sort((a, b) => new Intl.Collator().compare(a.zh, b.zh)),
    ...[
    { zh: '炎灵袍', native: 'エ' },
    { zh: '炎灵裤', native: 'オ' },
    ].sort((a, b) => new Intl.Collator().compare(a.zh, b.zh)),
  ]));
  eq('智能输入：别名也可作为候选', JSON.stringify(api.suggestByZh('炎灵袍')), JSON.stringify([
    { zh: '炎灵袍', native: 'エ' },
  ]));
  eq('智能输入：显式 limit 截断仍生效', api.suggestByZh('炎灵', 2).length, 2);
  eq('智能输入：limit 无 8 条封顶（全量返回，防御上限 3000）', api.suggestByZh('炎灵', 99999).length, 5);
}

// B1b. 搜索词落在中文名中间时也必须有候选（不局限于前缀）
{
  const api = buildResolver(mkEnv({ site: { id: 'mirapri' } }));
  api._irBuildAux([
    '1\t女仆发带\tMaid Headdress\tメイドヘッド\t메이드\t\t\t\t1',
    '2\t星光女仆长袍\tStarlight Maid Robe\t星メイド\t메이드로브\t\t\t\t1',
    '3\t女仆上衣\tMaid Top\tメイドトップ\t메이드상의\t\t\t星光女仆别名\t1',
    '4\t时尚饰品\tFashion Accessory\tおしゃれ\t패션\t\t\t女仆饰品\t1',
  ].join('\n'));
  const rows = api.suggestByZh('女仆');
  eq('词中匹配保留在正式名前缀之后', rows.map((r) => r.zh).join('|'),
    '女仆上衣|女仆发带|星光女仆长袍|女仆饰品|星光女仆别名');
  eq('中文别名仍能解析为原站装备名', rows.at(-1)?.native, 'メイドトップ');
  eq('limit 包含精确 / 前缀 / 包含全部类别的统一上限', api.suggestByZh('女仆', 3).length, 3);
  eq('不含查询词的物品不混入候选', rows.some((r) => r.zh === '时尚饰品'), false);
}

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
// D. 候选允许名单过滤：只有明确标记 1 的装备、时尚配饰、鸟甲入倒排
// ─────────────────────────────────────────────────────────────
{
  const api = buildResolver(mkEnv());
  const built = api._irBuildSearchFromNames(
    { A1: '甲乙', B1: '乙丙', C1: '丙丁', D1: '丁戊', E1: '戊己' },
    { '未知别名': ['丙丁'] },
    { A1: '1', B1: '0', C1: '', D1: '1', E1: '2' },
  );
  eq('D1 v3 明确允许 1 保留', built.map['甲乙'], 'A1');
  eq('D2 v3 0 剔除', built.map['乙丙'], undefined);
  eq('D3 v3 空标记剔除', built.map['丙丁'], undefined);
  eq('D4 v3 明确 1 保留', built.map['丁戊'], 'D1');
  eq('D5 v3 非法标记剔除', built.map['戊己'], undefined);
  eq('D6 v3 无标记时默认剔除', api._irBuildSearchFromNames({ A1: '甲乙' }, null, null).map['甲乙'], undefined);
  eq('D7 别名不能绕过主名允许标记', built.map['未知别名'], undefined);

  // v2 真实误入样例 + 分类允许项，CRLF / 第9列 trim 均按严格标记处理。
  const text = [
    '8043\t英骑装备的改良材料\tGallant Armor Augmentation\tガラントアーマーの補材\t\t\t\t改良材料别称\t0',
    '8881\t改良型加隆德御敌腰带\tAugmented Ironworks Belt of Fending\tガーロンド・ディフェンダーベルトRE\t\t\t\t\t0',
    '7551\t光之鸟甲\tBarding of Light\tバード・オブ・ライト\t\t\t\t\t1',
    '14972\t女仆发带\tHousemaid Brim\tメイドホワイトブリム\t\t\t\t\t1',
    '30269\t阳伞\tParasol\tパラソル\t\t\t\t\t 1 ',
    '48162\t黑色蕾丝阳伞\tBlack Embroidered Parasol\t黒い刺繍のパラソル\t\t\t\t\t1',
    '38459\t魔法阳伞\tMagicked Parasol\t魔法のパラソル\t\t\t\t\t0',
    '6482\t亚麻阳伞\tLinen Parasol\tリネンパラソル\t\t\t\t\t0',
    '90000\t旧格式物品\tLegacy Item\t旧名\t\t\t\t',
  ].join('\r\n') + '\r\n';
  const built2 = api._irBuildSearchFromText(text);
  eq('D8 v2 8043改良材料不进候选', built2.map['英骑装备的改良材料'], undefined);
  eq('D9 v2 8881旧腰带不进候选', built2.map['改良型加隆德御敌腰带'], undefined);
  eq('D10 v2 鸟甲保留', built2.map['光之鸟甲'], 'バード・オブ・ライト');
  eq('D11 v2 时尚发带保留', built2.map['女仆发带'], 'メイドホワイトブリム');
  eq('D12 v2 阳伞保留', built2.map['阳伞'], 'パラソル');
  eq('D13 v2 黑色蕾丝阳伞保留', built2.map['黑色蕾丝阳伞'], '黒い刺繍のパラソル');
  eq('D14 v2 坐骑魔法伞排除', built2.map['魔法阳伞'], undefined);
  eq('D15 v2 家具伞排除', built2.map['亚麻阳伞'], undefined);
  eq('D16 v2 旧8列未知标记排除', built2.map['旧格式物品'], undefined);
  eq('D17 v2 被排除主名的别名不进候选', built2.map['改良材料别称'], undefined);
}

// D2. canonical 表回归：锁定历史误入项与三类允许样例
{
  const text = fs.readFileSync(itemsTsvPath, 'utf8');
  const api = buildResolver(mkEnv({ text }));
  api._irBuildAux(text);
  for (const zh of ['英骑装备的改良材料', '改良型加隆德御敌腰带', '阿马罗装备的修复素材', '魔法阳伞', '亚麻阳伞']) {
    eq(`真实 canonical 排除：${zh}`, api.resolveByZh(zh), null);
  }
  for (const zh of ['光之鸟甲', '航空兜帽', '猎蛋装甲', '防雨装甲', '女仆发带', '阳伞', '黑色蕾丝阳伞']) {
    ok(`真实 canonical 允许：${zh}`, !!api.resolveByZh(zh));
  }
  const legacyZh = '阿马罗装备的修复素材';
  const legacyEn = 'Amaro Barding Repair Materials';
  const legacyText = '27242\t' + legacyZh + '\t' + legacyEn + '\tアマロ修理素材\t\t\t\t\t1\n';
  const restricted = buildResolver(mkEnv({
    candidatePolicy: 0,
    nameMap: { [legacyEn]: legacyZh },
    text: legacyText,
  }));
  restricted._irBuildAux(legacyText);
  eq('未知策略下旧9列误标物不进候选', restricted.resolveByZh(legacyZh), null);
  eq('未知策略不影响普通译名查表', restricted.resolveByName(legacyEn), legacyZh);

}

// E. resolvePartialByZh 部分词（v1.4.2 后续：完整名未命中 → 公共子串提取 + 英文质量门）
// ─────────────────────────────────────────────────────────────
{
  // E1-E2 / E5-E6：CJK 站（mirapri → ja 列）
  const api = buildResolver(mkEnv({ site: { id: 'mirapri' } }));
  const jaText = [
    '1\t女仆发带\tHousemaid brim\tメイドホワイトブリム\t메이드 머리띠\t\t\t\t1',
    '2\t女仆围裙装\tHousemaid apron\tメイドエプロンドレス\t메이드 앞치마\t\t\t\t1',
    '3\t女仆腕带\tHousemaid wrist\tメイドリストドレス\t메이드 소매장식\t\t\t\t1',
    '4\t女仆裙甲\tHousemaid skirt\tメイドスカート\t메이드 치마\t\t\t\t1',
  ].join('\n');
  api._irBuildAux(jaText);
  eq('E1 ja 纯组：部分词「女仆」→ 公共子串「メイド」', api.resolvePartialByZh('女仆'), 'メイド');
  eq('E2 无匹配词保持不转换（null）', api.resolvePartialByZh('紫电'), null);
  eq('E5 单条命中：「裙甲」→ 完整原生名', api.resolvePartialByZh('裙甲'), 'メイドスカート');
  eq('E6 完整名（键与查询相同）不产生部分词结果', api.resolvePartialByZh('女仆发带'), null);

  // E3：英文站（ec → en 列）——词中片段被质量门拒绝
  const api2 = buildResolver(mkEnv({ site: { id: 'ec' } }));
  api2._irBuildAux([
    '1\t测试头盔\tKAID A\tア\t가\t\t\t\t1',
    '2\t测试胸甲\tMAID A\tイ\t나\t\t\t\t1',
    '3\t测试护腕\tMAID B\tウ\t다\t\t\t\t1',
  ].join('\n'));
  eq('E3 en 词中片段（AID ）被质量门拒绝 → null', api2.resolvePartialByZh('测试'), null);

  // E4：英文站——纯组（词首起、右端有边界）通过
  const api3 = buildResolver(mkEnv({ site: { id: 'ec' } }));
  api3._irBuildAux([
    '1\t试验头盔\tHousemaid Helm\tア\t가\t\t\t\t1',
    '2\t试验胸甲\tHousemaid Mail\tイ\t나\t\t\t\t1',
    '3\t试验护腕\tHousemaid Vambrace\tウ\t다\t\t\t\t1',
  ].join('\n'));
  eq('E4 en 纯组：「试验」→ 公共子串「Housemaid 」', api3.resolvePartialByZh('试验'), 'Housemaid ');
}

// ─────────────────────────────────────────────────────────────
console.log(`\n════════ 汇总 ════════`);
console.log(`通过 ${pass} / 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
