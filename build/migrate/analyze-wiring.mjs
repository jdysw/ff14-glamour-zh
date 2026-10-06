// build/migrate/analyze-wiring.mjs —— 分析模块树的「跨模块写」与「循环依赖」
// 用法: node build/migrate/analyze-wiring.mjs [src目录=src]
// 用途：Phase 15 模块化收尾——找出所有对 import 绑定的非法重新赋值、以及全部循环依赖环，
// 供修正模块分配表（module-assign.json）与破环设计。
// 输出纪律：环列表默认只列前 12 个（其余从略），避免海量输出撑爆调用方管道；
// 需要全量时设 ZHX_WIRING_VERBOSE=1。
import { parse } from 'acorn';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || 'src';
const files = [];
for (const sub of ['core', 'sites']) {
  const dir = path.join(ROOT, sub);
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.js')) files.push(path.join(dir, f));
}
if (fs.existsSync(path.join(ROOT, 'main.js'))) files.push(path.join(ROOT, 'main.js'));

function walk(node, fn) {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'loc') continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, fn); }
    else if (v && typeof v.type === 'string') walk(v, fn);
  }
}

function collectPatternNames(pat, set) {
  if (!pat) return;
  if (pat.type === 'Identifier') set.add(pat.name);
  else if (pat.type === 'ObjectPattern') pat.properties.forEach((p) => collectPatternNames(p.value || p.argument, set));
  else if (pat.type === 'ArrayPattern') pat.elements.forEach((el) => collectPatternNames(el, set));
  else if (pat.type === 'AssignmentPattern') collectPatternNames(pat.left, set);
  else if (pat.type === 'RestElement') collectPatternNames(pat.argument, set);
}

const declOf = new Map(); // name -> module rel（本地声明）
const mods = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const ast = parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const declLocal = new Set(); // 本模块「自身声明」的名字（不含 import）
  const writes = []; // {name, line}
  const deps = new Set();
  walk(ast, (n) => {
    if (n.type === 'FunctionDeclaration' && n.id) declLocal.add(n.id.name);
    if (n.type === 'VariableDeclaration') n.declarations.forEach((d) => collectPatternNames(d.id, declLocal));
    if (n.type === 'ClassDeclaration' && n.id) declLocal.add(n.id.name);
    if (n.type === 'ImportDeclaration') {
      const src = n.source.value;
      const dep = path.posix.normalize(path.posix.join(path.posix.dirname(rel), src));
      deps.add(dep);
    }
    if (n.type === 'AssignmentExpression') {
      const L = n.left;
      if (L.type === 'Identifier') writes.push({ name: L.name, line: n.loc.start.line });
      else if (L.type === 'ObjectPattern' || L.type === 'ArrayPattern') {
        const s = new Set(); collectPatternNames(L, s); s.forEach((nm) => writes.push({ name: nm, line: n.loc.start.line }));
      }
    }
    if (n.type === 'UpdateExpression' && n.argument.type === 'Identifier') writes.push({ name: n.argument.name, line: n.loc.start.line });
    if ((n.type === 'ForInStatement' || n.type === 'ForOfStatement') && n.left.type === 'Identifier') writes.push({ name: n.left.name, line: n.loc.start.line });
  });
  for (const nm of declLocal) {
    if (!declOf.has(nm)) declOf.set(nm, rel);
    else if (declOf.get(nm) !== rel) declOf.set(nm, declOf.get(nm) + ' | ' + rel);
  }
  mods.push({ rel, declLocal, writes, ast, deps });
}

// A. 跨模块写
console.log('════ A. 跨模块写（对他人模块的声明赋值 → rollup Illegal reassignment）════');
let cnt = 0;
for (const m of mods) {
  for (const w of m.writes) {
    if (m.declLocal.has(w.name)) continue;
    const owner = declOf.get(w.name);
    if (!owner) continue;
    const owners = owner.split(' | ');
    if (!owners.includes(m.rel)) { cnt++; console.log(`${m.rel}:${w.line}  写 <${w.name}>  （声明于 ${owner}）`); }
  }
}
console.log(`共 ${cnt} 处`);
if (cnt > 0) {
  console.error('❌ 存在跨模块 imported binding 写入，禁止继续 Rollup 构建');
  process.exitCode = 1;
}

// B. 循环依赖
console.log('');
console.log('════ B. 循环依赖（import 图）════');
const graph = new Map();
for (const m of mods) graph.set(m.rel, [...m.deps].filter((d) => graph_has(m, d) || true));
function graph_has() { return true; } // 所有依赖都进图（包括 main->core 等）
function findCycles(g) {
  const seen = new Map();
  const out = [];
  const nodes = [...g.keys()].sort();
  for (const start of nodes) {
    const stack = [[start, [start]]];
    while (stack.length) {
      const [cur, p] = stack.pop();
      if (p.length > 12) continue;
      for (const nx of g.get(cur) || []) {
        if (nx === start && p.length > 1) {
          const parts = p.slice();
          let mi = 0; for (let i = 1; i < parts.length; i++) if (parts[i] < parts[mi]) mi = i;
          const rot = parts.slice(mi).concat(parts.slice(0, mi)).join(' -> ');
          if (!seen.has(rot)) { seen.set(rot, true); out.push(rot); }
        } else if (!p.includes(nx)) stack.push([nx, [...p, nx]]);
      }
    }
  }
  return out;
}
const cycles = findCycles(graph);
const verbose = process.env.ZHX_WIRING_VERBOSE === '1';
const MAX_SHOW = verbose ? cycles.length : 12;
for (const c of cycles.slice(0, MAX_SHOW)) console.log(c);
if (cycles.length > MAX_SHOW) console.log(`…（其余 ${cycles.length - MAX_SHOW} 个从略；ZHX_WIRING_VERBOSE=1 查看全量）`);
console.log(`共 ${cycles.length} 个环（信息性：均为既有依赖网络的一部分，不阻塞构建）`);
