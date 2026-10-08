// tests/unit/test-dictionary.mjs — Phase 5：冻结 Translator / Dictionary 行为（golden tests）
//
// 目的：把运行时词典（七层词表访问 / dict.json 原地合并 / 修订号 / 派生缓存失效）
//       与翻译统一接口层（按 profile 分发）的当前行为用断言钉死。
//       后续模块化（Phase 15）与任何重构必须保持这些行为不变。
//
// 机制：从构建产物（dist）提取 @zhixia:core-dictionary 与 @zhixia:core-translator
//       区段，以桩装配运行——六层词表起始为空对象；tr/trEC/… 以带标记的前缀桩
//       替代；修正扫描用 mock TreeWalker 观测（节点对象可断言 nodeValue）。
//       不依赖 Chrome / 外网。
//
// 说明：
//   - 「真实译文」由 integration / live 套件端到端覆盖；本文件的职责是接口分发
//     正确性与词典机制的精确契约（计划书 Phase 5 验收：动态词典更新 / old→new
//     修正 / 重复调用幂等 / 词典更新使派生缓存失效——均在此冻结）。
//   - 同 test-core：假宿主桩必须在 buildDict() 之前设置（装配参数为值捕获）。
//   - 提取锚随 src 结构变化会失配并明确报错——届时按新结构更新锚点即可（有意的哨兵）。
//
// 运行：node tests/unit/test-dictionary.mjs   （或 npm run test:unit）
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

// ─────────────────────────────────────────────────────────────
// 提取装置：按 @zhixia:<tag> 标记切出区段（同名多段按顺序全部取出）
// ─────────────────────────────────────────────────────────────
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

const DICT_SEG = sliceAll(DIST_TEXT, 'core-dictionary');
const TR_SEG = sliceAll(DIST_TEXT, 'core-translator');
const CACHE_REG_SEG = sliceAll(DIST_TEXT, 'core-cache-registry');   // Phase 14：dictInvalidate 经注册表按类清理

const STUB_LINES = [
  // ── 桩（必须先于区段：值捕获纪律；七层词表从空开始）──
  'const DICT_COMMON = {}, DICT = {}, DICT_EC = {}, DICT_FC = {}, DICT_RONKA = {}, DICT_ACL = {}, DICT_ENDCLOSET = {};',
  'let _fcSubstrCache = null, _allKeysCache = null;',
  'const tr = (t) => "T-main:" + t, trEC = (t) => "T-ec:" + t, trFC = (t) => "T-fc:" + t,',
  '  trRonka = (t) => "T-ronka:" + t, trACL = (t) => "T-acl:" + t;',
  'const trNode = (n) => __rec.calls.push(["trNode", n]);',
  'const trimECNode = (n) => __rec.calls.push(["trimECNode", n]), trimFCNode = (n) => __rec.calls.push(["trimFCNode", n]),',
  '  trimRonkaNode = (n) => __rec.calls.push(["trimRonkaNode", n]), trimACLNode = (n) => __rec.calls.push(["trimACLNode", n]);',
  'const trEl = (el) => __rec.calls.push(["trEl", el]), translateECAttrs = (el) => __rec.calls.push(["translateECAttrs", el]),',
  '  _wowFCInput = (el) => __rec.calls.push(["wowFCInput", el]);',
  'const _zhxErr = (where, e) => __rec.calls.push(["zhxErr", String(where)]);',
];

const RETURN_STMT = [
  'return { dictGet, dictHas, dictUpdate, dictGetRevision, dictInvalidate, DICT_LAYERS, __rec,',
  '  translateText, translateNode, translateAttributes,',
  '  TEXT_TRANSLATORS, NODE_TRANSLATORS, ATTR_TRANSLATORS,',
  '  __peek: () => ({ fc: _fcSubstrCache, ak: _allKeysCache }),',
  '  __poke: () => { _fcSubstrCache = "X"; _allKeysCache = "Y"; } };',
].join('\n');

/**
 * 装配词典 + 翻译器区段。
 * @param {{nodes?: Array<{nodeValue:string, parentElement?:object}>}} mock
 *        nodes 供修正扫描（TreeWalker）遍历；可复用的节点对象，其 nodeValue 可断言。
 */
function buildDict(mock = {}) {
  const rec = { calls: [] };
  const nodes = mock.nodes ? mock.nodes.slice() : [];
  const NF = { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 };
  const doc = {
    body: {},
    createTreeWalker: (root, what, filter) => {
      let i = 0;
      return {
        get currentNode() { return nodes[i - 1]; },
        nextNode() {
          while (i < nodes.length) {
            const n = nodes[i++];
            if (!filter || filter.acceptNode(n) !== NF.FILTER_REJECT) return true;
          }
          return false;
        },
      };
    },
  };
  const body = [...STUB_LINES, ...CACHE_REG_SEG, ...DICT_SEG, ...TR_SEG, RETURN_STMT].join('\n');
  try {
    const fn = new Function('document', 'console', 'NodeFilter', '__rec', body);
    return fn(doc, { warn: () => {} }, NF, rec);
  } catch (e) {
    throw new Error('Dictionary 装配失败：' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// A. dictGet / dictHas：层级、默认层、原型安全
// ─────────────────────────────────────────────────────────────
{
  const api = buildDict();
  eq('初始：dictGet 未命中 → undefined', api.dictGet('nope'), undefined);
  eq('初始：dictHas 未命中 → false', api.dictHas('nope'), false);

  api.dictUpdate('{"main":{"A":"甲"},"ec":{"B":"乙"},"common":{"C":"丙"}}');
  eq('update 后：main 层词命中', api.dictGet('A'), '甲');
  eq('update 后：dictHas 命中 → true', api.dictHas('A'), true);
  eq('显式 main 层查询', api.dictGet('A', 'main'), '甲');
  eq('层隔离：A 不在 ec 层', api.dictGet('A', 'ec'), undefined);
  eq('层隔离：B 在 ec 层', api.dictGet('B', 'ec'), '乙');
  eq('层隔离：B 不在默认 main 层', api.dictGet('B'), undefined);
  eq('common 词直达 main 层（合并语义）', api.dictGet('C'), '丙');
  eq('common 词覆盖各站层', api.dictGet('C', 'ec'), '丙');
  eq('common 层直查', api.dictGet('C', 'common'), '丙');

  // 原型安全：新 API 不得暴露 Object.prototype 成员
  eq('原型安全：dictGet("constructor") → undefined', api.dictGet('constructor'), undefined);
  eq('原型安全：dictHas("constructor") → false', api.dictHas('constructor'), false);
  eq('原型安全：dictHas("toString") → false', api.dictHas('toString'), false);

  // 未知层
  eq('未知层：dictGet → undefined', api.dictGet('A', 'nope'), undefined);
  eq('未知层：dictHas → false', api.dictHas('A', 'nope'), false);

  // extra 优先于 common（同键冲突时站层胜）
  api.dictUpdate('{"common":{"X":"公共"},"main":{"X":"主站"}}');
  eq('同键冲突：main 层 extra 胜', api.dictGet('X'), '主站');
  eq('同键冲突：ec 层无 extra 取 common', api.dictGet('X', 'ec'), '公共');

  // 七层引用齐备
  eq('DICT_LAYERS 七层', Object.keys(api.DICT_LAYERS).sort().join(','), 'acl,common,ec,endcloset,fc,main,ronka');
}

// ─────────────────────────────────────────────────────────────
// B. dictUpdate 容错（无效输入不改变任何状态）
// ─────────────────────────────────────────────────────────────
{
  const api = buildDict();
  const r0 = api.dictGetRevision();
  eq('初始修订号为 0', r0, 0);

  api.dictUpdate(null);
  api.dictUpdate(123);
  api.dictUpdate('not-json-at-all');
  api.dictUpdate('{bad json');
  api.dictUpdate('"just-a-string"');
  eq('无效输入后修订号不变', api.dictGetRevision(), 0);
  eq('无效输入后词表仍空', api.dictGet('A'), undefined);

  api.dictUpdate('{"main":{"A":"甲"}}');
  eq('有效输入后修订号 +1', api.dictGetRevision(), 1);
}

// ─────────────────────────────────────────────────────────────
// C. dictUpdate 合并语义 / 重复调用
// ─────────────────────────────────────────────────────────────
{
  const api = buildDict();
  api.dictUpdate('{"main":{"A":"甲"}}');
  api.dictUpdate('{"main":{"A":"甲","B":"乙"}}');   // 重复词不变 + 新词
  eq('重复调用：既有词值不变', api.dictGet('A'), '甲');
  eq('重复调用：新词生效', api.dictGet('B'), '乙');
  eq('重复调用：修订号按次递增', api.dictGetRevision(), 2);

  // 「原地合并」：词表对象引用不因 update 而替换（Phase 15 前契约）
  const ref = api.DICT_LAYERS.main;
  api.dictUpdate('{"main":{"C":"丙"}}');
  ok('原地合并：层对象引用不变', api.DICT_LAYERS.main === ref);
  eq('原地合并：新词进同一对象', ref.C, '丙');
}

// ─────────────────────────────────────────────────────────────
// D. 修正收集与定向替换（old → new，计划书验收）
// ─────────────────────────────────────────────────────────────
{
  const nodes = [{ nodeValue: '前缀旧译后缀' }, { nodeValue: '无关内容' }];
  const api = buildDict({ nodes });

  api.dictUpdate('{"main":{"K":"旧译"}}');          // 初值（无修正）
  eq('初值写入后节点未被动（首次无修正集）', nodes[0].nodeValue, '前缀旧译后缀');

  api.dictUpdate('{"main":{"K":"新译"}}');          // 修正：旧译 → 新译
  eq('old→new：子串替换（含前后缀）', nodes[0].nodeValue, '前缀新译后缀');
  eq('old→new：不相关节点不动', nodes[1].nodeValue, '无关内容');

  // 值不变时不产生修正（再次相同 update 不动 DOM）
  nodes[0].nodeValue = '已经是新译';
  api.dictUpdate('{"main":{"K":"新译"}}');
  eq('值不变：无修正集，DOM 不扫描', nodes[0].nodeValue, '已经是新译');

  // 多来源同一修正（两条 fix 同对）→ 去重后正确替换
  const n2 = { nodeValue: '旧译' };
  const api2 = buildDict({ nodes: [n2] });
  api2.dictUpdate('{"main":{"K1":"旧译","K2":"旧译"}}');
  n2.nodeValue = '旧译';
  api2.dictUpdate('{"main":{"K1":"新译","K2":"新译"}}');
  eq('多来源同一修正：正确替换', n2.nodeValue, '新译');
}

// ─────────────────────────────────────────────────────────────
// E. 派生缓存失效（计划书验收：词典更新使 derived cache 失效）
// ─────────────────────────────────────────────────────────────
{
  const api = buildDict();
  api.__poke();
  ok('poke 后派生缓存非空', api.__peek().fc === 'X' && api.__peek().ak === 'Y');

  api.dictInvalidate();
  ok('invalidate：派生缓存清空', api.__peek().fc === null && api.__peek().ak === null);

  api.__poke();
  api.dictUpdate('{"main":{"A":"甲"}}');
  ok('update 成功：派生缓存被清（走统一失效入口）', api.__peek().fc === null && api.__peek().ak === null);

  api.__poke();
  api.dictUpdate('bad-input');
  ok('update 无效：派生缓存不被清（无状态变更）', api.__peek().fc === 'X' && api.__peek().ak === 'Y');
}

// ─────────────────────────────────────────────────────────────
// F. 翻译统一接口层：分发正确性
// ─────────────────────────────────────────────────────────────
{
  const api = buildDict();

  // 表完整性
  eq('TEXT_TRANSLATORS 五站', Object.keys(api.TEXT_TRANSLATORS).sort().join(','), 'acl,ec,fc,mirapri,ronka');
  eq('NODE_TRANSLATORS 五站', Object.keys(api.NODE_TRANSLATORS).sort().join(','), 'acl,ec,fc,mirapri,ronka');
  eq('ATTR_TRANSLATORS 三站（acl/ronka 无独立实现）', Object.keys(api.ATTR_TRANSLATORS).sort().join(','), 'ec,fc,mirapri');

  // translateText
  eq('translateText → mirapri', api.translateText('x', 'mirapri'), 'T-main:x');
  eq('translateText → ec', api.translateText('x', 'ec'), 'T-ec:x');
  eq('translateText → fc', api.translateText('x', 'fc'), 'T-fc:x');
  eq('translateText → ronka', api.translateText('x', 'ronka'), 'T-ronka:x');
  eq('translateText → acl', api.translateText('x', 'acl'), 'T-acl:x');
  eq('translateText：未知 profile 原样返回', api.translateText('x', 'nope'), 'x');
  eq('translateText：无 profile 原样返回', api.translateText('x'), 'x');
  eq('重复调用一致（分发层无状态）', api.translateText('x', 'ec'), api.translateText('x', 'ec'));

  // translateNode：记录桩的调用
  const n = { nodeValue: 'v' };
  api.translateNode(n, 'mirapri');
  api.translateNode(n, 'ec');
  api.translateNode(n, 'fc');
  api.translateNode(n, 'ronka');
  api.translateNode(n, 'acl');
  eq('translateNode 五站分发（调用序）',
    api.__rec.calls.map((c) => c[0]).join(','),
    'trNode,trimECNode,trimFCNode,trimRonkaNode,trimACLNode');
  ok('translateNode 透传节点', api.__rec.calls.every((c) => c[1] === n));
  const lenBefore = api.__rec.calls.length;
  api.translateNode(n, 'nope');
  eq('translateNode：未知 profile 无动作', api.__rec.calls.length, lenBefore);

  // translateAttributes
  const el = {};
  api.translateAttributes(el, 'mirapri');
  api.translateAttributes(el, 'ec');
  api.translateAttributes(el, 'fc');
  eq('translateAttributes 三站分发',
    api.__rec.calls.slice(lenBefore).map((c) => c[0]).join(','),
    'trEl,translateECAttrs,wowFCInput');
  const len2 = api.__rec.calls.length;
  api.translateAttributes(el, 'acl');
  api.translateAttributes(el, 'ronka');
  eq('translateAttributes：acl/ronka 无注册（no-op）', api.__rec.calls.length, len2);
}

// ─────────────────────────────────────────────────────────────
console.log(`\n════════ 汇总 ════════`);
console.log(`通过 ${pass} / 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
