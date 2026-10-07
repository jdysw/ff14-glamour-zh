// build/migrate/add-interfaces.mjs —— Phase 15 搬移工具（v2）：为模块草案生成 import/export 接口
// 用法: node build/migrate/add-interfaces.mjs [草案目录=.cache/modules-v1] [输出目录=.cache/modules-v2]
// 原理:
//   1. acorn 解析每个模块草案，收集「顶层声明名」与「所有标识符出现」。
//   2. imports = 出现名 ∩ 其他模块的声明名 − 本模块任何声明名（保守：同模块任何作用域的声明都排除）。
//   3. export = 本模块全部顶层声明名（脚本型模块，全导出最简）。
//   4. 报告：重复声明（跨模块同名）、悬空引用（既非模块声明也非已知内建）。
import { parse } from 'acorn';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

// ── 路径净化：仅限仓库内路径（防路径穿越 / 公开可写目录；CLI 参数不可信）──
function safeResolve(p, label) {
  const abs = path.resolve(p);
  const rel = path.relative(repoRoot, abs);
  if (rel !== '' && (rel.startsWith('..') || path.isAbsolute(rel))) {
    throw new Error(`${label}越界（仅允许仓库内路径）: ${p}`);
  }
  return abs;
}
const byCodeUnit = (a, b) => (a < b ? -1 : (a > b ? 1 : 0));
const IN_ROOT = safeResolve(process.argv[2] || path.join(repoRoot, '.cache', 'modules-v1'), '输入目录');
const OUT_ROOT = safeResolve(process.argv[3] || path.join(repoRoot, '.cache', 'modules-v2'), '输出目录');

const BUILTINS = new Set([
  'window', 'document', 'console', 'navigator', 'location', 'history', 'localStorage',
  'sessionStorage', 'performance', 'JSON', 'Math', 'Date', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'parseInt', 'parseFloat', 'isNaN',
  'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'fetch', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader',
  'FormData', 'Headers', 'Request', 'Response', 'AbortController', 'TextEncoder',
  'TextDecoder', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array',
  'Int32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView', 'Proxy',
  'Reflect', 'globalThis', 'undefined', 'NaN', 'Infinity', 'structuredClone',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'CustomEvent', 'Event',
  'Node', 'Element', 'HTMLElement', 'NodeList', 'DOMParser', 'XMLHttpRequest', 'Image',
  'Audio', 'getComputedStyle', 'matchMedia', 'scrollTo', 'alert', 'confirm', 'prompt',
  'queueMicrotask', 'atob', 'btoa', 'crypto', 'Uint8ClampedArray', 'BigInt', 'eval',
  'isPrototypeOf', 'CSS', 'DOMRect', 'DOMRectReadOnly', 'Offset', 'Worker', 'HTMLLinkElement',
  'GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue', 'GM_info', 'GM_addStyle', 'GM_deleteValue',
  'GM_registerMenuCommand', 'unsafeWindow',
  'NodeFilter', 'SHOW_TEXT', 'SHOW_ELEMENT', 'SHOW_ALL', 'SHOW_COMMENT',
  'FILTER_REJECT', 'FILTER_ACCEPT', 'FILTER_SKIP',
  'requestIdleCallback', 'cancelIdleCallback', 'arguments', 'globalThis', 'self', 'top', 'parent', 'frames',
  'GM', 'MessageChannel',
]);

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    const val = node[key];
    if (Array.isArray(val)) for (const c of val) walk(c, visit);
    else if (val && typeof val.type === 'string') walk(val, visit);
  }
}

function collectNamesFromPattern(pat, out) {
  if (!pat) return;
  switch (pat.type) {
    case 'Identifier': out.add(pat.name); break;
    case 'ObjectPattern': pat.properties.forEach((p) => collectNamesFromPattern(p.value || p.argument, out)); break;
    case 'ArrayPattern': pat.elements.forEach((el) => collectNamesFromPattern(el, out)); break;
    case 'AssignmentPattern': collectNamesFromPattern(pat.left, out); break;
    case 'RestElement': collectNamesFromPattern(pat.argument, out); break;
    default: break;
  }
}

const bump = (m, nm) => m.set(nm, (m.get(nm) || 0) + 1);

// 声明名收集 / 引用计数拆为独立函数（仅降复杂度；判定不变）
function noteDecl(n, allDecl) {
  if (n.type === 'FunctionDeclaration' && n.id) { allDecl.add(n.id.name); n.params.forEach((p) => collectNamesFromPattern(p, allDecl)); }
  else if (n.type === 'FunctionExpression') {
    if (n.id) { allDecl.add(n.id.name); }
    n.params.forEach((p) => collectNamesFromPattern(p, allDecl));
  } else if (n.type === 'ArrowFunctionExpression') n.params.forEach((p) => collectNamesFromPattern(p, allDecl));
  else if (n.type === 'VariableDeclarator') collectNamesFromPattern(n.id, allDecl);
  else if (n.type === 'ClassDeclaration' && n.id) allDecl.add(n.id.name);
  else if (n.type === 'CatchClause' && n.param) collectNamesFromPattern(n.param, allDecl);
}

function noteUse(n, refCount, propCount) {
  if (n.type === 'Identifier') bump(refCount, n.name);
  else if (n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier') bump(propCount, n.property.name);
  else if (n.type === 'Property' && !n.computed && n.key.type === 'Identifier' && !n.shorthand) bump(propCount, n.key.name);
  else if ((n.type === 'LabeledStatement' || n.type === 'BreakStatement' || n.type === 'ContinueStatement') && n.label) bump(propCount, n.label.name);
}

const modules = fs.readdirSync(IN_ROOT, { recursive: true })
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.replace(/\\/g, '/'))
  .sort();

const info = {};
for (const rel of modules) {
  const code = fs.readFileSync(path.join(IN_ROOT, rel), 'utf8');
  const ast = parse(code, { ecmaVersion: 'latest' });
  const topDecl = new Set();
  const allDecl = new Set();

  for (const stmt of ast.body) {
    if (stmt.type === 'FunctionDeclaration' && stmt.id) topDecl.add(stmt.id.name);
    if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations) collectNamesFromPattern(d.id, topDecl);
    }
    if (stmt.type === 'ClassDeclaration' && stmt.id) topDecl.add(stmt.id.name);
    if (stmt.type === 'ImportDeclaration') {
      for (const spec of stmt.specifiers) topDecl.add(spec.local.name);
    }
  }
  // 第一遍：收集出现计数（区分「属性语境」与「引用语境」）
  const refCount = new Map();
  const propCount = new Map();
  walk(ast, (n) => { noteDecl(n, allDecl); noteUse(n, refCount, propCount); });
  // 自由候选：至少出现一次「非属性」语境
  const refs = new Set();
  for (const [nm, c] of refCount) if (c > (propCount.get(nm) || 0)) refs.add(nm);
  info[rel] = { topDecl, allDecl, refs, code };
}

// name → module（顶层声明）
const nameToModule = new Map();
const dups = [];
for (const rel of modules) {
  for (const nm of info[rel].topDecl) {
    if (nameToModule.has(nm) && nameToModule.get(nm) !== rel) {
      dups.push(`${nm}: ${nameToModule.get(nm)} 与 ${rel}`);
    }
    nameToModule.set(nm, rel);
  }
}

const importOf = (fromRel, rel) => {
  let p = path.posix.relative(path.posix.dirname(fromRel), rel);
  if (!p.startsWith('.')) p = './' + p;
  return p;
};

const dangling = new Map();
let written = 0;
for (const rel of modules) {
  const { topDecl, allDecl, refs, code } = info[rel];
  const need = new Map(); // moduleRel -> Set(names)
  for (const nm of refs) {
    if (allDecl.has(nm)) continue; // 本地（含任意作用域）声明
    const src = nameToModule.get(nm);
    if (!src || src === rel) continue;
    if (!need.has(src)) need.set(src, new Set());
    need.get(src).add(nm);
  }
  // 悬空（既非模块声明，也非内建）
  for (const nm of refs) {
    if (allDecl.has(nm) || nameToModule.has(nm) || BUILTINS.has(nm)) continue;
    dangling.set(nm, (dangling.get(nm) || []).concat(rel));
  }

  const importLines = [];
  for (const [src, names] of [...need.entries()].sort((x, y) => byCodeUnit(x[0], y[0]))) {
    importLines.push(`import { ${[...names].sort(byCodeUnit).join(', ')} } from '${importOf(rel, src)}';`);
  }
  // export 行置于头部（import 之后）：附着于 export 的注释会被 rollup 丢弃，
  // 若 export 在尾部会「吞掉」模块尾注释（@zhixia:*-end 锚点）。入口 main.js 不生成 export。
  const isEntry = rel === 'main.js';
  const exportLine = (!isEntry && topDecl.size) ? `export { ${[...topDecl].sort(byCodeUnit).join(', ')} };` : '';
  const headLines = importLines.concat(exportLine ? [exportLine] : []);
  const outCode = (headLines.length ? headLines.join('\n') + '\n\n' : '') + code.trimEnd() + '\n';

  const dest = path.join(OUT_ROOT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, outCode);
  written++;
}

console.log(`写出生效模块 ${written} 个 → ${OUT_ROOT}`);
console.log(`\n跨模块重复声明（${dups.length}）:`);
for (const d of dups.slice(0, 60)) console.log('  ' + d);
if (dups.length > 60) console.log(`  …还有 ${dups.length - 60} 条`);

console.log(`\n悬空引用（既非模块声明也非内建；${dangling.size} 个名字）:`);
const dangList = [...dangling.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [nm, mods] of dangList.slice(0, 120)) console.log(`  ${nm}  <- ${mods.join(', ')}`);
if (dangList.length > 120) console.log(`  …还有 ${dangList.length - 120} 个`);
