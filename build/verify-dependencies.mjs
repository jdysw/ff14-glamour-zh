import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['src/main.js', ...['core', 'sites'].flatMap((directory) =>
  fs.readdirSync(path.join(root, 'src', directory)).filter((f) => f.endsWith('.js')).map((f) => `src/${directory}/${f}`))];
const graph = new Map();
const errors = [];
for (const file of files) {
  const ast = parse(fs.readFileSync(path.join(root, file), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  const dependencies = ast.body.filter((n) => n.type === 'ImportDeclaration' || n.source).map((n) =>
    path.posix.normalize(path.posix.join(path.posix.dirname(file), n.source.value)));
  graph.set(file, dependencies);
  for (const dependency of dependencies) {
    if (!files.includes(dependency)) errors.push(`${file}: missing module ${dependency}`);
    if (file.startsWith('src/core/') && dependency.startsWith('src/sites/') &&
      !['src/core/site-registry.js', 'src/core/probe.js'].includes(file) &&
      !(file === 'src/core/chinese-search.js' && dependency === 'src/sites/eorzea-collection.js')) errors.push(`${file}: Core imports site ${dependency}`);
    if (file.startsWith('src/sites/') && dependency.startsWith('src/sites/')) errors.push(`${file}: cross-site dependency ${dependency}`);
  }
}
const done = new Set();
function visit(file, stack) {
  if (stack.includes(file)) { errors.push('Cycle: ' + [...stack.slice(stack.indexOf(file)), file].join(' -> ')); return; }
  if (done.has(file)) return;
  for (const dependency of graph.get(file) || []) visit(dependency, [...stack, file]);
  done.add(file);
}
for (const file of files) visit(file, []);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Dependencies verified: ${files.length} modules, no cycles or cross-site imports.`);
