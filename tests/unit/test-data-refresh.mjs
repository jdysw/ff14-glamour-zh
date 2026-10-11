// 使用内存网络与 GM 存储桩，测试真实的 V3 数据生命周期函数。
// 不为迎合待测实现而放宽断言。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { repoRoot } from '../helpers/paths.mjs';
import { validV3Manifest, validV3FileMeta, requiredV3Files } from '../../src/core/v3-contract.js';

const source = fs.readFileSync(path.join(repoRoot, 'src/core/data-manager.js'), 'utf8');
const implementation = source.split('\n')
  .filter((line) => !/^import\s/.test(line) && !/^export\s*\{/.test(line))
  .join('\n');
function sha(text) { return createHash('sha256').update(text).digest('hex'); }
function makeBundle(version) {
  const zh = version === 1 ? '中文甲' : '中文乙';
  const native = version === 1 ? 'English One' : 'English Two';
  const files = {
    names: native + '\t' + zh + '\t1\t0\n',
    hash: '0001\t' + zh + '\n',
    alias: '别称\t' + zh + '\n',
    dup: native + '\t' + zh + '\n',
  };
  const manifest = {
    schema: 3,
    candidatePolicy: 1,
    version: 'unit-v' + version,
    sites: { mirapri: { files: Object.fromEntries(Object.entries(files)
      .map(([name, value]) => [name, { url: 'mirapri/' + name + '.tsv', sha256: sha(value) }])) } },
  };
  return { manifest, files };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function buildHarness(download) {
  const store = new Map([['zhx.data.refresh.epoch', 'v3-only-1-force-refresh']]);
  const marks = [];
  const errors = [];
  const deps = {
    DATA_BASE_V3: 'https://unit.test/ff14/v3/',
    DAY_MS: 86400000,
    validV3Manifest, validV3FileMeta, requiredV3Files,
    cacheReset: () => {},
    _lcs90: () => null,
    applyRuntimeDict: () => {},
    httpGet: download,
    // 英文兜底现由规范 data-manager 源码实现，不再注入会重名的假函数。
    __zhxMark: (mark) => marks.push(mark),
    _zhxErr: (where, error) => errors.push([where, error]),
    findSite: () => ({ id: 'mirapri', indexes: ['nameMap', 'itemHash'], tables: ['items'] }),
    neededTables: () => ['items'],
    storeGetAsync: async (key) => store.get(key) ?? null,
    storeSetAsync: async (key, value) => { store.set(key, value); return true; },
    storeListAsync: async () => [...store.keys()],
    storeDeleteAsync: async (key) => { store.delete(key); return true; },
    crypto: webcrypto,
    TextEncoder,
  };
  const bindings = Object.keys(deps).join(', ');
  const factory = new Function('deps', 'const { ' + bindings + ' } = deps;\n' +
    implementation + '\nreturn { dataInvalidate, dataGetIndex, ensureTables, onTablesReady, resolveByName };');
  return { api: factory(deps), store, marks, errors };
}

function network(getVersion) {
  return async (url) => {
    const bundle = makeBundle(getVersion());
    if (url.endsWith('/manifest.json')) return JSON.stringify(bundle.manifest);
    const match = /\/mirapri\/(names|hash|alias|dup)\.tsv/.exec(url);
    assert.ok(match, 'unexpected remote file: ' + url);
    return bundle.files[match[1]];
  };
}

// 刷新会产生新的就绪代际：旧索引立即失效，
// 原有订阅者应在数据重新就绪时再次收到通知。
{
  let version = 1;
  const { api, errors } = buildHarness(network(() => version));
  let readyCount = 0;
  api.onTablesReady(() => { readyCount++; });
  await api.ensureTables();
  assert.equal(api.resolveByName('English One'), '中文甲');
  assert.equal(readyCount, 1);
  version = 2;
  api.dataInvalidate();
  assert.equal(api.dataGetIndex('nameMap'), null, 'invalidate immediately hides stale indexes');
  await api.ensureTables();
  assert.equal(api.resolveByName('English One'), null, 'obsolete translations must disappear');
  assert.equal(api.resolveByName('English Two'), '中文乙');
  assert.equal(readyCount, 2, 'ready subscribers must survive a refresh');
  assert.deepEqual(errors, []);
}

// 首次下载完成前可能触发刷新；过期的一代请求
// 在失效后不能应用数据，也不能发送就绪通知。
{
  let version = 1;
  let blocked = false;
  const pending = deferred();
  const download = async (url) => {
    if (url.endsWith('/manifest.json')) return JSON.stringify(makeBundle(version).manifest);
    const match = /\/mirapri\/(names|hash|alias|dup)\.tsv/.exec(url);
    assert.ok(match, 'unexpected remote file: ' + url);
    if (match[1] === 'names' && version === 1) {
      blocked = true;
      return pending.promise;
    }
    return makeBundle(version).files[match[1]];
  };
  const { api, errors } = buildHarness(download);
  let readyCount = 0;
  api.onTablesReady(() => { readyCount++; });
  const oldLoad = api.ensureTables();
  for (let i = 0; i < 30 && !blocked; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(blocked, true, 'older generation must be waiting for its names file');
  version = 2;
  api.dataInvalidate();
  const newLoad = api.ensureTables();
  pending.resolve(makeBundle(1).files.names);
  await Promise.all([oldLoad, newLoad]);
  assert.equal(api.resolveByName('English One'), null);
  assert.equal(api.resolveByName('English Two'), '中文乙');
  assert.equal(readyCount, 1, 'only the latest generation may announce readiness');
  assert.deepEqual(errors, []);
}

console.log('✅ V3 refresh readiness, cache invalidation and in-flight generation regressions passed');
