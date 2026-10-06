// tests/unit/test-targets.mjs — Phase 8：冻结统一 DOM Target Pipeline 行为（golden tests）
//
// 目的：把 collectTargets / dispatchTargets / processRoot 的当前行为用断言钉死。
//       后续模块化（Phase 15）与任何重构必须保持这些行为不变。
//
// 机制：从构建产物（dist）提取 @zhixia:core-targets 区段装配运行。
//       resolveByName / EC_CARD_SEL 以桩注入（值捕获）；document 桩按选择器分发候选。
//
// 覆盖（计划书 Phase 8 验收）：
//   - 全页（root 缺省）与局部（元素根）同一采集路径；
//   - 四类 target（item / plain-item / card / dye）判定与字段（type/element/text/context）；
//   - 分派顺序（item → plain-item → card → dye）；
//   - 幂等：已处理元素（flag）不再采集（第二次处理跳过）；
//   - 过滤规则：长度 / URL / 未命中。
//
// 运行：node tests/unit/test-targets.mjs   （或 npm run test:unit）
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

// ── 假元素工厂：最小 DOM 面（classList / dataset / textContent / matches / querySelector*）──
function fakeEl(over = {}) {
  const cls = new Set(over.cls || []);
  const el = {
    dataset: over.dataset || {},
    textContent: over.text ?? '',
    classList: {
      contains: (c) => cls.has(c),
      add: (c) => cls.add(c),
      has: (c) => cls.has(c),
    },
    matches: (sel) => (over.matcher ? over.matcher(sel, el) : false),
    querySelector: (sel) => (over.qs ? over.qs(sel, el) : null),
    querySelectorAll: (sel) => (over.qsa ? over.qsa(sel, el) : []),
  };
  return el;
}

const SEL = 'a.eorzeadb_link';
const PLAIN = 'span[class*="has-text-rarity-"]';
const CARD = 'p.title.has-text-text';   // EC_CARD_SEL 桩值（测试只关心标识一致）
const TAG = 'div.tag, span.tag';

const KNOWN = {
  'Ao Dai': '奥黛',
  '纯文本名': '纯文本名译',
  'Card Name': '卡片译',
  'Ink Blue': '墨蓝',
};
const resolveByName = (n) => KNOWN[n] || null;

function buildTargets(doc) {
  const parts = sliceAll(DIST_TEXT, 'core-targets');
  const ret = 'return { collectTargets, dispatchTargets, processRoot };';
  try {
    const fn = new Function('document', 'resolveByName', 'EC_CARD_SEL',
      parts.join('\n') + '\n' + ret);
    return fn(doc, resolveByName, CARD);
  } catch (e) {
    throw new Error('Targets 装配失败：' + e.message);
  }
}

// ═════════════════════════ 开始 ═════════════════════════════════

console.log('\n── A：全页采集（四类 target 与字段）──');
const spanInA = fakeEl({ text: 'Ao Dai' });
const a1 = fakeEl({ text: 'Ao Dai', qs: (s) => (s === 'span' ? spanInA : null) });
const sp1 = fakeEl({ text: '纯文本名' });
const card1 = fakeEl({ text: 'Card Name' });
const tag1 = fakeEl({ text: '\u2B24 Ink Blue' });   // ⬤ Ink Blue
{
  const doc = {
    querySelectorAll: (sel) => {
      if (sel === SEL) return [a1];
      if (sel === PLAIN) return [sp1];
      if (sel === CARD) return [card1];
      if (sel === TAG) return [tag1];
      return [];
    },
  };
  const api = buildTargets(doc);
  const ts = api.collectTargets();   // root 缺省 = 全页
  eq('全页：四类各 1 个', ts.length, 4);
  eq('item：type/文本', ts[0].type === 'item' && ts[0].text === 'Ao Dai', true);
  eq('item：element 为链接本体', ts[0].element === a1, true);
  eq('item：context.el 取内层 span', ts[0].context.el === spanInA, true);
  eq('plain-item：type', ts[1].type === 'plain-item' && ts[1].element === sp1, true);
  eq('card：type', ts[2].type === 'card' && ts[2].element === card1, true);
  eq('dye：type + zh 上下文', ts[3].type === 'dye' && ts[3].context.zh === '墨蓝', true);
  eq('dye：text 为「⬤ 」后名称', ts[3].text, 'Ink Blue');
}

console.log('\n── B：局部采集（root 自身 + 子树；非元素返回空）──');
{
  const spanInB = fakeEl({ text: 'Ao Dai' });
  const a2 = fakeEl({ text: 'Ao Dai', qs: (s) => (s === 'span' ? spanInB : null) });
  const root = fakeEl({
    text: 'Ao Dai',
    matcher: (sel) => sel === SEL,                        // root 自身命中 item
    qs: (s) => (s === 'span' ? spanInB : null),
    qsa: (sel) => (sel === SEL ? [a2] : []),              // 子树再命中一个
  });
  const api = buildTargets({ querySelectorAll: () => [] });
  const ts = api.collectTargets(root);
  eq('局部：自身 + 子树共 2 个', ts.length, 2);
  eq('局部：第 1 个为 root 自身', ts[0].element === root, true);
  eq('局部：第 2 个为子树元素', ts[1].element === a2, true);
  eq('局部：非元素根返回空', api.collectTargets({}).length, 0);
}

console.log('\n── C：过滤规则（幂等 flag / 长度 / URL / 未命中）──');
{
  const done = fakeEl({ cls: ['zhixia-item-zh'], text: 'Ao Dai' });
  const tiny = fakeEl({ text: 'x' });                     // <2 字符
  const url = fakeEl({ text: 'https://x.example' });      // URL 开头
  const spDone = fakeEl({ cls: ['zhixia-item-zh'], text: '纯文本名' });
  const spUnknown = fakeEl({ text: '未收录名' });          // resolveByName 未命中
  const cardDone = fakeEl({ dataset: { zhixiaCard: '1' }, text: 'Card Name' });
  const tagDone = fakeEl({ cls: ['zhixia-dye-zh'], text: '\u2B24 Ink Blue' });
  const tagUndyed = fakeEl({ text: '\u2B24 Undyed' });
  const doc = {
    querySelectorAll: (sel) => {
      if (sel === SEL) return [done, tiny, url];
      if (sel === PLAIN) return [spDone, spUnknown];
      if (sel === CARD) return [cardDone];
      if (sel === TAG) return [tagDone, tagUndyed];
      return [];
    },
  };
  const api = buildTargets(doc);
  const ts = api.collectTargets();
  eq('已处理 item（zhixia-item-zh）跳过', ts.filter((t) => t.type === 'item').length, 0);
  eq('过短 / URL 名跳过', ts.filter((t) => t.type === 'item').length, 0);
  eq('已处理 plain-item 跳过', ts.filter((t) => t.type === 'plain-item').length, 0);
  eq('未收录名跳过（仅 Undyed 特判保留）', ts.length, 1);
  eq('Undyed → 未染色', ts[0].text === 'Undyed' && ts[0].context.zh === '未染色', true);
  eq('已处理 card / dye 跳过', ts.filter((t) => t.type === 'card' || t.type === 'dye').length, 1);
}

console.log('\n── D：分派（顺序 item → plain-item → card → dye；缺类不造次）──');
{
  const doc = {
    querySelectorAll: (sel) => {
      if (sel === SEL) return [fakeEl({ text: 'Ao Dai' })];
      if (sel === TAG) return [fakeEl({ text: '\u2B24 Ink Blue' })];
      return [];
    },
  };
  const api = buildTargets(doc);
  const ts = api.collectTargets();
  const order = [];
  api.dispatchTargets(ts, {
    item: () => order.push('item'),
    'plain-item': () => order.push('plain-item'),
    card: () => order.push('card'),
    dye: () => order.push('dye'),
  });
  eq('分派顺序固定', JSON.stringify(order), '["item","dye"]');
  const order2 = [];
  api.dispatchTargets(ts, { dye: () => order2.push('dye') });
  eq('仅提供部分处理器时只调该处理器', JSON.stringify(order2), '["dye"]');
}

console.log('\n── E：processRoot（全页 / 局部同路径，返回值 = 采集结果）──');
{
  const doc = {
    querySelectorAll: (sel) => {
      if (sel === SEL) return [fakeEl({ text: 'Ao Dai' })];
      if (sel === CARD) return [fakeEl({ text: 'Card Name' })];
      return [];
    },
  };
  const api = buildTargets(doc);
  const got = [];
  const r = api.processRoot(null, { applyMap: { item: (ts) => got.push(...ts) } });
  eq('全页：返回值含全部采集', r.length, 2);
  eq('全页：分派到 item 处理器', got.length === 1 && got[0].type === 'item', true);

  const spanInL = fakeEl({ text: 'Ao Dai' });
  const lroot = fakeEl({
    text: 'Card Name',
    matcher: (sel) => sel === CARD,
  });
  const r2 = api.processRoot(lroot, {});
  eq('局部：同一路径采集（无处理器也不报错）', r2.length === 1 && r2[0].type === 'card', true);
}

console.log('\n── F：幂等（第二次处理：跳过已标记元素；React 重建后重新处理）──');
{
  const spanInX = fakeEl({ text: 'Ao Dai' });
  const x = fakeEl({ text: 'Ao Dai', qs: (s) => (s === 'span' ? spanInX : null) });
  const doc = { querySelectorAll: (sel) => (sel === SEL ? [x] : []) };
  const api = buildTargets(doc);
  eq('第一次：采集到 1 个', api.collectTargets().length, 1);
  x.classList.add('zhixia-item-zh');            // 模拟已应用中文
  eq('第二次：已标记跳过', api.collectTargets().length, 0);
  const rebuilt = fakeEl({ text: 'Ao Dai', qs: (s) => (s === 'span' ? spanInX : null) });
  const doc2 = { querySelectorAll: (sel) => (sel === SEL ? [rebuilt] : []) };
  const api2 = buildTargets(doc2);
  eq('React 重建（新节点无标记）：重新采集', api2.collectTargets().length, 1);
}

console.log(`\n════════ 汇总 ════════`);
console.log(`通过 ${pass} / 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
