// tests/benchmark/report.mjs — 基准报告读写与比较（zhx-bench/1；v1.4 Phase 19）
// 报告结构：{ schema, bench, when, env, metrics }；比较按「数值叶子路径」展开。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { repoRoot, distFile } from '../helpers/paths.mjs';

export const SCHEMA = 'zhx-bench/1';

/** 当前构建产物摘要（sha256 前 12 位；产物缺失返回 'n/a'） */
export function distSha12() {
  try {
    return createHash('sha256').update(fs.readFileSync(distFile)).digest('hex').slice(0, 12);
  } catch (e) {
    return 'n/a';   // 忽略：缺少产物时不阻断报告生成
  }
}

/** 环境元信息（随报告记录；跨环境对比前先核对 host / node） */
export function hostMeta(args) {
  return { node: process.version, host: os.hostname(), dist: distSha12(), args: args || [] };
}

/** 写报告：默认落 tests/.cache/bench/；opts.save=true 另存 tests/benchmark/baseline/<bench>.json */
export function writeReport(bench, metrics, opts = {}) {
  const rec = { schema: SCHEMA, bench, when: new Date().toISOString(), env: hostMeta(opts.args), metrics };
  const text = JSON.stringify(rec, null, 2) + '\n';
  const dir = path.join(repoRoot, 'tests', '.cache', 'bench');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `report-${bench}-${rec.when.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, text);
  let saved = null;
  if (opts.save) {
    saved = path.join(repoRoot, 'tests', 'benchmark', 'baseline', `${bench}.json`);
    fs.mkdirSync(path.dirname(saved), { recursive: true });
    fs.writeFileSync(saved, text);
  }
  console.log('报告已写入: ' + file);
  if (saved) console.log('基线已更新: ' + saved);
  return { file, saved };
}

export function loadReport(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** 数值叶子展开：{a:1,b:{c:2}} → {'a':1,'b.c':2}（仅有限 number；字符串/布尔跳过） */
export function flattenNumbers(obj, prefix = '', out = {}) {
  if (typeof obj === 'number') {
    if (Number.isFinite(obj)) out[prefix] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flattenNumbers(v, `${prefix}[${i}]`, out));
    return out;
  }
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) flattenNumbers(obj[k], prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

/** 两 metrics 的数值对比行（仅共同键；Δ% 以旧值绝对值为基准；旧值 0 且 Δ≠0 → Infinity） */
export function diffMetrics(ma, mb) {
  const fa = flattenNumbers(ma);
  const fb = flattenNumbers(mb);
  const rows = [];
  for (const key of Object.keys(fa)) {
    if (!(key in fb)) continue;
    const oldV = fa[key];
    const newV = fb[key];
    const delta = newV - oldV;
    const pct = oldV !== 0 ? (delta / Math.abs(oldV)) * 100 : (delta === 0 ? 0 : Infinity);
    rows.push({ key, old: oldV, new: newV, delta, pct });
  }
  return rows;
}

const one = (x) => (Number.isFinite(x) ? String(Math.round(x * 10) / 10) : '∞');
const pctText = (x) => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + one(x) + '%' : '∞');

/** 对比表格文本（|Δ%| > threshold 标 ⚠） */
export function formatRows(rows, { threshold = 10 } = {}) {
  const pad = (s, w) => String(s).padEnd(w);
  const wKey = Math.max(4, ...rows.map((r) => r.key.length));
  const lines = [`${pad('指标', wKey)} | ${pad('旧', 10)} | ${pad('新', 10)} | ${pad('Δ', 10)} | ${pad('Δ%', 9)} | 标记`];
  lines.push('-'.repeat(wKey + 48));
  for (const r of rows) {
    const flag = r.pct === Infinity || (Number.isFinite(r.pct) && Math.abs(r.pct) > threshold) ? '⚠' : '';
    lines.push(`${pad(r.key, wKey)} | ${pad(one(r.old), 10)} | ${pad(one(r.new), 10)} | ${pad((r.delta >= 0 ? '+' : '') + one(r.delta), 10)} | ${pad(pctText(r.pct), 9)} | ${flag}`);
  }
  return lines.join('\n');
}

/** 超阈值行（旧值 0 → 新值非 0 视作超阈值，显示 ∞） */
export function overThreshold(rows, pct = 10) {
  return rows.filter((r) => r.pct === Infinity || (Number.isFinite(r.pct) && Math.abs(r.pct) > pct));
}
