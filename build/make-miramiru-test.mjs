// Standalone Miramiru test installation. Data stays inside this script and in
// page-local memory, so testing never needs an unpublished production manifest.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { findPython } from './python.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, '.cache', 'miramiru-test-data');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
execFileSync(findPython(), ['build/make-runtime-data.py', '--out', dataDir], {
  cwd: root, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});
const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'manifest.json'), 'utf8'));
manifest.sites = { miramiru: manifest.sites.miramiru };
const files = {};
for (const [name, meta] of Object.entries(manifest.sites.miramiru.files)) {
  files[name] = { sha256: meta.sha256, text: fs.readFileSync(path.join(dataDir, meta.url), 'utf8') };
}
const dict = manifest.shared.dict;
files.dict = { sha256: dict.sha256, text: fs.readFileSync(path.join(dataDir, dict.url), 'utf8') };
const payload = gzipSync(JSON.stringify({ manifest, files })).toString('base64');
const production = fs.readFileSync(path.join(root, 'dist', 'ff14-glamour-zh.greasyfork.user.js'), 'utf8');
if (production.match(/^\/\/ @version\s+(\S+)/m)?.[1] !== version) {
  throw new Error('Production bundle version differs from package.json; rebuild first');
}
const end = production.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length;
if (end < '// ==/UserScript=='.length) throw new Error('Build the production script first');
const header = production.slice(0, end).split(/\r?\n/)
  .filter(line => !/^\/\/ @(?:match|grant|connect|updateURL|downloadURL)\s/.test(line))
  .map(line => {
    if (line.startsWith('// @name ')) return '// @name         FF14 Miramiru 中文支持 · 1.4.5 测试版';
    if (line.startsWith('// @namespace ')) return '// @namespace    https://github.com/jdysw/ff14-glamour-zh/miramiru-test';
    if (line.startsWith('// @description ')) return '// @description  Miramiru 英／日／韩三语中文与装备跳转测试。内置数据快照，无需部署数据站；独立安装，不写正式版缓存。测试结束后请停用。';
    if (line === '// ==/UserScript==') return '// @match        https://miramiru.co/*\n// @grant        none\n' + line;
    return line;
  }).join('\n');
const source = String.raw`${header}
(async () => {
  'use strict';
  const compressed = Uint8Array.from(atob('${payload}'), c => c.charCodeAt(0));
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const snapshot = JSON.parse(await new Response(stream).text());
  const cache = new Map();
  const manifestText = JSON.stringify(snapshot.manifest);
  const cachedManifest = Date.now() + '\n' + manifestText;
  cache.set('zhx.v3.manifest', cachedManifest);
  cache.set('zhx.v3.manifest.miramiru', cachedManifest);
  for (const [name, file] of Object.entries(snapshot.files)) {
    cache.set('zhx.v3.f.miramiru.' + name + '.' + file.sha256, file.sha256 + '\n' + file.text);
  }
  const GM_getValue = (key, fallback) => cache.has(key) ? cache.get(key) : fallback;
  const GM_setValue = (key, value) => { cache.set(key, String(value)); };
  const GM_listValues = () => [...cache.keys()];
  const GM_deleteValue = key => { cache.delete(key); };
  const GM_xmlhttpRequest = options => { queueMicrotask(() => options.onerror?.({status:0})); };
  ${production.slice(end)}
})().catch(error => console.error('[Miramiru 1.4.5 test]', error));
`;
const target = path.join(root, 'dist', `ff14-miramiru-zh-${version}-test.user.js`);
fs.writeFileSync(target, source);
console.log('Standalone test userscript: ' + target + ' (' + Buffer.byteLength(source) + ' bytes)');
