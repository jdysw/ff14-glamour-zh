// Shared real Runtime Data v3 manifest and cache fixtures for tests and benchmarks.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { repoRoot } from './paths.mjs';
const CACHE_DIR = path.join(repoRoot, 'tests', '.cache', 'runtime-data-v3-' + process.pid);
const MANIFEST_PATH = path.join(CACHE_DIR, 'manifest.json');
let loaded;
process.once('exit', () => { try { fs.rmSync(CACHE_DIR, { recursive: true, force: true }); } catch {} });
function ensureGenerated() {
  if (fs.existsSync(CACHE_DIR)) fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  execFileSync('python3', ['build/make-runtime-data.py', '--out', CACHE_DIR], { cwd: repoRoot, stdio: 'pipe' });
}
export function readRuntimeV3(siteId = 'ec') {
  if (!loaded) {
    ensureGenerated();
    const manifestText = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(manifestText);
    const filesFor = (id) => {
      const files = {};
      for (const [name, meta] of Object.entries(manifest.sites[id]?.files || {}))
        files[name] = { ...meta, text: fs.readFileSync(path.join(CACHE_DIR, meta.url), 'utf8') };
      return files;
    };
    const dictMeta = manifest.shared?.dict;
    const dict = dictMeta ? { ...dictMeta, text: fs.readFileSync(path.join(CACHE_DIR, dictMeta.url), 'utf8') } : null;
    loaded = { manifest, manifestText, filesFor, dict };
  }
  const siteFiles = loaded.filesFor(siteId);
  if (!Object.keys(siteFiles).length) throw new Error('Unknown Runtime Data v3 site: ' + siteId);
  return { ...loaded, siteId, siteFiles };
}
export function v3CacheEntries(siteId = 'ec', prefix = '') {
  const { manifestText, siteFiles, dict } = readRuntimeV3(siteId);
  const entries = {
    [prefix + 'zhx.data.refresh.epoch']: 'v3-only-1-force-refresh',
    [prefix + 'zhx.v3.manifest']: Date.now() + String.fromCharCode(10) + manifestText,
    [prefix + 'zhx.v3.manifest.' + siteId]: Date.now() + String.fromCharCode(10) + manifestText,
  };
  for (const [name, meta] of Object.entries(siteFiles))
    entries[prefix + 'zhx.v3.f.' + siteId + '.' + name + '.' + meta.sha256] = meta.sha256 + String.fromCharCode(10) + meta.text;
  if (dict) entries[prefix + 'zhx.v3.f.' + siteId + '.dict.' + dict.sha256] = dict.sha256 + String.fromCharCode(10) + dict.text;
  return entries;
}
export async function seedV3Browser(cdp, siteId = 'ec', prefix = 'gm:') {
  const entries = v3CacheEntries(siteId, prefix);
  await cdp.callFn('function (entries) { for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v); return Object.keys(entries).length; }', [entries]);
  return Object.keys(entries).length;
}
export function sha256Text(text) { return createHash('sha256').update(text).digest('hex'); }
