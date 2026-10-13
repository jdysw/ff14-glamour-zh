// 直接运行生产 DOM Target Pipeline 的采集/分派/翻译和跳转，覆盖正反与边界路径。
// 不通过 new Function 拼接源码，也不改写只读生产模块状态。
import test from 'node:test';
import assert from 'node:assert/strict';
import { _applyV3, dataInvalidate, resolveByName } from '../../src/core/data-manager.js';
import {
  collectTargets, dispatchTargets, processRoot, _domStats,
  EC_CARD_SEL, EC_ITEMS_APPLY, lookupZh, applyPlaceholder,
  zhApply, zhApplyPlain, zhApplyCards, zhApplyDye,
  bindGlobalWikiJump, applyItemZh,
} from '../../src/core/targets.js';

function fixture(tagName, text = '', options = {}) {
  const attrs = new Map(Object.entries(options.attributes || {}));
  const classes = new Set(options.classes || []);
  const listeners = new Map();
  return {
    nodeType: 1, tagName, textContent: text, dataset: {}, style: {},
    title: '', className: [...classes].join(' '), childNodes: [],
    listeners, attributes: attrs,
    classList: {
      contains: key => classes.has(key),
      add: key => classes.add(key),
    },
    getAttribute: key => attrs.get(key) ?? null,
    setAttribute: (key, value) => attrs.set(key, String(value)),
    closest: selector => options.closest?.(selector) || null,
    matches: selector => options.matches?.(selector) || false,
    querySelector: selector => selector === 'span' ? (options.span || null) : null,
    querySelectorAll: selector => options.children?.[selector] || [],
    addEventListener: (name, callback) => listeners.set(name, callback),
    replaceWith(node) { this.replacedWith = node; },
  };
}
function event(target) {
  return {
    target, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
  };
}
function withGlobals(values, fn) {
  const saved = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  try { return fn(); }
  finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test('V3 解析器与 Targets 共用真实名称/散列索引', () => {
  assert.equal(_applyV3({
    names: 'English Gear\t测试中文装备\t1\t0\n日本防具\t测试中文防具\t1\t1\nInk Blue\t墨蓝色\t1\t5\n',
    hash: 'abc123\t散列优先译名\n',
  }), true);
  assert.equal(resolveByName('English Gear'), '测试中文装备');
  assert.equal(lookupZh({ getAttribute: () => '/lodestone/playguide/db/item/abc123' },
    'English Gear'), '散列优先译名');
  assert.equal(lookupZh(null, 'English Gear'), '测试中文装备');
  assert.equal(lookupZh(null, '不存在的名字'), null);
});

test('Targets 收集：原链接、纯文本、卡片及染剂均命中，非法候选被排除', () => {
  const validLink = fixture('A', 'English Gear', { attributes: { href: '/lodestone/playguide/db/item/abc123' } });
  const span = fixture('SPAN', ' 日本防具 ', { classes: ['has-text-rarity-4'] });
  const card = fixture('H3', 'English Gear');
  const dye = fixture('SPAN', '⬤ Ink Blue');
  const special = fixture('SPAN', '○ Undyed');
  const invalidLink = fixture('A', 'https://example.test');
  const skippedLink = fixture('A', 'English Gear', { closest: () => ({}) });
  const paintedDye = fixture('SPAN', '⬤ Ink Blue', { classes: ['zhixia-dye-zh'] });
  const lookup = {
    'a.eorzeadb_link': [validLink, invalidLink, skippedLink],
    'span[class*="has-text-rarity-"]': [span],
    [EC_CARD_SEL]: [card],
    'div.tag, span.tag': [dye, special, paintedDye],
  };
  const scope = fixture('DIV', '', { children: lookup });
  const got = collectTargets(scope);
  assert.deepEqual(got.map(row => row.type),
    ['item', 'plain-item', 'card', 'dye', 'dye']);
  assert.equal(got[0].text, 'English Gear');
  assert.equal(got[1].text, '日本防具');
  assert.equal(got[3].context.zh, '墨蓝色');
  assert.equal(got[4].context.zh, '未染色');
  assert.deepEqual(collectTargets({ nodeType: 3 }), []); // 容器非元素应安全退化
});

test('Targets 分派：同类批处理顺序和缺失处理器互不影响', () => {
  const batches = [];
  const targets = [
    { type: 'card', text: 'c' }, { type: 'dye', text: 'd' },
    { type: 'item', text: 'i' }, { type: 'plain-item', text: 'p' },
    { type: 'item', text: 'i2' }, { type: 'unknown', text: 'u' },
  ];
  const result = dispatchTargets(targets, {
    item: x => batches.push(['item', x.map(y => y.text)]),
    'plain-item': x => batches.push(['plain', x.map(y => y.text)]),
    card: x => batches.push(['card', x.map(y => y.text)]),
    dye: x => batches.push(['dye', x.map(y => y.text)]),
  });
  assert.equal(result, undefined);
  assert.deepEqual(batches, [
    ['item', ['i', 'i2']], ['plain', ['p']], ['card', ['c']], ['dye', ['d']],
  ]);
  dispatchTargets(targets);
});

test('Targets 处理与翻译：更新链接、卡片、染剂、占位符和统计', () => {
  const opened = [];
  const item = fixture('A', 'English Gear', {
    attributes: { href: '/lodestone/playguide/db/item/abc123' },
  });
  const itemText = fixture('SPAN', 'English Gear');
  const plain = fixture('SPAN', '日本防具', { classes: ['has-text-rarity-4'] });
  const card = fixture('H3', 'English Gear');
  const dye = fixture('SPAN', '⬤ Ink Blue');
  const nested = fixture('DIV', '');
  const dyeText = { nodeType: 3, nodeValue: '颜色：Ink Blue' };
  nested.childNodes = [dyeText];
  dye.childNodes = [nested];
  const placeholder = fixture('INPUT', '', { attributes: { placeholder: 'Search...' } });
  const unchanged = fixture('INPUT', '', { attributes: { placeholder: 'Unknown' } });
  const matches = {
    'a.eorzeadb_link': [item],
    'span[class*="has-text-rarity-"]': [plain],
    [EC_CARD_SEL]: [card],
    'div.tag, span.tag': [dye],
    'input[placeholder], textarea[placeholder]': [placeholder, unchanged],
  };
  item.querySelector = selector => selector === 'span' ? itemText : null;
  const document = {
    querySelectorAll: selector => matches[selector] || [],
    createElement: name => fixture(name.toUpperCase()),
  };
  const window = { open: (...args) => opened.push(args) };

  withGlobals({ document, window }, () => {
    const before = _domStats.calls;
    const targets = processRoot(null, { applyMap: EC_ITEMS_APPLY });
    assert.deepEqual(targets.map(t => t.type), ['item', 'plain-item', 'card', 'dye']);
    assert.equal(_domStats.calls, before + 1);
    assert.ok(_domStats.firstMs >= 0);
    assert.equal(itemText.textContent, '散列优先译名');
    assert.ok(item.getAttribute('href').includes(encodeURIComponent('散列优先译名')));
    assert.ok(item.classList.contains('zhixia-item-zh'));
    assert.equal(plain.replacedWith.textContent, '测试中文防具');
    assert.ok(plain.replacedWith.classList.contains('zhixia-item-zh'));
    assert.equal(card.textContent, '测试中文装备');
    assert.equal(card.dataset.zhixiaCard, '1');
    const click = event(card);
    card.listeners.get('click')(click);
    assert.equal(click.prevented, true);
    assert.ok(opened[0][0].includes(encodeURIComponent('测试中文装备')));
    assert.equal(dyeText.nodeValue, '颜色：墨蓝色');
    assert.ok(dye.classList.contains('zhixia-dye-zh'));

    applyPlaceholder();
    assert.equal(placeholder.getAttribute('placeholder'), '搜索…');
    assert.equal(placeholder.dataset.zhixiaPh, '1');
    assert.equal(unchanged.getAttribute('placeholder'), 'Unknown');
    placeholder.setAttribute('placeholder', 'Search');
    applyPlaceholder();
    assert.equal(placeholder.getAttribute('placeholder'), 'Search', '同一占位符已被翻译后不再覆盖');

    // 已中文的候选不得再次包装，未命中的候选不得写入 DOM。
    zhApply([{ a: fixture('A'), el: fixture('SPAN'), name: '无法查询' }]);
    zhApplyPlain([{ sp: fixture('SPAN'), name: '无法查询' }]);
    zhApplyCards([{ el: fixture('H3'), name: '无法查询' }]);
    zhApplyDye([{ el: fixture('DIV'), name: 'Ink Blue', zh: 'Ink Blue' }]);
    applyItemZh();
    assert.equal(placeholder.getAttribute('placeholder'), 'Search');
  });
});

test('Targets 全局 Wiki 链接捕获：外服装备打开 Wiki，站点原生控件必须放行', () => {
  let callback;
  const navigations = [];
  const document = { addEventListener(type, cb, capture) {
    assert.equal(type, 'click');
    assert.equal(capture, true);
    callback = cb;
  } };
  const window = { open: (...args) => navigations.push(args) };
  withGlobals({ document, window }, () => {
    bindGlobalWikiJump();
    bindGlobalWikiJump();
    assert.equal(window.__zhixiaWikiJumpBound, true);
    assert.equal(typeof callback, 'function');

    const anchor = fixture('A', 'English Gear', {
      attributes: { href: '/lodestone/playguide/db/item/abc123' },
    });
    const text = fixture('SPAN', 'English Gear', {
      closest: selector => selector.startsWith('a[href') ? anchor : null,
    });
    const e = event(text);
    callback(e);
    assert.equal(e.prevented, true);
    assert.equal(e.stopped, true);
    assert.ok(navigations[0][0].includes(encodeURIComponent('散列优先译名')));

    const native = fixture('BUTTON', 'Search', {
      closest: selector => selector.includes('button, input, select') ? {} : null,
    });
    const passthrough = event(native);
    callback(passthrough);
    assert.equal(passthrough.prevented, false);

    const vue = fixture('SPAN', 'English Gear', { closest: () => ({}) });
    callback(event(vue));
    assert.equal(navigations.length, 1, 'vue-select 候选点击不能劫持跳转');
    callback(event({}));
    assert.equal(navigations.length, 1);
  });
});
