// EC 站点真实 ESM 逻辑：翻译、官方套装名、标题分离、图片、重置筛选。
// 通过确定性 DOM 夹具运行原函数；不改测试期望以通过测试，也不调用真实站点。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Window as TestWindow } from 'happy-dom';
import { _applyV3, _fireTablesReady, dataInvalidate } from '../../src/core/data/data-manager.js';
import { cacheReset } from '../../src/core/cache-primitives.js';
import { readRuntimeV3 } from '../helpers/v3-cache.mjs';
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
    for (const [source, want] of [['Ranged DPS','远程物理职业'],['Ranged','远程物理职业'],['Caster DPS','远程魔法职业'],['Caster','远程魔法职业'],['Tanks','防护职业'],['Healers','治疗职业']]) {
      const role = { nodeType: 3, nodeValue: source, parentElement: contentParent };
      trimECNode(role);
      assert.equal(role.nodeValue, want);
    }
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

test('EC 导航与编辑文案：按目标链接翻译，并区别挑战与玩家作品', () => {
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
    withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/news/patron-challenge') }, () => {
      d.body.innerHTML = '<a href="/challenges/verycold"><article class="card">' +
        '<img alt="❄️ Verycold"><div class="card-content"><p class="title">❄️ Verycold</p></div></article></a>' +
        '<a href="/glamour/241/example"><img alt="❄️ Verycold">' +
        '<p class="c-glamour-grid-item-content-title">❄️ Verycold</p></a>';
      const editorial = d.querySelector('a[href^="/challenges/"]');
      const authored = d.querySelector('a[href^="/glamour/"]');
      translateECPage(editorial.querySelector('p').firstChild);
      translateECPage();
      assert.equal(editorial.querySelector('p').textContent, '❄️ 凛冬');
      assert.equal(editorial.querySelector('img').alt, '❄️ 凛冬');
      assert.equal(editorial.getAttribute('href'), '/challenges/verycold');
      assert.equal(authored.querySelector('p').textContent, '❄️ Verycold');
      assert.equal(authored.querySelector('img').alt, '❄️ Verycold');
    });
    withGlobals({
      location: new URL('https://ffxiv.eorzeacollection.com/challenges/verycold'),
      Node: dom.Node,
    }, () => {
      d.title = "❄️ Verycold - August's Glamour Challenge | Eorzea Collection";
      d.body.innerHTML = '<h1 class="b-title-text"><b class="b-title-text-bold">❄️ Verycold</b> Challenge</h1>' +
        "<h2 class=\"b-title-sub\">August's Glamour Theme</h2>" +
        '<article class="b-article-content"><img alt="❄️ Verycold Glamour Challenge">' +
        '<p>For this challenge, we asked patrons to submit frosty and blustery glamours to  prepare for the frozen lands of Evercold.</p></article>' +
        '<a href="/glamour/241/example"><p class="c-glamour-grid-item-content-title">❄️ Verycold</p></a>';
      const bold = d.querySelector('h1 b');
      translateECPage(bold.nextSibling);
      assert.equal(d.querySelector('h1').textContent, '❄️ 凛冬挑战');
      translateECPage();
      translateECTitle();
      assert.equal(d.querySelector('h1 b'), bold);
      assert.equal(d.querySelector('h1').textContent, '❄️ 凛冬挑战');
      assert.equal(d.querySelector('h2').textContent, '8 月幻化主题');
      assert.equal(d.querySelector('article img').alt, '❄️ 凛冬幻化挑战');
      assert.match(d.querySelector('article p').textContent, /《银海之天舟》/u);
      assert.equal(d.title, '❄️ 凛冬：8 月幻化挑战 | Eorzea Collection');
      assert.equal(d.querySelector('a p').textContent, '❄️ Verycold');
    });
    // News-card prefixes must be tied to a matching editorial destination,
    // including the exact census year. Links and personal names stay native.
    withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/news') }, () => {
      const card = (href, title) => '<a href="' + href + '"><article class="card"><img alt="' + title +
        '"><div class="card-content"><p class="title">' + title + '</p></div></article></a>';
      const cards = [
        ['/interview/snow-white', 'We interviewed Snow White!', '专访：Snow White!'],
        ['/interview/edeon-vails', 'Interview with the Creator - Edeon Vails!', '创作者访谈：Edeon Vails!'],
        ['/year-in-review/2025', '2025 in Review', '2025 年度回顾'],
        ['/year-in-review/2024', '2025 in Review', '2025 in Review'],
        ['/glamour/241/example', 'We interviewed Snow White!', 'We interviewed Snow White!'],
      ];
      d.body.innerHTML = cards.map(([href, title]) => card(href, title)).join('');
      d.querySelector('a[href^="/interview/"] .card').insertAdjacentHTML('afterbegin', '<div class="ribbon">Interview</div>');
      const teaser = '<div class="content">Check out the 2025 census to find out what were the hottest gear pieces, the most used colors and which server was the most glamourous, among other things!</div>';
      for (const content of d.querySelectorAll('a[href^="/year-in-review/"] .card-content')) {
        content.insertAdjacentHTML('beforeend', teaser);
      }
      translateECPage();
      translateECPage();
      assert.equal(d.querySelector('.ribbon').textContent, '社区访谈');
      assert.match(d.querySelector('[href="/year-in-review/2025"] .content').textContent, /^查看 2025 年度统计/u);
      assert.match(d.querySelector('[href="/year-in-review/2024"] .content').textContent, /^Check out the 2025 census/u);
      assert.deepEqual([...d.querySelectorAll('a')].map(a =>
        [a.getAttribute('href'), a.querySelector('p').textContent, a.querySelector('img').alt]),
      cards.map(([href, , expected]) => [href, expected, expected]));
    });
    withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/interview/snow-white'), Node: dom.Node }, () => {
      d.title = 'Community Interview - Snow White | Eorzea Collection';
      d.body.innerHTML = '<h1 class="b-title-text">Community <b class="b-title-text-bold">Interview</b></h1>' +
        '<article class="b-article"><h3 class="c-author-name">Snow White</h3>' +
        '<img class="c-author-image" alt="Snow White"><p>Our original interview answer.</p></article>';
      const bold = d.querySelector('h1 b');
      translateECPage(bold.previousSibling);
      translateECPage();
      translateECTitle();
      assert.equal(d.querySelector('h1').textContent, '社区访谈');
      assert.equal(d.querySelector('h1 b'), bold);
      assert.equal(d.title, '社区访谈：Snow White | Eorzea Collection');
      assert.equal(d.querySelector('.c-author-name').textContent, 'Snow White');
      assert.equal(d.querySelector('.c-author-image').alt, 'Snow White');
      assert.equal(d.querySelector('article p').textContent, 'Our original interview answer.');
    });
    withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/year-in-review/2025'), Node: dom.Node }, () => {
      d.title = '2025 with EC';
      d.body.innerHTML = '<section><h1 class="title has-negative-letter-spacing"><span><span>Eorzea Collection</span> in 2025</span></h1>' +
        '<h4 class="subtitle">Most popular</h4><h3 class="title">GEARSETS</h3><p class="subtitle">279583</p></section>';
      const brand = d.querySelector('h1 span span');
      translateECPage(brand.nextSibling);
      translateECPage();
      translateECTitle();
      assert.equal(d.querySelector('h1').textContent, 'Eorzea Collection 2025 年度回顾');
      assert.equal(d.querySelector('h1 span span'), brand);
      assert.equal(d.title, 'Eorzea Collection 2025 年度回顾');
      assert.equal(d.querySelector('h4').textContent, '最受欢迎的');
      assert.equal(d.querySelector('h3').textContent, '装备套装');
      assert.equal(d.querySelector('p').textContent, '279583');
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
    'Ink Blue\t油墨蓝染剂\t1\t0\n' +
    'The Faces We Wear - Simple Spectacles\t面部配饰：基础款眼镜\t0\t0\n' +
    'The Faces We Wear - Monocles\t面部配饰：单眼镜\t0\t0\n' +
    'Angel Wings\t天使之翼\t1\t0\n' }), true);
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
          '<form id="filter_form"><select id="filter_job"><optgroup id="jobs" label="Tanks"><option value="19">Paladin</option></optgroup><optgroup id="unknown-group" label="Unrecognized group"><option>Unknown</option></optgroup></select></form>' +
          '<select><optgroup id="outside-form" label="Tanks"><option>Paladin</option></optgroup></select>' +
          '<span id="status">Non Dyeable</span><span id="source">Trial Drop</span>' +
          '<a href="/accessories/avalanche-leaders">Avalanche Leader\'s <span>Token Exchange</span></a>' +
          '<a href="/accessories/avalanche-brawlers">Avalanche Brawler\'s Accessories <span>Token Exchange</span></a>' +
          '<a href="/gearset/festival-neotunic">Festival Neotunic <span>Mogstation Set</span></a>' +
          '<a href="/gearset/avalanche-leaders"><img id="leader-set" alt="Avalanche Leader\'s image">Avalanche Leader\'s</a>' +
          '<a href="/gearset/avalanche-brawlers"><img id="brawler-set" alt="Avalanche Brawler\'s image">Avalanche Brawler\'s</a>' +
          '<a href="https://ffxiv.eorzeacollection.com/accessories/avalanche-leaders"><img id="leader-earring" alt="Avalanche Leader\'s image">Avalanche Leader\'s</a>' +
          '<a href="/gearset/graffiti-neotunic"><img id="graffiti-set" alt="Graffiti Neotunic image">Graffiti Neotunic</a>';
        translateECPage();
        assert.deepEqual([...d.querySelector('#patch').options].map(o => [o.value, o.textContent]),
          [['5.0', '暗影之逆焰'], ['6.0', '晓月之终途'], ['7.0', '金曦之遗辉']]);
        assert.equal(d.querySelector('#piece').textContent, '腕部');
        assert.equal(d.querySelector('#jobs').getAttribute('label'), '防护职业');
        assert.equal(d.querySelector('#jobs option').value, '19');
        assert.equal(d.querySelector('#unknown-group').getAttribute('label'), 'Unrecognized group');
        assert.equal(d.querySelector('#outside-form').getAttribute('label'), 'Tanks');
        assert.equal(d.querySelector('#status').textContent, '不可染色');
        assert.equal(d.querySelector('#source').textContent, '讨伐歼灭战掉落');
        translateECPage();
        assert.equal(d.querySelector('[href="/accessories/avalanche-leaders"]').textContent, '雪崩领导者饰品 代币兑换');
        assert.equal(d.querySelector('[href="/accessories/avalanche-brawlers"]').textContent, '雪崩斗手饰品 代币兑换');
        assert.equal(d.querySelector('[href="/gearset/festival-neotunic"]').textContent, '欢庆新式文化衫套装 商城');
        assert.deepEqual(['leader-set','brawler-set','leader-earring','graffiti-set'].map(id => d.getElementById(id).alt),
          ['雪崩领导者套装图片','雪崩斗手套装图片','雪崩领导者饰品图片','涂鸦新式文化衫套装图片']);
        assert.equal(d.querySelector('[href="/gearset/avalanche-leaders"]').textContent, '雪崩领导者套装');
        assert.equal(d.querySelector('[href="/gearset/avalanche-brawlers"]').textContent, '雪崩斗手套装');
      });
      withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/facewear') }, () => {
        d.title = 'Facewear | Eorzea Collection';
        translateECTitle();
        assert.equal(d.title, '面部配饰 | Eorzea Collection',
          '页面标题中官译优先于运行时词典旧译');
      });
      withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/facewear/simple-spectacles') }, () => {
        d.title = 'Simple Spectacles | Eorzea Collection';
        d.body.innerHTML = '<a href="/facewear">Facewear</a>' +
          '<h1 class="title has-negative-letter-spacing"><span class="has-text-primary">Simple Spectacles</span></h1>' +
          '<h2>— Next Facewear —</h2><a href="/facewear/monocle"><img alt="Monocle Icon">' +
          '<p class="title has-text-text">Monocle</p></a><a href="/glamour/21/sample"><p class="title has-text-text">Monocle</p></a>' +
          '<div class="box is-fake" id="palette"><img class="image" src="/brass.png" alt="Brass Color Image">' +
          '<div class="tag"><span>Brass</span></div></div>' +
          '<b-tooltip id="owned" label="Please login to mark accessories as owned"><a href="/login">1</a></b-tooltip>' +
          '<div class="b-tooltip"><div class="tooltip-content">Please login to love accessories</div></div>' +
          '<a href="/glamour/21/sample"><b-tooltip id="player-tooltip" label="Please login to love accessories"></b-tooltip></a>';
        const catalogue = d.querySelector('a[href="/facewear/monocle"]');
        translateECPage(catalogue.querySelector('p').firstChild);
        translateECPage();
        translateECTitle();
        assert.equal(d.querySelector('a[href="/facewear"]').textContent, '面部配饰');
        assert.equal(d.querySelector('h1').textContent, '基础款眼镜');
        assert.equal(d.querySelector('h2').textContent, '— 下一个面部配饰 —');
        assert.equal(d.title, '基础款眼镜 | Eorzea Collection');
        assert.equal(catalogue.querySelector('p').textContent, '单眼镜');
        assert.equal(catalogue.querySelector('img').alt, '单眼镜图标');
        assert.equal(catalogue.getAttribute('href'), '/facewear/monocle');
        assert.equal(d.querySelector('a[href^="/glamour/"] p').textContent, 'Monocle');
        bindGlobalWikiJump();
        const click = new dom.MouseEvent('click', { bubbles: true, cancelable: true });
        catalogue.querySelector('p').dispatchEvent(click);
        assert.equal(click.defaultPrevented, false, '面部配饰详情保留原站链接');

        const palette = d.querySelector('#palette');
        const swatchText = palette.querySelector('.tag span').firstChild;
        const swatchImage = palette.querySelector('img');
        const tooltip = d.querySelector('#owned');
        const hydrated = d.querySelector('.tooltip-content');
        assert.equal(swatchText.nodeValue, '铜色');
        assert.equal(swatchImage.alt, '铜色预览');
        assert.equal(tooltip.getAttribute('label'), '登录后可标记为已拥有');
        assert.equal(hydrated.textContent, '登录后可点赞');
        assert.equal(d.querySelector('#player-tooltip').getAttribute('label'), 'Please login to love accessories');

        // Site updates can replace individual text nodes or attributes.
        swatchText.nodeValue = 'Base';
        swatchImage.setAttribute('alt', 'Base Color Image');
        tooltip.setAttribute('label', 'Please login to love accessories');
        hydrated.firstChild.nodeValue = 'Please login to bookmark accessories';
        for (const changed of [swatchText, swatchImage, tooltip, hydrated.firstChild]) translateECPage(changed);
        assert.equal(swatchText.nodeValue, '默认色');
        assert.equal(swatchImage.alt, '默认色预览');
        assert.equal(swatchImage.getAttribute('src'), '/brass.png');
        assert.equal(tooltip.getAttribute('label'), '登录后可点赞');
        assert.equal(tooltip.querySelector('a').getAttribute('href'), '/login');
        assert.equal(hydrated.textContent, '登录后可收藏');
      });
      withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/fashion-accessory/angel-wings') }, () => {
        d.title = 'Angel Wings | Eorzea Collection';
        d.body.innerHTML = '<h1 class="title has-negative-letter-spacing"><span class="has-text-primary">Angel Wings</span></h1>' +
          '<a href="/fashion-accessories?subtype=back-2wings">Pair Of Wings</a>';
        translateECPage();
        translateECTitle();
        assert.equal(d.querySelector('h1').textContent, '天使之翼');
        assert.equal(d.title, '天使之翼 | Eorzea Collection');
        assert.equal(d.querySelector('a').textContent, '双翼');
        assert.equal(d.querySelector('a').getAttribute('href'), '/fashion-accessories?subtype=back-2wings');
      });
      for (const [route, english, localized] of [
        ['following', 'Creators Ink Blue Follows', 'Ink Blue关注的创作者'],
        ['followers', 'Creators Following Ink Blue', 'Ink Blue的关注者'],
      ]) {
        withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/creator/42/' + route) }, () => {
          d.body.innerHTML = '<aside><h1 class="title has-negative-letter-spacing">Ink Blue</h1>' +
            '<div class="image is-relative"><img alt="Ink Blue"></div>' +
            '<p class="content has-text-light mt-4 mb-2 pt-2">Ink Blue</p><nav class="level">' +
            '<p class="heading">Albums</p></nav></aside><div class="column">' +
            '<h1 class="title has-negative-letter-spacing">' + english + '</h1></div>';
          translateECPage();
          translateECPage();
          assert.equal(d.querySelector('.column h1').textContent, localized);
          assert.equal(d.querySelector('aside h1').textContent, 'Ink Blue');
          assert.equal(d.querySelector('aside .content').textContent, 'Ink Blue');
          assert.equal(d.querySelector('aside img').alt, 'Ink Blue');
          assert.equal(d.querySelector('.heading').textContent, '相册');
        });
      }
      withGlobals({ location: new URL('https://ffxiv.eorzeacollection.com/companion-glamour/231/adventurers-basics') }, () => {
        d.title = 'Ink Blue | Eorzea Collection';
        d.body.innerHTML = '<h1 class="minititle is-mega-menu-title">Browse all</h1>' +
          '<h1 id="authored" class="title has-negative-letter-spacing"><span>Ink Blue</span></h1>' +
          '<a href="/companion-glamour/232/example"><p class="title has-text-text is-5">Ink Blue</p></a>' +
          '<a href="/glamour/233/example" title="Ink Blue"><img alt="Ink Blue"><p class="title has-text-text is-5">Ink Blue</p></a>' +
          '<a href="/gearset/ink-blue"><p class="title has-text-text is-5">Ink Blue</p></a>' +
          '<a href="https://ffxiv.eorzeacollection.com/accessories/ink-blue"><span class="has-text-rarity-4">Ink Blue</span></a>' +
          '<a href="/glamour/submit" id="submit">Submit Glamour</a>' +
          '<img id="cover" alt="Cover image">' +
          '<h2 class="minititle">— Description —</h2><div class="box" id="description">Ink Blue' +
          '<a class="eorzeadb_link" href="https://na.finalfantasyxiv.com/lodestone/playguide/db/item/123"><span>Ink Blue</span></a></div>' +
          "<div class=\"list-item\"><img class=\"gear-icon-image\" alt=\"Ul'dahn Saddle\">" +
          '<div class="list-item-content"><div class="list-item-title">Ul\'dahn Saddle</div></div>' +
          '<div class="list-item-controls"><a href="/companion-glamours?legsPiece=9"><span>Others using this piece</span></a></div></div>' +
          '<a href="/login" data-tooltip="You need to be logged in send love" id="love"></a>' +
          '<b-tooltip label="Please login to bookmark glamours" id="bookmark"></b-tooltip>' +
          '<div data-tooltip="Ink Blue" id="companion-color"><span class="has-text-dye-ink-blue">⬤</span></div>' +
          '<div data-tooltip="Ink Blue" id="creator-tooltip"></div>';
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
        assert.equal(d.querySelector('#description').firstChild.nodeValue, 'Ink Blue');
        const authorItem = d.querySelector('#description a');
        assert.equal(authorItem.getAttribute('href'), 'https://na.finalfantasyxiv.com/lodestone/playguide/db/item/123');
        assert.equal(authorItem.textContent, 'Ink Blue');
        assert.equal(d.querySelector('.list-item-title').textContent, '黄沙陆行鸟鞍');
        assert.equal(d.querySelector('.gear-icon-image').alt, '黄沙陆行鸟鞍');
        const itemFilter = d.querySelector('[href="/companion-glamours?legsPiece=9"]');
        assert.equal(itemFilter.textContent, '使用这件装甲的其他陆行鸟幻化');
        assert.equal(d.querySelector('#love').getAttribute('data-tooltip'), '登录后可点赞');
        assert.equal(d.querySelector('#bookmark').getAttribute('label'), '登录后可收藏幻化');
        assert.equal(d.querySelector('#companion-color').getAttribute('data-tooltip'), '油墨蓝');
        assert.equal(d.querySelector('#creator-tooltip').getAttribute('data-tooltip'), 'Ink Blue');
        bindGlobalWikiJump();
        for (const control of [itemFilter, authorItem]) {
          const preserved = new dom.MouseEvent('click', { bubbles: true, cancelable: true });
          control.firstElementChild.dispatchEvent(preserved);
          assert.equal(preserved.defaultPrevented, false, '保留原站筛选链接及玩家描述链接');
        }
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
    assert.equal(icon.getAttribute('title'), '所有进攻职业');
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
    mainNode.nodeValue = 'Blooming Eyeglasses ';
    suffixNode.nodeValue = 'Set';
    withGlobals({ location: { pathname: '/gearset/blooming-eyeglasses' } }, () => {
      translateECGearsetNames();
      translateECGearsetNames();
      assert.equal(mainNode.nodeValue + suffixNode.nodeValue, '彩花装饰眼镜',
        '仅含一件已核对装备的目录标题不得追加「套装」');
    });
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

test('EC 发布数据驱动套装检索和饰品详情，不给未知系列造译名', () => {
  const { siteFiles } = readRuntimeV3('ec');
  const page = new TestWindow({ url: 'https://ffxiv.eorzeacollection.com/accessories/occult-deep' });
  dataInvalidate();
  try {
    const document = page.document;
    withGlobals({ document, window: page, location: page.location, NodeFilter: page.NodeFilter }, () => {
      assert.equal(_applyV3({ candidatePolicy: 1, names: siteFiles.names.text }), true);
      _fireTablesReady();
      // 无手工白名单时，由国服物品表推导职能系列，并用站点英文名提交。
      assert.equal(ecGearsetDisplayName('Ceremonial Scouting'), '仪仗游击套装');
      assert.equal(resolveECGearsetSearch('仪仗游击'), 'Ceremonial Scouting');
      assert.equal(ecGearsetDisplayName('Hempen Auri Male'), '敖龙族男性贴身衣套装');
      assert.equal(ecGearsetDisplayName("Eastern Socialite's"), '辨天装束');
      const variants = suggestECGearsetsByZh('冬季').filter(({ native }) => native.startsWith('Wintertide ('));
      assert.deepEqual(new Set(variants.map(({ native }) => native)),
        new Set(['Wintertide (Culottes)', 'Wintertide (Sheath Skirt)']));
      assert.equal(ecGearsetDisplayName('Wintertide (Unverified Variant)'), null);

      document.body.innerHTML = '<h1>Occult Deep <span>Accessories</span></h1>' +
        '<a href="/accessories/occult">Occult Accessories</a>' +
        '<a href="/accessories/sea-folk">Sea-folk Accessories</a>' +
        '<a href="/accessories/praemagitek">Praemagitek Accessories</a>' +
        '<a href="/accessories/unverified">Unverified Accessories</a>';
      translateECGearsetNames();
      assert.equal(document.querySelector('h1').textContent, '超新月魔饰品');
      assert.equal(document.querySelector('h1 span').textContent, '饰品');
      assert.deepEqual([...document.querySelectorAll('a')].map(a => [a.getAttribute('href'), a.textContent]), [
        ['/accessories/occult', '新月魔饰品'],
        ['/accessories/sea-folk', '海族饰品'],
        ['/accessories/praemagitek', '前魔导饰品'],
        ['/accessories/unverified', 'Unverified Accessories'],
      ]);
    });
  } finally {
    dataInvalidate();
    void page.happyDOM.close();
  }
});
