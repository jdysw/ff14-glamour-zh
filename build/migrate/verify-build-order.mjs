// build/migrate/verify-build-order.mjs —— Phase 15：验证最终 Rollup 产物的模块顺序
// 用法: node build/migrate/verify-build-order.mjs [dist文件] [顺序表]
// 读取规范源码保留的模块标记并对照自然 Rollup 输出顺序，不再通过额外 import 强制排序。
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
const distFile = safeResolve(process.argv[2] || path.join(repoRoot, 'dist', 'ff14-glamour-zh.greasyfork.user.js'), '产物文件');
const orderFile = safeResolve(process.argv[3] || path.join(repoRoot, 'build', 'module-order.json'), '顺序表');

const { order, entry = 'main' } = JSON.parse(fs.readFileSync(orderFile, 'utf8'));
const expected = [...order, entry];
const src = fs.readFileSync(distFile, 'utf8');
const re = /\/\* @phase15-module-order:([^*\n]+) \*\//g;
const actual = [];
let m;
while ((m = re.exec(src))) actual.push(m[1].trim());

console.log('期望模块数：' + expected.length);
console.log('实际模块数：' + actual.length);

const duplicate = actual.filter((x, i) => actual.indexOf(x) !== i);
const missing = expected.filter((x) => !actual.includes(x));
const extra = actual.filter((x) => !expected.includes(x));
const exact = !duplicate.length && !missing.length && !extra.length && actual.length === expected.length && actual.every((x, i) => x === expected[i]);

if (duplicate.length) console.error('重复模块标记：' + [...new Set(duplicate)].join(', '));
if (missing.length) console.error('缺失模块标记：' + missing.join(', '));
if (extra.length) console.error('未知模块标记：' + extra.join(', '));
if (!exact) {
  // 直接打印两侧顺序及首个差异，避免依靠远程构建产物才能定位问题。
  const first = expected.findIndex((item, index) => actual[index] !== item);
  console.error('模块顺序不符合契约，首个差异位置：' + first);
  console.error('期望：' + expected.join(' → '));
  console.error('实际：' + actual.join(' → '));
  process.exit(1);
}
console.log('✅ Rollup 产物模块顺序与契约完全一致');
