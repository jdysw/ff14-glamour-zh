// test-bench-report.mjs — 基准报告工具单测（v1.4 Phase 19）
// 覆盖：schema / flattenNumbers 展开 / diffMetrics 计算 / formatRows 标记 / overThreshold 判定
import { SCHEMA, flattenNumbers, diffMetrics, formatRows, overThreshold } from '../benchmark/report.mjs';

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const okv = JSON.stringify(got) === JSON.stringify(want);
  if (okv) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} —— got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const ok = (name, cond) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
};

console.log('\n── A：schema 与数值叶子展开 ──');
eq('schema 版本', SCHEMA, 'zhx-bench/1');
eq('嵌套展开', flattenNumbers({ a: 1, b: { c: 2.5, d: 'x' }, e: [1, 2] }), { a: 1, 'b.c': 2.5, 'e[0]': 1, 'e[1]': 2 });
eq('跳过非有限与字符串', flattenNumbers({ a: NaN, b: Infinity, c: 'y', d: 3 }), { d: 3 });
eq('空对象', flattenNumbers({}), {});

console.log('\n── B：diffMetrics ──');
{
  const rows = diffMetrics({ x: 100, y: 50, only: 1 }, { x: 110, y: 40, z: 2 });
  eq('仅共同键', rows.map((r) => r.key), ['x', 'y']);
  eq('Δ 与 Δ%', rows.map((r) => [r.delta, Math.round(r.pct * 10) / 10]), [[10, 10], [-10, -20]]);
  const rows0 = diffMetrics({ z: 0 }, { z: 5 });
  ok('旧值 0 → Δ% 视作 ∞', rows0[0].pct === Infinity);
  const rows1 = diffMetrics({ z: 0 }, { z: 0 });
  eq('双 0 → 0%', rows1[0].pct, 0);
}

console.log('\n── C：formatRows / overThreshold ──');
{
  const rows = diffMetrics({ a: 100, b: 100 }, { a: 115, b: 105 });
  const table = formatRows(rows, { threshold: 10 });
  const lineA = table.split('\n').find((l) => l.startsWith('a '));
  const lineB = table.split('\n').find((l) => l.startsWith('b '));
  ok('超过阈值标 ⚠', !!lineA && lineA.includes('⚠'));
  ok('未超阈值不标', !!lineB && !lineB.includes('⚠'));
  eq('overThreshold 仅超限行', overThreshold(rows, 10).map((r) => r.key), ['a']);
  eq('overThreshold 含 ∞', overThreshold(diffMetrics({ z: 0 }, { z: 5 }), 10).map((r) => r.key), ['z']);
}

console.log(`\n════════ 汇总 ════════`);
console.log(`通过 ${pass} / 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
