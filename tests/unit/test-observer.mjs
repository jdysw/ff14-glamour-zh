// tests/unit/test-observer.mjs — Phase 7：冻结统一 MutationObserver 调度层行为（golden tests）
//
// 目的：把统一观察器（createObserver / observeLocal / dedupeByAncestor 升级版）的
//       当前行为用断言钉死。后续模块化（Phase 15）与任何重构必须保持这些行为不变。
//
// 机制：从构建产物（dist）提取 @zhixia:core-observer 与 @zhixia:core-dom 区段，
//       以假 MutationObserver / document / setTimeout 装配运行。不依赖 Chrome / 外网。
//
// 覆盖（计划书 Phase 7 验收清单）：
//   - 1 / 100 / 1000 nodes；parent + child；重复 mutation；flood；Ronka characterData。
//   - 另有：root 默认、characterData 默认关闭、站点独立 debounce、disconnect 扩展位。
//
// 注意：假宿主桩必须在 buildObs(env) 之前设置：装配参数为「值捕获」。
//
// 运行：node tests/unit/test-observer.mjs   （或 npm run test:unit）
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

// 假 MutationObserver：记录实例与调用参数，允许测试手动触发回调
class FakeMO {
  constructor(cb) { this.cb = cb; this.root = null; this.opts = null; this.disconnected = false; FakeMO.last = this; FakeMO.all.push(this); }
  observe(root, opts) { this.root = root; this.opts = opts; }
  disconnect() { this.disconnected = true; }
  trigger(muts) { this.cb(muts); }
}
FakeMO.last = null;
FakeMO.all = [];

let timers = [];
let timerSeq = 0;
const activeTimers = () => timers.filter((x) => !x.cleared && !x.done);
function runTimer() {
  const act = activeTimers();
  const t = act[act.length - 1];
  if (!t) throw new Error('无可执行 timer');
  t.done = true;
  t.fn();
  return t;
}

function makeEnv() {
  timers = [];
  timerSeq = 0;
  FakeMO.all = [];
  const rec = { warns: [] };
  const fakeDoc = { body: { tag: 'body' }, documentElement: { tag: 'html' } };
  return {
    document: fakeDoc,
    console: { warn: (...a) => rec.warns.push(a) },
    setTimeout: (fn, ms) => { const id = ++timerSeq; timers.push({ id, fn, ms, cleared: false, done: false }); return id; },
    clearTimeout: (id) => { const t = timers.find((x) => x.id === id); if (t) t.cleared = true; },
    MutationObserver: FakeMO,
    rec,
    fakeDoc,
  };
}

function buildObs(env) {
  const parts = [...sliceAll(DIST_TEXT, 'core-dom'), ...sliceAll(DIST_TEXT, 'core-observer')];
  const ret = 'return { createObserver, observeLocal, dedupeByAncestor, __obsStats: () => ({ ..._obsStats }) };';
  try {
    const fn = new Function('document', 'console', 'setTimeout', 'clearTimeout', 'MutationObserver',
      parts.join('\n') + '\n' + ret);
    return fn(env.document, env.console, env.setTimeout, env.clearTimeout, env.MutationObserver);
  } catch (e) {
    throw new Error('Observer 装配失败：' + e.message);
  }
}

const mkNode = (parent = null, extra = {}) => ({ nodeType: 1, parentNode: parent, ...extra });

// ═════════════════════════ 开始 ═════════════════════════════════

console.log('\n── A：基础调度（1 node / root / 默认关闭 characterData / disconnect）──');
{
  const env = makeEnv();
  const api = buildObs(env);
  const seen = [];
  const ctl = api.observeLocal((nodes) => seen.push(nodes), 300);
  const mo = FakeMO.last;
  eq('观察根默认 document.body', mo.root, env.fakeDoc.body);
  eq('订阅 childList + subtree', JSON.stringify(mo.opts), JSON.stringify({ childList: true, subtree: true }));
  eq('返回 disconnect 扩展位', typeof ctl.disconnect, 'function');

  const n1 = mkNode();
  mo.trigger([{ type: 'childList', addedNodes: [n1] }]);
  eq('1 node：调度 1 个 timer', activeTimers().length, 1);
  eq('1 node：调度前不回调', seen.length, 0);
  runTimer();
  eq('1 node：回调收到 1 个节点', seen.length === 1 && seen[0].length === 1 && seen[0][0] === n1, true);

  // characterData 默认关闭：完全忽略
  mo.trigger([{ type: 'characterData', target: { nodeValue: '任意文本' } }]);
  eq('未开启 characterData：完全忽略（不调度）', activeTimers().length, 0);

  // disconnect
  ctl.disconnect();
  eq('disconnect 生效', mo.disconnected, true);
}

console.log('\n── B：规模（100 / 1000 nodes）与性能 ──');
{
  const env = makeEnv();
  const api = buildObs(env);
  const seen = [];
  api.observeLocal((nodes) => seen.push(nodes), 0);
  const mo = FakeMO.last;

  const batch100 = Array.from({ length: 100 }, () => mkNode());
  mo.trigger([{ type: 'childList', addedNodes: batch100 }]);
  runTimer();
  eq('100 nodes：全部独立（无父子关系）', seen.at(-1).length, 100);

  const batch1000 = Array.from({ length: 1000 }, () => mkNode());
  const t0 = performance.now();
  mo.trigger([{ type: 'childList', addedNodes: batch1000 }]);
  runTimer();
  const ms = performance.now() - t0;
  eq('1000 nodes：全部独立', seen.at(-1).length, 1000);
  ok('1000 nodes：去重 + 处理 < 500ms', ms < 500, `实测 ${ms.toFixed(1)}ms`);
}

console.log('\n── C：parent + child 去重（子先父后只留祖先）──');
{
  const env = makeEnv();
  const api = buildObs(env);
  const seen = [];
  api.observeLocal((nodes) => seen.push(nodes), 0);
  const mo = FakeMO.last;

  const p = mkNode();
  const c = mkNode(p);
  mo.trigger([{ type: 'childList', addedNodes: [c, p] }]);   // 子先父后
  runTimer();
  const r = seen.at(-1);
  eq('父+子：只留祖先（子被跳过去重）', r.length === 1 && r[0] === p, true);

  // 深层链：曾孙 + 子 + 根 → 只留根
  const a = mkNode();
  const b = mkNode(a);
  const d = mkNode(b);
  mo.trigger([{ type: 'childList', addedNodes: [d, b, a] }]);
  runTimer();
  const r2 = seen.at(-1);
  eq('三层链：只留最上层祖先', r2.length === 1 && r2[0] === a, true);
}

console.log('\n── D：重复 mutation（同节点多次入队只处理一次）──');
{
  const env = makeEnv();
  const api = buildObs(env);
  const seen = [];
  api.observeLocal((nodes) => seen.push(nodes), 0);
  const mo = FakeMO.last;

  const x = mkNode();
  mo.trigger([{ type: 'childList', addedNodes: [x, x] }]);
  mo.trigger([{ type: 'childList', addedNodes: [x] }]);
  runTimer();
  eq('重复入队：只保留一次', seen.at(-1).length === 1 && seen.at(-1)[0] === x, true);
}

console.log('\n── E：flood 洪峰保护（超阈值重置计时器）──');
{
  const env = makeEnv();
  const api = buildObs(env);
  const seen = [];
  api.observeLocal((nodes) => seen.push(nodes), 350);
  const mo = FakeMO.last;

  mo.trigger([{ type: 'childList', addedNodes: [mkNode()] }]);
  eq('flood 前：1 个活跃 timer', activeTimers().length, 1);

  const floodBatch = Array.from({ length: 801 }, () => mkNode());   // pending = 802 > 800
  mo.trigger([{ type: 'childList', addedNodes: floodBatch }]);
  eq('flood：旧 timer 被清', timers.filter((t) => t.cleared).length >= 1, true);
  eq('flood：重设 1 个活跃 timer', activeTimers().length, 1);
  runTimer();
  eq('flood：洪峰节点全部被处理（802 个）', seen.at(-1).length, 802);
}

console.log('\n── F：Ronka characterData（显式开启 + filter）──');
{
  const env = makeEnv();
  const api = buildObs(env);
  const seen = [];
  api.createObserver({
    characterData: true,
    filter: (m) => !!(m.target?.nodeValue && /[가-힣]/.test(m.target.nodeValue)),
    debounce: 120,
    handler: (nodes) => seen.push(nodes),
  });
  const mo = FakeMO.last;
  eq('订阅含 characterData', mo.opts.characterData, true);

  // 非韩文 CD：被 filter 拒绝
  mo.trigger([{ type: 'characterData', target: { nodeValue: 'hello world' } }]);
  eq('CD 未过 filter：不调度', activeTimers().length, 0);

  // 韩文 CD：调度
  mo.trigger([{ type: 'characterData', target: { nodeValue: '안녕하세요' } }]);
  eq('CD 过 filter：调度', activeTimers().length, 1);
  eq('debounce 记录为 120ms', activeTimers()[0].ms, 120);
  runTimer();
  eq('CD 调度执行 handler', seen.length, 1);
  eq('CD 型调度：nodes 为空数组（signal 型站点可忽略）', JSON.stringify(seen[0]), '[]');
}

console.log('\n── G：兼容包装与可配置性 ──');
{
  const env = makeEnv();
  const api = buildObs(env);
  const ctl = api.observeLocal(() => {}, 500);
  const mo = FakeMO.last;
  mo.trigger([{ type: 'childList', addedNodes: [mkNode()] }]);
  eq('observeLocal delay=500 → timer 500ms', activeTimers()[0].ms, 500);
  eq('observeLocal 返回控制对象', typeof ctl.disconnect, 'function');

  // 自定义 floodLimit / root
  const env2 = makeEnv();
  const api2 = buildObs(env2);
  api2.createObserver({ handler: () => {}, floodLimit: 2, root: env2.fakeDoc.documentElement });
  const mo2 = FakeMO.last;
  eq('自定义 root 生效', mo2.root, env2.fakeDoc.documentElement);
  mo2.trigger([{ type: 'childList', addedNodes: [mkNode()] }]);
  eq('自定义 floodLimit=2 下 1 个节点不触发 flood', timers.filter((t) => t.cleared).length, 0);
  mo2.trigger([{ type: 'childList', addedNodes: [mkNode(), mkNode()] }]);   // pending = 3 > 2 → flood
  eq('自定义 floodLimit=2 下 3 个节点触发 flood（清旧 timer）', timers.filter((t) => t.cleared).length >= 1, true);
}

console.log('\n── H：观察统计（v1.4 Phase 10）──');
{
  const env = makeEnv();
  const api = buildObs(env);
  api.observeLocal(() => {}, 0);
  const mo = FakeMO.last;

  const z0 = api.__obsStats();
  eq('初始统计为 0', z0.ticks === 0 && z0.nodes === 0, true);

  mo.trigger([{ type: 'childList', addedNodes: [mkNode(), mkNode()] }]);
  runTimer();
  const z1 = api.__obsStats();
  eq('一次调度后 ticks=1', z1.ticks, 1);
  eq('nodes 累计（2 节点）', z1.nodes, 2);

  mo.trigger([{ type: 'childList', addedNodes: [mkNode()] }]);
  runTimer();
  const z2 = api.__obsStats();
  eq('二次调度后 ticks=2', z2.ticks, 2);
  eq('nodes 累计（3 节点）', z2.nodes, 3);
}

console.log(`\n════════ 汇总 ════════`);
console.log(`通过 ${pass} / 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
