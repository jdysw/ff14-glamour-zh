import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { findPython } from './python.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const python = findPython();
const out = process.env.ZHX_OUT || 'dist/ff14-glamour-zh.greasyfork.user.js';
const cache = process.env.ZHX_BUILD_CACHE || '.cache/build';
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });
const run = (bin, args) => execFileSync(bin, args, { cwd: root, stdio: 'inherit', windowsHide: true });
const node = (...args) => run(process.execPath, args);

node('build/version.mjs');
run(python, ['build/inject_dicts.py', 'src/core/dictionary.js']);
node('build/verify-module-source.mjs');
node('build/verify-dependencies.mjs');
node('--check', 'src/main.js');
for (const directory of ['src/core', 'src/sites']) {
  for (const file of fs.readdirSync(directory).filter((f) => f.endsWith('.js')).sort()) node('--check', path.join(directory, file));
}
node('node_modules/rollup/dist/bin/rollup', '-c', 'build/rollup.config.mjs');
node('--check', out);
node('build/migrate/verify-build-order.mjs', out, 'build/module-order.json');
run(python, ['build/verify-anchors.py', out]);
node('build/verify_dicts.js', 'src/core/dictionary.js');
run(python, ['build/make_dict_json.py', '--out', path.join(cache, 'dict.json')]);
node('build/verify_dicts.js', 'src/core/dictionary.js', '--dict-json', path.join(cache, 'dict.json'));
node('build/version.mjs', '--check');
console.log('Build verified: ' + out);
