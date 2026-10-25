import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_IMPORTERS = new Set(['src/core/site-registry.js', 'src/core/probe.js']);
const PURE_MODULES = new Set(['src/core/runtime.js', 'src/core/site-policy.js']);

function validateEdge(owner, dependency, sources, errors) {
  if (!sources.has(dependency)) errors.push(`${owner}: missing module ${dependency}`);
  if (owner.startsWith('src/core/') && dependency.startsWith('src/sites/')
    && !SITE_IMPORTERS.has(owner)
    && !(owner === 'src/core/chinese-search.js' && dependency === 'src/sites/eorzea-collection.js'))
    errors.push(`${owner}: Core imports site ${dependency}`);
  if (owner.startsWith('src/sites/') && dependency.startsWith('src/sites/'))
    errors.push(`${owner}: cross-site dependency ${dependency}`);
}

// Both the build and its regression tests use this actual ESM parser and graph.
export function analyzeDependencies(sources) {
  const graph = new Map();
  const errors = [];
  for (const [file, source] of sources) {
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const dependencies = ast.body.filter(node => node.source).map(node =>
      path.posix.normalize(path.posix.join(path.posix.dirname(file), node.source.value)));
    graph.set(file, dependencies);
    if (PURE_MODULES.has(file) && dependencies.length) errors.push(`${file}: pure module imports dependencies`);
    for (const dependency of dependencies) validateEdge(file, dependency, sources, errors);
  }
  const done = new Set();
  const visiting = new Set();
  const trail = [];
  function visit(file) {
    if (visiting.has(file)) { errors.push('Cycle: ' + [...trail.slice(trail.indexOf(file)), file].join(' -> ')); return; }
    if (done.has(file)) return;
    visiting.add(file);
    trail.push(file);
    for (const dependency of graph.get(file) || []) visit(dependency);
    trail.pop();
    visiting.delete(file);
    done.add(file);
  }
  for (const file of graph.keys()) visit(file);
  return { graph, errors };
}

export function verifyDependencies(directory = root) {
  const files = ['src/main.js', ...['core', 'sites'].flatMap(folder =>
    fs.readdirSync(path.join(directory, 'src', folder)).filter(file => file.endsWith('.js'))
      .map(file => `src/${folder}/${file}`))];
  return analyzeDependencies(new Map(files.map(file => [file, fs.readFileSync(path.join(directory, file), 'utf8')])));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { graph, errors } = verifyDependencies();
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(`Dependencies verified: ${graph.size} modules, no cycles or cross-site imports.`);
}
