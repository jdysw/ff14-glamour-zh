// 在 V8 LCOV 中执行真实站点模块的翻译/页面行为，不使用字符串执行替身。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window as TestWindow} from 'happy-dom';
import { readRuntimeV3 } from '../helpers/v3-cache.mjs';
import { isAuthoredContent } from '../../src/core/content-scope.js';
import { translateECPage } from '../../src/sites/eorzea-collection.js';
import { translateACLPage, translateACLTitle } from '../../src/sites/ffxiv-collection.js';
import { bindZhxItemClick, ensureZhxItemStyle } from '../../src/core/item-links.js';
import { _scanStats } from '../../src/core/dom.js';
import { trMiramiru, translateMiramiruTitle } from '../../src/sites/miramiru.js';
import { trEden, translateEdenPage, startEden, edenImageKey, indexEdenRecipes, loadEdenRecipes } from '../../src/sites/mirapri-eden.js';
import { startXivc, translateXivcPage, trXivc } from '../../src/sites/xivc.js';

function createTestDom(markup) {
  const host=new TestWindow({url:'https://mirapri.ff14eden.work/'});
  host.document.write(markup);
  return host;
}

test('实站回归：候选原名、指南空白与概念卡片标题保持正确边界', () => {
  const previous = Object.fromEntries(['document','location','window','NodeFilter'].map(k=>[k,globalThis[k]]));
  const dom = createTestDom('<div data-zhx-chinese-suggest><button role="option"><span>幻境意象御敌套装</span><span id="native">Phantom Vision Fending</span></button></div><div class="group cursor-pointer"><img alt="Grisly Bear Hood"><div><h3>Grisly Bear Hood</h3><p>2 outfits</p></div></div><p id="equipment">Grisly Bear Hood</p>');
  try {
    globalThis.document=dom.document; globalThis.NodeFilter=dom.NodeFilter;
    globalThis.window=dom; globalThis.location={pathname:'/gearsets'};
    translateECPage();
    assert.equal(dom.document.querySelector('#native').textContent,'Phantom Vision Fending');
    const cardTitle=dom.document.querySelector('h3');
    assert.equal(isAuthoredContent(cardTitle,'endcloset'),true);
    assert.equal(isAuthoredContent(dom.document.querySelector('img'),'endcloset'),true);
    assert.equal(isAuthoredContent(dom.document.querySelector('p'),'endcloset'),false,'穿搭数量仍属于官方界面');
    assert.equal(isAuthoredContent(dom.document.querySelector('#equipment'),'endcloset'),false,'普通装备名称仍可翻译');
    assert.equal(tr('①\u00a0正面全身画像は全身が写っていて、ミラプリが分かりやすいものを選択！'),'① 正面全身图应清晰展示整套幻化！');
    assert.equal(tr('しましょう。\n            また、ミラプリギャラリーサイトとして利用していただきたいため、過度な加工や目立つテキストの配置を行った画像をメインに設定することはお控えください。'),'并请尽量避免将过度修图或添加醒目文字的图片设为主图，以便大家正常欣赏幻化。');
    dom.__zhxTestSite='collection';
    _applyV3({candidatePolicy:1,names:'ブレイズグローリー\t女王之荣光\t1\t0'});
    dom.document.title='ブレイズグローリー | FFXIV WEAPON COLLECTION';
    dom.document.body.innerHTML='<div class="item-panel"><div class="name"><p>両手槍</p></div><div class="description"><p>ブレイズグローリー</p></div><a class="item-link-1" href="http://jp.finalfantasyxiv.com/lodestone/playguide/db/item/76f2f7502ee/"><img></a></div><div class="item-panel"><div class="description"><p>架空の未知武器</p></div><a class="item-link-1" href="http://jp.finalfantasyxiv.com/lodestone/playguide/db/item/unknown/"></a></div>';
    translateACLPage();translateACLTitle();
    const weapon=dom.document.querySelector('.item-panel');
    assert.equal(weapon.querySelector('.description p').dataset.zhxItem,'女王之荣光');
    assert.equal(decodeURIComponent(weapon.querySelector('a').href),'https://ff14.huijiwiki.com/wiki/物品:女王之荣光');
    assert.ok(dom.document.title.startsWith('女王之荣光'));
    assert.ok(dom.document.querySelector('.item-panel:last-child a').href.includes('lodestone'),'未知武器保留原链接');
  } finally {
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
    dom.happyDOM.abort();
  }
});

test('Eden 真实适配器：界面、装备、Vue 节点复用和用户内容边界', async () => {
  const previous = Object.fromEntries(['document','location','window','NodeFilter','MutationObserver'].map(k=>[k,globalThis[k]]));
  let dom;
  try {
    dom=createTestDom('<html><head><title>PopularEquipment | FFXIV Mirapri Eden</title></head><body><div class="input-area"><input type="text"></div><h1>装備ランキング</h1><div class="flex-grow-1">テスト装備</div><a href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/abcdef/"></a><div class="recipe-dialog-text">装備ランキング</div><div class="recipe-dialog-text"><input id="protected-title" placeholder="タイトル（任意）" value="投稿タイトル"></div><div class="zhx-skip"><input id="skipped-title" placeholder="タイトル（任意）" value="保留内容"></div><input id="title" placeholder="タイトル（任意）" value="検索"><textarea id="remarks" placeholder="備考（任意）">玩家输入</textarea><div class="tui-image-editor-menu-crop"><ul class="tui-image-editor-submenu-item"><li class="tie-crop-preset-button"><label>Custom</label></li><li class="tie-crop-button action"><label>Apply</label></li></ul></div><div class="tui-image-editor-menu-rotate"><ul class="tui-image-editor-submenu-item"><li class="tui-image-editor-range-wrap"><label>Range</label></li></ul></div><div class="tui-image-editor-menu-draw"><ul class="tui-image-editor-submenu-item"><li class="tui-image-editor-range-wrap"><label>Range</label></li></ul></div><div class="tui-image-editor-menu-shape"><ul class="tui-image-editor-submenu-item"><li class="tui-image-editor-range-wrap"><label>Stroke</label></li></ul></div><li id="tooltip" tooltip-content="Crop"></li><button class="tui-image-editor-download-btn">Download</button><div class="tui-image-editor-container"><input id="detail" type="button" value="Detail"></div><div class="v-list-item__title">テスト装備</div><i class="v-icon">mdi-home</i></body></html>');
    const doc=dom.document;
    const input=doc.querySelector('input'),title=doc.querySelector('h1'),name=doc.querySelector('.flex-grow-1'),link=doc.querySelector('a');
    const authored=doc.querySelector('.recipe-dialog-text'),icon=doc.querySelector('i'),option=doc.querySelector('.v-list-item__title');
    globalThis.NodeFilter=dom.NodeFilter;
    globalThis.location={hash:'#/components/popular-equipment'};globalThis.window={__zhxTestSite:'eden'};
    let observer;
    globalThis.MutationObserver=class{constructor(cb){observer=cb;}observe(){}};
    globalThis.document=doc;
    _applyV3({candidatePolicy:1,names:'English Test Gear\t测试装备\t1\t0\nテスト装備\t测试装备\t1\t0',hash:'abcdef\t测试装备'});
    assert.equal(resolveByZh('测试装备'),'テスト装備','多语表中英文行在先时，Eden 搜索仍必须选日文');
    _applyV3({candidatePolicy:1});
    assert.equal(resolveByZh('测试装备'),null,'names 缺省时仍可清空上一版名称索引');
    _applyV3({candidatePolicy:1,names:'English Test Gear\t测试装备\t1\t0\nテスト装備\t测试装备\t1\t0',hash:'abcdef\t测试装备'});
    assert.equal(trEden('Equipment Ranking'),'装备排行榜');
    assert.equal(trEden('3個のオブジェクトを揃えました。'),'已对齐 3 个对象。');
    assert.equal(trEden('1-50 of 27418'),'第 1–50 项，共 27418 项');
    assert.equal(trEden('不认识的玩家标题'),'不认识的玩家标题');
    startEden();
    assert.equal(title.textContent,'装备排行榜');assert.equal(name.textContent,'测试装备');
    assert.equal(doc.querySelector('#title').placeholder,'标题（可选）');assert.equal(doc.querySelector('#title').value,'検索','静态提示翻译不能覆盖玩家输入值');
    assert.equal(doc.querySelector('#remarks').placeholder,'备注（可选）');assert.equal(doc.querySelector('#remarks').value,'玩家输入','多行输入值保持原样');
    assert.equal(doc.querySelector('#protected-title').placeholder,'タイトル（任意）','投稿内容中的输入属性仍受保护');
    assert.equal(doc.querySelector('#skipped-title').placeholder,'タイトル（任意）','显式跳过子树保持原样');
    assert.equal(doc.querySelector('.tie-crop-preset-button label').textContent,'自定义');
    assert.equal(doc.querySelector('.tie-crop-button label').textContent,'应用');
    assert.equal(doc.querySelector('.tui-image-editor-menu-rotate .tui-image-editor-range-wrap label').textContent,'角度');
    assert.equal(doc.querySelector('.tui-image-editor-menu-draw .tui-image-editor-range-wrap label').textContent,'线宽');
    assert.equal(doc.querySelector('.tui-image-editor-menu-shape .tui-image-editor-range-wrap label').textContent,'描边宽度');
    assert.equal(doc.querySelector('.tui-image-editor-download-btn').textContent,'下载');
    assert.equal(doc.querySelector('#tooltip').getAttribute('tooltip-content'),'裁剪');
    assert.equal(doc.querySelector('#detail').value,'详细','只翻译图编固定的 input button 标签');
    assert.equal(name.dataset.zhxItem,'测试装备');assert.equal(option.textContent,'测试装备');
    assert.equal(option.dataset.zhxItem,undefined,'原生装备选项不劫持为 Wiki 点击');
    assert.ok(link.getAttribute('href').endsWith(encodeURIComponent('测试装备')));
    link.removeAttribute('href');translateEdenPage(link);
    assert.equal(link.dataset.zhxItem,undefined,'复用锚点移除 href 后清理旧装备目标');
    link.setAttribute('href','https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/abcdef/');
    translateEdenPage(link);
    assert.ok(link.getAttribute('href').endsWith(encodeURIComponent('测试装备')));
    assert.equal(input.dataset.zhxEdenSearch,'1');assert.equal(authored.textContent,'装備ランキング');
    assert.equal(icon.textContent,'mdi-home');assert.equal(document.title,'装备排行榜 | FFXIV Mirapri Eden');
    assert.equal(typeof observer,'function');
    const added=doc.createElement('div'),child=doc.createElement('div'),dynamicInput=doc.createElement('input'),dynamicEditor=doc.createElement('div');child.className='v-list-item__title';child.textContent='placeholder';
    dynamicInput.value='編集中のタイトル';dynamicEditor.className='tui-image-editor-container tui-image-editor-menu-shape';dynamicEditor.setAttribute('tooltip-content','Shape');dynamicEditor.innerHTML='<ul class="tui-image-editor-submenu-item"><li class="tie-shape-button"><label>Circle</label></li></ul><input type="button" value="Detail">';
    added.append(child,dynamicInput,dynamicEditor);doc.body.appendChild(added);child.firstChild.nodeValue='テスト装備';
    const beforeLocal=_scanStats.local;
    observer([
      {type:'childList',addedNodes:[added]},
      {type:'characterData',target:child.firstChild},
    ]);
    await new Promise(resolve=>setTimeout(resolve,150));
    assert.equal(child.textContent,'测试装备','混合变更批次仍翻译新增子树中的装备文本');
    assert.equal(dynamicEditor.querySelector('label').textContent,'圆形','动态插入的真实 TUI 子菜单结构也翻译');
    assert.equal(dynamicEditor.getAttribute('tooltip-content'),'形状','动态插入的工具提示属性也翻译');
    assert.equal(dynamicEditor.querySelector('input[type=button]').value,'详细','动态插入的固定图编按钮值也翻译');
    assert.equal(_scanStats.local,beforeLocal+1,'同批父树新增与后代文本变更只扫描一次局部子树');
    dynamicEditor.setAttribute('tooltip-content','Rotate');
    observer([{type:'attributes',attributeName:'tooltip-content',target:dynamicEditor}]);
    await new Promise(resolve=>setTimeout(resolve,150));
    assert.equal(dynamicEditor.getAttribute('tooltip-content'),'旋转','工具切换时观察 tooltip-content 属性');
    dynamicInput.setAttribute('placeholder','タイトル（任意）');
    observer([{type:'attributes',attributeName:'placeholder',target:dynamicInput}]);
    await new Promise(resolve=>setTimeout(resolve,150));
    assert.equal(dynamicInput.placeholder,'标题（可选）','动态提示属性变化后重用同一局部扫描处理');
    assert.equal(dynamicInput.value,'編集中のタイトル','动态提示更新不能覆盖用户输入');
    name.firstChild.nodeValue='未知新装备';translateEdenPage(name.firstChild);
    assert.equal(name.dataset.zhxItem,undefined,'Vue 复用名称节点不能保留前一件装备的 Wiki 目标');
    translateEdenPage(null);assert.equal(title.textContent,'装备排行榜');
    translateEdenPage(authored);assert.equal(authored.textContent,'装備ランキング');
  } finally {
    await dom?.happyDOM.abort();
    _applyV3({candidatePolicy:1});
    for(const[k,v]of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
  }
});

test('Eden 图片投稿数据：精确匹配、异步换图、缺失记录与重试', async () => {
  const previous=Object.fromEntries(['document','location','window','NodeFilter','fetch'].map(k=>[k,globalThis[k]]));
  const a='https://mirapri.ff14eden.work/img/a.jpg',b='https://pbs.twimg.com/media/b.jpg';
  const rows=[{image_urls:[a+'?name=large'],equipments:[{name:'テスト甲',colorNames:['スートブラック']},{name:'テスト甲',colorNames:[]},{name:'テスト甲',colorNames:['スートブラック']}]},
    {image_urls:[b],equipments:[{name:'テスト乙',colorNames:[]},{name:'<unknown>',colorNames:[]}]},
    {image_urls:['https://example.test/empty.jpg'],equipments:[]}];
  const index=indexEdenRecipes(rows);
  assert.equal(edenImageKey(a+'?name=900x900&format=jpg#photo'),a);
  for(const value of ['',null,'data:image/png;base64,abc','javascript:alert(1)','https://secret:token@example.test/a.jpg'])assert.equal(edenImageKey(value),null);
  assert.equal(index.get(a).length,2,'同名但染色不同的记录不能合并丢失');
  assert.equal(indexEdenRecipes([...rows,{image_urls:[a],equipments:[{name:'别的装备'}]}]).get(a),null);
  assert.throws(()=>indexEdenRecipes({}),/格式/);
  let requests=0,deliver,fail=false;const options=[];
  const dom=createTestDom('<html><head></head><body><div class="v-dialog v-dialog--active recipe-dialog-content"><div class="recipe-dialog-card"><div class="dialog-image"><div class="v-image__image" id="media"></div></div><div class="recipe-dialog-title-text">装備ランキング</div><div class="recipe-dialog-actions"><button>关闭</button></div></div></div></body></html>');
  const doc=dom.document;
  const media=doc.querySelector('#media'),dialog=doc.querySelector('.v-dialog');
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  const move=async url=>{media.style.backgroundImage='url("'+url+'")';translateEdenPage();await settle();};
  try {
    Object.assign(globalThis,{document:doc,location:{hash:'#/'},window:{__zhxTestSite:'eden'},NodeFilter:dom.NodeFilter});
    globalThis.fetch=(url,opt)=>{requests++;options.push(opt);if(fail)return Promise.resolve({ok:false,status:503});
      const response={ok:true,json:async()=>rows};return requests===1?new Promise(resolve=>{deliver=()=>resolve(response);}):Promise.resolve(response);};
    _applyV3({candidatePolicy:1,names:'テスト甲\t测试甲\t1\t0\nテスト乙\t测试乙\t1\t0\nカララント:スートブラック\t煤烟黑染剂\t0\t5'});
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
    await dom.happyDOM.abort();
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
  assert.equal(trMiramiru('Weaver'), '裁衣匠');
  assert.equal(trMiramiru('재봉사'), '裁衣匠');
  assert.equal(trMiramiru('Miqo’te'), '猫魅族');
  assert.equal(trMiramiru('Rava'), '密林之民');
  assert.equal(trMiramiru('황금의 유산'), '金曦之遗辉');
  assert.equal(trMiramiru('キャスター'), '远程魔法输出');
  const { siteFiles } = readRuntimeV3('miramiru');
  assert.ok(_applyV3({candidatePolicy:1,names:siteFiles.names.text}));
  try {
    for (const raw of ['Chestnut Brown','チェスナットブラウン','밤색']) assert.equal(trMiramiru(raw), '山栗棕');
    for (const raw of ['General-purpose Jet Black','ジェットブラック','칠흑색']) assert.equal(trMiramiru(raw), '煤玉黑');
    for (const raw of ['Jet Black','ジェットブラックEX','칠흑색(거래 불가)']) assert.equal(trMiramiru(raw), '特制煤玉黑');
  } finally {
    _applyV3({candidatePolicy:1});
  }
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
  aclStandaloneSetName, trimACLNode,
} from '../../src/sites/ffxiv-collection.js';
import {
  trFC, trFCSegments, _trFCExact, _trFCDecor, _trFCName, _trFCSubstr,
  _fcCanReplaceAt, _wowFCInput, _trFCAttr, _procFCNode, _fcAcceptNode,
  fcLinkZhName, rewriteFCForeignLink, translateFCTitle, trimFCNode, fcSetDisplayText, fcGaroSetName, fcStarterOutfitName, fcVerifiedSetName, collapseFCHomeHeadings, fixFCMenu,
} from '../../src/sites/ff14-fc.js';
import { DICT_FC } from '../../src/core/data/dictionary.js';
import { cacheReset } from '../../src/core/cache-primitives.js';
import { _getSeriesMap } from '../../src/core/cache.js';

import { DICT_ACL } from '../../src/core/data/dictionary.js';
import {
  m_last, _slotHit, _slotFromList, getSlot, getItemZhName,
  blockByTitle, wikiReverseItems, _buildReverseBlock, injectWikiButton,
} from '../../src/sites/huiji-wiki.js';
import { _applyV3, resolveByName, resolveByZh, itemById, findItemsByName, suggestByZh } from '../../src/core/data/data-manager.js';
import { parseItemIds } from '../../src/core/data/item-identity.js';
import { itemNames } from '../../src/core/item-languages.js';

test('同名物品按 ID 分别反查，染剂可按普通和特制原名查询', () => {
  const data = [
    'en\tja\tko',
    '1001\t同名装备\tFirst Coat\t共通装備\t첫 장비\t1\t1',
    '1002\t同名装备\tSecond Coat\t共通装備\t두번째 장비\t1\t1',
    '1003\t煤玉黑染剂\tGeneral-purpose Jet Black Dye\tカララント:ジェットブラック\t염료: 칠흑색\t0\t5',
    '1004\t特制煤玉黑染剂\tJet Black Dye\tカララント:ジェットブラックEX\t염료: 칠흑색(거래 불가)\t0\t5',
  ].join('\n');
  const parsed = parseItemIds(data);
  assert.ok(parsed);
  assert.equal(parseItemIds(data + '\n1001\t重复\tA\tB\tC\t1\t1'), null);
  assert.ok(_applyV3({ candidatePolicy: 1, identity: parsed }));
  try {
    assert.equal(itemById(1002).names.ko, '두번째 장비');
    assert.deepEqual(findItemsByName('共通装備', 'ja').map(row => row.id), [1001, 1002]);
    assert.deepEqual(suggestByZh('同名装备', 0, 1, 'en').map(row => [row.itemId, row.native]),
      [[1001, 'First Coat'], [1002, 'Second Coat']]);
    assert.deepEqual(suggestByZh('同名装备', 0, 1, 'ja').map(row => row.itemId), [1001, 1002]);
    assert.deepEqual(itemNames('同名装备'), {});
    assert.equal(itemNames('同名装备', 1002).en, 'Second Coat');
    assert.equal(findItemsByName('ジェットブラック', 'ja')[0].id, 1003);
    assert.equal(findItemsByName('칠흑색(거래불가)', 'ko')[0].id, 1004);
    assert.equal(itemById(1004).names.en, 'Jet Black Dye');
  } finally {
    _applyV3({ candidatePolicy: 1 });
  }
});

test('xivc 真实 DOM 适配：固定界面、装备与染色搜索隔离、预设和试穿行为', { skip: 'xivc 支持暂时停用' }, async () => {
  const previous = Object.fromEntries(['document','location','window','NodeFilter','MutationObserver','setTimeout','clearTimeout']
    .map(key=>[key,globalThis[key]]));
  const dom = createTestDom('<html><head></head><body><div id="app">'
    + '<div id="top-left-controls"><button id="freecam-button" title="Toggle WASD freecam">Freecam</button></div>'
    + '<div id="drawer"><div id="drawer-tabs"><button>Equipment</button><button>Saved</button></div>'
    + '<div id="slot-list"><div class="slot-row"><div class="slot-name">Head</div><div class="slot-item">English Test Gear</div></div>'
    + '<div class="slot-row"><div class="slot-name">Body</div><div class="slot-item">Empty</div></div>'
    + '<div class="slot-row"><div class="slot-name">Gender</div><div class="slot-item">Male</div></div></div>'
    + '<div id="item-grid"><div class="item-card unequip-card"><div class="item-card-name">Unequip</div></div>'
    + '<div class="item-card"><canvas></canvas><div class="item-card-name">English Test Gear</div></div>'
    + '<div class="item-card"><div class="item-card-name">Unknown Gear</div></div></div>'
    + '<div id="tab-customization"><label><input type="checkbox"> Male</label></div>'
    + '<div id="tab-scene"><h3>Background</h3><button id="scene-reset">Reset scene</button>'
    + '<span id="spaced-static">  Reset scene  </span></div>'
    + '<div id="tab-saved"><div class="preset-name">English Test Gear</div><input id="import-file-input" value="玩家自填"></div>'
    + '<input id="item-search" placeholder="Search equipment..." title="Words match in any order. Use &quot;quotes&quot; for an exact phrase and -word to exclude." value="玩家输入"></div>'
    + '<div id="fps">60 FPS</div></body></html>');
  const roots = [];
  let timers = [];
  try {
    globalThis.document = dom.document;
    globalThis.location = dom.location;
    globalThis.window = { __zhxTestSite: 'xivc' };
    globalThis.NodeFilter = dom.NodeFilter;
    globalThis.MutationObserver = class {
      constructor(callback) { this.callback = callback; }
      observe(root) { roots.push({ root, callback: this.callback }); }
      disconnect() {}
    };
    globalThis.setTimeout = callback => { timers.push(callback); return timers.length; };
    globalThis.clearTimeout = () => {};
    _applyV3({ candidatePolicy:1, names:'English Test Gear\t测试装备\t1\t0\nSecond Test Gear\t第二件装备\t1\t0' });
    assert.equal(resolveByName('Second Test Gear'), '第二件装备');
    assert.equal(resolveByName('English Test Gear'), '测试装备');
    assert.equal(trXivc('Search equipment...'), '搜索装备……');
    let picks = 0;
    const card = dom.document.querySelector('#item-grid .item-card:not(.unequip-card)');
    card.addEventListener('click', () => picks++);
    startXivc();
    assert.equal(dom.document.querySelector('#drawer-tabs button').textContent, '装备');
    assert.equal(dom.document.querySelector('#freecam-button').textContent, '自由视角');
    assert.equal(dom.document.querySelector('#freecam-button').title, '切换 WASD 自由视角');
    assert.equal(dom.document.querySelector('#spaced-static').textContent, '  重置场景  ', '静态翻译保留首尾空白');
    assert.equal(dom.document.querySelector('#item-search').placeholder, '搜索装备……');
    assert.equal(dom.document.querySelector('#item-search').title, '关键词可按任意顺序匹配。用引号搜索完整词组，用 -词 排除关键词。');
    assert.equal(dom.document.querySelector('#item-search').value, '玩家输入', '搜索框值必须保留');
    assert.equal(dom.document.querySelector('#item-search').dataset.zhxXivcSearch, '1');
    assert.equal(dom.document.querySelector('#item-grid .item-card:nth-child(2) .item-card-name')
      .querySelector('.zhx-xivc-name').textContent, '测试装备');
    assert.equal(dom.document.querySelector('#item-grid .item-card:nth-child(3) .item-card-name').textContent, 'Unknown Gear');
    assert.equal(dom.document.querySelector('#item-grid .item-card:nth-child(3) .zhx-xivc-wiki'), null,
      '未知装备名称不能猜 Wiki 链接');
    assert.match(dom.document.querySelector('#slot-list .slot-item').textContent, /^测试装备Wiki$/);
    assert.equal(decodeURIComponent(dom.document.querySelector('#slot-list .slot-item .zhx-xivc-wiki')?.getAttribute('href')),
      'https://ff14.huijiwiki.com/wiki/物品:测试装备');
    assert.equal(dom.document.querySelectorAll('#slot-list .slot-item .zhx-xivc-wiki').length, 1,
      '空槽不生成 Wiki 链接');
    assert.equal(dom.document.querySelector('#slot-list .slot-row:last-child .slot-item').textContent, '男性',
      '非装备槽位只翻译常见选项文字');
    assert.equal(dom.document.querySelector('#slot-list .slot-row:last-child .zhx-xivc-wiki'), null,
      '非装备槽位不得猜装备 Wiki');
    const slotItem = dom.document.querySelector('#slot-list .slot-item');
    slotItem.textContent = 'Unknown Gear';
    translateXivcPage(slotItem);
    assert.equal(slotItem.querySelector('.zhx-xivc-wiki'), null,
      '槽位节点复用为未知装备时清除旧 Wiki 目标');
    slotItem.textContent = 'English Test Gear';
    translateXivcPage(slotItem);
    assert.equal(decodeURIComponent(slotItem.querySelector('.zhx-xivc-wiki')?.getAttribute('href')),
      'https://ff14.huijiwiki.com/wiki/物品:测试装备', '槽位节点复用后更新 Wiki 目标');
    assert.equal(dom.document.querySelector('#tab-saved .preset-name').textContent, 'English Test Gear',
      '预设名称保持原样');
    assert.equal(dom.document.querySelector('#tab-saved input').value, '玩家自填', '输入值保持原样');
    assert.equal(dom.document.querySelector('#fps').textContent, '60 FPS', 'FPS 指示不参与汉化扫描');
    card.querySelector('.zhx-xivc-name').dispatchEvent(new dom.window.MouseEvent('click', { bubbles:true }));
    assert.equal(picks, 1, '汉化装备名称仍触发原生选取');
    card.querySelector('.zhx-xivc-wiki').dispatchEvent(new dom.window.MouseEvent('click', { bubbles:true, cancelable:true }));
    assert.equal(picks, 1, '独立 Wiki 入口不会触发原生试穿');

    const gearName = card.querySelector('.item-card-name');
    gearName.textContent = 'Second Test Gear';
    translateXivcPage(gearName);
    assert.equal(gearName.querySelector('.zhx-xivc-name')?.textContent, '第二件装备',
      '复用装备卡后显示新装备名而不保留旧名');
    assert.equal(decodeURIComponent(card.querySelector('.zhx-xivc-wiki')?.getAttribute('href')),
      'https://ff14.huijiwiki.com/wiki/物品:第二件装备', '复用卡片时 Wiki 目标跟随新装备');
    gearName.textContent = 'Unknown Gear';
    translateXivcPage(gearName);
    assert.equal(gearName.textContent, 'Unknown Gear', '未知复用名称保持站点原文');
    assert.equal(card.querySelector('.zhx-xivc-wiki'), null, '未知复用名称清除旧 Wiki 目标');
    gearName.innerHTML = 'English <mark>Test Gear</mark>';
    translateXivcPage(gearName);
    assert.equal(gearName.querySelector('.zhx-xivc-name')?.textContent, '测试装备',
      '已翻译节点追加 direct text 与 mark 后从完整原名重新解析');
    assert.equal(decodeURIComponent(card.querySelector('.zhx-xivc-wiki')?.getAttribute('href')),
      'https://ff14.huijiwiki.com/wiki/物品:测试装备');
    gearName.innerHTML = 'Second <mark>Test Gear</mark>';
    translateXivcPage(gearName);
    assert.equal(gearName.querySelector('.zhx-xivc-name')?.textContent, '第二件装备',
      'Vue 复用标记文本后更新为另一已知装备');
    gearName.innerHTML = 'Unknown <mark>Gear</mark><button type="button">Action</button>';
    translateXivcPage(gearName);
    assert.equal(gearName.querySelector('mark')?.textContent, 'Gear', '未知高亮名保留原始 mark');
    assert.ok(gearName.querySelector('button'), '未知名称的原站按钮子节点不能被清除');
    assert.equal(card.querySelector('.zhx-xivc-wiki'), null, '未知高亮名清除旧 Wiki 目标');

    const drawerObserver = roots.find(entry => entry.root.id === 'drawer');
    assert.ok(drawerObserver, '仅观察装备和设置侧栏，视口动画更新不触发扫描');
    assert.ok(roots.every(entry => entry.root.id !== 'app' && entry.root !== dom.document.documentElement));

    const searchInput = dom.document.querySelector('#item-search');
    searchInput.setAttribute('placeholder', 'Search equipment...');
    drawerObserver.callback([{ type:'attributes', attributeName:'placeholder', target:searchInput }]);
    timers.shift()();
    assert.equal(searchInput.dataset.zhxXivcSearch, '1',
      '单独更新搜索提示属性时仍保留装备模式中文候选标记');

    const grid = dom.document.getElementById('item-grid');
    grid.innerHTML = '<div class="item-card unequip-card"><div class="item-card-name">Back</div></div>'
      + '<div class="item-card unequip-card"><div class="item-card-name">No Dye</div></div>'
      + '<div class="item-card"><div class="item-thumb"></div><div class="item-card-name">Soot Black</div></div>';
    translateXivcPage(grid);
    assert.equal(dom.document.querySelector('#item-search').dataset.zhxXivcSearch, undefined,
      '共享装备筛选框切到染色时撤销中文装备搜索标记');
    assert.equal(dom.document.querySelectorAll('#item-grid .zhx-xivc-wiki').length, 0,
      '染剂卡和染色操作卡都不生成装备 Wiki 链接');
    assert.deepEqual([...dom.document.querySelectorAll('#item-grid .unequip-card .item-card-name')]
      .map(name => name.textContent), ['返回', '不染色'], '染色控制卡文案正确翻译');
    assert.equal(dom.document.querySelector('#item-grid .item-card:last-child .item-card-name').textContent, '煤烟黑',
      '染剂卡只使用精确染色词条翻译');
    assert.equal(dom.document.querySelector('#item-grid .item-card:last-child .zhx-xivc-wiki'), null,
      '煤烟黑作为染剂时不链接到同名物品');
    grid.innerHTML = '<div class="item-card unequip-card"><div class="item-card-name">Unequip</div></div>'
      + '<div class="item-card"><canvas></canvas><div class="item-card-name">English Test Gear</div></div>';
    translateXivcPage(grid);
    assert.equal(dom.document.querySelector('#item-search').dataset.zhxXivcSearch, '1',
      '切回装备模式后恢复中文装备搜索标记');
    assert.ok(dom.document.querySelector('#item-grid .zhx-xivc-wiki'), '切回装备模式后恢复已知装备链接');
    assert.equal(dom.document.querySelector('#item-grid .unequip-card .item-card-name').textContent,
      '卸下', '装备模式控制卡保留卸下语义');
    const dynamicCard = dom.document.createElement('div');
    dynamicCard.className = 'item-card';
    dynamicCard.innerHTML = '<div class="item-card-name">English Test Gear</div>';
    dom.document.getElementById('item-grid').appendChild(dynamicCard);
    const dynamicText = dynamicCard.querySelector('.item-card-name').firstChild;
    drawerObserver.callback([{ type:'childList', addedNodes:[dynamicText] }]);
    timers.shift()();
    assert.equal(dynamicCard.querySelector('.zhx-xivc-name').textContent, '测试装备',
      '新加入的装备卡沿同一局部扫描路径翻译');
    assert.ok(dynamicCard.querySelector('.zhx-xivc-wiki'));
    timers = [];
    const characterText = dom.document.createTextNode('');
    dynamicCard.querySelector('.item-card-name').appendChild(characterText);
    characterText.nodeValue = 'Second Test Gear';
    drawerObserver.callback([{ type:'characterData', target:characterText }]);
    timers.shift()();
    assert.equal(dynamicCard.querySelector('.zhx-xivc-name')?.textContent, '第二件装备',
      '纯 characterData 更新触发装备名与 Wiki 目标同步');
    assert.equal(decodeURIComponent(dynamicCard.querySelector('.zhx-xivc-wiki')?.getAttribute('href')),
      'https://ff14.huijiwiki.com/wiki/物品:第二件装备');
    const textAddedCard = dom.document.createElement('div');
    textAddedCard.className = 'item-card';
    textAddedCard.innerHTML = '<div class="item-card-name">Second Test Gear</div>';
    dom.document.getElementById('item-grid').appendChild(textAddedCard);
    const addedText = textAddedCard.querySelector('.item-card-name').firstChild;
    drawerObserver.callback([{ type:'childList', addedNodes:[addedText] }]);
    timers.shift()();
    assert.equal(textAddedCard.querySelector('.zhx-xivc-name')?.textContent, '第二件装备',
      '单独加入的装备名称文本节点也走局部翻译');
  } finally {
    timers = [];
    await dom.happyDOM.abort();
    _applyV3({ candidatePolicy:1 });
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});

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

  const authored = element('H2');
  authored.closest = selector => selector.includes('#gallery article') ? {} : null;
  const authoredTitle = { nodeType: 3, nodeValue: '侍', parentElement: authored };
  trNode(authoredTitle);
  assert.equal(authoredTitle.nodeValue, '侍');

  const input = element('INPUT', { type: 'text', value: 'Loading...' });
  trEl(input);
  assert.equal(input.getAttribute('value'), 'Loading...');

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

test('FFXIV Collection：只在套装标题补后缀，物品名称与系列词库保持原样', () => {
  const previousDoc = globalThis.document;
  try {
    assert.equal(_applyV3({
      candidatePolicy: 1,
      names: '見本・アタイア\t正式示例装束\t1\t0',
      series: 'フリースピリッツ|自由之魂\nヘヴンスナイト|苍穹骑士\n見本|示例',
    }), true);
    cacheReset('derived');
    cacheReset('lookup');
    assert.equal(aclStandaloneSetName('フリースピリッツ・アタイア'), '自由之魂套装');
    assert.equal(aclStandaloneSetName('ヘヴンスナイト・アーマー'), '苍穹骑士套装');
    assert.equal(aclStandaloneSetName('見本・アタイア'), '正式示例装束',
      '官方套装道具名优先于系列的通用后缀');
    assert.equal(aclStandaloneSetName('未知系列・アタイア'), null,
      '未核对译名的系列不能猜造中文');
    assert.equal(aclStandaloneSetName('フリースピリッツ・ハット'), null,
      '不将单件帽子识别为套装');
    assert.equal(trACL('フリースピリッツ・アタイア'), 'フリースピリッツ・アタイア',
      '普通装备名翻译链不能因为展示规则而改写');

    const heading = {
      nodeValue: 'フリースピリッツ・アタイア',
      parentElement: { closest: selector => selector.includes('h1,h2,h3') ? {} : null },
    };
    trimACLNode(heading);
    assert.equal(heading.nodeValue, '自由之魂套装');
    trimACLNode(heading);
    assert.equal(heading.nodeValue, '自由之魂套装', '二次扫描不可追加第二次套装');

    const piece = {
      nodeValue: 'フリースピリッツ・アタイア',
      parentElement: { closest: () => null },
    };
    trimACLNode(piece);
    assert.equal(piece.nodeValue, 'フリースピリッツ・アタイア',
      '单件装备描述区域不得被套装标题规则污染');
    assert.equal(_trACLGearsetAlt("フリースピリッツ・アタイア's gearset image."),
      '自由之魂套装的装备展示图');
    globalThis.document = { title: 'フリースピリッツ・アタイア ｜ FFXIV ARMOURY COLLECTION' };
    translateACLTitle();
    assert.equal(globalThis.document.title, '自由之魂套装 ｜ FFXIV ARMOURY COLLECTION');
  } finally {
    _applyV3({candidatePolicy: 1});
    cacheReset('derived');
    cacheReset('lookup');
    if (previousDoc === undefined) delete globalThis.document;
    else globalThis.document = previousDoc;
  }
});

test('FFXIV Collection 实体翻译：词典、套装规则和原生筛选表单标签', () => {
  assert.equal(trACL(''), '');
  assert.equal(trACL('漆黒のヴィランズ'), '暗影之逆焰');
  assert.equal(trACL('キャスター'), '咏咒');
  assert.equal(trACL('ロスト'), 'ロスト');
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

test('灰机 Wiki 面部配饰：解锁道具反查 EC 面饰详情', async () => {
  const originalDocument = globalThis.document;
  const dom = createTestDom(`
    <h1 id="firstHeading"><span class="mw-page-title-main">面部配饰：窄框眼镜</span></h1>
    <div class="infobox"><div class="infobox-item--name-category">杂货</div></div>
    <div class="ff14-content-box-block">
      <div class="ff14-content-box-block--title">其他站点链接</div>
      <ul><li><a href="https://ff14risingstones.web.sdo.com/pc/index.html#/search?equipmentid=45006">光之收藏家</a></li></ul>
    </div>
  `);
  try {
    globalThis.document = dom.document;
    injectWikiButton();
    injectWikiButton();
    assert.equal(document.querySelectorAll('.zhixia-reverse-block').length, 1);
    const links = [...document.querySelectorAll('.zhixia-reverse-block a')].map(a => a.href);
    assert.deepEqual(links, ['https://ffxiv.eorzeacollection.com/facewear/slim-frame-glasses']);
    assert.ok(blockByTitle('数据库链接').querySelector('a[href*="equipmentid=45006"]'));

    document.querySelector('.mw-page-title-main').textContent = '面部配饰：暂无站点收录';
    injectWikiButton();
    assert.equal(document.querySelector('.zhixia-reverse-block'), null);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    await dom.happyDOM.close();
  }
});

test('灰机 Wiki 重排外链：人偶兵装原生条目随反查区块重建保留', async () => {
  const originalDocument = globalThis.document;
  const dom = createTestDom(`
    <h1 id="firstHeading">物品:雪崩斗手上衣</h1>
    <div class="infobox"><div class="infobox-item--name-category">身体防具</div></div>
    <div class="ff14-content-box-block">
      <div class="ff14-content-box-block--title">其他站点链接</div>
      <ul>
        <li><a href="https://garlandtools.cn/db/#item/52323">Garland Data</a></li>
        <li><a href="https://ff14risingstones.web.sdo.com/pc/index.html#/search?equipmentid=52323">光之收藏家</a></li>
        <li id="android">
          <a href="https://ff14android.huijiwiki.com/wiki/Item:52323"><img alt="Icon ff14android.png"></a>
          <a href="https://ff14android.huijiwiki.com/wiki/Item:52323">人偶兵装使用说明书</a>
        </li>
      </ul>
    </div>
  `);
  try {
    globalThis.document = dom.document;
    const android = document.querySelector('#android');
    injectWikiButton();
    injectWikiButton();
    const database = blockByTitle('数据库链接');
    const reverse = blockByTitle('幻化反查链接');
    assert.equal(database.nextElementSibling, reverse);
    assert.deepEqual([...database.querySelectorAll('li')].map(li => li.textContent), ['Garland Data']);
    const [starlight, moved] = reverse.querySelectorAll('li');
    assert.equal(starlight.textContent, '光之收藏家');
    assert.equal(moved, android);
    assert.equal(moved.querySelectorAll('a').length, 2);
    assert.equal(moved.querySelector('a.external, a:last-child').href, 'https://ff14android.huijiwiki.com/wiki/Item:52323');
    assert.equal(document.querySelectorAll('.zhixia-reverse-block').length, 1);

    document.querySelector('.infobox-item--name-category').textContent = '套装';
    injectWikiButton();
    assert.deepEqual([...blockByTitle('幻化反查链接').querySelectorAll('li')], [android]);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    await dom.happyDOM.close();
  }
});

test('灰机 Wiki 鸟甲：按 EC 目录编号和部位生成反查', async () => {
  const originalDocument = globalThis.document;
  const dom = createTestDom(`
    <h1 id="firstHeading"><span class="mw-page-title-main">海岛开拓者装甲</span></h1>
    <div class="infobox"><div class="infobox-item--name-category">杂货</div></div>
  `);
  try {
    globalThis.document = dom.document;
    const title = document.querySelector('.mw-page-title-main');
    const links = () => [...document.querySelectorAll('.zhixia-reverse-block a')].map(a => a.href);
    injectWikiButton();
    assert.deepEqual(links(), [
      'https://ffxiv.eorzeacollection.com/companion-glamours?headPiece=88',
      'https://ffxiv.eorzeacollection.com/companion-glamours?bodyPiece=88',
      'https://ffxiv.eorzeacollection.com/companion-glamours?legsPiece=88',
    ]);

    title.textContent = '航空兜帽';
    injectWikiButton();
    assert.deepEqual(links(), ['https://ffxiv.eorzeacollection.com/companion-glamours?headPiece=18']);

    title.textContent = '阿马罗装备的修复素材';
    injectWikiButton();
    assert.deepEqual(links(), []);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    await dom.happyDOM.close();
  }
});

test('FF14-FC 顶部导航：按子页语义命名，保留国服术语与原生链接', () => {
  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const dom = new TestWindow({url:'https://ff14-fc.com/'});
  const doc = dom.document;
  const labels = [
    ['/equipment_search_parts/equipment_search_foot/', '部位別', '按部位'],
    ['/equipment_series_search/', 'シリーズ', '装备套装'],
    ['/summary_equipment_fashionable/', 'おしゃれ', '时装'],
    ['/fashion_accessories_search/', 'ファッションアクセ', '时尚配饰'],
    ['/modern_aesthetics_search/', 'ヘアカタログ', '发型图鉴'],
    ['/weapon_search/', 'ウェポン', '武器'],
    ['/summary_equipment_id/', 'ID', '副本装备'],
    ['/summary_equipment/', 'カテゴリ別', '按来源汇总'],
    ['/capture_top/', 'お役立ち', '攻略'],
    ['/item_intro_top/', 'アイテム', '物品介绍'],
    ['/about/', 'About', '关于'],
  ];
  doc.body.innerHTML = '<nav id="fc-top">'
    + labels.map(([url, japanese], i) => '<a id="nav-' + i + '" href="' + url
      + '"><span> ' + japanese + ' </span><i aria-hidden="true"></i></a>').join('')
    + '</nav><main><a id="other" href="/summary_equipment/">按部位</a>'
    + '<a id="not-dungeon" href="/summary_equipment_fashionable/">副本装备</a>'
    + '<a id="nested" href="/summary_equipment_id/"><span>ID</span><em></em></a>'
    + '<a id="external" href="https://example.org/summary_equipment_id/">副本装备</a>'
    + '<a id="already-localized" href="/summary_equipment_id/">副本装备</a></main>';
  try {
    globalThis.document = doc;
    globalThis.location = dom.location;
    for (const anchor of doc.querySelectorAll('#fc-top a')) trimFCNode(anchor.querySelector('span').firstChild);
    assert.equal(fixFCMenu(doc.querySelector('#fc-top')), true);
    for (const [url, , expected] of labels) {
      const anchor = doc.querySelector('#fc-top a[href="' + url + '"]');
      assert.equal(anchor.textContent.trim(), expected, '导航链接 ' + url + ' 必须准确描述其子页');
      assert.equal(anchor.getAttribute('href'), url, '原生 href 不得变化');
      assert.ok(anchor.querySelector('span') && anchor.querySelector('i'),
        '翻译不得破坏现有图标及文本容器');
    }
    assert.equal(fixFCMenu(doc.querySelector('#fc-top')), false,
      '重复扫描不得二次替换');
    assert.equal(doc.querySelector('#other').textContent, '按部位',
      '同样的中文标签指向其他页面时不得错误改写');
    assert.equal(doc.querySelector('#not-dungeon').textContent, '副本装备',
      '无关链接不应套用副本装备命名');
    assert.equal(doc.querySelector('#external').textContent, '副本装备',
      '站外同路径链接不得修改');
    assert.equal(fixFCMenu(doc.querySelector('#nested span').firstChild), true,
      '局部文本更新时可回溯包含链接');
    assert.equal(doc.querySelector('#nested span').textContent, '副本装备');
    assert.ok(doc.querySelector('#nested em'), '嵌套装饰元素保留');
    assert.equal(trFC('カテゴリ別'), '按分类', '通用站点词库不能因导航标题而被重写');
    assert.equal(trFC('シリーズ'), '系列');
    assert.equal(fixFCMenu(doc.querySelector('#already-localized')), false,
      '已采用副本装备的导航无需重复替换');
    assert.equal(trFC('アイテム'), '物品');
    assert.equal(trFC('お役立ち'), '实用');
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
    dom.close();
  }
});

test('FF14-FC 首页双语栏目标题只显示一处中文，不改变正文和链接', async () => {
  const beforeDoc = globalThis.document;
  const beforeLocation = globalThis.location;
  const dom = new TestWindow({url:'https://ff14-fc.com/'});
  const doc = dom.document;
  const cases = [
    ['equipment', 'New Equipment', '新着装備', '新装备'],
    ['feature', 'Feature', '特集', '特辑'],
    ['parts', 'Parts', '部位ごと', '按部位'],
    ['accessories', 'New Fashion Accessories', 'ファッションアクセ', '新时尚配饰'],
    ['category', 'Category', 'カテゴリ', '分类'],
    ['package', 'Package', 'パッケージ', '资料片'],
    ['hairstyles', 'New Modern Aesthetics', 'ヘアカタログ', '最新发型'],
    ['weapons', 'New Weapon', '新着武器', '最新武器'],
    ['pickup', 'Pick Up!', 'オススメ', '推荐'],
  ];
  doc.body.innerHTML = cases.map(([id, english, japanese]) =>
    '<section id="' + id + '"><div class="home-heading">'
    + '<span class="en">' + english + '</span><h2>' + japanese + '</h2></div>'
    + '<a href="/' + id + '/">すべて見る</a></section>'
  ).join('') + '<section id="unrelated"><h2>ヘアカタログ</h2></section>'
    + '<section id="detail"><h2>任意の題名</h2></section>';
  try {
    globalThis.document = doc;
    globalThis.location = dom.location;
    const textNodes = [...doc.querySelectorAll('section .en, section h2, section a')]
      .map(el => el.firstChild);
    for (const node of textNodes) trimFCNode(node);
    collapseFCHomeHeadings();
    for (const [id, , , chinese] of cases) {
      const section = doc.getElementById(id);
      const primary = section.querySelector('.en');
      const subtitle = section.querySelector('h2');
      assert.equal(primary.textContent, chinese, id + ' 主标题应全中文');
      assert.equal(subtitle.style.display, 'none', id + ' 不显示重复的第二个标题');
      assert.equal(subtitle.getAttribute('aria-hidden'), 'true');
      assert.equal(primary.getAttribute('role'), 'heading',
        '保留可见标题的语义');
      assert.equal(section.querySelector('a').getAttribute('href'), '/' + id + '/',
        '栏目跳转链接必须保持原样');
      assert.equal(section.querySelector('a').textContent, '查看全部');
    }
    assert.notEqual(doc.querySelector('#unrelated h2').style.display, 'none',
      '未配对的同名标题不应被隐藏');
    assert.notEqual(doc.querySelector('#detail h2').style.display, 'none');
    collapseFCHomeHeadings();
    assert.equal(doc.querySelector('#hairstyles .en').textContent, '最新发型');
    assert.equal(doc.querySelector('#weapons .en').textContent, '最新武器',
      '重复扫描不得新增标题');

    globalThis.location = new URL('https://ff14-fc.com/summary_weapon/');
    const outside = doc.querySelector('#unrelated h2');
    outside.textContent = '新着武器';
    collapseFCHomeHeadings();
    assert.notEqual(outside.style.display, 'none',
      '该规则只对首页生效，不能影响其他页面');
  } finally {
    if (beforeLocation === undefined) delete globalThis.location;
    else globalThis.location = beforeLocation;
    if (beforeDoc === undefined) delete globalThis.document;
    else globalThis.document = beforeDoc;
    dom.close();
  }
});

test('FF14-FC 7.5/7.55 套装：按官译识别十种系列简称，不污染单件名称', () => {
  const before = globalThis.location;
  const dom = new TestWindow({url:'https://ff14-fc.com/equipment_series_search/'});
  const doc = dom.document;
  const verified = [
    ['プレマジテック・ディフェンダー', '前魔导御敌套装'],
    ['プレマジテック・スレイヤー', '前魔导制敌套装'],
    ['プレマジテック・ストライカー', '前魔导强袭套装'],
    ['プレマジテック・スカウト', '前魔导游击套装'],
    ['プレマジテック・レンジャー', '前魔导精准套装'],
    ['プレマジテック・キャスター', '前魔导咏咒套装'],
    ['プレマジテック・ヒーラー', '前魔导治愈套装'],
    ['ネオシチズン・コスチュームセット', '新生国民套装'],
    ['カーウェン', '卡文套装'],
    ['ゼロルミナリー・コスチュームセット', '零点套装'],
  ];
  try {
    globalThis.location = dom.location;
    for (const [japanese, chinese] of verified) {
      assert.equal(fcVerifiedSetName(japanese), chinese);
      assert.equal(trFC(japanese), chinese, '套装标题必须命中完整官方中文');
      assert.equal(trFC(japanese + '（全身）'), chinese + '（全身）',
        '全身预览仍保留原有全角括号');
      for (const prefix of ['【FF14】', '〖FF14〗']) {
        const article = trFC(prefix + japanese + '装備👗各種族での見た目・入手方法');
        assert.ok(article.startsWith(prefix + chinese + '👗'),
          prefix + japanese + ' 的文章标题应完整使用套装名，且不叠加“装备”');
      }
      const gallery = 'ミラプリ「' + japanese + '」装備の見た目紹介1';
      assert.ok(trFC(gallery).includes('「' + chinese + '」'),
        '图片说明中的套装简写必须保留成套装名');
      const card = doc.createElement('h4');
      card.textContent = japanese;
      doc.body.append(card);
      trimFCNode(card.firstChild);
      assert.equal(card.textContent, chinese, '套装列表使用完整名称，不能重复加后缀');
      trimFCNode(card.firstChild);
      assert.equal(card.textContent, chinese, '重复扫描结果不变');
    }
    const parts = [
      'プレマジテック・ディフェンダーバイザー',
      'プレマジテック・スレイヤーサバトン',
      'ネオシチズン・フーディー',
    ];
    for (const item of parts) {
      assert.notEqual(fcVerifiedSetName(item), '前魔导御敌套装');
      assert.ok(!trFC(item).includes('套装'),
        item + ' 是单件装备，不得因前缀相同而错误包含套装');
    }
    assert.equal(fcVerifiedSetName('プレマジテック・未知職'), null);
    assert.equal(trFC('前魔导御敌套装'), '前魔导御敌套装');
  } finally {
    if (before === undefined) delete globalThis.location;
    else globalThis.location = before;
    dom.close();
  }
});

test('FF14-FC 7.5/7.56 套装短称：仅在匹配详情页、系列卡片和链接使用官译', () => {
  const beforeLocation = globalThis.location;
  const dom = new TestWindow({url:'https://ff14-fc.com/equipment_series_search/'});
  const doc = dom.document;
  const sets = [
    ['夜桜', '夜樱套装', '/equipment/yozakuras/'],
    ['ビーストマスター', '兽主套装', '/equipment/beastmasters/'],
    ['コスモエクスプローラー', '宇宙探索者套装', '/equipment/cosmic_explorers/'],
  ];
  try {
    for (const [native, official, path] of sets) {
      globalThis.location = new URL('https://ff14-fc.com' + path);
      doc.body.innerHTML = '<h5 id="set">' + native + '</h5>'
        + '<h3 id="whole">' + native + '（全身）</h3>'
        + '<h1 id="article">〖FF14〗' + native + '装備👗各種族での見た目・入手方法</h1>'
        + '<a id="same-link" href="' + path + '"><span>' + native + '</span></a>'
        + '<p id="ordinary">' + native + '</p>'
        + '<a id="external" href="https://example.com' + path + '">' + native + '</a>'
        + '<h3 id="single">' + native + '・ジャケット</h3>';
      for (const selector of ['#set', '#whole', '#article', '#same-link span',
        '#ordinary', '#external', '#single']) trimFCNode(doc.querySelector(selector).firstChild);
      assert.equal(doc.querySelector('#set').textContent, official, native + ' 套装小标题');
      assert.equal(doc.querySelector('#whole').textContent, official + '（全身）', native + ' 全身预览');
      assert.ok(doc.querySelector('#article').textContent.startsWith('〖FF14〗' + official + '👗'),
        native + ' 文章主标题');
      assert.equal(doc.querySelector('#same-link').textContent, official);
      assert.notEqual(doc.querySelector('#external').textContent, official, '站外链接不应当误判为本套装');
      assert.notEqual(doc.querySelector('#ordinary').textContent, official, '正文不能误加套装后缀');
      assert.ok(!doc.querySelector('#single').textContent.includes('套装'),
        '单件装备不能因为套装简称而增加“套装”');
      for (const selector of ['#set', '#whole']) trimFCNode(doc.querySelector(selector).firstChild);
      assert.equal(doc.querySelector('#set').textContent, official, '多次扫描不可重复附加套装');
      assert.equal(doc.querySelector('#whole').textContent, official + '（全身）');
    }
    globalThis.location = new URL('https://ff14-fc.com/equipment_series_search/');
    doc.body.innerHTML = sets.map(([native]) => '<h4>' + native + '</h4>').join('');
    for (const h4 of doc.querySelectorAll('h4')) trimFCNode(h4.firstChild);
    sets.forEach(([, official], i) => assert.equal(doc.querySelectorAll('h4')[i].textContent, official));
    globalThis.location = new URL('https://ff14-fc.com/equipment/unrelated/');
    doc.body.innerHTML = '<h5>夜桜</h5><h5>コスモエクスプローラー</h5>';
    for (const h5 of doc.querySelectorAll('h5')) trimFCNode(h5.firstChild);
    assert.notEqual(doc.querySelectorAll('h5')[0].textContent, '夜樱套装');
    assert.notEqual(doc.querySelectorAll('h5')[1].textContent, '宇宙探索者套装');
  } finally {
    if (beforeLocation === undefined) delete globalThis.location;
    else globalThis.location = beforeLocation;
    dom.close();
  }
});

test('FF14-FC 真实页面残留词：切换提示的空格、武器职能、列表占位文案', () => {
  const ui = [
    ['装備部位 クリックで切替', '点击装备部位切换'],
    ['染色 クリックで切替', '点击染色切换'],
    ['種族 クリックで切替', '点击种族切换'],
    ['Galleryタップで切り替え', '点击图库切换'],
    ['Coming Soon……', '内容待补充'],
    ['TANK / タンク', '防护'],
    ['Melee DPS / 近接物理DPS', '近战物理输出'],
    ['HEALER / ヒーラー', '治愈'],
    ['製作装備', '制作装备'],
    ['制作装備', '制作装备'],
    ['ボズヤ・エウレカ（準備中）', '博兹雅与优雷卡（准备中）'],
    ['ITEMレベル', '品级'],
    ['セット価格', '套装价格'],
    ['魔獣使い', '驯兽师'],
    ['闘獣練', '斗兽奇弈'],
  ];
  const dom = new TestWindow({url:'https://ff14-fc.com/weapon_search/'});
  try {
    for (const [source, chinese] of ui) {
      assert.equal(trFC(source), chinese, source + ' 完整界面文案应有精确译名');
      const node = dom.document.createElement('span');
      node.textContent = source;
      trimFCNode(node.firstChild);
      assert.equal(node.textContent, chinese);
      trimFCNode(node.firstChild);
      assert.equal(node.textContent, chinese, '二次扫描仍应一致');
    }
    assert.equal(trFC('Physical Ranged DPS / 遠隔物理DPS'), '远程物理输出',
      '原已翻译的远程物理输出不变');
    assert.equal(trFC('Magical Ranged DPS / 遠隔魔法DPS'), '远程魔法输出',
      '原已翻译的远程魔法输出不变');
  } finally { dom.close(); }
});

test('FF14-FC GARO 缩写套装：用已核实官译还原阴阳装束，不重复后缀', () => {
  const beforeLocation = globalThis.location;
  const dom = new TestWindow({url:'https://ff14-fc.com/equipment/makai_priests/'});
  const doc = dom.document;
  const sets = [
    ['魔戒法師・陽', '魔戒法師の装束・陽', '魔戒法师装束·阳'],
    ['魔戒導師・陰', '魔戒導師の装束・陰', '魔戒导师装束·阴'],
    ['魔戒闘師・刃・陽', '魔戒闘師・刃の装束・陽', '魔戒斗师·刃装束·阳'],
  ];
  doc.body.innerHTML = [
    '<h5 id="set-name">魔戒法師・陽</h5>',
    '<h3 id="full-body">魔戒法師・陽（全身）</h3>',
    '<a href="/equipment/makai_priests/" id="related"><span>魔戒法師・陽</span></a>',
    '<p id="plain">魔戒法師・陽</p>',
  ].join('');
  try {
    globalThis.location = dom.location;
    assert.equal(_applyV3({
      candidatePolicy: 1,
      series: sets.map(([, full, official]) => full + '|' + official).join('\n'),
    }), true);
    cacheReset('derived');

    for (const [short, full, official] of sets) {
      assert.equal(_getSeriesMap().get(full), official, '完整套装名称必须经数据源核实');
      assert.equal(fcGaroSetName(short), official, short + ' 不应停留在日文简写');
      assert.equal(trFC(short), official);
      assert.equal(trFC(short + '（全身）'), official + '（全身）');
    }
    assert.equal(fcGaroSetName('魔戒法師・陰'), null,
      '缺乏对应正式套装名时不得猜译阴阳变体');
    assert.equal(fcGaroSetName('魔戒異教・陽'), null, '未核实系列不得猜译');
    assert.equal(fcGaroSetName('魔戒法師の胴・陽'), null,
      '不能把单件装备识别成套装');

    for (const id of ['set-name', 'full-body', 'plain']) trimFCNode(doc.getElementById(id).firstChild);
    trimFCNode(doc.querySelector('#related span').firstChild);
    assert.equal(doc.querySelector('#set-name').textContent, '魔戒法师装束·阳');
    assert.equal(doc.querySelector('#full-body').textContent, '魔戒法师装束·阳（全身）');
    assert.equal(doc.querySelector('#related').textContent, '魔戒法师装束·阳');
    assert.equal(doc.querySelector('#plain').textContent, '魔戒法师装束·阳');

    for (const id of ['set-name', 'full-body']) trimFCNode(doc.getElementById(id).firstChild);
    assert.equal(doc.querySelector('#set-name').textContent, '魔戒法师装束·阳',
      '重复扫描不可附加额外套装后缀');

    assert.equal(_applyV3({
      candidatePolicy: 1,
      series: sets.map(([, full, official]) => full + '|' + official).join('\n')
        + '\n魔戒法師・陽|魔戒法师装束·阳',
    }), true);
    cacheReset('derived');
    const detail = doc.createElement('h3');
    detail.textContent = '魔戒法師・陽（全身）';
    assert.equal(fcSetDisplayText(detail.firstChild, '魔戒法師・陽（全身）',
      '魔戒法师装束·阳（全身）'), '魔戒法师装束·阳（全身）',
    '数据源直接收录简称时也不能叠加“套装”');
  } finally {
    _applyV3({candidatePolicy: 1});
    cacheReset('derived');
    if (beforeLocation === undefined) delete globalThis.location;
    else globalThis.location = beforeLocation;
    dom.close();
  }
});

test('FF14-FC 种族初始服装：十六种族性别组合完整汉化', () => {
  const races = [
    ['ヒューラン', '人族'],
    ['エレゼン', '精灵族'],
    ['ララフェル', '拉拉菲尔族'],
    ['ミコッテ', '猫魅族'],
    ['ルガディン', '鲁加族'],
    ['アウラ', '敖龙族'],
    ['ヴィエラ', '维埃拉族'],
    ['ロスガル', '硌狮族'],
  ];
  for (const [native, chinese] of races) {
    for (const [symbol, localized] of [['♀', '女性'], ['♂', '男性']]) {
      const title = native + symbol + '初期服';
      const expected = chinese + localized + '初始服装';
      assert.equal(fcStarterOutfitName(title), expected);
      assert.equal(trFC(title), expected);
      assert.equal(trFC(title + '（全身）'), expected + '（全身）');
      assert.equal(trFC('ミラプリ「' + title + '」装備'), 'ミラプリ「' + expected + '」装備',
        '图片替代文本内的种族初始服装简称需补全');
      const siteTitle = '【FF14】' + native + (symbol === '♀' ? '女性♀' : '男性♂')
        + '初期服装備👗見た目・入手方法';
      assert.ok(trFC(siteTitle).startsWith('【FF14】' + expected + '👗'),
        '文章标题起首应使用完整中文');
    }
  }
  assert.equal(fcStarterOutfitName('未知族♀初期服'), null);
  assert.equal(fcStarterOutfitName('ミコッテ初期服'), null);
  assert.equal(fcStarterOutfitName('ミコッテ♀初期服装備'), null,
    '非标题形式不能误判为普通装备物品');
  assert.equal(trFC('ミコッテ♀初期服（全身）'),
    '猫魅族女性初始服装（全身）');
});

test('FF14-FC 详情页未译界面词：切换指引、占位信息和种族标签', () => {
  const cases = [
    ['装備部位クリックで切替', '点击装备部位切换'],
    ['染色クリックで切替', '点击染色切换'],
    ['種族クリックで切替', '点击种族切换'],
    ['種族（切り替え）', '切换种族'],
    ['種族装束', '种族服装'],
    ['SHOP販売価格：', '商店售价：'],
    ['Coming Soon......', '内容待补充'],
    ['Coming Soon...', '内容待补充'],
    ['Point', '要点'],
  ];
  const dom = new TestWindow({url:'https://ff14-fc.com/equipment/scientists/'});
  try {
    for (const [native, localized] of cases) {
      assert.equal(trFC(native), localized, native + ' 不能保留英文/日文');
      const holder = dom.document.createElement('div');
      holder.textContent = native;
      trimFCNode(holder.firstChild);
      assert.equal(holder.textContent, localized, native + ' 翻译后不得重复显示原词');
      trimFCNode(holder.firstChild);
      assert.equal(holder.textContent, localized, native + ' 重复扫描应幂等');
    }
    assert.equal(trFC('How to get'), '获取方式',
      '原有翻译不得受新增 UI 词条影响');
    assert.equal(trFC('Info'), '信息');
  } finally {
    dom.close();
  }
});

test('FF14-FC GARO 装束简称：五个裸名称按详情路径翻译，风魔与资料片不误伤', () => {
  const beforeLocation = globalThis.location;
  const dom = new TestWindow({url:'https://ff14-fc.com/equipment/undying_twilight/'});
  const doc = dom.document;
  const sets = [
    ['金狼', '金狼装束', '/equipment/the_golden_wolf/'],
    ['漆黒', '漆黑装束', '/equipment/undying_twilight/'],
    ['暗黒', '暗黑装束', '/equipment/pressing_darkness/'],
    ['白夜', '白夜装束', '/equipment/the_white_night/'],
    ['銀狼', '银狼装束', '/equipment/the_silver_wolf/'],
  ];
  const series = sets.map(([native, official]) => native + 'の装束|' + official)
    .concat('風魔の装束|威望风魔装束').join('\n');
  try {
    globalThis.location = dom.location;
    // 数据未到达前不准把特殊的「漆黒」装备标题错误锁定为资料片「暗影之逆焰」。
    assert.equal(_applyV3({candidatePolicy: 1}), true);
    cacheReset('derived');
    doc.body.innerHTML = '<h5 id="before">漆黒</h5>';
    trimFCNode(doc.querySelector('#before').firstChild);
    assert.equal(doc.querySelector('#before').textContent, '漆黒');
    assert.equal(trFC('漆黒'), '暗影之逆焰', '普通 UI 资料片翻译不得被更改');
    assert.equal(_applyV3({candidatePolicy: 1, series}), true);
    cacheReset('derived');
    trimFCNode(doc.querySelector('#before').firstChild);
    assert.equal(doc.querySelector('#before').textContent, '漆黑装束',
      '加载正式系列词库后应可补译已有 DOM 节点');

    for (const [native, official, path] of sets) {
      globalThis.location = new URL('https://ff14-fc.com' + path);
      doc.body.innerHTML = '<h5 id="set">' + native + '</h5>'
        + '<h3 id="whole">' + native + '（全身）</h3>'
        + '<h1 id="article">【FF14】' + native + '(戦士) 各種族での見た目</h1>'
        + '<a id="same-link" href="' + path + '"><span>' + native + '</span></a>'
        + '<p id="ordinary">' + native + '</p>'
        + '<a id="external" href="https://example.com' + path + '">' + native + '</a>';
      for (const selector of ['#set', '#whole', '#article', '#same-link span',
        '#ordinary', '#external']) trimFCNode(doc.querySelector(selector).firstChild);
      assert.equal(doc.querySelector('#set').textContent, official, native + ' 套装小标题');
      assert.equal(doc.querySelector('#whole').textContent, official + '（全身）', native + ' 全身预览');
      assert.ok(doc.querySelector('#article').textContent.startsWith('【FF14】' + official),
        native + ' 文章主标题');
      assert.equal(doc.querySelector('#same-link').textContent, official, native + ' 详情链接');
      assert.notEqual(doc.querySelector('#external').textContent, official,
        '不同域名的同路径链接不得识别成该装备');
      assert.notEqual(doc.querySelector('#ordinary').textContent, official,
        '普通正文中不可把简称无条件改成套装名');
      for (const selector of ['#set', '#whole']) trimFCNode(doc.querySelector(selector).firstChild);
      assert.equal(doc.querySelector('#set').textContent, official, '多次扫描不可重复追加后缀');
      assert.equal(doc.querySelector('#whole').textContent, official + '（全身）');
    }

    globalThis.location = new URL('https://ff14-fc.com/equipment_series_search/');
    doc.body.innerHTML = '<h4>金狼</h4><h4>漆黒</h4><h4>風魔</h4>';
    for (const h4 of doc.querySelectorAll('h4')) trimFCNode(h4.firstChild);
    assert.equal(doc.querySelectorAll('h4')[0].textContent, '金狼装束');
    assert.equal(doc.querySelectorAll('h4')[1].textContent, '漆黑装束');
    assert.notEqual(doc.querySelectorAll('h4')[2].textContent, '威望风魔装束',
      '迷宫风魔装备不能误匹配威望风魔装束');
  } finally {
    _applyV3({candidatePolicy: 1});
    cacheReset('derived');
    if (beforeLocation === undefined) delete globalThis.location;
    else globalThis.location = beforeLocation;
    dom.close();
  }
});

test('FF14-FC GARO 阴阳装束：全部十二种正式缩写可由完整词库还原', () => {
  const families = [
    ['魔戒導師', '魔戒导师'],
    ['魔戒弓師', '魔戒弓师'],
    ['魔戒法師', '魔戒法师'],
    ['魔戒軍師', '魔戒军师'],
    ['魔戒闘師', '魔戒斗师'],
    ['魔戒闘師・刃', '魔戒斗师·刃'],
  ];
  const pairs = families.flatMap(([native, zh]) => [
    ['陰', '阴'], ['陽', '阳'],
  ].map(([variant, localized]) => [
    native + 'の装束・' + variant, zh + '装束·' + localized,
    native + '・' + variant,
  ]));
  try {
    assert.equal(_applyV3({
      candidatePolicy: 1,
      series: pairs.map(([native, localized]) => native + '|' + localized).join('\n'),
    }), true);
    cacheReset('derived');
    for (const [native, localized, shortened] of pairs) {
      assert.equal(_getSeriesMap().get(native), localized);
      assert.equal(fcGaroSetName(shortened), localized);
      assert.equal(trFC(shortened), localized);
    }
  } finally {
    _applyV3({candidatePolicy: 1});
    cacheReset('derived');
  }
});

test('FF14-FC 套装卡片只给已核实的系列名添加显示后缀', () => {
  const before = globalThis.location;
  const dom = new TestWindow({url:'https://ff14-fc.com/equipment_series_search/'});
  const source = dom.document;
  source.body.innerHTML = [
    '<h4 id="series">アバランチブロウラー</h4>',
    '<h4 id="already">グリムグリズリー・スーツ</h4>',
    '<p id="plain">アバランチブロウラー</p>',
    '<h4 id="item">試験の腕輪</h4>',
    '<a href="/equipment/example/"><span id="home">ビーストハーダー</span></a>',
    '<a href="/equipment/example/"><span id="individual">試験の腕輪</span></a>',
  ].join('');
  try {
    globalThis.location = dom.location;
    assert.equal(_applyV3({
      candidatePolicy: 1,
      names: '試験の腕輪\t试验手镯\t1\t0',
      series: 'アバランチブロウラー|雪崩斗手\nグリムグリズリー・スーツ|狰狞熊套装\nビーストハーダー|兽牧',
    }), true, '测试系列数据必须有效加载');
    cacheReset('derived');
    const label = id => source.querySelector('#' + id).firstChild;
    assert.equal(dom.location.pathname, '/equipment_series_search/');
    assert.equal(_getSeriesMap().get('アバランチブロウラー'), '雪崩斗手');
    assert.equal(fcSetDisplayText(label('series'), 'アバランチブロウラー', '雪崩斗手'), '雪崩斗手套装');
    assert.equal(fcSetDisplayText(label('already'), 'グリムグリズリー・スーツ', '狰狞熊套装'), '狰狞熊套装');
    assert.equal(fcSetDisplayText(label('plain'), 'アバランチブロウラー', '雪崩斗手'), '雪崩斗手');
    assert.equal(fcSetDisplayText(label('item'), '試験の腕輪', '试验手镯'), '试验手镯');
    assert.equal(fcSetDisplayText(label('individual'), '試験の腕輪', '试验手镯'), '试验手镯');
    assert.equal(fcSetDisplayText(label('home'), 'ビーストハーダー', '兽牧'), '兽牧套装');
    globalThis.location = new URL('https://ff14-fc.com/equipment/example/');
    assert.equal(fcSetDisplayText(label('series'), 'アバランチブロウラー', '雪崩斗手'), '雪崩斗手');
    const detail = source.createElement('h3');
    detail.textContent = 'アバランチブロウラー（全身）';
    assert.equal(fcSetDisplayText(detail.firstChild, 'アバランチブロウラー（全身）', '雪崩斗手（全身）'), '雪崩斗手套装（全身）');
  } finally {
    _applyV3({candidatePolicy:1});
    cacheReset('derived');
    if (before === undefined) delete globalThis.location;
    else globalThis.location = before;
    dom.close();
  }
});

test('FF14-FC 真正源码路径：复合职能、装饰符、字典和链接重写', () => {
  assert.equal(trFC('ヴァイパー'), '蝰蛇剑士');
  assert.equal(trFC('ミコッテ'), '猫魅族');
  assert.equal(trFC('ひろし似'), '人族（宣传片男主风）');
  assert.equal(trFC('キャスター'), '法系');
  assert.equal(trFC('漆黒'), '暗影之逆焰');
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
    _applyV3({ candidatePolicy: 1, hash: 'abcdef\t理想化的春日护手\n' });
    assert.equal(fcLinkZhName({
      textContent: '春日護手【想】',
      getAttribute: () => 'https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/abcdef/',
    }), '理想化的春日护手', '原站装备散列优先于混合文字');
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
    _applyV3({ candidatePolicy: 1 });
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
