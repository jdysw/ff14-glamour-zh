// 在 V8 LCOV 中执行七站真实模块的翻译/页面行为，不使用字符串执行替身。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bindZhxItemClick, ensureZhxItemStyle } from '../../src/core/item-links.js';
import { trMiramiru, translateMiramiruTitle } from '../../src/sites/miramiru.js';
import { trEden, translateEdenPage, startEden } from '../../src/sites/mirapri-eden.js';

test('Eden 真实适配器：界面、装备、Vue 节点复用和用户内容边界', () => {
  const previous = Object.fromEntries(['document','location','window','NodeFilter','MutationObserver'].map(k=>[k,globalThis[k]]));
  const make = (tag, classes = '', attrs = {}, value = '') => {
    const node = {nodeType:1,tagName:tag.toUpperCase(),classes:classes.split(' '),dataset:{},style:{},children:[],parentElement:null,
      get textContent(){return this.children.map(c=>c.nodeType===3?c.nodeValue:c.textContent).join('');},
      set textContent(value){this.children=[{nodeType:3,nodeValue:value,parentElement:this}];},
      getAttribute(k){return attrs[k]??null;},setAttribute(k,v){attrs[k]=v;},
      matches(selector){return selector.split(',').some(s=>{s=s.trim();return s==='input'?tag==='input':s==='a'?tag==='a':s==='.v-data-table td'?tag==='td':s.startsWith('.')&&this.classes.includes(s.slice(1));});},
      closest(selector){for(let p=this;p;p=p.parentElement)if(p.matches(selector))return p;return null;},
      querySelectorAll(selector){return this.children.filter(c=>c.nodeType===1).flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);},
      querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
      appendChild(child){this.children.push(child);child.parentElement=this;return child;},
    };
    if(value)node.appendChild({nodeType:3,nodeValue:value});
    return node;
  };
  try {
    const body=make('body');const head=make('head');const area=body.appendChild(make('div','input-area'));
    const input=area.appendChild(make('input'));input.readOnly=false;input.type='text';
    const title=body.appendChild(make('h1','','','装備ランキング'));
    const name=body.appendChild(make('div','flex-grow-1',{},'テスト装備'));
    const link=body.appendChild(make('a','',{href:'https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/abcdef/'}));
    const authored=body.appendChild(make('div','recipe-dialog-text',{},'装備ランキング'));
    const icon=body.appendChild(make('i','v-icon',{},'mdi-home'));
    const option=body.appendChild(make('div','v-list-item__title',{},'テスト装備'));
    globalThis.NodeFilter={SHOW_ELEMENT:1,SHOW_TEXT:4,FILTER_ACCEPT:1,FILTER_REJECT:2};
    globalThis.location={hash:'#/components/popular-equipment'};globalThis.window={__zhxTestSite:'eden'};
    let observer;
    globalThis.MutationObserver=class{constructor(cb){observer=cb;}observe(){}};
    globalThis.document={body,head,documentElement:body,title:'PopularEquipment | FFXIV Mirapri Eden',
      addEventListener(){},getElementById(){return null;},createElement:tag=>make(tag),
      createTreeWalker(root,mask,filter){const all=[];const visit=n=>{for(const child of n.children||[]){if(filter.acceptNode(child)!==2){all.push(child);visit(child);}}};visit(root);let i=0;return{nextNode(){this.currentNode=all[i++];return!!this.currentNode;}};},
    };
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
    name.children[0].nodeValue='未知新装备';translateEdenPage(name.children[0]);
    assert.equal(name.dataset.zhxItem,undefined,'Vue 复用名称节点不能保留前一件装备的 Wiki 目标');
    translateEdenPage(null);assert.equal(title.textContent,'装备排行榜');
    translateEdenPage(authored);assert.equal(authored.textContent,'装備ランキング');
    document.body=null;translateEdenPage();
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
