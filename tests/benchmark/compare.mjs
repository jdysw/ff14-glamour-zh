#!/usr/bin/env node
// tests/benchmark/compare.mjs — 基准报告比较（旧 vs 新；v1.4 Phase 19）
// 用法: node tests/benchmark/compare.mjs <旧.json> <新.json> [--pct 10] [--strict]
// 说明：默认只列表 + 标记（方向人工判读）；--strict 时存在超阈值指标则 exit 1（可供门禁使用）。
import { loadReport, diffMetrics, formatRows, overThreshold } from './report.mjs';

const argv = process.argv.slice(2);
let pct = 10;
let strict = false;
const files = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--pct') { pct = Number(argv[++i]); }
  else if (a === '--strict') { strict = true; }
  else { files.push(a); }
}
if (files.length !== 2) {
  console.log('用法: node tests/benchmark/compare.mjs <旧.json> <新.json> [--pct 10] [--strict]');
  process.exit(2);
}
const A = loadReport(files[0]);
const B = loadReport(files[1]);
if (A.bench !== B.bench) console.log(`⚠ bench 名不一致: ${A.bench} vs ${B.bench}`);
if (A.env.dist !== B.env.dist) console.log(`⚠ dist 摘要不一致: ${A.env.dist} vs ${B.env.dist}（跨版本对比，注意口径）`);
console.log(`旧: ${A.when}  dist=${A.env.dist}  node=${A.env.node}`);
console.log(`新: ${B.when}  dist=${B.env.dist}  node=${B.env.node}`);
console.log('');
const rows = diffMetrics(A.metrics, B.metrics);
console.log(formatRows(rows, { threshold: pct }));
const over = overThreshold(rows, pct);
console.log(`\n超过 ±${pct}% 的指标: ${over.length ? over.map((r) => `${r.key}(${Number.isFinite(r.pct) ? (r.pct >= 0 ? '+' : '') + Math.round(r.pct * 10) / 10 : '∞'}%)`).join(', ') : '无'}`);
console.log('注：方向需人工判读——耗时/规模类一般越低越好；cache 命中、数据来源计数类方向相反。');
if (strict && over.length) {
  console.log('--strict：存在超阈值指标 → exit 1');
  process.exit(1);
}
