// build/migrate/order-modules.mjs —— Phase 15 收尾：钉死 Rollup 模块输出顺序
// 用法: node build/migrate/order-modules.mjs [模块根目录=src] [顺序表=build/module-order.json]
//
// 背景：Rollup 按依赖图计算模块执行顺序；本项目存在循环依赖，而 unit 测试按
// dist 文本中的锚点提取区段，因此必须把“产物模块顺序”作为显式构建契约。
//
// 做法：
//   1. 校验顺序表与 src/core + src/sites 的实际模块集合完全一致；
//   2. 清理本工具此前生成的顺序标记与链式副作用 import，保证真正幂等；
//   3. 按顺序为模块插入链式副作用 import；
//   4. 在每个模块顶部写入稳定的 @phase15-module-order 标记，供构建后的自动校验；
//   5. main.js 引入顺序表中的最后一个模块，使入口首次下潜即沿链走到底。
//
// 注意：这些 import / 标记是“构建生成内容”，不是业务源代码；真正的单文件源
// src/ff14-glamour-zh.external.user.js 永远不由本工具修改。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

// ── 路径净化：结果必须位于仓库内（防路径穿越；CLI 参数不可信）──
function safeResolve(p, label) {
  const abs = path.resolve(p);
  const rel = path.relative(repoRoot, abs);
  if (rel !== '' && (rel.startsWith('..') || path.isAbsolute(rel))) {
    throw new Error(`${label}越界（仅允许仓库内路径）: ${p}`);
  }
  return abs;
}
const root = safeResolve(process.argv[2] || path.join(repoRoot, 'src'), '模块根目录');
const orderFile = safeResolve(process.argv[3] || path.join(repoRoot, 'build', 'module-order.json'), '顺序表');

const data = JSON.parse(fs.readFileSync(orderFile, 'utf8'));
const order = Array.isArray(data.order) ? data.order.slice() : [];
const entry = data.entry || 'main';

if (!order.length) {
  console.error('顺序表为空：' + orderFile);
  process.exit(1);
}
if (new Set(order).size !== order.length) {
  console.error('顺序表存在重复模块：' + order.filter((m, i) => order.indexOf(m) !== i).join(', '));
  process.exit(1);
}

const actual = [];
for (const sub of ['core', 'sites']) {
  const dir = path.join(root, sub);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (f.endsWith('.js')) actual.push(`${sub}/${f.slice(0, -3)}`);
  }
}
actual.sort((a, b) => a.localeCompare(b));
const listed = order.slice().sort((a, b) => a.localeCompare(b));
const missing = actual.filter((m) => !listed.includes(m));
const extra = listed.filter((m) => !actual.includes(m));
if (missing.length || extra.length) {
  if (missing.length) console.error('顺序表遗漏实际模块：' + missing.join(', '));
  if (extra.length) console.error('顺序表包含不存在模块：' + extra.join(', '));
  process.exit(1);
}

const relOf = (from, to) => {
  const p = path.posix.relative(path.posix.dirname(from), to);
  return p.startsWith('.') ? p : './' + p;
};
const MARK_RE = /^\/\* @phase15-module-order:[^\n]*\*\/\n?/;
const GENERATED_IMPORT_RE = /^import ['"](?:\.\.\/|\.\/)[^'"\n]+\.js['"];\n?/;

const generatedLinks = new Map();
for (let i = 1; i < order.length; i++) {
  const cur = order[i];
  const prev = order[i - 1];
  generatedLinks.set(cur, `import '${relOf(cur, prev)}.js';`);
}
const mainGeneratedLink = `import '${relOf('main', order[order.length - 1])}.js';`;

function cleanGeneratedPrefix(code, rel) {
  let out = code;
  // 清理本工具历代版本可能留下的模块标记。
  while (/^\/\* @phase15-module-order:[^\n]*\*\/\n?/.test(out)) {
    out = out.replace(/^\/\* @phase15-module-order:[^\n]*\*\/\n?/, '');
  }
  while (/^\/\* @phase15-order-link:[^\n]*\*\/\n?/.test(out)) {
    out = out.replace(/^\/\* @phase15-order-link:[^\n]*\*\/\n?/, '');
  }
  // 清理本工具生成过的确定性顺序 import。仅匹配“当前顺序表中的边”，
  // 不碰其它真实业务依赖。这样即使顺序表未来调整，重跑也不会遗留旧链。
  const candidates = new Set([generatedLinks.get(rel)]);
  if (rel === 'main') candidates.add(mainGeneratedLink);
  const lines = out.split('\n');
  out = lines.filter((line) => !candidates.has(line.trim())).join('\n');
  return out;
}

function writeModule(rel, prev = null) {
  const file = safeResolve(path.join(root, rel + '.js'), '模块文件');
  let code = fs.readFileSync(file, 'utf8');
  code = cleanGeneratedPrefix(code, rel);
  const lines = [`/* @phase15-module-order:${rel} */`];
  if (prev) {
    const imp = relOf(rel, prev) + '.js';
    lines.push(`/* @phase15-order-link:${rel}<- ${prev} */`.replace('<- ', '<-'), `import '${imp}';`);
  }
  fs.writeFileSync(file, lines.join('\n') + '\n' + code, 'utf8');
}

for (let i = 0; i < order.length; i++) writeModule(order[i], i ? order[i - 1] : null);

const mainRel = entry;
const mainFile = safeResolve(path.join(root, mainRel + '.js'), '入口文件');
if (!fs.existsSync(mainFile)) {
  console.error('入口文件不存在（检查 entry 配置与 src 结构）');
  process.exit(1);
}
let mainCode = fs.readFileSync(mainFile, 'utf8');
mainCode = cleanGeneratedPrefix(mainCode, 'main');
const mainImp = relOf('main', order[order.length - 1]) + '.js';
fs.writeFileSync(
  mainFile,
  `/* @phase15-module-order:${mainRel} */\n/* @phase15-order-link:${mainRel}<-${order[order.length - 1]} */\nimport '${mainImp}';\n` + mainCode,
  'utf8',
);

console.log('顺序契约已应用：' + order.length + ' 个模块 + 入口');
console.log('  顺序明细见 build/module-order.json');
