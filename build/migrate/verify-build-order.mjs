// build/migrate/verify-build-order.mjs —— Phase 15：验证最终 Rollup 产物的模块顺序
// 用法: node build/migrate/verify-build-order.mjs [dist文件] [顺序表]
// 依赖 order-modules.mjs 写入的稳定模块标记，不依赖具体业务锚点数量。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const distFile = path.resolve(process.argv[2] || path.join(repoRoot, 'dist', 'ff14-glamour-zh.greasyfork.user.js'));
const orderFile = path.resolve(process.argv[3] || path.join(repoRoot, 'build', 'module-order.json'));

const { order, entry = 'main' } = JSON.parse(fs.readFileSync(orderFile, 'utf8'));
const expected = [...order, entry];
const src = fs.readFileSync(distFile, 'utf8');
const re = /\/\* @phase15-module-order:([^*\n]+) \*\//g;
const actual = [];
let m;
while ((m = re.exec(src))) actual.push(m[1].trim());

console.log(`期望模块顺序：${expected.join(' → ')}`);
console.log(`实际模块顺序：${actual.join(' → ')}`);

const duplicate = actual.filter((x, i) => actual.indexOf(x) !== i);
const missing = expected.filter((x) => !actual.includes(x));
const extra = actual.filter((x) => !expected.includes(x));
const exact = !duplicate.length && !missing.length && !extra.length && actual.length === expected.length && actual.every((x, i) => x === expected[i]);

if (duplicate.length) console.error('重复模块标记：' + [...new Set(duplicate)].join(', '));
if (missing.length) console.error('缺失模块标记：' + missing.join(', '));
if (extra.length) console.error('未知模块标记：' + extra.join(', '));
if (!exact) {
  process.exit(1);
}
console.log('✅ Rollup 产物模块顺序与契约完全一致');
