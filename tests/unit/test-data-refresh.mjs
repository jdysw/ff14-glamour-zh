// 使用内存网络与 GM 存储桩，测试真实的 V3 数据生命周期函数。
// 不为迎合待测实现而放宽断言。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { repoRoot } from '../helpers/paths.mjs';
import { validV3Manifest, validV3FileMeta, requiredV3Files } from '../../src/core/v3-contract.js';
import { validRuntimeDictionary } from '../../src/core/dict-contract.js';

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
      .map(([name, value]) => [name, { url: 'mirapri/' + name + '.tsv', sha256: sha(value), bytes: Buffer.byteLength(value) }])) } },
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
    validV3Manifest, validV3FileMeta, requiredV3Files, validRuntimeDictionary,
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
    implementation + '\nreturn { dataInvalidate, dataGetIndex, dataGetStatus, ensureTables, onTablesReady, resolveByName };');
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
  const statuses = [];
  api.onTablesReady(status => { readyCount++; statuses.push(status); });
  assert.deepEqual(api.dataGetStatus(), {
    site: 'mirapri', state: 'idle', origin: 'none', version: null, generation: 0, ready: false,
  }, '脚本层首轮应能获取明确的未启动状态');
  await api.ensureTables();
  assert.equal(api.resolveByName('English One'), '中文甲');
  assert.equal(readyCount, 1);
  assert.deepEqual(statuses[0], {
    site: 'mirapri', state: 'ready', origin: 'network', version: 'unit-v1', generation: 0, ready: true,
  }, '首次网络加载向脚本层发布不可变数据状态');
  assert.equal(Object.isFrozen(statuses[0]), true);
  const late = [];
  api.onTablesReady(status => late.push(status));
  assert.equal(late.length, 1, '迟到订阅者立即得到现存数据状态');
  assert.equal(late[0].version, 'unit-v1');
  version = 2;
  api.dataInvalidate();
  assert.equal(api.dataGetStatus().state, 'idle', '数据失效时同步撤销成功状态');
  assert.equal(api.dataGetStatus().generation, 1, '失效必须切换加载代际');
  assert.equal(api.dataGetIndex('nameMap'), null, 'invalidate immediately hides stale indexes');
  await api.ensureTables();
  assert.equal(api.resolveByName('English One'), null, 'obsolete translations must disappear');
  assert.equal(api.resolveByName('English Two'), '中文乙');
  assert.equal(readyCount, 2, 'ready subscribers must survive a refresh');
  assert.equal(statuses[1].version, 'unit-v2');
  assert.equal(statuses[1].generation, 1);
  assert.equal(statuses[1].origin, 'network');
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

// 网络失败仍广播结束，以免翻译等待永远悬挂；但状态必须区分失败与有效索引。
{
  const { api, errors } = buildHarness(async () => { throw new Error('offline'); });
  const observations = [];
  api.onTablesReady(status => observations.push(status));
  await api.ensureTables();
  assert.equal(observations.length, 1);
  assert.equal(observations[0].state, 'degraded');
  assert.equal(observations[0].ready, true);
  assert.equal(observations[0].origin, 'none');
  assert.equal(observations[0].version, null);
  assert.equal(api.resolveByName('English One'), null);
  assert.deepEqual(errors, [], '正常离线降级不属于脚本异常');
}

// 生成器提供字节数后，同 SHA 的缓存和下载体仍必须逐字节匹配。
{
  const { manifest, files } = makeBundle(1);
  manifest.sites.mirapri.files.names.bytes += 1;
  const { api } = buildHarness(async url => {
    if (url.endsWith('/manifest.json')) return JSON.stringify(manifest);
    const match = /\/mirapri\/(names|hash|alias|dup)\.tsv/.exec(url);
    assert.ok(match, '只允许请求选定站点的预期文件');
    return files[match[1]];
  });
  await api.ensureTables();
  assert.equal(api.resolveByName('English One'), null, '字节长度冲突不得发布错误索引');
  assert.equal(api.dataGetStatus().state, 'degraded');
}

// 站点清单即使只混入合法类型的多余文件，也必须在下载前拒绝。
{
  const { manifest } = makeBundle(1);
  manifest.sites.mirapri.files.ecid = {
    url: 'mirapri/ecid.tsv', sha256: 'a'.repeat(64), bytes: 12,
  };
  const requests = [];
  const { api } = buildHarness(async url => {
    requests.push(url);
    if (url.endsWith('/manifest.json')) return JSON.stringify(manifest);
    throw new Error('意外下载额外站点文件：' + url);
  });
  await api.ensureTables();
  assert.equal(api.dataGetStatus().state, 'degraded');
  assert.equal(requests.length, 1, '无关文件不得进入实际网络下载流程');
  assert.ok(requests[0].endsWith('/manifest.json'));
}

// 新键损坏不应阻断旧键的有效离线副本；依旧逐项执行 SHA 和字节校验。
{
  const { manifest, files } = makeBundle(1);
  const { api, store } = buildHarness(async url => {
    throw new Error('应完全离线命中缓存：' + url);
  });
  store.set('zhx.v3.manifest', Date.now() + '\n' + JSON.stringify(manifest));
  for (const [name, meta] of Object.entries(manifest.sites.mirapri.files)) {
    const baseKey = 'zhx.v3.f.mirapri.' + name;
    store.set(baseKey, meta.sha256 + '\n' + files[name]);
    store.set(baseKey + '.' + meta.sha256, meta.sha256 + '\n' + '损坏内容');
  }
  await api.ensureTables();
  assert.equal(api.resolveByName('English One'), '中文甲');
  assert.equal(api.dataGetStatus().origin, 'cache');
  assert.equal(api.dataGetStatus().state, 'ready');
}

// 文件 SHA/bytes 即使完全自洽，非法共享词典仍必须使整批数据降级。
{
  const { manifest, files } = makeBundle(1);
  const dictionary = '{"common":{"__proto__":{"polluted":"yes"}}}';
  manifest.shared = { dict: {
    url: 'dict.json', sha256: sha(dictionary), bytes: Buffer.byteLength(dictionary),
  } };
  const { api } = buildHarness(async url => {
    if (url.endsWith('/manifest.json')) return JSON.stringify(manifest);
    if (url.endsWith('/dict.json')) return dictionary;
    const match = /\/mirapri\/(names|hash|alias|dup)\.tsv/.exec(url);
    assert.ok(match, '禁止加载未声明的数据文件：' + url);
    return files[match[1]];
  });
  await api.ensureTables();
  assert.equal(api.dataGetStatus().state, 'degraded', '词典语义校验失败不得发布 ready');
  assert.equal(api.dataGetIndex('nameMap'), null, '失败时内部索引不能对外暴露');
  assert.equal(api.resolveByName('English One'), null, '无效共享词典不能使装备索引部分生效');
}

console.log('✅ V3 refresh readiness, cache invalidation and in-flight generation regressions passed');
