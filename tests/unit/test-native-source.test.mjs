import {currentDictionary,currentDictionaryText} from '../helpers/current-dictionary.mjs';
// 直接加载生产 ESM 模块执行测试，由 Node V8 生成真实源码 LCOV 覆盖率。
import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import {
  SITE_POLICIES, DATA_POLICIES, findSitePolicy, neededTables, _siteIndexes, onHost,
} from '../../src/core/site-policy.js';
import {
  CACHE_CAP_LOOKUP, _cacheReg, _shortestStr, _countIncludes,
  _lcs90, cacheGuard, cacheRegister, cacheReset,
} from '../../src/core/cache-primitives.js';
import {
  ERR_LOG_CAP, _errLog, _zhxErr, safe, registerProbeMark, __zhxMark,
} from '../../src/core/runtime.js';
import { httpGet } from '../../src/core/http.js';
import { requiredV3Files, validV3FileMeta, validV3Manifest } from '../../src/core/v3-contract.js';
import { validRuntimeDictionary } from '../../src/core/dict-contract.js';
import { dataGetStatus, ensureTables, dataInvalidate, resolveByName, onTablesReady, _ensureTryV3 } from '../../src/core/data-manager.js';
import {
  _storeNorm, storeGetAsync, storeSetAsync, storeListAsync, storeDeleteAsync,
} from '../../src/core/storage.js';
import {
  dedupeByAncestor, localScope, queryIn, _scanStats, ensureChineseFont,
} from '../../src/core/dom.js';

test('统一字体：重复调用幂等，head 缺失和样式被移除时仍能恢复', () => {
  const previous=globalThis.document;const styles=new Map();let headWrites=0,rootWrites=0;
  const add=style=>styles.set(style.id,style);
  globalThis.document={getElementById:id=>styles.get(id),createElement:()=>({}),
    head:{appendChild:style=>{headWrites++;add(style)}},documentElement:{appendChild:style=>{rootWrites++;add(style)}}};
  try{
    ensureChineseFont();ensureChineseFont();assert.equal(headWrites,1);assert.equal(styles.size,1);
    styles.clear();document.head=null;ensureChineseFont();assert.equal(rootWrites,1);
    assert.match(styles.get('zhx-chinese-font').textContent,/Microsoft YaHei/);
  }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('纯站点策略：站点配置、宿主边界和测试覆盖钩子', () => {
  const previousWindow = globalThis.window;
  const previousLocation = globalThis.location;
  try {
    globalThis.window = {};
    globalThis.location = { hostname: 'www.mirapri.com' };
    assert.equal(SITE_POLICIES.length, 10);
    assert.equal(new Set(SITE_POLICIES.map(x => x.id)).size, 10);
    assert.equal(DATA_POLICIES.length, 8);
    assert.equal(Object.isFrozen(SITE_POLICIES), true);
    assert.equal(onHost('mirapri.com', 'mirapri.com'), true);
    assert.equal(onHost('www.mirapri.com', 'mirapri.com'), true);
    assert.equal(onHost('evilmirapri.com', 'mirapri.com'), false);
    assert.equal(onHost('mirapri.com.example', 'mirapri.com'), false);
    assert.equal(findSitePolicy()?.id, 'mirapri');
    assert.deepEqual(neededTables(), ['items', 'dict']);
    assert.deepEqual(_siteIndexes(), ['nameMap', 'itemHash']);

    globalThis.location.hostname = 'xivc.app';
    assert.equal(findSitePolicy()?.id, 'xivc');
    assert.deepEqual(neededTables(), ['items', 'dict']);
    assert.deepEqual(_siteIndexes(), ['nameMap', 'itemHash']);
    assert.equal(SITE_POLICIES.find(x => x.id === 'xivc')?.dataSite, 'miramiru');
    assert.equal(DATA_POLICIES.some(x => x.id === 'xivc'), false);
    globalThis.location.hostname = 'evilxivc.app';
    assert.equal(findSitePolicy(), null);

    globalThis.location.hostname = 'not-matched.invalid';
    assert.equal(findSitePolicy(), null);
    assert.deepEqual(neededTables(), []);
    assert.equal(_siteIndexes(), null);

    globalThis.window.__zhxTestSite = 'wiki';
    assert.equal(findSitePolicy()?.id, 'wiki');
    assert.deepEqual(neededTables(), ['items', 'dict']);
    assert.deepEqual(_siteIndexes(), ['ecidMap', 'koByZh']);
    globalThis.window.__zhxTestTables = ['series'];
    globalThis.window.__zhxTestIndexes = ['itemHash'];
    assert.deepEqual(neededTables(), ['series']);
    assert.deepEqual(_siteIndexes(), ['itemHash']);
    globalThis.window.__zhxTestSite = 'invalid';
    assert.equal(findSitePolicy(), null);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test('基础缓存：分类失效、失败隔离及 Map/对象容量防线', () => {
  assert.ok(CACHE_CAP_LOOKUP >= 1000);
  const events = [];
  const entries = [
    ['phase4-lookup', 'lookup', () => events.push('lookup'), () => 1],
    ['phase4-dict', 'dict', () => events.push('dict'), () => 2],
    ['phase4-throw', 'lookup', () => { throw new Error('清理失败'); }, () => 3],
    ['phase4-after', 'lookup', () => events.push('after'), () => 4],
  ];
  try {
    for (const entry of entries) cacheRegister(...entry);
    cacheReset('lookup');
    assert.deepEqual(events, ['lookup', 'after']);
    events.length = 0;
    cacheReset();
    assert.deepEqual(events, ['lookup', 'dict', 'after']);
  } finally {
    for (const [name] of entries) _cacheReg.delete(name);
  }

  const map = new Map([['a', 1], ['b', 2]]);
  assert.equal(cacheGuard(map, 3), false);
  assert.equal(map.size, 2);
  map.set('c', 3);
  assert.equal(cacheGuard(map, 3), true);
  assert.equal(map.size, 0);
  assert.equal(cacheGuard(null, 3), false);

  const obj = Object.assign(Object.create(null), { a: 1, b: 2 });
  assert.equal(cacheGuard(obj, 3, 2), false);
  assert.equal(cacheGuard(obj, 2, 2), true);
  assert.deepEqual(Object.keys(obj), []);
});

test('基础字符串算法：短字符串、包含计数和 90% 公共片段', () => {
  assert.equal(_shortestStr(['abcde', 'a', 'abc']), 'a');
  assert.equal(_countIncludes(['abcdef', 'xxx', 'abcxy'], 'abc'), 2);
  assert.equal(_lcs90(['上海幻化装备', '夏季幻化装备', '春日幻化装备']), '幻化装备');
  assert.equal(_lcs90(['ab', 'cd', 'ef']), null);
});

test('真实运行时：异常边界、诊断注册及最近 20 条滚动日志', () => {
  const oldWindow = globalThis.window;
  const oldWarn = console.warn;
  const warnings = [];
  const markers = [];
  const prefix = 'phase4-';
  try {
    globalThis.window = { __zhxErrs: [] };
    console.warn = (...args) => warnings.push(args);
    const wrapped = safe(() => { throw new Error('预期测试异常'); }, prefix + 'safe');
    assert.equal(wrapped(), undefined);
    assert.ok(_errLog.at(-1).startsWith(prefix + 'safe：'));
    registerProbeMark(name => markers.push(name));
    __zhxMark('ready');
    assert.deepEqual(markers, ['ready']);
    registerProbeMark(null);
    __zhxMark('ignored');
    assert.deepEqual(markers, ['ready']);

    const mirror = globalThis.window.__zhxErrs;
    for (let index = 0; index < ERR_LOG_CAP + 8; index++) {
      _zhxErr(prefix + index, new Error('测试'));
    }
    assert.equal(_errLog.length, ERR_LOG_CAP);
    assert.equal(mirror.length, ERR_LOG_CAP);
    assert.equal(_errLog[0], prefix + '8：测试');
    assert.equal(_errLog.at(-1), prefix + '27：测试');
    assert.equal(mirror[0], prefix + '8：测试');
    assert.equal(mirror.at(-1), prefix + '27：测试');
    assert.equal(globalThis.window.__zhxErrs, mirror);
    assert.equal(warnings.length, ERR_LOG_CAP + 9);
  } finally {
    registerProbeMark(null);
    console.warn = oldWarn;
    _errLog.length = 0;
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
});


test('原生 HTTP：GM 响应与错误、fetch 响应体及超时', async () => {
  const oldGM = globalThis.GM_xmlhttpRequest;
  const oldFetch = globalThis.fetch;
  try {
    globalThis.GM_xmlhttpRequest = options => options.onload({ status: 200, responseText: '原生成功' });
    assert.equal(await httpGet('https://example.invalid/item', 100), '原生成功');
    globalThis.GM_xmlhttpRequest = options => options.onload({ status: 503, responseText: 'error' });
    await assert.rejects(httpGet('https://example.invalid/item', 100), /HTTP 503/);
    globalThis.GM_xmlhttpRequest = options => options.onerror();
    await assert.rejects(httpGet('https://example.invalid/item', 100), /network/);

    delete globalThis.GM_xmlhttpRequest;
    globalThis.fetch = async (_url, opts) => {
      assert.ok(opts.signal);
      return { ok: true, text: async () => '响应体完成' };
    };
    assert.equal(await httpGet('https://example.invalid/item', 100), '响应体完成');
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(httpGet('https://example.invalid/item', 100), /HTTP 404/);
    globalThis.fetch = async () => ({ ok: true, text: () => new Promise(() => {}) });
    await assert.rejects(httpGet('https://example.invalid/item', 5), /timeout/);
  } finally {
    if (oldGM === undefined) delete globalThis.GM_xmlhttpRequest;
    else globalThis.GM_xmlhttpRequest = oldGM;
    if (oldFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = oldFetch;
  }
});

test('原生 GM 存储：读取、写入、枚举、删除及无 GM 降级', async () => {
  const names = ['GM', 'GM_getValue', 'GM_setValue', 'GM_listValues', 'GM_deleteValue'];
  const saved = Object.fromEntries(names.map(k => [k, globalThis[k]]));
  const store = new Map();
  try {
    for (const name of names) delete globalThis[name];
    assert.equal(_storeNorm(undefined), null);
    assert.equal(_storeNorm(123), '123');
    assert.equal(_storeNorm('值'), '值');
    assert.equal(await storeGetAsync('missing'), null);
    assert.equal(await storeSetAsync('missing', 'value'), false);
    assert.equal(await storeListAsync(), null);

    globalThis.GM_getValue = (key, fallback) => store.get(key) ?? fallback;
    globalThis.GM_setValue = (key, value) => { store.set(key, value); };
    globalThis.GM_listValues = () => [...store.keys()];
    globalThis.GM_deleteValue = key => { store.delete(key); return true; };
    assert.equal(await storeSetAsync('test', 100), true);
    assert.equal(await storeGetAsync('test'), '100');
    assert.deepEqual(await storeListAsync(), ['test']);
    assert.equal(await storeDeleteAsync('test'), true);
    assert.equal(await storeGetAsync('test'), null);

    delete globalThis.GM_getValue;
    delete globalThis.GM_setValue;
    delete globalThis.GM_listValues;
    delete globalThis.GM_deleteValue;
    globalThis.GM = {
      getValue: async (key, fallback) => store.get(key) ?? fallback,
      setValue: async (key, value) => { store.set(key, value); },
      listValues: async () => [...store.keys()],
      deleteValue: async key => { store.delete(key); },
    };
    assert.equal(await storeSetAsync('async', '异步'), true);
    assert.equal(await storeGetAsync('async'), '异步');
    assert.deepEqual(await storeListAsync(), ['async']);
    assert.equal(await storeDeleteAsync('async'), true);
    assert.equal(await storeGetAsync('async'), null);
    // Storage rejection must remain visible; do not report a successful delete.
    globalThis.GM={setValue:async()=>{throw new Error('denied')},listValues:async()=>{throw new Error('denied')},deleteValue:async()=>{throw new Error('denied')}};
    assert.equal(await storeSetAsync('bad','value'),false);
    assert.equal(await storeListAsync(),null);
    assert.equal(await storeDeleteAsync('bad'),false);
    delete globalThis.GM;
    globalThis.GM_getValue=(key,fallback)=>store.get(key)??fallback;
    globalThis.GM_setValue=(key,value)=>store.set(key,value);
    store.set('legacy','old');
    assert.equal(await storeDeleteAsync('legacy'),true);
    assert.equal(await storeGetAsync('legacy'),'');
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete globalThis[name];
      else globalThis[name] = saved[name];
    }
  }
});

test('原生 DOM 工具：祖先去重、局部根和查询计数', () => {
  const parent = { nodeType: 1, parentNode: null };
  const child = { nodeType: 1, parentNode: parent };
  const sibling = { nodeType: 1, parentNode: null };
  assert.deepEqual(dedupeByAncestor([child, parent, sibling, child]), [parent, sibling]);
  assert.deepEqual(dedupeByAncestor([sibling]), [sibling]);
  assert.equal(localScope(null), null);
  assert.equal(localScope(parent), parent);
  assert.equal(localScope({ nodeType: 3, parentElement: parent }), parent);
  const originalDoc = globalThis.document;
  const root = {
    nodeType: 1,
    matches: selector => selector === '.a',
    querySelectorAll: selector => selector === '.a' ? [child] : [],
  };
  const beforeLocal = _scanStats.local;
  const beforeGlobal = _scanStats.global;
  try {
    globalThis.document = { querySelectorAll: selector => selector === '.a' ? [sibling] : [] };
    assert.deepEqual(queryIn(root, '.a'), [root, child]);
    assert.deepEqual(queryIn(null, '.a'), [sibling]);
    assert.equal(_scanStats.local, beforeLocal + 1);
    assert.equal(_scanStats.global, beforeGlobal + 1);
  } finally {
    if (originalDoc === undefined) delete globalThis.document;
    else globalThis.document = originalDoc;
  }
});


test('原生 V3 契约：站点表一致、固定路径和异常元数据不得进入下载器', () => {
  for (const policy of DATA_POLICIES) {
    const required = requiredV3Files(policy);
    assert.ok(required.length >= 2 && required.every(name =>
      ['names', 'alias', 'dup', 'hash', 'ecid', 'ko', 'series', 'acl'].includes(name)));
  }
  const sha = 'a'.repeat(64);
  const make = () => ({
    schema: 3, candidatePolicy: 1, sites: {
      mirapri: { files: {
        names: { url: 'mirapri/names.tsv', sha256: sha, bytes: 12 },
        hash: { url: 'mirapri/hash.tsv', sha256: sha, bytes: 4 },
        alias: { url: 'mirapri/alias.tsv', sha256: sha, bytes: 5 },
        dup: { url: 'mirapri/dup.tsv', sha256: sha, bytes: 6 },
      } },
    },
    shared: { dict: { url: 'dict.json', sha256: sha, bytes: 2 } },
  });
  assert.equal(validV3Manifest(make()), true);
  assert.equal(validRuntimeDictionary({ main: { Name: '译名' } }), false);
  assert.equal(validRuntimeDictionary(currentDictionary({main:{Name:'译名'}})),true);
  assert.equal(validRuntimeDictionary(currentDictionary({main:{Name:null}})),false);
  assert.equal(validRuntimeDictionary(currentDictionary({main:JSON.parse('{"__proto__":"unsafe"}')})),false);
  assert.equal(validRuntimeDictionary(currentDictionary({main:null})),false);
  assert.equal(validV3FileMeta(null, 'mirapri/names.tsv'), false);
  assert.equal(validV3FileMeta({ url: 'mirapri/names.tsv', sha256: sha, bytes: -1 },
    'mirapri/names.tsv'), false);
  assert.equal(validV3FileMeta({ url: 'mirapri/names.tsv', sha256: sha },
    'mirapri/names.tsv'), false);
  const variants = [
    m => { m.sites.mirapri.files.names.url = '../../unexpected'; },
    m => { m.sites.mirapri.files.names.url = 'https://external.invalid'; },
    m => { m.sites.mirapri.files.names.bytes = 2 ** 31; },
    m => { m.sites.mirapri.files.names.sha256 = 'invalid'; },
    m => { m.sites.untrusted = m.sites.mirapri; },
    m => { m.sites.mirapri.files.unexpected = m.sites.mirapri.files.names; },
    m => { m.shared.dict.url = '/dict.json'; },
    m => { m.sites = []; },
    m => { m.sites = {}; },
    m => { m.candidatePolicy = 2; },
  ];
  for (const alter of variants) {
    const m = make(); alter(m);
    assert.equal(validV3Manifest(m), false);
  }
});

test('真实数据层及脚本事件桥：网络加载、内容校验、刷新和异常降级', async () => {
  const names = ['window', 'location', 'GM_xmlhttpRequest', 'GM_getValue',
    'GM_setValue', 'GM_listValues', 'GM_deleteValue'];
  const original = Object.fromEntries(names.map(name => [name, globalThis[name]]));
  const gm = new Map();
  const sha = text => createHash('sha256').update(text).digest('hex');
  let version = 1;
  let invalidManifest = false;
  const events = [];
  let requests = 0;
  const resourceRequests=[];
  const probes=()=>resourceRequests.filter(request=>new URL(request.url).pathname.endsWith('/manifest.json')).length;

  function bundle() {
    const zh = version === 1 ? '测试第一版' : '测试第二版';
    const files = {
      names: 'English Test Gear\t' + zh + '\t1\t0\n',
      hash: '0001\t' + zh + '\n',
      alias: '装备别称\t' + zh + '\n',
      dup: 'English Test Gear\t' + zh + '\n',
      dict: currentDictionaryText(),
    };
    const entries = Object.fromEntries(Object.entries(files).filter(([n]) => n !== 'dict')
      .map(([name, contents]) =>
        [name, { url: 'mirapri/' + name + '.tsv', sha256: sha(contents), bytes: Buffer.byteLength(contents) }]));
    const manifest = {
      schema: 3, candidatePolicy: 1, version: 'contract-' + version,
      sites: { mirapri: { files: entries } },
      shared: { dict: { url: 'dict.json', sha256: sha(files.dict), bytes: Buffer.byteLength(files.dict) } },
    };
    return { files, manifest };
  }

  try {
    globalThis.window = {};
    globalThis.location = { hostname: 'mirapri.com' };
    assert.ok(globalThis.crypto?.subtle, 'Node 22 应提供真实 WebCrypto 校验');
    globalThis.GM_getValue = (k, fallback) => gm.get(k) ?? fallback;
    globalThis.GM_setValue = (k, val) => { gm.set(k, val); };
    globalThis.GM_listValues = () => [...gm.keys()];
    globalThis.GM_deleteValue = k => { gm.delete(k); };
    globalThis.GM_xmlhttpRequest = options => {
      requests++;
      resourceRequests.push(options);
      const { files, manifest } = bundle();
      let responseText;
      if (options.url.includes('/manifest.json')) responseText = invalidManifest
        ? '{"schema":2,"sites":{}}' : JSON.stringify(manifest);
      else if (new URL(options.url).pathname.endsWith('/dict.json')) responseText = files.dict;
      else {
        const match = /\/mirapri\/(names|hash|alias|dup)\.tsv/.exec(options.url);
        if (!match) return options.onerror(new Error('未经允许的资源'));
        responseText = files[match[1]];
      }
      options.onload({ status: 200, responseText });
    };
    onTablesReady(status => events.push(status));
    assert.equal(dataGetStatus().state, 'idle');
    await ensureTables();
    assert.equal(resolveByName('English Test Gear'), '测试第一版');
    assert.equal(events.length, 1);
    assert.equal(events[0].origin, 'network');
    assert.equal(events[0].state, 'ready');
    assert.equal(Object.isFrozen(events[0]), true);
    assert.equal(requests, 6, '仅下载 manifest + 当前站 4 文件 + 共享词典');
    const afterFirst = requests;

    // A deployment can replace mutable URLs before our cached manifest expires.
    // Exercise the real loader with a missing file and a newer server bundle.
    const firstManifest=bundle().manifest;
    gm.delete('zhx.v3.f.mirapri.names.'+firstManifest.sites.mirapri.files.names.sha256);
    let beforeProbe=probes();
    version=2;
    assert.equal(await _ensureTryV3(),true);
    assert.equal(resolveByName('English Test Gear'),'测试第二版');
    assert.equal(probes(),beforeProbe+1,'A stale bundle gets one immediate manifest recheck');
    assert.equal(JSON.parse(gm.get('zhx.v3.manifest').split('\n').slice(1).join('\n')).version,'contract-2');

    // An incorrect future timestamp must not suppress normal update probes.
    const cached=gm.get('zhx.v3.manifest').split('\n').slice(1).join('\n');
    gm.set('zhx.v3.manifest',(Date.now()+86400000)+'\n'+cached);
    beforeProbe=probes();version=1;
    assert.equal(await _ensureTryV3(),true);
    assert.equal(resolveByName('English Test Gear'),'测试第一版');
    assert.equal(probes(),beforeProbe+1);
    assert.ok(resourceRequests.every(request=>request.headers?.['Cache-Control']?.includes('no-cache')),
      'Metadata probes and cache-miss downloads must bypass stale HTTP responses');

    // Quota failure must not destroy the last complete current-format cache.
    for(const key of ['zhx.v3.manifest','zhx.v3.manifest.mirapri'])
      gm.set(key,(Date.now()-2*86400000)+'\n'+JSON.stringify(bundle().manifest));
    const committed=gm.get('zhx.v3.manifest');
    const write=globalThis.GM_setValue,transport=globalThis.GM_xmlhttpRequest;
    globalThis.GM_setValue=()=>false;version=2;
    assert.equal(await _ensureTryV3(),true);
    assert.equal(resolveByName('English Test Gear'),'测试第二版','Valid downloads remain usable in memory');
    assert.equal(gm.get('zhx.v3.manifest'),committed,'Failed writes must not publish new cache metadata');
    globalThis.GM_setValue=write;
    // Another site's daily probe may advance global metadata while we are offline.
    gm.set('zhx.v3.manifest',Date.now()+'\n'+JSON.stringify(bundle().manifest));
    globalThis.GM_xmlhttpRequest=options=>options.onerror();
    assert.equal(await _ensureTryV3(),true);
    assert.equal(resolveByName('English Test Gear'),'测试第一版');
    assert.equal(dataGetStatus().origin,'fallback');
    globalThis.GM_xmlhttpRequest=transport;

    version = 2;
    dataInvalidate();
    assert.equal(dataGetStatus().state, 'idle');
    assert.equal(dataGetStatus().generation, 1);
    await ensureTables();
    assert.equal(resolveByName('English Test Gear'), '测试第二版');
    assert.equal(events.at(-1).version, 'contract-2');
    assert.equal(events.at(-1).generation, 1);
    assert.equal(events.at(-1).origin, 'network');
    assert.ok(requests > afterFirst);

    const beforeWarmLoad = requests;
    dataInvalidate();
    await ensureTables();
    assert.equal(dataGetStatus().state, 'ready');
    assert.equal(dataGetStatus().origin, 'cache', '相同版本优先复用已验证的 GM 文件缓存');
    assert.equal(requests, beforeWarmLoad + 1,
      '手动刷新只检查 manifest，不应重新下载相同散列的四个站点文件与词典');

    globalThis.window.__zhxTestSite = 'eden';
    const edenManifest=JSON.parse(gm.get('zhx.v3.manifest').split('\n').slice(1).join('\n'));
    edenManifest.sites.miramiru={files:Object.fromEntries(Object.entries(edenManifest.sites.mirapri.files)
      .map(([name,meta])=>[name,{...meta,url:meta.url.replace('mirapri/','miramiru/')}]))};
    gm.set('zhx.v3.manifest',Date.now()+'\n'+JSON.stringify(edenManifest));
    for(const[key,value]of gm)if(key.startsWith('zhx.v3.f.mirapri.'))gm.set(key.replace('.mirapri.','.miramiru.'),value);
    const beforeEden=requests;
    assert.equal(await _ensureTryV3(),true);
    assert.equal(resolveByName('English Test Gear'),'测试第二版');
    assert.equal(dataGetStatus().site,'eden');
    assert.equal(requests,beforeEden,'Eden 直接复用现有多语数据集，不请求未发布的 eden 路径');
    globalThis.window.__zhxTestSite = 'mirapri';

    invalidManifest = true;
    dataInvalidate();
    await ensureTables();
    assert.equal(dataGetStatus().state, 'degraded');
    assert.equal(dataGetStatus().ready, true, '失败后依旧释放等候者');
    assert.equal(resolveByName('English Test Gear'), null, '无效 manifest 不应发布旧索引');
    assert.equal(events.at(-1).state, 'degraded');
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete globalThis[name];
      else globalThis[name] = original[name];
    }
  }
});
