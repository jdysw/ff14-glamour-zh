// 直接加载生产 ESM 模块执行测试，由 Node V8 生成真实源码 LCOV 覆盖率。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SITE_POLICIES, findSitePolicy, neededTables, _siteIndexes, onHost,
} from '../../src/core/site-policy.js';
import {
  CACHE_CAP_LOOKUP, _cacheReg, _shortestStr, _countIncludes,
  _lcs90, cacheGuard, cacheRegister, cacheReset,
} from '../../src/core/cache-primitives.js';
import {
  ERR_LOG_CAP, _errLog, _zhxErr, safe, registerProbeMark, __zhxMark,
} from '../../src/core/runtime.js';
import { httpGet } from '../../src/core/http.js';
import {
  _storeNorm, storeGetAsync, storeSetAsync, storeListAsync, storeDeleteAsync,
} from '../../src/core/storage.js';
import {
  dedupeByAncestor, localScope, queryIn, _scanStats,
} from '../../src/core/dom.js';

test('纯站点策略：七站配置、宿主边界和测试覆盖钩子', () => {
  const previousWindow = globalThis.window;
  const previousLocation = globalThis.location;
  try {
    globalThis.window = {};
    globalThis.location = { hostname: 'www.mirapri.com' };
    assert.equal(SITE_POLICIES.length, 7);
    assert.equal(new Set(SITE_POLICIES.map(x => x.id)).size, 7);
    assert.equal(Object.isFrozen(SITE_POLICIES), true);
    assert.equal(onHost('mirapri.com', 'mirapri.com'), true);
    assert.equal(onHost('www.mirapri.com', 'mirapri.com'), true);
    assert.equal(onHost('evilmirapri.com', 'mirapri.com'), false);
    assert.equal(onHost('mirapri.com.example', 'mirapri.com'), false);
    assert.equal(findSitePolicy()?.id, 'mirapri');
    assert.deepEqual(neededTables(), ['items', 'dict']);
    assert.deepEqual(_siteIndexes(), ['nameMap', 'itemHash']);

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
