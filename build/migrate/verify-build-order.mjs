// build/migrate/verify-build-order.mjs —— Phase 15：验证最终 Rollup 产物的模块顺序
// 用法: node build/migrate/verify-build-order.mjs [dist文件] [顺序表]
// 依赖 order-modules.mjs 写入的稳定模块标记，不依赖具体业务锚点数量。
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
const expectedSet = new Set(expected);
const actualSet = new Set(actual);
const exact = !duplicate.length && !missing.length && !extra.length && actual.length === expected.length && actualSet.size === expectedSet.size;

if (!exact) console.error('模块顺序已由 Rollup 依赖图决定；此处仅要求模块集合完整且唯一。');

if (duplicate.length) console.error('重复模块标记：' + [...new Set(duplicate)].join(', '));
if (missing.length) console.error('缺失模块标记：' + missing.join(', '));
if (extra.length) console.error('未知模块标记：' + extra.join(', '));
if (!exact) {
  process.exit(1);
}
console.log('✅ Rollup 产物模块顺序与契约完全一致');
