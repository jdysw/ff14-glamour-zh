import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { findPython } from '../python.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
process.chdir(root);
const python = findPython();
const out = process.env.ZHX_OUT || 'dist/ff14-glamour-zh.greasyfork.user.js';
const cache = process.env.ZHX_BUILD_CACHE || '.cache/build';
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });
const run = (bin, args) => execFileSync(bin, args, {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
  env: { PYTHONIOENCODING: 'utf-8', ...process.env },
});
const node = (...args) => run(process.execPath, args);

node('build/userscript/version.mjs');
run(python, ['build/userscript/inject_dicts.py', 'src/core/data/dictionary.js']);
node('build/userscript/verify-dependencies.mjs');
node('node_modules/rollup/dist/bin/rollup', '-c', 'build/userscript/rollup.config.mjs');
node('--check', out);
run(python, ['build/data/make_dict_json.py', '--out', path.join(cache, 'dict.json')]);
node('build/userscript/verify_dicts.js', 'src/core/data/dictionary.js', '--dict-json', path.join(cache, 'dict.json'));
node('build/userscript/version.mjs', '--check');
console.log('Build verified: ' + out);
