// build/module-map.mjs —— Phase 15 搬移工具（1/3）：块地图扫描器
// 解析 IIFE 体内的顶层语句 → 输出「块清单」（行号范围 + 类型 + 首行摘要）
// 用法: node build/module-map.mjs [源文件] > 输出.json
import { parse } from 'acorn';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const file = process.argv[2] || path.join(repoRoot, 'src', 'ff14-glamour-zh.external.user.js');
const src = fs.readFileSync(file, 'utf8');
const lines = src.split('\n');

const ast = parse(src, { ecmaVersion: 'latest' });

// 顶层应是 (function () { ... })(); —— 取该 IIFE 函数体的语句列表
let stmts = [];
for (const s of ast.body) {
  if (s.type === 'ExpressionStatement' && s.expression.type === 'CallExpression') {
    const fn = s.expression.callee;
    if (fn.type === 'FunctionExpression') { stmts = fn.body.body; break; }
  }
}

const lineOf = (pos) => src.slice(0, pos).split('\n').length;

const out = stmts.map((s) => {
  const start = lineOf(s.start);
  const end = lineOf(s.end);
  const head = lines[start - 1].trim().slice(0, 100);
  const head2 = start + 1 <= lines.length ? lines[start].trim().slice(0, 100) : '';
  return { start, end, type: s.type, head, head2 };
});

console.error(`共 ${out.length} 个顶层块（${file}）`);
console.log(JSON.stringify(out, null, 1));
