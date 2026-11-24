import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { analyzeDependencies, verifyDependencies } from '../../build/userscript/verify-dependencies.mjs';

assert.deepEqual(verifyDependencies().errors, [], 'Production ESM must satisfy the build dependency rules');
const fixture = files => new Map(Object.entries(files).map(([file,imports]) =>
  [file, imports.map(dependency => `import '${dependency}';`).join('\n')]));
const errors = files => analyzeDependencies(fixture(files)).errors.join('\n');
assert.match(errors({'src/main.js':['./missing.js']}), /missing module/);
assert.match(errors({'src/core/a.js':['./b.js'],'src/core/b.js':['./a.js']}), /Cycle: src\/core\/a.js -> src\/core\/b.js -> src\/core\/a.js/);
assert.match(errors({'src/core/runtime.js':['./dom.js'],'src/core/dom.js':[]}), /pure module/);
assert.match(errors({'src/core/site-policy.js':['./dom.js'],'src/core/dom.js':[]}), /pure module/);
assert.match(errors({'src/core/a.js':['../sites/a.js'],'src/sites/a.js':[]}), /Core imports site/);
assert.match(errors({'src/sites/a.js':['./b.js'],'src/sites/b.js':[]}), /cross-site dependency/);
assert.equal(errors({'src/core/site-registry.js':['../sites/a.js'],'src/sites/a.js':[]}), '');
assert.equal(errors({'src/core/probe.js':['../sites/a.js'],'src/sites/a.js':[]}), '');
assert.match(errors({'src/core/chinese-search.js':['../sites/eorzea-collection.js'],'src/sites/eorzea-collection.js':[]}), /Core imports site/);
assert.match(analyzeDependencies(new Map([
  ['src/core/a.js', "export * from '../sites/a.js';"], ['src/sites/a.js',''],
])).errors.join('\n'), /Core imports site/);
assert.throws(() => analyzeDependencies(new Map([['src/main.js','import { broken']])), SyntaxError);
const directory = mkdtempSync(join(tmpdir(), 'glamour-dependencies-'));
const writeModule = (file, source = '') => {
  const output = join(directory, file);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, source);
};

try {
  const entry = 'src/sites/a.js';
  const helper = 'src/sites/a/helper.js';
  const nested = 'src/sites/a/catalog/nested.js';
  writeModule(entry, "import './a/helper.js';");
  writeModule(helper, "export * from './catalog/nested.js';");
  writeModule(nested);
  writeModule('src/sites/a-extra/helper.js');
  const { graph, errors: allowedErrors } = verifyDependencies(directory);
  assert.deepEqual(allowedErrors, []);
  assert.deepEqual(graph.get(entry), [helper]);
  assert.deepEqual(graph.get(helper), [nested]);
  assert.deepEqual(graph.get(nested), []);

  writeModule(nested, "import '../../a.js'; import '../../a-extra/helper.js';");
  writeModule('src/core/chinese-search/catalog.js', "import '../../sites/a/helper.js';");
  const { errors: rejected } = verifyDependencies(directory);
  const cycle = rejected.find(error => error.startsWith('Cycle: '));
  assert.ok(cycle, 'A same-site cycle is still illegal');
  assert.deepEqual(new Set(cycle.slice('Cycle: '.length).split(' -> ')), new Set([entry, helper, nested]));
  assert.deepEqual(rejected.filter(error => error !== cycle).sort(), [
    'src/core/chinese-search/catalog.js: Core imports site src/sites/a/helper.js',
    'src/sites/a/catalog/nested.js: cross-site dependency src/sites/a-extra/helper.js',
  ]);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
console.log('PASS dependency rules: real graph, site-local helpers, missing modules, cycles, layer boundaries and invalid ESM');
