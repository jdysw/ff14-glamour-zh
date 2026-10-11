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
