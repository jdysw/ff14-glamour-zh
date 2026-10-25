import assert from 'node:assert/strict';
import {analyzeDependencies,verifyDependencies} from '../../build/verify-dependencies.mjs';

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
assert.equal(errors({'src/core/chinese-search.js':['../sites/eorzea-collection.js'],'src/sites/eorzea-collection.js':[]}), '');
assert.match(analyzeDependencies(new Map([
  ['src/core/a.js', "export * from '../sites/a.js';"], ['src/sites/a.js',''],
])).errors.join('\n'), /Core imports site/);
assert.throws(() => analyzeDependencies(new Map([['src/main.js','import { broken']])), SyntaxError);
console.log('PASS dependency rules: real graph, missing modules, cycles, layer boundaries and invalid ESM');
