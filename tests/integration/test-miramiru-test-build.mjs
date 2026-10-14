// Exercise the actual downloadable userscript, with no preseeded V3 cache.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { repoRoot } from '../helpers/paths.mjs';

execFileSync(process.execPath, ['build/make-miramiru-test.mjs'], { cwd: repoRoot, stdio: 'pipe' });
const version = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
const file = path.join(repoRoot, 'dist', `ff14-miramiru-zh-${version}-test.user.js`);
const source = fs.readFileSync(file, 'utf8');
const header = source.split('// ==/UserScript==')[0];
assert.ok(header.includes('/miramiru-test'));
assert.ok(header.includes('// @grant        none'));
assert.ok(!header.includes('@connect'));
assert.equal((header.match(/^\/\/ @match /gm) || []).length, 1);
execFileSync(process.execPath, ['--check', file], { cwd: repoRoot, stdio: 'inherit' });
execFileSync(process.execPath, ['tests/integration/test-miramiru.mjs'], {
  cwd: repoRoot, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, GF: file, ZHX_MIRAMIRU_STANDALONE: '1' },
});
console.log('PASS standalone install: embedded data, own namespace, no GM storage or localStorage changes');
