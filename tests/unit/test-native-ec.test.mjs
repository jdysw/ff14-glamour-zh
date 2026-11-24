// EC 站点真实 ESM 逻辑：翻译、官方套装名、标题分离、图片、重置筛选。
// 通过确定性 DOM 夹具运行原函数；不改测试期望以通过测试，也不调用真实站点。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Window as TestWindow } from 'happy-dom';
import { _applyV3, dataInvalidate } from '../../src/core/data/data-manager.js';
import { cacheReset } from '../../src/core/cache-primitives.js';
import { collectTargets, bindGlobalWikiJump } from '../../src/core/targets.js';
import {
  ecGearsetDisplayName, suggestECGearsetsByZh, resolveECGearsetSearch,
  trimECNode, translateECTitle, translateECAttrs, translateECPage,
  translateECGearsetNames, bindECPieceTiles, bindECResetFilters,
  translateECNavigation, translateECHomeEditorial,
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
    for(const [source,want] of [['Oct 2nd, 2026','2026年10月2日'],['January 15, 2025','2025年1月15日'],['Test 12, 2024','Test 12, 2024']]){
      const date={nodeType:3,nodeValue:source,parentElement:contentParent};trimECNode(date);assert.equal(date.nodeValue,want);
    }

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

test('EC 首页结构化汉化：按 7.0 链接修正资料片、栏目合并文本与编辑文案', () => {
  const dom = new TestWindow({ url: 'https://ffxiv.eorzeacollection.com/' });
  const d = dom.document;
  d.body.innerHTML = [
    '<nav>',
    '<a id="expansion" href="/gearsets?patch=7.0"><span>自晓月之终途起</span></a>',
    '<a id="old" href="/gearsets?patch=6.0">From Endwalker</a>',
    '<a id="current" href="/gearsets?patch=7.0">当前资料片</a>',
    '<a id="foreign" href="https://example.com/gearsets?patch=7.0">From Endwalker</a>',
    '<a id="tomes" href="/gearsets?content=tomes"><img alt="Female Midlander"><span>神典石</span> 兑换</a>',
    '<a id="first-page" href="/gearsets?content=tomes">1</a>',
    '<a id="page-two" href="/gearsets?content=tomes&page=2">2</a>',
    '<a id="combined-filter" href="/gearsets?content=tomes&maximumLvl=70">Tomestones Exchange</a>',
    '<a id="seasonal" href="/gearsets?content=seasonal"><img alt="seasonal">季节活动 <b>装备</b></a>',
    '<a id="legacy-seasonal" href="/gearsets?content=seasonal">商城套装</a>',
    '<a id="job" href="/gearsets?content=job">职业校服 <i>护甲</i></a>',
    '</nav>',
    '<section><h3 id="section">— <span>News and Articles</span> —</h3>',
    '<h3 id="lodestone">— <span>Latest Lodestone News</span> —</h3>',
    '<h3 id="updates">— <span>Latest Updates</span> —</h3>',
    '<h3 id="event">❄️ <em>Verycold</em></h3>',
    '<p id="promo">The Eorzea Collection 周边系列 is finally here!</p>',
    '<p id="challenge-intro">Every month, our Patrons vote on a theme for the glamour challenge and come up with a glamour that fits that theme. For August, we challenged them to prepare for the frozen lands of Evercold with frosty and blustery glamours.</p>',
    '<img id="model" alt="Female Midlander">',
    '<img id="challenge" alt="🎃 Spooky Season">',
    '</section>',
    '<h3 class="c-glamour-grid-item-content-title" id="authored">Verycold</h3>',
  ].join('');
  const savedHref = d.querySelector('#tomes').getAttribute('href');
  const savedImage = d.querySelector('#tomes img');
  withGlobals({
    document: d, location: dom.location, NodeFilter: dom.NodeFilter,
  }, () => {
    translateECNavigation();
    translateECHomeEditorial();
    translateECAttrs();
    assert.equal(d.querySelector('#expansion').textContent, '自金曦之遗辉起');
    assert.equal(d.querySelector('#old').textContent, '自晓月之终途起');
    assert.equal(d.querySelector('#current').textContent, '当前资料片');
    assert.equal(d.querySelector('#foreign').textContent, 'From Endwalker');
    assert.equal(d.querySelector('#tomes').textContent, '神典石兑换');
    assert.equal(d.querySelector('#tomes').getAttribute('href'), savedHref);
    assert.equal(d.querySelector('#tomes img'), savedImage);
    assert.equal(savedImage.alt, '神典石兑换');
    assert.equal(d.querySelector('#first-page').textContent, '1');
    assert.equal(d.querySelector('#page-two').textContent, '2');
    assert.equal(d.querySelector('#combined-filter').textContent, 'Tomestones Exchange');
    assert.equal(d.querySelector('#seasonal').textContent, '季节活动装备');
    assert.equal(d.querySelector('#legacy-seasonal').textContent, '季节活动装备');
    assert.equal(d.querySelector('#job').textContent, '职业校服');
    assert.equal(d.querySelector('#section').textContent, '— 新闻与文章 —');
    assert.equal(d.querySelector('#lodestone').textContent, '— 最新 Lodestone 新闻 —');
    assert.equal(d.querySelector('#updates').textContent, '— 最新更新 —');
    assert.equal(d.querySelector('#event').textContent, '❄️ 凛冬');
    assert.equal(d.querySelector('#promo').textContent, 'Eorzea Collection 周边商品系列正式推出！');
    assert.equal(d.querySelector('#challenge-intro').textContent, '每个月，赞助人都会投票选出幻化挑战主题，并围绕主题创作。8 月的挑战是为踏入《银海之天舟》的冰雪之地做准备，设计充满冰雪与寒风气息的幻化。');
    assert.equal(d.querySelector('#model').alt, '人族·中原之民女性');
    assert.equal(d.querySelector('#challenge').alt, '🎃 惊魂季');
    assert.equal(d.querySelector('#authored').textContent, 'Verycold');
    translateECNavigation();
    translateECHomeEditorial();
    assert.equal(d.querySelector('#job').textContent, '职业校服');
    // Same sitewide header repeats outside the homepage.
    withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/gearsets') }, () => {
      const raw = d.querySelector('#challenge-intro');
      raw.textContent = 'Every month, our Patrons vote on a theme for the glamour challenge and come up with a glamour that fits that theme. For August, we challenged them to prepare for the frozen lands of Evercold with frosty and blustery glamours.';
      translateECHomeEditorial();
      assert.ok(raw.textContent.startsWith('Every month, our Patrons vote'),
        '编辑正文仅限首页，不翻译其他页面正文');
      d.querySelector('#expansion').textContent = 'From Endwalker';
      translateECNavigation();
      assert.equal(d.querySelector('#expansion').textContent, '自金曦之遗辉起');
    });
  });
  dom.close();
});

test('EC 子页：资料片筛选、饰品部位、染色预览和玩家标题边界', () => {
  const dom = new TestWindow({ url: 'https://ffxiv.eorzeacollection.com/dyes' });
  const d = dom.document;
  const raw = 'Rolanberry Red Dye';
  assert.equal(_applyV3({ candidatePolicy: 1, names:
    raw + '\t罗兰莓染剂\t1\t0\nInk Blue Dye\t油墨蓝染剂\t1\t0\n' +
    'Ink Blue\t油墨蓝染剂\t1\t0\n' }), true);
  try {
    withGlobals({ document: d, window: dom, location: dom.location, Node: dom.Node, NodeFilter: dom.NodeFilter }, () => {
      d.title = 'Dyes Preview | Eorzea Collection';
      d.body.innerHTML = '<h1 id="title" class="b-title-text"><b class="b-title-text-bold">Dyes</b> Preview</h1>' +
        '<p id="dye">Rolanberry red NEW</p><p id="other">Ink Blue</p>' +
        '<span id="badge">NEW</span><p id="unknown">Unknown Color NEW</p>';
      translateECPage();
      translateECTitle();
      assert.equal(d.title, '染色预览 | Eorzea Collection');
      assert.equal(d.querySelector('#title').textContent, '染色预览');
      assert.equal(d.querySelector('#title b').textContent, '染色');
      assert.equal(d.querySelector('#dye').textContent, '罗兰莓 新增');
      assert.equal(d.querySelector('#other').textContent, '油墨蓝');
      assert.equal(d.querySelector('#badge').textContent, '新增');
      assert.equal(d.querySelector('#unknown').textContent, 'Unknown Color NEW');
      // Mutation callbacks may receive only the updated text node.
      const dye = d.querySelector('#dye').firstChild;
      dye.nodeValue = 'Ink Blue NEW';
      translateECPage(dye);
      assert.equal(dye.nodeValue, '油墨蓝 新增');
      withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/accessories') }, () => {
        d.body.innerHTML = '<select id="patch"><option value="5.0">ShadowBringers</option><option value="6.0">Endwalker</option>' +
          '<option value="7.0">Dawntrail</option></select><button id="piece">Wrists</button>' +
          '<span id="status">Non Dyeable</span><span id="source">Trial Drop</span>' +
          '<a href="/accessories/avalanche-leaders">Avalanche Leader\'s <span>Token Exchange</span></a>' +
          '<a href="/accessories/avalanche-brawlers">Avalanche Brawler\'s Accessories <span>Token Exchange</span></a>' +
          '<a href="/gearset/festival-neotunic">Festival Neotunic <span>Mogstation Set</span></a>';
        translateECPage();
        assert.deepEqual([...d.querySelector('#patch').options].map(o => [o.value, o.textContent]),
          [['5.0', '暗影之逆焰'], ['6.0', '晓月之终途'], ['7.0', '金曦之遗辉']]);
        assert.equal(d.querySelector('#piece').textContent, '腕部');
        assert.equal(d.querySelector('#status').textContent, '不可染色');
        assert.equal(d.querySelector('#source').textContent, '讨伐歼灭战掉落');
        translateECPage();
        assert.equal(d.querySelector('[href="/accessories/avalanche-leaders"]').textContent, '雪崩领导者饰品 代币兑换');
        assert.equal(d.querySelector('[href="/accessories/avalanche-brawlers"]').textContent, '雪崩斗手饰品 代币兑换');
        assert.equal(d.querySelector('[href="/gearset/festival-neotunic"]').textContent, '欢庆新式文化衫套装 商城');
      });
      withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/companion-glamour/231/adventurers-basics') }, () => {
        d.title = 'Ink Blue | Eorzea Collection';
        d.body.innerHTML = '<h1 class="minititle is-mega-menu-title">Browse all</h1>' +
          '<h1 id="authored" class="title has-negative-letter-spacing"><span>Ink Blue</span></h1>' +
          '<a href="/companion-glamour/232/example"><p class="title has-text-text is-5">Ink Blue</p></a>' +
          '<a href="/glamour/233/example" title="Ink Blue"><img alt="Ink Blue"><p class="title has-text-text is-5">Ink Blue</p></a>' +
          '<a href="/gearset/ink-blue"><p class="title has-text-text is-5">Ink Blue</p></a>' +
          '<a href="https://ffxiv.eorzeacollection.com/accessories/ink-blue"><span class="has-text-rarity-4">Ink Blue</span></a>' +
          '<a href="/glamour/submit" id="submit">Submit Glamour</a>' +
          '<img id="cover" alt="Cover image">';
        translateECPage();
        translateECTitle();
        assert.equal(d.title, 'Ink Blue | Eorzea Collection');
        assert.equal(d.querySelector('#authored').textContent, 'Ink Blue');
        assert.equal(d.querySelector('.is-mega-menu-title').textContent, '浏览全部');
        assert.equal(collectTargets(d.body).length, 0, '作品及系列卡片均不属于单件物品链');
        const authoredLink = d.querySelector('a[href="/glamour/233/example"]');
        assert.equal(authoredLink.title, 'Ink Blue');
        assert.equal(authoredLink.querySelector('img').alt, 'Ink Blue');
        const work = d.querySelector('a[href="/companion-glamour/232/example"] p');
        assert.equal(work.textContent, 'Ink Blue');
        assert.equal(d.querySelector('#cover').alt, '封面图片');
        bindGlobalWikiJump();
        const ev = new dom.MouseEvent('click', { bubbles: true, cancelable: true });
        work.dispatchEvent(ev);
        assert.equal(ev.defaultPrevented, false, '玩家作品链接不得被 Wiki 跳转拦截');
        for (const link of d.querySelectorAll('a[href*="/gearset/"], a[href*="/accessories/"]')) {
          const click = new dom.MouseEvent('click', { bubbles: true, cancelable: true });
          link.firstElementChild.dispatchEvent(click);
          assert.equal(click.defaultPrevented, false, '系列详情保留原站跳转');
        }
      });
    });
  } finally {
    dataInvalidate();
    cacheReset('lookup');
    cacheReset('derived');
    dom.close();
  }
});

test('EC 阳伞详情：配饰导航、获取方式、图片说明和页面标题', () => {
  const parent = element('DIV');
  const icon = element('IMG', { alt: 'Sky Blue Parasol Icon', title: 'All DPS' });
  const doc = {
    title: 'Parasol | Eorzea Collection',
    body: element('BODY'),
    querySelectorAll: selector => ['[alt]', '[title]'].includes(selector) ? [icon] : [],
  };
  withGlobals({ document: doc, location: { pathname: '/fashion-accessory/parasol' } }, () => {
    for (const [source, expected] of [
      ['— Next Accessory —', '— 下一个配饰 —'],
      ['— Similar accessories —', '— 相似配饰 —'],
      ['Mark as Owned', '标记为已拥有'],
      ["Skybuilders' Scrips", '天穹街振兴票'],
      ['  in The Firmament (X:12.0 Y:14.0)  ', '  位于天穹街 (X:12.0 Y:14.0)  '],
      ['The perfect accessory to protect you from the summer sun, spring showers, and birds seeking to relieve themselves.',
        '夏日遮阳、春雨挡雨，还能防止鸟粪落到身上，是一件实用的配饰。'],
    ]) {
      const node = { nodeType: 3, nodeValue: source, parentElement: parent };
      trimECNode(node);
      assert.equal(node.nodeValue, expected);
    }
    translateECAttrs();
    assert.equal(icon.getAttribute('alt'), '天蓝阳伞图标');
    assert.equal(icon.getAttribute('title'), '所有输出职业');
    translateECTitle();
    assert.equal(doc.title, '阳伞 | Eorzea Collection');
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
