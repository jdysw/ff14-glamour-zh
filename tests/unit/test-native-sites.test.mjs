// 在 V8 LCOV 中执行七站真实模块的翻译/页面行为，不使用字符串执行替身。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML, NodeFilter as DOMNodeFilter} from 'linkedom';
import { bindZhxItemClick, ensureZhxItemStyle } from '../../src/core/item-links.js';
import { trMiramiru, translateMiramiruTitle } from '../../src/sites/miramiru.js';
import { trEden, translateEdenPage, startEden, edenImageKey, indexEdenRecipes, loadEdenRecipes } from '../../src/sites/mirapri-eden.js';

test('Eden 真实适配器：界面、装备、Vue 节点复用和用户内容边界', () => {
  const previous = Object.fromEntries(['document','location','window','NodeFilter','MutationObserver'].map(k=>[k,globalThis[k]]));
  try {
    const {document:doc}=parseHTML('<html><head><title>PopularEquipment | FFXIV Mirapri Eden</title></head><body><div class="input-area"><input type="text"></div><h1>装備ランキング</h1><div class="flex-grow-1">テスト装備</div><a href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/abcdef/"></a><div class="recipe-dialog-text">装備ランキング</div><i class="v-icon">mdi-home</i><div class="v-list-item__title">テスト装備</div></body></html>');
    const input=doc.querySelector('input'),title=doc.querySelector('h1'),name=doc.querySelector('.flex-grow-1'),link=doc.querySelector('a');
    const authored=doc.querySelector('.recipe-dialog-text'),icon=doc.querySelector('i'),option=doc.querySelector('.v-list-item__title');
    globalThis.NodeFilter=DOMNodeFilter;
    globalThis.location={hash:'#/components/popular-equipment'};globalThis.window={__zhxTestSite:'eden'};
    let observer;
    globalThis.MutationObserver=class{constructor(cb){observer=cb;}observe(){}};
    globalThis.document=doc;
    _applyV3({candidatePolicy:1,names:'English Test Gear\t测试装备\t1\t0\nテスト装備\t测试装备\t1\t0',hash:'abcdef\t测试装备'});
    assert.equal(resolveByZh('测试装备'),'テスト装備','多语表中英文行在先时，Eden 搜索仍必须选日文');
    assert.equal(trEden('Equipment Ranking'),'装备排行榜');
    assert.equal(trEden('3個のオブジェクトを揃えました。'),'已对齐 3 个对象。');
    assert.equal(trEden('1-50 of 27418'),'第 1–50 项，共 27418 项');
    assert.equal(trEden('不认识的玩家标题'),'不认识的玩家标题');
    startEden();
    assert.equal(title.textContent,'装备排行榜');assert.equal(name.textContent,'测试装备');
    assert.equal(name.dataset.zhxItem,'测试装备');assert.equal(option.textContent,'测试装备');
    assert.equal(option.dataset.zhxItem,undefined,'原生装备选项不劫持为 Wiki 点击');
    assert.ok(link.getAttribute('href').endsWith(encodeURIComponent('测试装备')));
    assert.equal(input.dataset.zhxEdenSearch,'1');assert.equal(authored.textContent,'装備ランキング');
    assert.equal(icon.textContent,'mdi-home');assert.equal(document.title,'装备排行榜 | FFXIV Mirapri Eden');
    assert.equal(typeof observer,'function');
    name.firstChild.nodeValue='未知新装备';translateEdenPage(name.firstChild);
    assert.equal(name.dataset.zhxItem,undefined,'Vue 复用名称节点不能保留前一件装备的 Wiki 目标');
    translateEdenPage(null);assert.equal(title.textContent,'装备排行榜');
    translateEdenPage(authored);assert.equal(authored.textContent,'装備ランキング');
  } finally {
    _applyV3({candidatePolicy:1});
    for(const[k,v]of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
  }
});

test('Eden 图片投稿数据：精确匹配、异步换图、缺失记录与重试', async () => {
  const previous=Object.fromEntries(['document','location','window','NodeFilter','fetch'].map(k=>[k,globalThis[k]]));
  const a='https://mirapri.ff14eden.work/img/a.jpg',b='https://pbs.twimg.com/media/b.jpg';
  const rows=[{image_urls:[a+'?name=large'],equipments:[{name:'テスト甲',colorNames:['スートブラック']},{name:'テスト甲',colorNames:[]}]},
    {image_urls:[b],equipments:[{name:'テスト乙',colorNames:[]},{name:'<unknown>',colorNames:[]}]},
    {image_urls:['https://example.test/empty.jpg'],equipments:[]}];
  const index=indexEdenRecipes(rows);
  assert.equal(edenImageKey(a+'?name=900x900&format=jpg#photo'),a);
  for(const value of ['',null,'data:image/png;base64,abc','javascript:alert(1)','https://secret:token@example.test/a.jpg'])assert.equal(edenImageKey(value),null);
  assert.equal(index.get(a).length,2,'同名但染色不同的记录不能合并丢失');
  assert.equal(indexEdenRecipes([...rows,{image_urls:[a],equipments:[{name:'别的装备'}]}]).get(a),null);
  assert.throws(()=>indexEdenRecipes({}),/格式/);
  let requests=0,deliver,fail=false;const options=[];
  const {document:doc}=parseHTML('<html><head></head><body><div class="v-dialog v-dialog--active recipe-dialog-content"><div class="recipe-dialog-card"><div class="dialog-image"><div class="v-image__image" id="media"></div></div><div class="recipe-dialog-title-text">装備ランキング</div><div class="recipe-dialog-actions"><button>关闭</button></div></div></div></body></html>');
  const media=doc.querySelector('#media'),dialog=doc.querySelector('.v-dialog');
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  const move=async url=>{media.style.backgroundImage='url("'+url+'")';translateEdenPage();await settle();};
  try {
    Object.assign(globalThis,{document:doc,location:{hash:'#/'},window:{__zhxTestSite:'eden'},NodeFilter:DOMNodeFilter});
    globalThis.fetch=(url,opt)=>{requests++;options.push(opt);if(fail)return Promise.resolve({ok:false,status:503});
      const response={ok:true,json:async()=>rows};return requests===1?new Promise(resolve=>{deliver=()=>resolve(response);}):Promise.resolve(response);};
    _applyV3({candidatePolicy:1,names:'テスト甲\t测试甲\t1\t0\nテスト乙\t测试乙\t1\t0'});
    translateEdenPage();assert.equal(requests,0,'打开空弹窗不能匹配时不下载整份数据');
    await move(a+'?format=png');assert.equal(requests,1);
    await move(b);assert.equal(requests,1,'切换图片共享同一请求');
    dialog.classList.remove('v-dialog--active');deliver();await settle();await settle();
    dialog.classList.add('v-dialog--active');translateEdenPage();await settle();
    let panel=doc.querySelector('.zhx-eden-recipe-items');
    assert.equal(panel.querySelector('a').textContent,'测试乙');assert.ok(!panel.textContent.includes('测试甲'));
    const wiki=new URL(panel.querySelector('a').getAttribute('href'));
    assert.equal(wiki.origin,'https://ff14.huijiwiki.com');assert.equal(decodeURIComponent(wiki.pathname),'/wiki/物品:测试乙');
    assert.ok(panel.textContent.includes('<unknown>'));assert.equal(panel.querySelector('unknown'),null,'未知名称只能作为文本显示');
    await move(a);panel=doc.querySelector('.zhx-eden-recipe-items');
    assert.equal(panel.querySelectorAll('a').length,2);assert.ok(panel.textContent.includes('煤烟黑'));
    assert.equal(doc.querySelectorAll('.zhx-eden-recipe-items').length,1);assert.equal(doc.querySelector('.recipe-dialog-title-text').textContent,'装備ランキング');
    await move('https://example.test/empty.jpg');assert.equal(panel.querySelectorAll('a').length,0);
    assert.match(panel.textContent,/未提供/);assert.equal(requests,1);
    await move('data:image/png;base64,abc');assert.equal(doc.querySelector('.zhx-eden-recipe-items'),null);
    fail=true;await assert.rejects(loadEdenRecipes(true),/503/);await move(b);
    panel=doc.querySelector('.zhx-eden-recipe-items');assert.match(panel.textContent,/无法加载/);
    fail=false;panel.querySelector('button').click();await settle();await settle();
    assert.equal(panel.querySelector('a').textContent,'测试乙');assert.equal(requests,3);
    assert.ok(options.every(opt=>opt.credentials==='omit'));assert.equal(options.at(-1).cache,'reload');
    translateEdenPage();await settle();assert.equal(requests,3);
  } finally {
    _applyV3({candidatePolicy:1});
    for(const[k,v]of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
  }
});

test('Miramiru 三语真实词条：界面、染剂、数量及标题', () => {
  const locales = JSON.parse(fs.readFileSync(new URL('../fixtures/miramiru-locales.json', import.meta.url), 'utf8'));
  for (const row of Object.values(locales)) {
    assert.equal(trMiramiru(row.Filter.filter), '筛选');
    assert.equal(trMiramiru(row.Equipment.title), '装备列表');
    assert.equal(trMiramiru(row.Equipment.noDye), '未染色');
    assert.equal(trMiramiru(row.Equipment.undyeable), '不可染色');
    assert.equal(trMiramiru(row.Filter.keywordPlaceholder), '搜索标题、装备或标签');
    assert.equal(trMiramiru(row.Hero.subtitle), 'FF14 幻化展示');
  }
  for (const raw of ['Chestnut Brown','チェスナットブラウン','밤색']) assert.equal(trMiramiru(raw), '山栗棕');
  for (const raw of ['Other','その他','기타']) assert.equal(trMiramiru(raw), '其他');
  for (const raw of ['15 Glamours','15 ミラプリ','15 투영']) assert.equal(trMiramiru(raw), '15 套幻化');
  assert.equal(trMiramiru('  '), '  ');
  assert.equal(trMiramiru('Unknown player title'), 'Unknown player title');
  const old = globalThis.document;
  try {
    for (const suffix of ['FFXIV Glamour Showcase','FFXIV ミラプリ紹介サイト','FFXIV 투영 소개 사이트']) {
      globalThis.document = {title:'Miramiru - ' + suffix};
      translateMiramiruTitle();
      assert.equal(document.title, 'Miramiru - FF14 幻化展示');
    }
    globalThis.document={title:'Miramiru 소개 | Miramiru'};
    translateMiramiruTitle();
    assert.equal(document.title,'关于 Miramiru | Miramiru');
  } finally { if(old === undefined)delete globalThis.document;else globalThis.document=old; }
});

test('Miramiru 用户可见规则：官方标签、数量、未知名称和原型键', () => {
  assert.equal(trMiramiru('Miramiru Statistics'), 'Miramiru 统计');
  assert.equal(trMiramiru('クール (41) (Official tag)'), '酷帅 (41)（官方标签）');
  assert.equal(trMiramiru('クール (41)', true), '酷帅 (41)');
  assert.equal(trMiramiru('Player tag (2)'), 'Player tag (2)');
  assert.equal(trMiramiru('constructor'), 'constructor');
  assert.equal(trMiramiru('__proto__'), '__proto__');
  assert.equal(trMiramiru('ハイランダー (41)'), '高地之民 (41)');
  assert.equal(trMiramiru('Unknown author (41)'), 'Unknown author (41)');
});

test('Miramiru 筛选真实枚举与全部官方标签：三语文案、数量和选中摘要', () => {
  // Full option rendering and original filter values are exercised in Chrome.
  // Here only formatting and the official/custom-tag distinction are checked.
  assert.equal(trMiramiru('クール（公式タグ）'),'酷帅（官方标签）');
  assert.equal(trMiramiru('#クール',true),'#酷帅');
  assert.equal(trMiramiru('3 posts'),'3 篇投稿');
  assert.equal(trMiramiru('3件'),'3 篇投稿');
  assert.equal(trMiramiru('3건'),'3 篇投稿');
  assert.equal(trMiramiru('Job: Paladin, White Mage'),'职业：骑士、白魔法师');
  assert.equal(trMiramiru('ジョブ: ナイト'),'职业：骑士');
  assert.equal(trMiramiru('직업: 나이트'),'职业：骑士');
  assert.equal(trMiramiru('Tag: 春コーデ'),'标签：春季穿搭');
  assert.equal(trMiramiru('Tag: My custom tag'),'标签：My custom tag');
  assert.equal(trMiramiru('PLD'),'PLD');
});

test('共享物品点击与样式：幂等注册，并保留原生筛选按钮行为', () => {
  const previous = { window: globalThis.window, document: globalThis.document };
  const styles = new Map(), opened = [], handlers = [];
  const appendChild = style => styles.set(style.id, style);
  globalThis.window = { open: (...args) => opened.push(args) };
  globalThis.document = { getElementById: id => styles.get(id), createElement: () => ({}),
    head: { appendChild }, documentElement: { appendChild }, addEventListener: (...args) => handlers.push(args) };
  try {
    ensureZhxItemStyle('shared-style'); ensureZhxItemStyle('shared-style');
    assert.equal(styles.size, 1);
    globalThis.document.head = null; ensureZhxItemStyle('fallback-style');
    assert.equal(styles.size, 2);
    bindZhxItemClick('shared'); bindZhxItemClick('shared'); assert.equal(handlers.length, 1);
    const click = handlers[0][1];
    const item = { dataset: { zhxItem: '女仆礼服' } };
    let prevented = 0, stopped = 0;
    const event = (el, control) => ({ target: { closest: selector => selector === '[data-zhx-item]' ? el : control },
      preventDefault: () => prevented++, stopPropagation: () => stopped++ });
    click({}); click(event(null)); click(event({ dataset: {} }));
    click(event(item, { contains: () => false })); assert.equal(opened.length, 0);
    click(event(item)); click(event(item, item)); click(event(item, { contains: () => true }));
    assert.equal(opened.length, 3); assert.equal(prevented, 3); assert.equal(stopped, 3);
    assert.ok(opened[0][0].endsWith(encodeURIComponent('女仆礼服')));
    assert.equal(opened[0][2], 'noopener');
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
});
import {
  tr, trNode, trEl, translateMirapriTitle,
} from '../../src/sites/mirapri.js';
import {
  _trRonkaPatch, _trRonkaDye, trRonka, trimRonkaNode, markRonkaItem,
} from '../../src/sites/ronka.js';
import {
  _trEndClosetDye, _trEndClosetItem, trEndCloset,
  markEndClosetItem, _ecInput, _ecImgAlt, _ecAcceptNode,
} from '../../src/sites/endcloset.js';
import {
  _trACLSet, _trACLExact, trACL, _trACLLabel, _trACLGearsetAlt, _aclAcceptNode,
} from '../../src/sites/ffxiv-collection.js';
import {
  trFC, trFCSegments, _trFCExact, _trFCDecor, _trFCName, _trFCSubstr,
  _fcCanReplaceAt, _wowFCInput, _trFCAttr, _procFCNode, _fcAcceptNode,
  fcLinkZhName, rewriteFCForeignLink, translateFCTitle, trimFCNode,
} from '../../src/sites/ff14-fc.js';
import { DICT_FC } from '../../src/core/dictionary.js';

import { DICT_ACL } from '../../src/core/dictionary.js';
import {
  m_last, _slotHit, _slotFromList, getSlot, getItemZhName,
  blockByTitle, wikiReverseItems, _buildReverseBlock,
} from '../../src/sites/huiji-wiki.js';
import { _applyV3, resolveByZh } from '../../src/core/data-manager.js';

function element(tagName, initial = {}) {
  const attrs = new Map(Object.entries(initial));
  return {
    nodeType: 1, tagName, dataset: {},
    closest: () => null,
    getAttribute: key => attrs.get(key) ?? null,
    hasAttribute: key => attrs.has(key),
    setAttribute: (key, value) => attrs.set(key, value),
  };
}

test('MIRAPRI 实体翻译：正文、属性、按钮文本及标题保持原站协议', () => {
  assert.equal(tr(''), '');
  assert.equal(tr('     '), '     ');
  assert.equal(tr('Loading...'), '加载中…');
  assert.equal(tr('未知原文'), '未知原文');
  const parent = element('SPAN');
  const node = { nodeType: 3, nodeValue: 'Loading...', parentElement: parent };
  trNode(node);
  assert.equal(node.nodeValue, '加载中…');
  assert.equal(parent.dataset.zhixiaSourceText, 'Loading...');
  const button = element('INPUT', {
    type: 'submit', value: 'Loading...',
    placeholder: '装備品名等を入力', title: 'Loading...',
  });
  trEl(button);
  assert.equal(button.getAttribute('placeholder'), '输入装备名等');
  assert.equal(button.getAttribute('title'), '加载中…');
  assert.equal(button.getAttribute('value'), '加载中…');

  const oldDoc = globalThis.document;
  try {
    globalThis.document = { title: 'FF14ミラプリSS投稿・共有サイト · ミラプリを投稿' };
    translateMirapriTitle();
    assert.equal(document.title, 'FF14 幻化截图投稿 · 分享站 · 发布幻化');
    translateMirapriTitle();
    assert.equal(document.title, 'FF14 幻化截图投稿 · 分享站 · 发布幻化',
      '重复翻译必须保持幂等');
  } finally {
    if (oldDoc === undefined) delete globalThis.document;
    else globalThis.document = oldDoc;
  }
});

test('Ronka 实体翻译：韩文补丁前缀和装备标记', () => {
  const source = '현재 적용된 패치 데이터 버전(KOR): 7.0';
  const target = '当前应用的补丁数据版本(KOR): 7.0';
  assert.equal(_trRonkaPatch(source), target);
  assert.equal(_trRonkaPatch('Unknown'), null);
  assert.equal(_trRonkaDye('没有染剂'), null);
  assert.equal(trRonka(source), target);
  assert.equal(trRonka(''), '');
  assert.equal(trRonka('Unmapped English 123'), 'Unmapped English 123');

  const p = element('P');
  p.parentElement = { classList: { contains: s => s === 'post-item-information' } };
  const node = { nodeValue: '无关', parentElement: p };
  markRonkaItem(node, '测试中文装备');
  assert.equal(p.dataset.zhxItem, '测试中文装备');
  assert.equal(p.getAttribute('title'), '点击查看灰机 wiki 物品页');
  markRonkaItem(node, '测试中文装备');
  trimRonkaNode({ nodeValue: source, parentElement: element('SPAN') });
});

test('End Closet 实体翻译：英文统计、属性和装备标记', () => {
  assert.equal(trEndCloset('Showing 2 of 3 items'), '显示 2 / 共 3 件装备');
  assert.equal(trEndCloset('9 items'), '9 件装备');
  assert.equal(trEndCloset(''), '');
  assert.equal(trEndCloset('No Matching UI Entry'), 'No Matching UI Entry');
  assert.equal(_trEndClosetDye('plain'), null);
  assert.equal(_trEndClosetItem('Unmapped Equipment 12345'), null);
  const node = { parentElement: element('SPAN') };
  markEndClosetItem(node, '已识别国服装备');
  assert.equal(node.parentElement.dataset.zhxItem, '已识别国服装备');
  assert.equal(node.parentElement.getAttribute('title'), '点击查看灰机 wiki 物品页');
  const input = element('INPUT', { placeholder: 'Showing 2 of 3 items' });
  _ecInput(input);
  assert.equal(input.getAttribute('placeholder'), '显示 2 / 共 3 件装备');
  const image = element('IMG', { alt: '9 items', title: 'Showing 2 of 3 items' });
  _ecImgAlt(image);
  assert.equal(image.getAttribute('alt'), '9 件装备');
  assert.equal(image.getAttribute('title'), '显示 2 / 共 3 件装备');

  const old = globalThis.NodeFilter;
  try {
    globalThis.NodeFilter = { FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
    assert.equal(_ecAcceptNode({ nodeType: 3 }), 1);
    assert.equal(_ecAcceptNode(element('SCRIPT')), 2);
  } finally {
    if (old === undefined) delete globalThis.NodeFilter;
    else globalThis.NodeFilter = old;
  }
});

test('FFXIV Collection 实体翻译：词典、套装规则和原生筛选表单标签', () => {
  assert.equal(trACL(''), '');
  const phrase = 'テスト・ディフェンダーアタイアRE';
  const setName = _trACLSet(phrase, phrase);
  assert.ok(setName?.startsWith('改良型'), 'RE 套装必须带改良型前缀');
  assert.ok(setName.endsWith('套装'), '按职能分部翻译后的结果必须是套装');
  assert.equal(_trACLSet('无匹配', '无匹配'), null);
  assert.equal(_trACLGearsetAlt("Unmapped Set's gearset image."), null);
  const had = Object.hasOwn(DICT_ACL, 'COVERAGE_TEST_SENTINEL');
  const old = DICT_ACL.COVERAGE_TEST_SENTINEL;
  try {
    DICT_ACL.COVERAGE_TEST_SENTINEL = '自动化校验词条';
    assert.equal(_trACLExact('  COVERAGE_TEST_SENTINEL  ',
      'COVERAGE_TEST_SENTINEL'), '  自动化校验词条  ');
    assert.equal(trACL('COVERAGE_TEST_SENTINEL'), '自动化校验词条');
  } finally {
    if (had) DICT_ACL.COVERAGE_TEST_SENTINEL = old;
    else delete DICT_ACL.COVERAGE_TEST_SENTINEL;
  }
  const searchFilter = element('BUTTON', { title: 'yes' });
  searchFilter.closest = selector => selector === '#search-menu' ? {} : null;
  _trACLLabel(searchFilter, 'title');
  assert.equal(searchFilter.getAttribute('title'), '是');

  const previous = globalThis.NodeFilter;
  try {
    globalThis.NodeFilter = { FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
    assert.equal(_aclAcceptNode({ nodeType: 3 }), 1);
    assert.equal(_aclAcceptNode(element('SCRIPT')), 2);
  } finally {
    if (previous === undefined) delete globalThis.NodeFilter;
    else globalThis.NodeFilter = previous;
  }
});

test('灰机 Wiki 实体适配：装备 ID、部位筛选和页面标题', () => {
  assert.equal(m_last('https://example.invalid/item/12345'), '12345');
  assert.equal(m_last('https://example.invalid/equipment/12345'), null);
  assert.deepEqual(_slotHit({ textContent: '身体防具' }),
    { key: 'bodyPiece', label: '身体防具' });
  assert.equal(_slotHit({ textContent: '用户简介' }), null);
  assert.deepEqual(_slotFromList([
    { textContent: '未知' }, { textContent: '头部防具' },
  ]), { key: 'headPiece', label: '头部防具' });
  const originalDocument = globalThis.document;
  try {
    const category = { textContent: '耳饰' };
    const translated = { textContent: '物品:虚构的测试装备' };
    const box = {
      nodeType: 1, parentElement: null,
      querySelector: () => ({ textContent: '装备资料' }),
    };
    globalThis.document = {
      querySelector(selector) {
        if (selector.includes('name-category')) return category;
        if (selector.includes('mw-page-title-main')) return translated;
        return null;
      },
      querySelectorAll(selector) {
        if (selector.includes('garlandtools')) return [{ getAttribute: () => 'https://garlandtools.cn/db/#item/38171' }];
        return selector === '.ff14-content-box-block' ? [box] : [];
      },
      createElement(tagName) {
        return { tagName, style: {}, children: [], setAttribute() {},
          appendChild(child) { this.children.push(child); },
          insertBefore(child) { this.children.unshift(child); } };
      },
    };
    assert.deepEqual(getSlot(), { key: 'earringsPiece', label: '耳饰' });
    assert.equal(getItemZhName(), '虚构的测试装备');
    assert.equal(blockByTitle('装备资料'), box);
    assert.equal(blockByTitle('不存在的标题'), null);
    _applyV3({ candidatePolicy: 1, ko: '虚构的测试装备\t테스트 장비 & 이름\n' });
    const reverse = wikiReverseItems();
    assert.ok(reverse.some(([href]) => href === 'https://miramiru.co/en/items/38171'));
    const end = reverse.find(([href]) => href.startsWith('https://end-closet.com/'));
    assert.equal(new URL(end[0]).searchParams.get('search'), '테스트 장비 & 이름');
    const block = _buildReverseBlock(reverse);
    const links = block.children.at(-1).children.map(li => li.children[0]);
    assert.equal(links.length, reverse.length);
    assert.ok(links.every(a => a.children[0].tagName === 'img' && a.children[0].src.startsWith('data:image/png;base64,')));
    globalThis.document.querySelectorAll = () => [];
    _applyV3({ candidatePolicy: 1 });
    assert.ok(!wikiReverseItems().some(([href]) => /miramiru|end-closet/.test(href)),
      '缺少物品 ID 或韩文映射时，不生成无效反查链接');
  } finally {
    _applyV3({ candidatePolicy: 1 });
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('FF14-FC 真正源码路径：复合职能、装饰符、字典和链接重写', () => {
  assert.equal(trFC('🎉インスタンスダンジョン✨'),'🎉副本✨','Decorative emoji must survive translation');
  assert.equal(trFCSegments('不存在'), null);
  assert.equal(trFCSegments('ディフェンダー・ディフェンダー'), '御敌·御敌');
  assert.equal(trFCSegments('ABC・ディフェンダー'), 'ABC·御敌');
  assert.equal(trFCSegments('未知名・ディフェンダー'), null,
    '未知日文区段不应被半翻译导致后续数据加载无法命中');
  assert.equal(_fcCanReplaceAt('ノートゥング', 0, 'ノート'), false,
    '连续片假名中的部分词不能错误替换');
  assert.equal(_fcCanReplaceAt('☆ ノート ☆', 2, 'ノート'), true);
  assert.equal(_trFCName('abcdef', 'abcdef', 'abcdef'), null);
  assert.equal(_trFCSubstr('no', 'no', 'no'), null);
  assert.equal(trFC(''), '');
  const key = 'COVERAGE_FC_TEST_WORD';
  const old = DICT_FC[key];
  const had = Object.hasOwn(DICT_FC, key);
  const oldTitle = DICT_FC['テストカバー'];
  const hadTitle = Object.hasOwn(DICT_FC, 'テストカバー');
  const doc = globalThis.document;
  const filter = globalThis.NodeFilter;
  try {
    DICT_FC[key] = '模拟译文';
    DICT_FC['テストカバー'] = '测试标题';
    assert.equal(_trFCExact(key, key), '模拟译文');
    assert.equal(_trFCDecor('≫' + key + '»', '≫' + key + '»', key), '≫模拟译文»');
    assert.equal(trFC('≪' + key + '»'), '≪模拟译文»');
    assert.equal(trFC(key), '模拟译文');
    const input = element('INPUT', {
      type: 'submit', placeholder: key, value: key,
    });
    _wowFCInput(input);
    assert.equal(input.getAttribute('placeholder'), '模拟译文');
    assert.equal(input.getAttribute('value'), '模拟译文');
    const title = element('A', { title: 'View all posts in ' + key });
    _trFCAttr(title, 'title');
    assert.equal(title.getAttribute('title'), '查看“模拟译文”分类下的全部文章');
    _procFCNode(element('SPAN', { title: key }));
    assert.equal(fcLinkZhName({
      textContent: '精金骑士铠甲', getAttribute: () => '',
    }), '精金骑士铠甲');
    const link = element('A', { href: 'https://external.example/item', target: '_blank' });
    link.textContent = '精金骑士铠甲';
    link.removeAttribute = name => link.setAttribute(name, null);
    rewriteFCForeignLink(link);
    assert.ok(link.getAttribute('href').includes('%E7%B2%BE%E9%87%91'));
    assert.equal(link.dataset.zhixiaFcHref, '1');
    rewriteFCForeignLink(link);
    assert.equal(link.dataset.zhixiaFcHref, '1', '同一节点不能重复包裹');

    globalThis.document = { title: 'テストカバー | テストカバー' };
    translateFCTitle();
    assert.equal(document.title, '测试标题 | 测试标题');
    globalThis.NodeFilter = { FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
    assert.equal(_fcAcceptNode({ nodeType: 3 }), 1);
    assert.equal(_fcAcceptNode(element('SCRIPT')), 2);
    const node = { nodeValue: key, parentElement: element('SPAN') };
    trimFCNode(node);
    assert.equal(node.nodeValue, '模拟译文');
  } finally {
    if (had) DICT_FC[key] = old;
    else delete DICT_FC[key];
    if (hadTitle) DICT_FC['テストカバー'] = oldTitle;
    else delete DICT_FC['テストカバー'];
    if (doc === undefined) delete globalThis.document;
    else globalThis.document = doc;
    if (filter === undefined) delete globalThis.NodeFilter;
    else globalThis.NodeFilter = filter;
  }
});
