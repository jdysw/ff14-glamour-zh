import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE_IMPORTERS = new Set(['src/core/site-registry.js', 'src/core/probe.js']);
const SITE_POLICY = 'src/core/site-policy.js';
const SITE_CONFIG = 'src/core/site-config.json';
const PURE_MODULES = new Set(['src/core/runtime.js', SITE_POLICY]);

// A site entry (src/sites/<name>.js) and its private directory share a namespace.
const siteName = file => /^src\/sites\/([^/]+?)(?:\/|\.js$)/u.exec(file)?.[1];

function validateEdge(owner, dependency, sources, errors) {
  if (!sources.has(dependency)) errors.push(`${owner}: missing module ${dependency}`);
  if (owner.startsWith('src/core/') && dependency.startsWith('src/sites/')
    && !SITE_IMPORTERS.has(owner))
    errors.push(`${owner}: Core imports site ${dependency}`);
  const ownerSite = siteName(owner);
  if (ownerSite && dependency.startsWith('src/sites/') && ownerSite !== siteName(dependency))
    errors.push(`${owner}: cross-site dependency ${dependency}`);
}

// Both the build and its regression tests use this actual ESM parser and graph.
export function analyzeDependencies(sources) {
  const graph = new Map();
  const errors = [];
  for (const [file, source] of sources) {
    if (file === SITE_CONFIG) {
      JSON.parse(source);
      graph.set(file, []);
      continue;
    }
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const dependencies = ast.body.filter(node => node.source).map(node =>
      path.posix.normalize(path.posix.join(path.posix.dirname(file), node.source.value)));
    graph.set(file, dependencies);
    if (PURE_MODULES.has(file) && dependencies.some(dep => file !== SITE_POLICY || dep !== SITE_CONFIG))
      errors.push(`${file}: pure module imports dependencies`);
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
  const listModules = folder => fs.readdirSync(path.join(directory, folder), { withFileTypes: true })
    .flatMap(entry => {
      const file = folder + '/' + entry.name;
      if (entry.isDirectory()) return listModules(file);
      return entry.isFile() && (file.endsWith('.js') || file === SITE_CONFIG) ? [file] : [];
    });
  const files = listModules('src');
  return analyzeDependencies(new Map(files.map(file => [file, fs.readFileSync(path.join(directory, file), 'utf8')])));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { graph, errors } = verifyDependencies();
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(`Dependencies verified: ${graph.size} modules, no cycles or cross-site imports.`);
}
