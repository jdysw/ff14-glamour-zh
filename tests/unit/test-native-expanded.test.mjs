// 真实 ESM 源码覆盖率：使用原模块而非 new Function 字符串片段。
// 这里验证搜索、站点注册、缓存衍生、装备解析及 MutationObserver 的业务行为。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSearchQuery, isChineseSearchQuery, searchInputScore,
  findSearchInput, buildSearchUrl, startChineseSearch,
} from '../../src/core/chinese-search.js';
import {
  SITE_REGISTRY, createSiteAdapter, findSite,
} from '../../src/core/site-registry.js';
import {
  _itemPfxGroup, _seriesPfxCollect, _getSeriesMap, _getItemPfx,
  _getFCSubstrKeys, _getSeriesPfx, _getSubstrKeysAll, cacheInfo,
} from '../../src/core/cache.js';
import {
  _stripSeriesHit, _prefixBest, _mutualPrefix, lookupSeries,
  lookupJp2Zh,
} from '../../src/core/item-resolver.js';
import { cacheReset } from '../../src/core/cache-primitives.js';
import { DATA_TEXT } from '../../src/core/data-manager.js';
import { createObserver, _obsStats } from '../../src/core/observer.js';

const input = attrs => ({
  className: attrs.className ?? '',
  name: attrs.name ?? '',
  value: attrs.value ?? '',
  disabled: !!attrs.disabled,
  readOnly: !!attrs.readOnly,
  getAttribute(name) { return attrs[name] ?? null; },
});

test('真实中文搜索模块：输入筛选、查询判定和 URL 保留有效筛选', () => {
  assert.equal(normalizeSearchQuery('  月读之  长袍  '), '月读之 长袍');
  assert.equal(isChineseSearchQuery('贤王莫古力王冠'), true);
  assert.equal(isChineseSearchQuery("Tsukuyomi's Hose"), false);
  assert.equal(isChineseSearchQuery('   '), false);
  const keyword = input({ name: 'keyword', placeholder: '装備品名等を入力' });
  const player = input({ name: 'player', placeholder: 'Player' });
  const vueSelect = input({ className: 'vs__search', placeholder: 'Any head' });
  assert.ok(searchInputScore(keyword) > 0);
  assert.equal(searchInputScore(player), -Infinity);
  assert.equal(searchInputScore(vueSelect), -Infinity);
  assert.equal(findSearchInput({ querySelectorAll: () => [player, vueSelect, keyword] }), keyword);
  assert.equal(findSearchInput({ querySelectorAll: () => [player, vueSelect] }), null);
  const u = new URL(buildSearchUrl('/?page=2&keyword=old', [
    ['keyword', '旧值'], ['page', '3'], ['filter', 'body'], ['g', ''],
  ], 'keyword', 'アーモンド胴着', 'https://mirapri.com/'));
  assert.equal(u.searchParams.get('keyword'), 'アーモンド胴着');
  assert.equal(u.searchParams.get('page'), '3');
  assert.equal(u.searchParams.get('filter'), 'body');
  assert.equal(u.searchParams.has('g'), false);
  // 不支持站点和缺少 DOM 时不注册事件，也不触发站点初始化。
  assert.equal(startChineseSearch('unknown'), undefined);
  if (typeof document === 'undefined') assert.equal(startChineseSearch('mirapri'), undefined);
});

test('真实站点注册：十站生命周期、异常隔离与域名识别', () => {
  assert.equal(SITE_REGISTRY.length, 10);
  assert.deepEqual(SITE_REGISTRY.map(row => row.id),
    ['mirapri', 'ec', 'wiki', 'fc', 'ronka', 'collection', 'endcloset', 'miramiru', 'eden', 'xivc']);
  const events = [];
  const adapter = createSiteAdapter({
    id: 'mirapri',
    start: () => events.push('boot'),
    onPageShow: () => events.push('pageshow'),
  });
  assert.equal(adapter.id, 'mirapri');
  adapter.boot();
  adapter.pageshow();
  assert.deepEqual(events, ['boot', 'pageshow']);

  const minimal = createSiteAdapter({ id: 'custom' });
  minimal.boot();
  minimal.pageshow();
  const broken=createSiteAdapter({id:'broken',start(){throw new Error('unavailable')},onPageShow(){throw new Error('unavailable')}});
  assert.doesNotThrow(()=>broken.boot());
  assert.doesNotThrow(()=>broken.pageshow());

  const previousWindow = globalThis.window;
  const previousLocation = globalThis.location;
  try {
    globalThis.window = { __zhxTestSite: 'wiki' };
    globalThis.location = { hostname: 'untrusted.test' };
    assert.equal(findSite()?.id, 'wiki');
    globalThis.window.__zhxTestSite = 'untrusted';
    assert.equal(findSite(), null);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test('真实缓存与物品系列解析：前缀、歧义和派生失效', () => {
  // DATA_TEXT.series 是只读访问器；通过属性描述符注入测试数据，结束后还原访问器。
  const original = Object.getOwnPropertyDescriptor(DATA_TEXT, 'series');
  assert.equal(typeof original.get, 'function');
  try {
    const fixture = [
      'ファントムヴィジョン・ディフェンダー|幻境意象御敌',
      'ファントムヴィジョン・スレイヤー|幻境意象制敌',
      '異なる系列・ヒーラー|毫无关联译名',
      'bad row',
    ].join('\n');
    Object.defineProperty(DATA_TEXT, 'series', {
      configurable: true, enumerable: original.enumerable, value: fixture,
    });
    cacheReset('derived');
    const series = _getSeriesMap();
    assert.equal(series.get('ファントムヴィジョン・ディフェンダー'), '幻境意象御敌');
    assert.equal(_getSeriesMap(), series, '相同源数据应复用缓存实例');
    const prefix = _getSeriesPfx();
    assert.equal(prefix.get('ファントムヴィジョン'), '幻境意象');
    assert.equal(_getSeriesPfx(), prefix);
    assert.equal(lookupSeries('ファントムヴィジョン・ディフェンダー'), '幻境意象御敌');
    assert.equal(lookupSeries('ファントムヴィジョン・ディフェンダー・鎧'),
      '幻境意象御敌');
    assert.equal(lookupSeries('ファントムヴィジョン'), '幻境意象御敌',
      '系列查找的历史最长前缀算法返回第一个同长度的精确条目');
    assert.equal(lookupSeries(''), null);
    assert.equal(_stripSeriesHit(series, '不相关・名称'), null);
    assert.equal(_mutualPrefix('abc', 'abcd'), true);
    assert.equal(_mutualPrefix('abc', 'def'), false);
    assert.equal(_prefixBest(new Map([['ABCD', '甲'], ['ABCE', '乙']]), 'AB'), '甲');
    assert.equal(_prefixBest(new Map(), 'AB'), null);

    const groups = _itemPfxGroup({
      'ネオイシュガルディアン・胴': '新伊修加德外套',
      'ネオイシュガルディアン・脚': '新伊修加德长裤',
      '不相关': '无',
      '短・': '跳过',
    });
    assert.deepEqual(groups.get('ネオイシュガルディアン'),
      ['新伊修加德外套', '新伊修加德长裤']);
    assert.deepEqual(_itemPfxGroup({}), new Map());
    const candidates = new Map();
    _seriesPfxCollect(series, candidates);
    assert.deepEqual([...candidates.get('ファントムヴィジョン')], ['幻境意象']);
    assert.equal(_getItemPfx() instanceof Map, true);
    assert.ok(Array.isArray(_getFCSubstrKeys()));
    assert.ok(Array.isArray(_getSubstrKeysAll()));
    assert.equal(cacheInfo().rev.dict >= 0, true);
    assert.equal(lookupJp2Zh(''), null);
    assert.equal(lookupJp2Zh('X'.repeat(81)), null);
  } finally {
    Object.defineProperty(DATA_TEXT, 'series', original);
    cacheReset('derived');
  }
});

test('真实 MutationObserver：批次去重、文字变动、异常隔离和销毁', async () => {
  const oldObserver = globalThis.MutationObserver;
  const oldDocument = globalThis.document;
  const oldWarn = console.warn;
  const observers = [];
  const warnings = [];
  class FakeObserver {
    constructor(callback) { this.callback = callback; this.disconnectCalls = 0; observers.push(this); }
    observe(node, opts) { this.node = node; this.opts = opts; }
    disconnect() { this.disconnectCalls++; }
    emit(mutations) { this.callback(mutations); }
  }
  const root = { nodeType: 1, parentNode: null };
  const child = { nodeType: 1, parentNode: root };
  const leaf = { nodeType: 3, parentNode: child };
  const batches = [];
  try {
    globalThis.MutationObserver = FakeObserver;
    globalThis.document = { body: root, documentElement: root };
    console.warn = (...args) => warnings.push(args);
    const ticks = _obsStats.ticks;
    const worker = createObserver({
      root, debounce: 1, floodLimit: 20, characterData: true,
      attributes: true, attributeFilter: ['title'], filter: () => true,
      handler(nodes, changed) { batches.push({ nodes, changed }); },
    });
    assert.equal(observers.length, 1);
    assert.equal(observers[0].node, root);
    assert.equal(observers[0].opts.attributes, true);
    assert.equal(observers[0].opts.characterData, true);
    observers[0].emit([
      { type: 'childList', addedNodes: [child, leaf] },
      { type: 'characterData', target: leaf },
      { type: 'attributes', target: child },
    ]);
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(batches.length, 1);
    // dedupeByAncestor 仅剔除重复元素；文本节点作为独立变更目标保留。
    assert.deepEqual(batches[0].nodes, [child, leaf]);
    assert.deepEqual(batches[0].changed, [leaf]);
    assert.equal(_obsStats.ticks, ticks + 1);
    worker.disconnect();
    assert.equal(observers[0].disconnectCalls, 1);
    observers[0].emit([{ type: 'childList', addedNodes: [child] }]);
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(batches.length, 1, '销毁后不得再次调度回调');

    const next = createObserver({handler:() => { throw new Error('预期观察回调异常'); },debounce:1});
    assert.equal(observers.length, 2);
    observers[1].emit([{ type: 'childList', addedNodes: [child] }]);
    await new Promise(resolve => setTimeout(resolve, 25));
    next.disconnect();
  } finally {
    if (oldObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = oldObserver;
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
    console.warn = oldWarn;
  }
});
