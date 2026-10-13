// EC 站点真实 ESM 逻辑：翻译、官方套装名、标题分离、图片、重置筛选。
// 通过确定性 DOM 夹具运行原函数；不改测试期望以通过测试，也不调用真实站点。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ecGearsetDisplayName, suggestECGearsetsByZh, resolveECGearsetSearch,
  trimECNode, translateECTitle, translateECAttrs, translateECPage,
  translateECGearsetNames, bindECPieceTiles, bindECResetFilters,
} from '../../src/sites/eorzea-collection.js';

function withGlobals(values, fn) {
  const previous = Object.fromEntries(
    Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis,
    key, { configurable: true, writable: true, value });
  try { return fn(); }
  finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}
function element(tagName, attrs = {}) {
  const attributes = new Map(Object.entries(attrs));
  const children = [];
  return {
    nodeType: 1, tagName: tagName.toUpperCase(), dataset: {}, style: {}, children,
    getAttribute: key => attributes.get(key) ?? null,
    hasAttribute: key => attributes.has(key),
    setAttribute: (key, val) => attributes.set(key, val),
    closest: () => null,
    appendChild(child) { children.push(child); child.parentElement = this; },
    querySelectorAll() { return []; },
  };
}
function walker(nodes) {
  let idx = -1;
  return {
    nextNode() { return ++idx < nodes.length; },
    get currentNode() { return nodes[idx]; },
  };
}

test('EC 已核实套装及搜索候选：未知标题保持原文，禁止猜测直链', () => {
  const known = ecGearsetDisplayName('Phantom Vision Fending');
  assert.ok(known?.endsWith('套装'), '已核实的系列 + 职能须转换为中文套装名');
  assert.equal(ecGearsetDisplayName('An Imaginary Unknown Gearset'), null);
  assert.equal(ecGearsetDisplayName(''), null);
  assert.equal(ecGearsetDisplayName('A'.repeat(111)), null);
  assert.equal(ecGearsetDisplayName('Phantom Vision Fending Set'), known,
    'EC 原生 Set 后缀不能重复变成套装套装');

  const rows = suggestECGearsetsByZh('东方');
  assert.ok(Array.isArray(rows));
  assert.ok(rows.some(row => row.native === 'Eastern'), '官方核验过的公共搜索别名不能丢失');
  const resolved = resolveECGearsetSearch('东方');
  assert.equal(resolved, 'Eastern', '多个东方套装只应检索英文公共词');
  assert.deepEqual(suggestECGearsetsByZh('z'.repeat(3)), []);
});

test('EC 文本与属性：保留玩家创作，规范翻译界面文本和动态标题', () => {
  const contentParent = element('SPAN');
  const text = { nodeType: 3, nodeValue: '1,234 results', parentElement: contentParent };
  withGlobals({ location: { pathname: '/glamours' } }, () => {
    trimECNode(text);
    assert.equal(text.nodeValue, '共 1,234 条结果');
    assert.equal(contentParent.dataset.zhixiaSourceText, '1,234 results');

    const skipParent = element('DIV');
    skipParent.closest = () => ({});
    const authored = { nodeType: 3, nodeValue: '1,234 results', parentElement: skipParent };
    trimECNode(authored);
    assert.equal(authored.nodeValue, '1,234 results');
    trimECNode({ nodeType: 3, nodeValue: '    ', parentElement: contentParent });

    const label = element('BUTTON', { title: 'Latest Patch - 7.5' });
    const image = element('IMG', { alt: '2 results', 'aria-label': 'Loading...' });
    const lookup = {
      '[title]': [label], '[alt]': [image],
      '[aria-label]': [image], '[placeholder]': [],
    };
    const doc = {
      title: 'Latest Patch - 7.5 | Eorzea Collection',
      querySelectorAll: selector => lookup[selector] || [],
      documentElement: element('HTML'), body: element('BODY'),
    };
    withGlobals({ document: doc }, () => {
      translateECAttrs();
      assert.equal(label.getAttribute('title'), '最新版本 - 7.5');
      assert.equal(image.getAttribute('alt'), '共 2 条结果');
      assert.equal(image.getAttribute('aria-label'), '加载中…');
      translateECTitle();
      assert.equal(doc.title, '最新版本 - 7.5 | Eorzea Collection');
      translateECTitle();
      assert.equal(doc.title, '最新版本 - 7.5 | Eorzea Collection',
        '重复翻译不能破坏原站站名或日期');
    });
  });
});

test('EC Gearsets H1 拆分后缀：保留原版式并避免套装重复翻译', () => {
  const sourceName = 'Phantom Vision Fending';
  const zhName = ecGearsetDisplayName(sourceName);
  const heading = element('H1');
  const mainNode = { nodeType: 3, nodeValue: sourceName };
  const suffixNode = { nodeType: 3, nodeValue: 'Set' };
  const nodes = [mainNode, suffixNode];
  const doc = {
    querySelectorAll: selector => selector === 'h1' ? [heading] : [],
    createTreeWalker: (root, flags) => {
      assert.equal(root, heading);
      assert.equal(flags, 4);
      return walker(nodes);
    },
  };
  withGlobals({
    document: doc, NodeFilter: { SHOW_TEXT: 4 },
    location: { pathname: '/gearset/phantom-vision-fending' },
  }, () => {
    translateECGearsetNames();
    assert.equal(mainNode.nodeValue + suffixNode.nodeValue, zhName);
    assert.equal(suffixNode.nodeValue, '套装');
    translateECGearsetNames();
    assert.equal(mainNode.nodeValue + suffixNode.nodeValue, zhName,
      'SPA 再次扫描不能重复添加套装后缀');
  });
});

test('EC 装饰图图片叠字：中文贴片只添加一次，不改站点原图地址', () => {
  const banner = element('IMG', { src: '/pages/header/banner-head-piece.png' });
  const link = element('A');
  banner.parentElement = link;
  const doc = {
    querySelectorAll: selector => selector === 'a > img[src*="/pages/header/banner-"]'
      ? [banner] : [],
    createElement: name => element(name),
  };
  withGlobals({ document: doc }, () => {
    assert.equal(bindECPieceTiles(), true);
    assert.equal(link.dataset.zhixiaPiece, '1');
    assert.equal(link.children[0].textContent, '头部');
    assert.equal(banner.getAttribute('src'), '/pages/header/banner-head-piece.png');
    assert.equal(bindECPieceTiles(), false, '幂等标记防止双重贴片');
    assert.equal(link.children.length, 1);
  });
});

test('EC 全页 walker：有效界面翻译，脚本及玩家自创文本保持隔离', () => {
  const textParent = element('DIV');
  const text = { nodeType: 3, nodeValue: 'Loading...', parentElement: textParent };
  const skipped = element('SCRIPT');
  const root = element('DIV');
  const filter = { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
  const doc = {
    body: root, documentElement: element('HTML'),
    querySelectorAll: () => [],
    createTreeWalker(node, flags, opts) {
      assert.equal(node, root);
      assert.equal(flags, 5);
      assert.equal(opts.acceptNode(skipped), filter.FILTER_REJECT);
      assert.equal(opts.acceptNode(text), filter.FILTER_ACCEPT);
      return walker([text]);
    },
  };
  withGlobals({ document: doc, NodeFilter: filter, location: { pathname: '/glamours' } }, () => {
    translateECPage();
    assert.equal(text.nodeValue, '加载中…');
    translateECPage();
    assert.equal(text.nodeValue, '加载中…');
  });
});

test('EC 重置筛选：先遵循站点处理，失败时清理 /glamours/<slot>/<id> 路径', () => {
  const handlers = [];
  const timers = [];
  const loc = {
    pathname: '/glamours/head/27832',
    href: 'https://ffxiv.eorzeacollection.com/glamours/head/27832?query=one#top',
    navigated: [],
    assign(url) { this.navigated.push(url); },
    reload() { this.reloads = (this.reloads || 0) + 1; },
  };
  const doc = { addEventListener(type, cb, capture) {
    assert.equal(type, 'click');
    assert.equal(capture, true);
    handlers.push(cb);
  } };
  const label = element('BUTTON');
  label.textContent = 'Reset filters';
  label.closest = () => label;
  const oldBound = Object.getOwnPropertyDescriptor(globalThis, '__zhxECResetBound');
  withGlobals({
    document: doc, location: loc,
    setTimeout: (fn, delay) => { timers.push(fn); assert.equal(delay, 250); },
    __zhxECResetBound: false,
  }, () => {
    bindECResetFilters();
    bindECResetFilters();
    assert.equal(handlers.length, 1, '必须避免绑定多个文档捕获监听');
    const click = { target: label, preventDefault() { throw Error('不应抢原站事件'); } };
    handlers[0](click);
    assert.equal(timers.length, 1);
    timers.shift()();
    assert.equal(loc.navigated[0], 'https://ffxiv.eorzeacollection.com/glamours');
    loc.pathname = '/gearsets';
    loc.href = 'https://ffxiv.eorzeacollection.com/gearsets';
    label.textContent = 'Reset';
    handlers[0](click);
    timers.shift()();
    assert.equal(loc.reloads, 1, '没有筛选参数时回退站点原页刷新');
    loc.href = 'https://ffxiv.eorzeacollection.com/gearsets?page=3';
    handlers[0](click);
    loc.href = 'https://ffxiv.eorzeacollection.com/gearsets?page=2';
    timers.shift()();
    assert.equal(loc.navigated.length, 1, '站点已经自己导航时不得强行覆盖结果');
  });
  if (oldBound) Object.defineProperty(globalThis, '__zhxECResetBound', oldBound);
  else delete globalThis.__zhxECResetBound;
});
