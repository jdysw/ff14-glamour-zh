// 在 V8 LCOV 中执行真实站点模块的翻译/页面行为，不使用字符串执行替身。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window as TestWindow} from 'happy-dom';
import { readRuntimeV3 } from '../helpers/v3-cache.mjs';
import { isAuthoredContent } from '../../src/core/content-scope.js';
import { translateECPage } from '../../src/sites/eorzea-collection.js';
import { createChineseSearchController } from '../../src/core/chinese-search.js';
import { startAttire, translateAttirePage } from '../../src/sites/attire.js';
import { translateACLPage, translateACLTitle } from '../../src/sites/ffxiv-collection.js';
import { bindZhxItemClick, ensureZhxItemStyle } from '../../src/core/item-links.js';
import { _scanStats } from '../../src/core/dom.js';
import { trMiramiru, translateMiramiruPage, translateMiramiruTitle } from '../../src/sites/miramiru.js';
import { trEden, translateEdenPage, startEden, edenImageKey, indexEdenRecipes, loadEdenRecipes } from '../../src/sites/mirapri-eden.js';

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
    assert.equal(trEden('画像をダウンサンプリング→ΔEベースのクラスタリングで同系色を統合。ほぼ白（L>95）／ほぼ黒（L<5）は除外。 出力数は最大6色。'),
      '缩小图片并按 ΔE 色差合并近似颜色。排除近白（L > 95）和近黑（L < 5），最多显示 6 种颜色。');
    assert.equal(trEden('反対主 / 20%'), '主色的互补色 / 20%');
    assert.equal(trEden('主 40% #de0b16'), '主色 40% #de0b16');
    const ranking = document.createElement('div');
    ranking.innerHTML = '<a class="matched" href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/abcdef/?patch=latest">...</a>'
      + '<a class="unknown" href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/ffff00/?patch=latest">...</a>'
      + '<a class="historical" href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/abcdef/?patch=6.0">...</a>'
      + '<a class="external" href="https://example.test/lodestone/playguide/db/item/abcdef/?patch=latest">...</a>';
    document.body.append(ranking);
    const unchanged = [...ranking.querySelectorAll('a:not(.matched)')].map(a => a.href);
    translateEdenPage(ranking);
    assert.ok(ranking.querySelector('.matched').href.endsWith(encodeURIComponent('测试装备')));
    assert.deepEqual([...ranking.querySelectorAll('a:not(.matched)')].map(a => a.href), unchanged);
    ranking.remove();
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
  const oldLocation = globalThis.location;
  const oldNodeFilter = globalThis.NodeFilter;
  const dom = new TestWindow({url:'https://miramiru.co/'});
  try {
    globalThis.location = dom.location;
    for (const suffix of ['FFXIV Glamour Showcase','FFXIV ミラプリ紹介サイト','FFXIV 투영 소개 사이트']) {
      globalThis.document = {title:'Miramiru - ' + suffix};
      translateMiramiruTitle();
      assert.equal(document.title, 'Miramiru - FF14 幻化展示');
    }
    globalThis.document={title:'Miramiru 소개 | Miramiru'};
    translateMiramiruTitle();
    assert.equal(document.title,'关于 Miramiru | Miramiru');

    globalThis.document = dom.document;
    globalThis.NodeFilter = dom.NodeFilter;
    document.body.innerHTML = '<h1><span class="text-shimmer">Mira</span><span>miru</span>' +
      '<span class="sr-only"> - FFXIV ミラプリ紹介サイト</span></h1>';
    const visibleBrand = document.querySelector('.text-shimmer');
    const subtitle = document.querySelector('.sr-only');
    translateMiramiruPage(subtitle.firstChild);
    translateMiramiruPage();
    assert.equal(document.querySelector('h1').textContent, 'Miramiru - FF14 幻化展示');
    assert.equal(document.querySelector('.text-shimmer'), visibleBrand);
    assert.equal(document.querySelector('.sr-only'), subtitle);

    document.body.innerHTML = '<div role="dialog"><button id="dialog-job" title="Paladin"><span> PLD </span></button>'
      + '<button id="custom-tag" title="PLD"><span data-slot="badge">#PLD</span></button></div>'
      + '<button id="ordinary-job"><span> PLD </span></button>';
    const job = document.getElementById('dialog-job');
    const jobText = job.querySelector('span').firstChild;
    translateMiramiruPage(jobText);
    assert.equal(job.getAttribute('title'), '骑士');
    assert.equal(jobText.nodeValue, ' 骑士 ');
    jobText.nodeValue = ' 戦 ';
    translateMiramiruPage();
    assert.equal(job.getAttribute('title'), '战士');
    assert.equal(jobText.nodeValue, ' 战士 ');
    assert.equal(document.getElementById('ordinary-job').textContent, ' PLD ');
    assert.equal(document.getElementById('custom-tag').textContent, '#PLD');

    const filter = document.querySelector('[role="dialog"]');
    const input = document.createElement('input');
    input.setAttribute('role', 'combobox');
    input.placeholder = '頭の装備を検索';
    filter.append(input);
    translateMiramiruPage(input);
    assert.equal(input.dataset.zhxMiramiruSlot, '0');
    filter.removeChild(input);
    document.body.append(input);
    translateMiramiruPage(input);
    assert.equal(input.dataset.zhxMiramiruSlot, undefined);

    globalThis.location = new URL('https://miramiru.co/ja/collection');
    document.title = 'コレクション — Miramiru | Miramiru';
    translateMiramiruTitle();
    translateMiramiruTitle();
    assert.equal(document.title, '收藏集 | Miramiru');
    globalThis.location = new URL('https://miramiru.co/ja/mirapuri/player-title');
    document.title = 'コレクション | Miramiru';
    translateMiramiruTitle();
    assert.equal(document.title, 'コレクション | Miramiru', '玩家作品标签页标题不按 UI 词典翻译');
  } finally {
    if (old === undefined) delete globalThis.document;
    else globalThis.document = old;
    globalThis.location = oldLocation;
    globalThis.NodeFilter = oldNodeFilter;
    dom.close();
  }
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
  _trRonkaPatch, _trRonkaDye, trRonka, trimRonkaNode, markRonkaItem, translateRonkaPage,
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
  fcLinkZhName, rewriteFCForeignLink, translateFCTitle, translateFCPage, trimFCNode, fcSetDisplayText, fcGaroSetName, fcStarterOutfitName, fcVerifiedSetName, collapseFCHomeHeadings, fixFCMenu,
} from '../../src/sites/ff14-fc.js';
import { DICT_FC } from '../../src/core/data/dictionary.js';
import { cacheReset } from '../../src/core/cache-primitives.js';
import { _getSeriesMap } from '../../src/core/cache.js';

import { DICT_ACL } from '../../src/core/data/dictionary.js';
import {
  m_last, _slotHit, _slotFromList, getSlot, getItemZhName,
  blockByTitle, wikiReverseItems, _buildReverseBlock, injectWikiButton,
} from '../../src/sites/huiji-wiki.js';
import { _applyV3, _fireTablesReady, resolveByName, resolveByZh, itemById, findItemsByName, suggestByZh } from '../../src/core/data/data-manager.js';
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

  const globals = ['document', 'location', 'NodeFilter', 'MutationObserver'];
  const previous = Object.fromEntries(globals.map(key => [key, globalThis[key]]));
  const dom = new TestWindow({url:'https://lookbook.ronkacloset.com/about'});
  const guide = 'https://guide.ff14.co.kr/lodestone/search?keyword=경비원 권총집 조끼';
  try {
    for (const key of globals) globalThis[key] = dom[key];
    assert.equal(_applyV3({ candidatePolicy: 1, names: '경비원 권총집 조끼\t保镖枪带背心\t1\t1' }), true);
    const doc = dom.document;
    doc.body.innerHTML = '<div class="rule-list-wrap"><ul>'
      + '<li>반드시 <strong>파이널판타지14 게임 내 배경</strong>을 사용해야 합니다.</li>'
      + '<li>게시물 중<!-- --> <a href="https://www.ff14.co.kr/support/policy">파이널판타지14 운영정책</a> <!-- -->제7.4항 에 해당하는 ‘홈페이지 제재 항목’ 대상의 경우 작성자에게 사전통지 없이 해당 게시물을 삭제할 수 있으며, 이를 작성한 계정은 경고 1회 후 게시글 삭제</li>'
      + '</ul></div><p class="post-title">코디아이템</p><img class="post-image" alt="코디아이템">'
      + '<div class="item-searcher"><div class="post-item-information"><p>경비원 권총집 조끼</p></div>'
      + '<div class="post-search-modal"><a href="' + guide + '">공식 가이드</a></div></div>';
    const policy = doc.querySelector('.rule-list-wrap a');
    const reinserted = policy.parentElement.cloneNode(true);
    const emphasis = doc.querySelector('.rule-list-wrap strong');
    translateRonkaPage();
    translateRonkaPage();
    assert.equal(doc.querySelector('.rule-list-wrap a'), policy);
    assert.equal(policy.getAttribute('href'), 'https://www.ff14.co.kr/support/policy');
    assert.match(policy.parentElement.textContent, /^如帖子属于《最终幻想14运营政策》第 7\.4 条/u);
    assert.equal(doc.querySelector('.rule-list-wrap strong'), emphasis);
    assert.equal(emphasis.parentElement.textContent, '必须使用最终幻想14游戏内背景。');
    const itemWiki = doc.querySelector('.post-search-modal a');
    assert.ok(itemWiki.href.endsWith(encodeURIComponent('保镖枪带背心')));
    assert.equal(itemWiki.textContent, '灰机 wiki');
    assert.equal(doc.querySelector('.post-item-information p').dataset.zhxItem, '保镖枪带背心');
    assert.equal(doc.querySelector('.post-title').textContent, '코디아이템');
    assert.equal(doc.querySelector('.post-image').alt, '코디아이템');
    policy.parentElement.replaceWith(reinserted);
    const restoredPolicy = reinserted.querySelector('a');
    translateRonkaPage(restoredPolicy.firstChild);
    assert.equal(reinserted.querySelector('a'), restoredPolicy);
    assert.equal(restoredPolicy.href, policy.href);
    assert.equal(restoredPolicy.textContent, '最终幻想14运营政策');

    doc.body.innerHTML = `<div class="item-search-keyword">'유저'이 포함된 룩북 전체보기</div>`
      + '<button class="primary-filter filter-keyword">검색: 유저<img alt="modal open button"></button>'
      + '<div class="filter-layout-block"><p class="filter-title">검색어</p><div class="filter-item-align">'
      + '<p class="filter-item filter-item-active">유저 X</p></div></div>'
      + '<div class="search-result-user"><span>유저</span></div><div class="search-result-title">유저</div>'
      + '<div class="palette-name-info"><img alt="add_color_icon">1염색 색상추가</div>'
      + '<div class="palette-name-info"><div class="palette-name-color"></div>2<!-- -->염색 - <!-- -->기본색</div>';
    const shortcut = doc.querySelector('.item-search-keyword');
    const chip = doc.querySelector('button.filter-keyword');
    const icon = chip.firstElementChild;
    translateRonkaPage(doc.body);
    assert.equal(shortcut.textContent, '查看包含“유저”的全部作品');
    assert.equal(chip.textContent, '搜索： 유저');
    assert.equal(chip.firstElementChild, icon);
    assert.equal(doc.querySelector('.filter-title').textContent, '关键词');
    assert.equal(doc.querySelector('.filter-item').textContent, '유저 X');
    assert.equal(doc.querySelector('.search-result-user').textContent, '유저');
    assert.equal(doc.querySelector('.search-result-title').textContent, '用户');
    assert.deepEqual([...doc.querySelectorAll('.palette-name-info')].map(el => el.textContent),
      ['1号染色：添加颜色', '2号染色：基础色']);
  } finally {
    _applyV3({ candidatePolicy: 1 });
    cacheReset('lookup');
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
    dom.close();
  }
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
  const pagerText = { nodeValue: ' of ', parentElement: { closest: selector => selector === '#navigation' } };
  const articleText = { nodeValue: ' of ', parentElement: { closest: () => null } };
  trimACLNode(pagerText);
  trimACLNode(articleText);
  assert.equal(pagerText.nodeValue, ' / ');
  assert.equal(articleText.nodeValue, ' of ');
  assert.equal(trACL('ロスト'), 'ロスト');
  const unknown = 'テスト・ディフェンダーアタイアRE';
  assert.equal(_trACLSet(unknown, unknown), null, '未核实系列不能生成半日半中的套装名');
  assert.equal(trACL(unknown), unknown, '保留完整原文，等待正确系列数据');
  const knownRe = 'オールドキングダム・ディフェンダーアタイアRE';
  assert.equal(_trACLSet(knownRe, knownRe), '改良型旧日王国御敌套装');
  // 对照旧日王国胸甲的国服「华美型」名称：不应把 SP 漏译或误作「改良型」。
  const ornate = 'オールドキングダム・ディフェンダーアタイアSP';
  assert.equal(trACL(ornate), '华美型旧日王国御敌套装');
  assert.equal(trACL('レイド'), '大型任务／团队任务');
  assert.equal(_trACLGearsetAlt(ornate + "'s gearset image."),
    '华美型旧日王国御敌套装的装备展示图');
  assert.equal(_trACLSet('オールドキングダム・ディフェンダーキュイラスSP',
    'オールドキングダム・ディフェンダーキュイラスSP'), null);
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

test('灰机 Wiki 面部及时尚配饰：杂货解锁道具反查 EC 目录详情', async () => {
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

    const nativeLink = blockByTitle('数据库链接').querySelector('a');
    nativeLink.href = 'https://garlandtools.org/db/#item/33041';
    nativeLink.textContent = 'Garland Data';
    document.querySelector('.mw-page-title-main').textContent = '天使之翼';
    injectWikiButton();
    injectWikiButton();
    assert.equal(document.querySelectorAll('.zhixia-reverse-block').length, 1);
    assert.deepEqual([...document.querySelectorAll('.zhixia-reverse-block a')].map(a => a.href),
      ['https://ffxiv.eorzeacollection.com/fashion-accessory/angel-wings']);
    assert.equal(blockByTitle('数据库链接').querySelector('a'), nativeLink);
    assert.equal(nativeLink.href, 'https://garlandtools.org/db/#item/33041');

    document.querySelector('.mw-page-title-main').textContent = '尚未收录的配饰';
    injectWikiButton();
    assert.equal(document.querySelector('.zhixia-reverse-block'), null);
    assert.equal(blockByTitle('数据库链接').querySelector('a'), nativeLink);
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

test('FF14-FC 分类导航与首页重复标题：按链接校准且不改外链', () => {
  const oldDoc = globalThis.document;
  const oldLocation = globalThis.location;
  const dom = new TestWindow({url:'https://ff14-fc.com/'});
  try {
    globalThis.document = dom.document;
    globalThis.location = dom.location;
    const doc = dom.document;
    doc.body.innerHTML =
      '<nav><a href="/equipment_series_search/"><span>シリーズ</span><i></i></a>'
      + '<a href="/summary_equipment/"><span>カテゴリ別</span></a>'
      + '<a href="/summary_equipment_id/">ID</a>'
      + '<a href="https://example.org/summary_equipment_id/">ID</a></nav>'
      + '<section><span>New Weapon</span><h2>新着武器</h2></section>'
      + '<section><h2>新着武器</h2></section>';
    for (const el of doc.querySelectorAll('nav a span, section span, section h2')) {
      trimFCNode(el.firstChild);
    }
    assert.equal(fixFCMenu(doc), true);
    const links = doc.querySelectorAll('nav a');
    assert.deepEqual([...links].map(a => a.textContent.trim()),
      ['装备套装', '按来源汇总', '副本装备', 'ID']);
    assert.ok(links[0].querySelector('span') && links[0].querySelector('i'));
    assert.equal(fixFCMenu(doc), false);
    collapseFCHomeHeadings();
    const [first, unrelated] = doc.querySelectorAll('section h2');
    assert.equal(first.style.display, 'none');
    assert.notEqual(unrelated.style.display, 'none');
    assert.equal(doc.querySelector('section span').textContent, '最新武器');
  } finally {
    if (oldDoc === undefined) delete globalThis.document;
    else globalThis.document = oldDoc;
    if (oldLocation === undefined) delete globalThis.location;
    else globalThis.location = oldLocation;
    dom.close();
  }
});

test('FF14-FC 套装整名、文章标题与单件装备边界', () => {
  const oldLocation = globalThis.location;
  const dom = new TestWindow({url:'https://ff14-fc.com/equipment_series_search/'});
  try {
    globalThis.location = dom.location;
    assert.equal(fcVerifiedSetName('プレマジテック・ディフェンダー'), '前魔导御敌套装');
    assert.equal(trFC('ネオシチズン・コスチュームセット（全身）'), '新生国民套装（全身）');
    assert.equal(fcVerifiedSetName('プレマジテック・未知職'), null);
    assert.ok(!trFC('プレマジテック・ディフェンダーバイザー').includes('套装'));
    assert.equal(fcStarterOutfitName('ミコッテ♀初期服'), '猫魅族女性初始服装');
    assert.equal(_applyV3({candidatePolicy: 1,
      series: '魔戒法師の装束・陽|魔戒法师装束·阳\nファントムヴィジョン・ディフェンダー|幻境意象御敌',
    }), true);
    cacheReset('derived');
    assert.equal(fcGaroSetName('魔戒法師・陽'), '魔戒法师装束·阳');
    assert.equal(fcGaroSetName('魔戒異教・陽'), null);
    assert.ok(trFC('〖FF14〗ファントムヴィジョン・ディフェンダー装備👗各種族での見た目・入手方法')
      .startsWith('〖FF14〗幻境意象御敌套装'));
    assert.equal(trFC('ファントムヴィジョン・ディフェンダー'), '幻境意象御敌');
    assert.ok(!trFC('〖FF14〗グラフィティ・ネオチュニック装備👗').includes('套装'));
    assert.equal(trFC('アライアンスレイド'), '团队任务');
    assert.equal(trFC('ノーマルレイド'), '普通大型任务');
  } finally {
    _applyV3({candidatePolicy: 1});
    cacheReset('derived');
    if (oldLocation === undefined) delete globalThis.location;
    else globalThis.location = oldLocation;
    dom.close();
  }
});

test('FF14-FC GARO 简称：资料未就绪时保留原文，按路径翻译套装', () => {
  const oldDoc = globalThis.document;
  const oldLocation = globalThis.location;
  const dom = new TestWindow({url:'https://ff14-fc.com/equipment/undying_twilight/'});
  try {
    globalThis.document = dom.document;
    globalThis.location = dom.location;
    const doc = dom.document;
    doc.body.innerHTML = '<h5>漆黒</h5><p>漆黒</p>'
      + '<img alt="ミラプリ「漆黒」装備の見た目">'
      + '<a href="https://example.net/equipment/undying_twilight/">'
      + '<img alt="ミラプリ「漆黒」装備の見た目"></a>';
    const heading = doc.querySelector('h5');
    const img = doc.querySelector('img');
    assert.equal(_applyV3({candidatePolicy: 1}), true);
    cacheReset('derived');
    trimFCNode(heading.firstChild);
    _trFCAttr(img, 'alt');
    assert.equal(heading.textContent, '漆黒');
    assert.equal(img.getAttribute('alt'), 'ミラプリ「漆黒」装備の見た目');
    assert.equal(_applyV3({candidatePolicy: 1, series: '漆黒の装束|漆黑装束'}), true);
    cacheReset('derived');
    trimFCNode(heading.firstChild);
    _trFCAttr(img, 'alt');
    assert.equal(heading.textContent, '漆黑装束');
    assert.ok(img.getAttribute('alt').includes('「漆黑装束」'));
    trimFCNode(doc.querySelector('p').firstChild);
    assert.notEqual(doc.querySelector('p').textContent, '漆黑装束');
    globalThis.location = new URL('https://ff14-fc.com/equipment/unrelated/');
    const external = doc.querySelector('a img');
    _trFCAttr(external, 'alt');
    assert.ok(!external.getAttribute('alt').includes('漆黑装束'));
  } finally {
    _applyV3({candidatePolicy: 1});
    cacheReset('derived');
    if (oldDoc === undefined) delete globalThis.document;
    else globalThis.document = oldDoc;
    if (oldLocation === undefined) delete globalThis.location;
    else globalThis.location = oldLocation;
    dom.close();
  }
});

test('FF14-FC 水晶塔光之套装：页面简称、获取方式及图库说明不留日文', () => {
  const oldDoc = globalThis.document;
  const oldLocation = globalThis.location;
  const oldNodeFilter = globalThis.NodeFilter;
  const dom = new TestWindow({url:'https://ff14-fc.com/equipment/of_light/'});
  try {
    globalThis.document = dom.document;
    globalThis.location = dom.location;
    globalThis.NodeFilter = dom.NodeFilter;
    const doc = dom.document;
    doc.body.innerHTML =
      '<h5>オブ・ライト</h5><h3>オブ・ライト（全身）</h3>'
      + '<p>オブ・ライト</p>'
      + '<img alt="ミラプリ「オブ・ライト」装備ミコッテでの見た目紹介1">'
      + '<a href="https://example.net/equipment/of_light/"><img alt="ミラプリ「オブ・ライト」装備ミコッテでの見た目紹介1"></a>';
    for (const el of doc.querySelectorAll('h5,h3,p')) trimFCNode(el.firstChild);
    assert.deepEqual([...doc.querySelectorAll('h5,h3,p')].map(x => x.textContent),
      ['光之套装', '光之套装（全身）', '光之套装']);
    assert.equal(trFC('オブ・ライトの関連アイテム'), '光之套装的相关物品');
    assert.ok(trFC('〖FF14〗オブ・ライト装備👗各種族での見た目・入手方法')
      .startsWith('〖FF14〗光之套装'));
    _trFCAttr(doc.querySelector('img'), 'alt');
    assert.equal(doc.querySelector('img').getAttribute('alt'),
      '猫魅族「光之套装」外观展示图 1');
    const duty = 'クリスタルタワー：古代の民の迷宮';
    assert.equal(trFC('アライアンスレイド「' + duty + '」の宝箱からランダムでドロップする。'),
      '从团队任务“水晶塔 古代人迷宫”的宝箱中随机掉落。');
    assert.equal(trFC('▷ ' + duty + ' の詳細情報'), '▷ 水晶塔 古代人迷宫的详细信息');
    assert.ok(trFC('「オブ・ライト」装備が「' + duty
      + '」のどの宝箱からドロップするか、ひと目でわかるツールです').includes('光之套装'));
    assert.equal(trFC('レイド'), '团队任务');
    assert.equal(trFC('大型任务'), '团队任务');
    assert.equal(trFC('ドロップで入手'), '掉落获得');
    assert.equal(trFC('地図を表示'), '显示地图');
    assert.equal(trFC('異国風の男'), '异国装扮的男人');
    // Acquisition paragraphs may have emphasis or links around native words.
    const strongDrop = doc.createElement('p');
    strongDrop.innerHTML = 'アライアンスレイド「' + duty
      + '」の <strong>宝箱</strong> からランダムでドロップする。';
    doc.body.append(strongDrop);
    const originalStrong = strongDrop.querySelector('strong');
    translateFCPage(strongDrop);
    assert.equal(strongDrop.textContent, '从团队任务“水晶塔 古代人迷宫”的宝箱中随机掉落。');
    assert.equal(strongDrop.querySelector('strong'), originalStrong);
    const linkDrop = doc.createElement('p');
    linkDrop.innerHTML = 'アライアンスレイド「<a href="/summary/the_labyrinth_of_the_ancients/">'
      + duty + '</a>」の <strong>宝箱</strong> からランダムでドロップする。';
    doc.body.append(linkDrop);
    const linkedDuty = linkDrop.querySelector('a');
    const linkedStrong = linkDrop.querySelector('strong');
    translateFCPage(linkDrop);
    assert.equal(linkDrop.textContent, '从团队任务“水晶塔 古代人迷宫”的宝箱中随机掉落。');
    assert.equal(linkDrop.querySelector('a'), linkedDuty);
    assert.equal(linkDrop.querySelector('a').getAttribute('href'), '/summary/the_labyrinth_of_the_ancients/');
    assert.equal(linkDrop.querySelector('strong'), linkedStrong);
    // 同一水晶塔的关联卡片：站内 URL 确认套装，外链和普通单件不能误伤。
    const related = [
      ['ロイヤル', '皇室套装', '/equipment/royal/'],
      ['クリムゾン', '深红套装', '/equipment/crimson/'],
      ['バラード', '民谣套装', '/equipment/ballad/'],
      ['風魔', '风魔套装', '/equipment/fuma/'],
      ['オニオン', '洋葱套装', '/equipment/onion/'],
    ];
    for (const [native, chinese, href] of related) {
      const link = doc.createElement('a');
      link.setAttribute('href', href);
      link.innerHTML = '<span>' + native + '</span><img alt="ミラプリ「'
        + native + '」装備ミコッテでの見た目紹介1">'
        + '<img class="bare-alt" alt="' + native + '">';
      doc.body.append(link);
      trimFCNode(link.querySelector('span').firstChild);
      _trFCAttr(link.querySelector('img'), 'alt');
      _trFCAttr(link.querySelector('img.bare-alt'), 'alt');
      assert.equal(link.textContent, chinese, '关联卡片需按链接翻译：' + href);
      assert.ok(link.querySelector('img').getAttribute('alt').includes('「' + chinese + '」'));
      assert.equal(link.querySelector('img.bare-alt').getAttribute('alt'), chinese);
      assert.equal(link.getAttribute('href'), href);
    }
    assert.equal(trFC('Point'), '要点', '普通文案保留原始词义');
    const summary = doc.createElement('section');
    summary.innerHTML = '<span>Point</span><h2>まとめ</h2>';
    doc.body.append(summary);
    for (const el of summary.children) trimFCNode(el.firstChild);
    collapseFCHomeHeadings();
    assert.equal(summary.querySelector('span').textContent, '汇总');
    assert.equal(summary.querySelector('h2').style.display, 'none',
      '已配对的详情页双语标题只显示一次');
    const foreignSet = doc.createElement('a');
    foreignSet.href = 'https://example.net/equipment/crimson/';
    foreignSet.textContent = 'クリムゾン';
    doc.body.append(foreignSet);
    trimFCNode(foreignSet.firstChild);
    assert.notEqual(foreignSet.textContent, '深红套装',
      '站外相同路径不得触发 FC 套装规则');
    globalThis.location = new URL('https://ff14-fc.com/equipment/crimson/');
    assert.equal(trFC('クリムゾン'), '深红套装', '详情页正文使用已核实的系列名称');
    globalThis.location = new URL('https://ff14-fc.com/summary/the_labyrinth_of_the_ancients/');
    const linkedArticle = doc.createElement('a');
    linkedArticle.setAttribute('href', '/equipment/crimson/');
    linkedArticle.textContent = '〖FF14〗クリムゾン装備各種族での見た目・入手方法';
    doc.body.append(linkedArticle);
    trimFCNode(linkedArticle.firstChild);
    assert.ok(linkedArticle.textContent.startsWith('〖FF14〗深红套装'));
    assert.ok(!linkedArticle.textContent.includes('鲜红纤维毯'));
    assert.equal(linkedArticle.getAttribute('href'), '/equipment/crimson/');
    assert.equal(trFC('クリムゾン（黒魔道士・召喚士・赤魔道士・ピクトマンサー・青魔道士）'),
      '深红套装（黑魔法师、召唤师、赤魔法师、绘灵法师、青魔法师）');
    assert.equal(trFC('〖FF14〗オニオン（竜騎士・リーパー）装備の見た目'),
      '〖FF14〗洋葱套装（龙骑士、钐镰客）装备外观');
    globalThis.location = new URL('https://ff14-fc.com/equipment/unrelated/');
    assert.equal(trFC('オブ・ライト'), 'オブ・ライト',
      '不能在其他装备页面将系列简称当成通用物品名');
    const foreign = doc.querySelector('a img');
    _trFCAttr(foreign, 'alt');
    assert.ok(!foreign.getAttribute('alt').includes('光之套装'));
  } finally {
    if (oldDoc === undefined) delete globalThis.document;
    else globalThis.document = oldDoc;
    if (oldLocation === undefined) delete globalThis.location;
    else globalThis.location = oldLocation;
    if (oldNodeFilter === undefined) delete globalThis.NodeFilter;
    else globalThis.NodeFilter = oldNodeFilter;
    dom.close();
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
  assert.equal(trFC('FF14の新生エオルゼアでの装備について一覧で紹介しているページです。', '/summary_equipment_heavensward/'), '本页汇总介绍《苍穹之禁城》版本的装备。');
  assert.equal(trFC('FF14の新生エオルゼアでの装備について一覧で紹介しているページです。', '/summary_equipment_stormblood/'), '本页汇总介绍《红莲之狂潮》版本的装备。');
  assert.equal(trFC('FF14の新生エオルゼアでの装備について一覧で紹介しているページです。', '/summary_equipment_shadowbringers/'), '本页汇总介绍《暗影之逆焰》版本的装备。');
  assert.equal(trFC('アライアンスレイド'), '团队任务', '24 人任务不能译为大型任务');
  assert.equal(trFC('ノーマルレイド'), '普通大型任务', '8 人任务须使用大型任务');
  assert.equal(trFC('ノーマルレイド・零式'), '普通与零式大型任务');
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

test('装備手帳：保留站内分类入口与正文，仅以确切物品身份改 Wiki 跳转', async () => {
  const names = ['document','location','window','NodeFilter','MutationObserver'];
  const prior = Object.fromEntries(names.map(name => [name,globalThis[name]]));
  const dom = new TestWindow({url:'https://attire.jp/field-commanders-coat/'});
  try {
    const d = dom.document;
    const official = 'https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/';
    const jp = 'フィールドコマンダーコート';
    const zh = '野战指挥官外套';
    const wiki = 'https://ff14.huijiwiki.com/wiki/物品:';
    const hash = '4551a07ab65';
    d.body.innerHTML = `<nav><a href="/vanity-2/"><span>おしゃれ装備</span><svg></svg></a></nav>
      <input value="検索"><h1 id="jinrPostTitle">${jp}</h1><section id="postContent">
      <h2 class="a--h2rich-maincopy">アイテム情報</h2><p id="author">アイテム情報</p>
      <a id="item" href="${official}${hash}/"><strong>${jp}</strong></a>
      <a id="foreign" href="https://example.test/lodestone/playguide/db/item/${hash}/">${jp}</a>
      <a id="custom" href="${official}${hash}/">作者的文字</a>
      <a id="unknown" href="${official}00000000001/">未収録の装備</a>
      <a id="new" href="${official}511859ea2ce/">アバランチブロウラー・トップス</a></section>`;
    Object.assign(globalThis,{document:d,location:dom.location,window:dom,NodeFilter:dom.NodeFilter});
    dom.__zhxTestSite = 'attire';
    _applyV3({candidatePolicy:1,names:jp+'\t'+zh+'\t1\t1'});
    translateAttirePage();
    assert.equal(d.querySelector('nav a').textContent,'外观装备');
    assert.equal(d.querySelector('nav a').pathname,'/vanity-2/');
    assert.equal(d.querySelectorAll('nav svg').length,1);
    assert.equal(d.querySelector('input').value,'検索');
    assert.equal(d.querySelector('#author').textContent,'アイテム情報');
    assert.equal(d.querySelector('h2').textContent,'物品信息');
    assert.equal(d.querySelector('h1').textContent,zh);
    assert.equal(d.querySelector('#item strong').textContent,zh);
    assert.equal(d.querySelector('#item').href,official+hash+'/','仅名字命中时保留原站物品链接');
    assert.equal(decodeURI(d.querySelector('#new').href),wiki+'雪崩斗手上衣');
    _applyV3({candidatePolicy:1,names:jp+'\t'+zh+'\t1\t1',hash:hash+'\t'+zh});
    translateAttirePage();
    translateAttirePage();
    assert.equal(decodeURI(d.querySelector('#item').href),wiki+zh,'数据补齐后能够更新已翻译链接');
    assert.equal(d.querySelector('#foreign').textContent,jp);
    assert.equal(d.querySelector('#custom').textContent,'作者的文字');
    assert.equal(d.querySelector('#unknown').textContent,'未収録の装備');
    assert.equal(d.querySelector('#unknown').href,official+'00000000001/');
    // Already redirected links must also be rechecked after a data refresh.
    const updatedZh = '野战指挥官外套（更正）';
    d.title = zh+'〖FF14 装备手帐〗｜幻化装备外观汇总';
    d.body.insertAdjacentHTML('beforeend', `<ol id="breadCrumb"><li><a href="/">HOME</a></li><li>＞${zh}</li></ol>`);
    assert.ok(_applyV3({candidatePolicy:1,names:jp+'\t'+updatedZh+'\t1\t1',hash:hash+'\t'+updatedZh}));
    translateAttirePage();
    assert.equal(d.querySelector('#item strong').textContent,updatedZh);
    assert.equal(decodeURI(d.querySelector('#item').href),wiki+updatedZh);
    assert.equal(d.querySelector('h1').textContent,updatedZh);
    assert.equal(d.querySelector('#breadCrumb li:last-child').textContent,'＞'+updatedZh);
    assert.ok(d.title.startsWith(updatedZh));
    assert.ok(_applyV3({candidatePolicy:1,names:jp+'\t'+updatedZh+'\t1\t1\n別の装備\t另一件装备\t1\t1',hash:hash+'\t另一件装备'}));
    translateAttirePage();
    translateAttirePage();
    assert.equal(d.querySelector('#item strong').textContent,jp);
    assert.equal(d.querySelector('#item').href,official+hash+'/');
    assert.equal(d.querySelector('h1').textContent,jp);
    assert.equal(d.querySelector('#breadCrumb li:last-child').textContent,'＞'+jp);
    assert.ok(d.title.startsWith(jp));
    // A name-only label must revert if the canonical identity contradicts it.
    d.body.innerHTML = `<h1 id="jinrPostTitle">${jp}</h1><section id="postContent"><a id="conflict" href="${official}${hash}/">${jp}</a></section>`;
    d.title = jp+'〖FF14 装備手帳〗｜ミラプリ用装備見た目まとめ';
    assert.ok(_applyV3({candidatePolicy:1,names:jp+'\t'+zh+'\t1\t1'}));
    translateAttirePage();
    assert.equal(d.querySelector('#conflict').textContent,zh);
    assert.ok(_applyV3({candidatePolicy:1,names:jp+'\t'+zh+'\t1\t1\n別の装備\t另一件装备\t1\t1',hash:hash+'\t另一件装备'}));
    translateAttirePage();
    translateAttirePage();
    assert.equal(d.querySelector('#conflict').textContent,jp);
    assert.equal(d.querySelector('#conflict').href,official+hash+'/');
    assert.equal(d.querySelector('h1').textContent,jp);
    assert.ok(d.title.startsWith(jp));
    _applyV3({candidatePolicy:1,names:jp+'\t'+zh+'\t1\t1',hash:hash+'\t'+zh});
    d.body.innerHTML = `<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/glamour/">ミラプリ</a></div></div>
      <h1 id="jinrPostTitle">${jp}</h1><section id="postContent"><a href="${official}${hash}/">${jp}</a></section>`;
    translateAttirePage();
    assert.equal(d.querySelector('h1').textContent,jp,'幻化文章标题即使等于装备原名也不改');
    d.body.className = 'page';
    d.body.innerHTML = `<nav><a href="/viper/">ヴァイパー</a></nav>
      <form role="search" method="get" action="/"><input type="search" name="s" placeholder="キーワードを入力して検索">
      <button type="submit">検索</button><input type="submit" value="検索"><input type="submit" name="action" value="検索"></form>
      <section id="postContent"><div class="wp-block-columns"><a href="/field-commanders-coat/">${jp}</a></div>
      <a class="c--post-link" rel="bookmark" href="/field-commanders-coat/"><h2 class="a--post-title">${jp}</h2><span class="a--post-category category-achievement">アチーブメント報酬</span></a>
      <a class="c--post-link" rel="bookmark" href="/glamour-post/"><h2 class="a--post-title">${jp}</h2><span class="a--post-category category-glamour">ミラプリ</span></a>
      <p>${jp}</p></section><a class="tag-cloud-link" href="/tag/boots/">眼鏡 (12)</a>`;
    translateAttirePage();
    translateAttirePage();
    assert.equal(d.querySelector('nav a').textContent,'蝰蛇剑士');
    assert.equal(d.querySelector('input').placeholder,'输入关键词搜索');
    assert.equal(d.querySelector('button').textContent,'搜索');
    assert.equal(d.querySelector('input[type="submit"]:not([name])').value,'搜索');
    assert.equal(d.querySelector('input[name="action"]').value,'検索');
    assert.equal(d.querySelector('.wp-block-columns a').textContent,zh);
    assert.equal(d.querySelector('.wp-block-columns a').pathname,'/field-commanders-coat/');
    assert.deepEqual([...d.querySelectorAll('.a--post-title')].map(h=>h.textContent),[zh,jp]);
    assert.equal(d.querySelector('#postContent p').textContent,jp);
    assert.equal(d.querySelector('.tag-cloud-link').textContent,'眼镜 (12)');
    d.body.className = 'single';
    d.body.innerHTML = `<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/glamour/">ミラプリ</a></div></div>
      <section id="postContent"><figure class="wp-block-table"><table><tbody><tr><td>${jp}</td><td>染色不可</td></tr></tbody></table></figure><p>${jp}</p></section>`;
    translateAttirePage();
    assert.deepEqual([...d.querySelectorAll('td')].map(td=>td.textContent),[zh,'不可染色']);
    assert.equal(d.querySelector('#postContent p').textContent,jp);
    // The live recipe is a rich link card, not just a table.
    _applyV3({candidatePolicy:1,names:jp+'\t'+zh+'\t1\t1\nカララント:スノウホワイト\t雪白染剂\t1\t1\nカララント:ジェットブラック\t煤黑染剂\t1\t1',hash:hash+'\t'+zh});
    d.body.innerHTML = `<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/glamour/">ミラプリ</a></div></div>
      <h1 id="jinrPostTitle">ミラプリ：Rose du Désert</h1>
      <section id="postContent">
        <div><h2 class="a--h2rich-maincopy">ミラプリ</h2><span class="a--h2rich-subcopy">Glamour</span></div>
        <a id="recipe" href="/field-commanders-coat/"><span>スノウホワイト・ジェットブラック</span><strong>${jp}</strong></a>
        <a id="single" href="/field-commanders-coat/">無染色${jp}</a>
        <a id="unverified" href="/other/">未収録色${jp}</a>
        <a id="author-link" href="/field-commanders-coat/">${jp}</a>
        <figure class="wp-block-table"><table><tbody><tr><td><a id="recipe-official" href="${official}${hash}/">${jp}</a></td></tr></tbody></table></figure>
      </section>`;
    translateAttirePage();
    translateAttirePage();
    assert.equal(d.querySelector('#recipe span').textContent,'雪白／煤黑');
    assert.equal(d.querySelector('#recipe strong').textContent,zh);
    assert.equal(d.querySelector('#recipe').pathname,'/field-commanders-coat/');
    assert.equal(d.querySelector('#single').textContent,'未染色 '+zh);
    assert.equal(d.querySelector('#unverified').textContent,'未収録色'+jp);
    assert.equal(d.querySelector('#author-link').textContent,jp);
    assert.equal(d.querySelector('#jinrPostTitle').textContent,'ミラプリ：Rose du Désert');
    assert.equal(d.querySelector('.a--h2rich-maincopy').textContent,'幻化');
    assert.equal(d.querySelector('.a--h2rich-subcopy').hidden,true);
    assert.equal(decodeURI(d.querySelector('#recipe-official').href),wiki+zh);
    d.body.innerHTML = `<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/seriesb/">シリーズ武器一覧</a></div></div>
      <section id="postContent"><a id="weapon" href="/field-commanders-coat/"><span>ナイト</span><strong>${jp}</strong></a>
      <a id="duty" href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/duty/841d3f69efd/">廃砦捜索 ダスクヴィジル</a></section>`;
    translateAttirePage();
    assert.equal(d.querySelector('#weapon span').textContent,'骑士');
    assert.equal(d.querySelector('#weapon strong').textContent,zh);
    assert.equal(d.querySelector('#duty').textContent,'冰雪废堡暮卫塔');
    d.body.innerHTML = '<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/seriesb/">シリーズ武器一覧</a></div></div><h1 id="jinrPostTitle">廃砦捜索 ダスクヴィジル マーシャル武器一覧</h1>';
    translateAttirePage();
    assert.equal(d.querySelector('h1').textContent,'冰雪废堡暮卫塔 军用武器一览');
    const coffer = 'ダークマホガニー・ウェポンチェスト〖ILv663〗 武器一覧';
    const cofferZh = '深红木武器箱（品级663） 武器一览';
    d.body.innerHTML = `<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/seriesb/">シリーズ武器一覧</a></div></div>
      <h1 id="jinrPostTitle">${coffer}</h1><section id="postContent"><a class="c--post-link" rel="bookmark" href="/dark-mahogany-weapon-coffer-il-663/"><h2 class="a--post-title">${coffer}</h2><span class="a--post-category category-seriesb">シリーズ武器一覧</span></a></section>
      <aside class="widget_recent_entries"><a href="/dark-mahogany-weapon-coffer-il-663/">${coffer}</a></aside>`;
    translateAttirePage();
    translateAttirePage();
    assert.equal(d.querySelector('h1').textContent,cofferZh);
    assert.equal(d.querySelector('.a--post-title').textContent,cofferZh);
    assert.equal(d.querySelector('.widget_recent_entries a').textContent,cofferZh);
    assert.equal(d.querySelector('.c--post-link').pathname,'/dark-mahogany-weapon-coffer-il-663/');
    const ponchos = 'カシミヤポンチョ・ラミーポンチョ';
    _applyV3({candidatePolicy:1,names:'カシミヤポンチョ\t羊绒斗篷\t1\t1\nラミーポンチョ\t青麻斗篷\t1\t1',hash:'7d89571f76f\t羊绒斗篷'});
    d.body.innerHTML = `<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/vanity/">Lv63ID 海底宮殿 紫水宮</a></div></div>
      <h1 id="jinrPostTitle">${ponchos}</h1><section id="postContent"><p>Lv1 All Job</p><p>Lv63 モンク 侍</p><p>Lv50 魔獣使い</p><span>染色✕</span>
      <p>これは作者の文章です。</p><a id="poncho" href="${official}7d89571f76f/">カシミヤポンチョ</a>
      <a id="group" href="/cashmere-poncho/">${ponchos}</a></section>`;
    d.title = ponchos+'〖FF14 装備手帳〗｜ミラプリ用装備見た目まとめ';
    translateAttirePage();
    translateAttirePage();
    assert.equal(d.querySelector('#jinrPostTitle').textContent,'羊绒斗篷、青麻斗篷');
    assert.equal(d.querySelector('#jinrPostMeta a').textContent,'63级副本 海底宫殿紫水宫');
    assert.deepEqual([...d.querySelectorAll('#postContent p')].map(p=>p.textContent),['1级 全职业','63级 武僧／武士','50级 驯兽师','これは作者の文章です。']);
    assert.equal(d.querySelector('#postContent span').textContent,'不可染色');
    assert.equal(d.querySelector('#group').textContent,'羊绒斗篷、青麻斗篷');
    assert.equal(d.querySelector('#group').pathname,'/cashmere-poncho/');
    assert.equal(decodeURI(d.querySelector('#poncho').href),wiki+'羊绒斗篷');
    assert.equal(d.title,'羊绒斗篷、青麻斗篷〖FF14 装备手帐〗｜幻化装备外观汇总');
    d.body.insertAdjacentHTML('beforeend', `<ol id="breadCrumb"><li><a href="/">HOME</a></li>
      <li><a href="/category/dungeons/">ダンジョン</a></li><li>＞${ponchos}</li></ol>
      <label for="archive-select">アーカイブ</label><select id="archive-select">
      <option value="">週を選択</option><option value="/2026/06/08/">2026年6月8日–2026年6月14日 (1)</option></select>`);
    const archiveSelect = d.querySelector('#archive-select');
    archiveSelect.selectedIndex = 1;
    translateAttirePage();
    translateAttirePage();
    assert.deepEqual([...d.querySelectorAll('#breadCrumb li')].map(el=>el.textContent),['首页','副本装备','＞羊绒斗篷、青麻斗篷']);
    assert.deepEqual([...d.querySelectorAll('#breadCrumb a')].map(el=>el.pathname),['/','/category/dungeons/']);
    assert.equal(d.querySelector('label[for="archive-select"]').textContent,'归档');
    assert.equal(archiveSelect.options[0].textContent,'选择周');
    assert.equal(archiveSelect.options[0].value,'');
    assert.equal(archiveSelect.value,'/2026/06/08/');
    assert.equal(archiveSelect.selectedIndex,1);

    d.body.innerHTML = `<h1 id="jinrPostTitle">トリテレイアイヤリング</h1><section id="postContent"><a href="${official}00000000001/">トリテレイアイヤリング:ブラック</a></section>`;
    translateAttirePage();
    assert.equal(d.querySelector('h1').textContent,'紫灯花耳环');
    assert.equal(d.querySelector('#postContent a').href,official+'00000000001/');
    // Flower summaries omit colour, while the actual items retain it.
    const flower = 'スイートピーネックレス';
    assert.ok(_applyV3({candidatePolicy:1,names:flower+':レッド\t红色香豌豆花项链\t1\t1\n'+flower+':ブルー\t蓝色香豌豆花项链\t1\t1\n別の花:レッド\t红色未知花\t1\t1\n別の花:ブルー\t蓝色另一种花\t1\t1',hash:'00000000002\t红色香豌豆花项链'}));
    d.body.innerHTML = `<h1 id="jinrPostTitle">${flower}</h1><section id="postContent">
      <p>マーケット取引可能</p><a href="${official}00000000002/">${flower}:レッド</a>
      <a class="c--post-link" rel="bookmark" href="/sweet-pea-necklace/"><h2 class="a--post-title">${flower}</h2><span class="a--post-category category-flower">フラワーオーナメント</span></a>
      <a class="c--post-link" rel="bookmark" href="/other/"><h2 class="a--post-title">別の花</h2><span class="a--post-category category-flower">フラワーオーナメント</span></a></section>
      <nav><a href="/viper/">ヴァイパー</a><a href="/search/">検索</a></nav>`;
    translateAttirePage();
    translateAttirePage();
    assert.equal(d.querySelector('h1').textContent,'香豌豆花项链');
    assert.equal(d.querySelector('#postContent p').textContent,'可在市场交易');
    assert.equal(d.querySelector('#postContent > a').textContent,'红色香豌豆花项链');
    assert.equal(decodeURI(d.querySelector('#postContent > a').href),wiki+'红色香豌豆花项链');
    assert.deepEqual([...d.querySelectorAll('.a--post-title')].map(el=>el.textContent),['香豌豆花项链','別の花']);
    assert.deepEqual([...d.querySelectorAll('nav a')].map(el=>el.textContent),['蝰蛇剑士','搜索']);
    d.body.className = 'archive category';
    d.body.innerHTML = '<h1 id="jinrPostTitle">おしゃれ装備：黄金編</h1>';
    d.title = 'おしゃれ装備：黄金編〖FF14 装備手帳〗｜ミラプリ用装備見た目まとめ';
    translateAttirePage();
    assert.equal(d.querySelector('h1').textContent,'外观装备：金曦之遗辉');
    assert.equal(d.title,'外观装备：金曦之遗辉〖FF14 装备手帐〗｜幻化装备外观汇总');
    d.body.className = 'home';
    d.body.innerHTML = `<section id="postContent"><div class="a--richmenu-text"><span>Market</span><span>マーケット</span></div>
      <div class="a--richmenu-text"><span>Wolf Marks</span><span>PvP装備</span></div>
      <div class="calendar"><div><span class="a--h2rich-maincopy">月間FLカレンダー</span><h2 class="a--h2rich-subcopy">FRONTLINE CALENDAR</h2></div>
        <div><button id="prev-month">‹</button><button id="next-month">›</button></div>
        <div id="weekdays"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span><span>1</span></div></div>
      <p id="outside-calendar">月</p>
      <p id="split-series">シ<a href="/category/seriesb/">リーズ武器一覧</a></p>
      <p id="other-split">シ<a href="/other/">リーズ武器一覧</a></p>
      <div><span class="a--h2rich-maincopy">メニュー</span><h2 class="a--h2rich-subcopy">MENU</h2></div>
      <a class="c--post-link" rel="bookmark" href="/neo-kingdom/"><h2 class="a--post-title">ネオキングダム武器一覧</h2><span class="a--post-category category-seriesb">シリーズ武器一覧</span></a></section>
      <aside class="widget_recent_entries"><ul><li><a href="/lost-allagan/">アラガントームストーン:万物 ロストアラガン武器一覧</a></li><li><a href="/rose-du-desert/">ミラプリ：Rose du Désert</a></li></ul></aside>`;
    translateAttirePage();
    translateAttirePage();
    assert.deepEqual([...d.querySelectorAll('.a--richmenu-text')].map(el=>el.textContent),['市场','PvP 装备']);
    assert.deepEqual([...d.querySelectorAll('#weekdays > span')].map(el=>el.textContent),['日','一','二','三','四','五','六','1']);
    assert.equal(d.querySelector('#outside-calendar').textContent,'月');
    assert.equal(d.querySelector('#prev-month').textContent,'‹');
    assert.equal(d.querySelector('#next-month').textContent,'›');
    d.querySelector('#weekdays').innerHTML = '<span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span><span>2</span>';
    translateAttirePage();
    assert.deepEqual([...d.querySelectorAll('#weekdays > span')].map(el=>el.textContent),['日','一','二','三','四','五','六','2']);
    assert.equal(d.querySelector('#split-series').textContent,'系列武器一览');
    assert.equal(d.querySelector('#split-series a').pathname,'/category/seriesb/');
    assert.equal(d.querySelector('#other-split').textContent,'シリーズ武器一覧');
    assert.ok([...d.querySelectorAll('.a--h2rich-subcopy')].every(el=>el.hidden));
    assert.equal(d.querySelector('.a--post-title').textContent,'新生王国武器一览');
    assert.deepEqual([...d.querySelectorAll('aside a')].map(el=>el.textContent),['亚拉戈万物神典石 亚拉戈失传武器一览','ミラプリ：Rose du Désert']);
    const menuSub = [...d.querySelectorAll('.a--h2rich-subcopy')].find(el=>!el.closest('.calendar'));
    menuSub.textContent = '別の見出し';
    translateAttirePage();
    assert.equal(menuSub.hidden,false);
    d.body.className = 'archive tag tag-mf';
    d.body.innerHTML = '<nav><a href="/tag/mf/">男女別デザイン</a></nav><h1 id="jinrPostTitle">男女別デザイン</h1>';
    translateAttirePage();
    assert.equal(d.querySelector('h1').textContent,'男女外观不同');
    assert.equal(d.querySelector('nav a').textContent,'男女外观不同');
    assert.equal(d.querySelector('nav a').pathname,'/tag/mf/');
    d.body.className = 'search search-results';
    d.body.innerHTML = `<header id="postHeader"><h1 id="jinrPostTitle">「${jp}」の検索結果は2件です</h1></header>
      <section id="jinrPostList">
        <a class="c--post-link" rel="bookmark" href="/field-commanders-coat/"><h2 class="a--post-title">${jp}</h2><span class="a--post-category category-achievement">アチーブメント報酬</span></a>
        <a class="c--post-link" rel="bookmark" href="/glamour-post/"><h2 class="a--post-title">${jp}</h2><span class="a--post-category category-glamour">ミラプリ</span></a>
      </section>`;
    assert.ok(_applyV3({candidatePolicy:1,names:'未使用の装備\t未使用的装备\t1\t1'}));
    translateAttirePage();
    assert.equal(d.querySelector('h1').textContent,`「${jp}」的搜索结果：2 条`);
    _applyV3({candidatePolicy:1,names:jp+'\t'+zh+'\t1\t1'});
    translateAttirePage();
    assert.equal(d.querySelector('h1').textContent,`「${zh}」的搜索结果：2 条`);
    assert.deepEqual([...d.querySelectorAll('h2')].map(h=>h.textContent),[zh,jp]);
    assert.deepEqual([...d.querySelectorAll('.c--post-link')].map(a=>a.pathname),['/field-commanders-coat/','/glamour-post/']);
    // The search header and a menu/form may be inserted outside postContent.
    let notify;
    globalThis.MutationObserver = class {
      constructor(callback) { notify = callback; }
      observe() {}
    };
    d.body.innerHTML = '';
    startAttire();
    const late = d.createElement('div');
    late.innerHTML = '<header id="postHeader"><h1 id="jinrPostTitle">「未知」の検索結果は0件です</h1></header>'
      + '<nav><a href="/market/">マーケット</a></nav>'
      + '<form role="search" method="get" action="/"><input type="search" name="s" placeholder="キーワードを入力して検索"></form>';
    d.body.append(late);
    notify([{type:'childList',addedNodes:[late]}]);
    await new Promise(resolve=>setTimeout(resolve,60));
    assert.equal(d.querySelector('h1').textContent,'「未知」的搜索结果：0 条');
    assert.equal(d.querySelector('nav a').textContent,'市场');
    assert.equal(d.querySelector('input').placeholder,'输入关键词搜索');
  } finally {
    for (const [name,value] of Object.entries(prior)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
    await dom.happyDOM.close();
  }
});

test('装備手帳武器汇总：职业标题、等级分段、图注及标签', async () => {
  const keys = ['document','location','window','NodeFilter'];
  const prior = Object.fromEntries(keys.map(key => [key,globalThis[key]]));
  const dom = new TestWindow({url:'https://attire.jp/vpr/'});
  try {
    const d = dom.document;
    Object.assign(globalThis,{document:d,location:dom.location,window:dom,NodeFilter:dom.NodeFilter});
    const jp = 'テスト用の双剣', zh = '测试用对剑';
    const hash = '00000000003';
    const official = 'https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/'+hash+'/';
    assert.ok(_applyV3({candidatePolicy:1,names:jp+'\t'+zh+'\t1\t1',hash:hash+'\t'+zh}));
    d.body.className = 'single';
    d.title = '〖ヴァイパー〗二刀流武器 一覧〖FF14 装備手帳〗｜ミラプリ用装備見た目まとめ';
    d.body.innerHTML = '<h1 id="jinrPostTitle">〖ヴァイパー〗二刀流武器 一覧</h1>'
      + '<section id="postContent"><h2>Lv100～Lv91</h2><h3>Lv80～Lv1</h3><h3>Lv70</h3><h3>Lv60</h3><h3>Lv1</h3>'
      + '<a href="/test-weapon/">'+jp+'</a><figure><figcaption>'+jp+'</figcaption></figure>'
      + '<figure><figcaption><a id="official-caption" href="'+official+'">'+jp+'</a></figcaption></figure>'
      + '<p>'+jp+'</p><h3>作者の文章</h3></section>'
      + '<a rel="tag" href="/tag/vpr/">#ヴァイパー</a><a href="/tag/eyes/">#眼鏡</a>'
      + '<a rel="tag" href="/tag/unknown/">#未知のタグ</a>';
    translateAttirePage();
    translateAttirePage();
    assert.equal(d.querySelector('#jinrPostTitle').textContent,'【蝰蛇剑士】蝰蛇对剑一览');
    assert.ok(d.title.startsWith('【蝰蛇剑士】蝰蛇对剑一览'));
    assert.deepEqual([...d.querySelectorAll('#postContent :is(h2,h3)')].map(el=>el.textContent),['91～100级','1～80级','70级','60级','1级','作者の文章']);
    assert.equal(d.querySelector('#postContent a').textContent,zh);
    assert.equal(d.querySelector('#postContent a').pathname,'/test-weapon/');
    assert.equal(d.querySelector('figcaption').textContent,zh);
    assert.equal(d.querySelector('#official-caption').textContent,zh);
    assert.equal(decodeURI(d.querySelector('#official-caption').href),'https://ff14.huijiwiki.com/wiki/物品:'+zh);
    assert.equal(d.querySelector('#postContent p').textContent,jp);
    assert.deepEqual([...d.querySelectorAll('a[href^="/tag/"]')].map(el=>el.textContent),['#蝰蛇剑士','#眼镜','#未知のタグ']);
    // The real /arms/ layout has a separate metadata and catalogue-navigation section.
    globalThis.location = new URL('https://attire.jp/arms/white-gold-foil/');
    d.body.innerHTML = `<h1 id="jinrPostTitle">${jp}</h1><section id="postContent">
      <p id="level">Lv96 IL669</p><dl><dt>抜刀ギミック</dt><dd>発光</dd><dt>種類</dt><dd>未確認の分類</dd></dl>
      <p id="effects">発光<br>変形</p><p id="none">無し</p>
      <p id="vendor">カ・インタナ<br>モードゥナ</p><p id="token">未知蛮神のトーテム像〖剛〗<br>10</p>
      <p id="mixed">発光<br>作者の説明</p><p id="type">ナックル</p>
      <p id="coffer">ダイヤ・ウェポンチェスト〖ILv525〗</p>
      <a id="duty-name" href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/duty/00000000001/">極ダイヤウェポン捕獲作戦</a>
      <a id="foreign-vendor" href="https://example.test/">カ・インタナ</a>
      <div><span class="a--h2rich-subcopy">Weapons of the same design</span><h2 class="a--h2rich-maincopy">同デザイン武器</h2></div>
      <h2 class="wp-block-heading">セット防具</h2>
      <a id="catalogue" href="/arcanist_s_grimoire/">〖召喚士〗魔道書一覧</a>
      <a id="unrelated" href="/other/">〖召喚士〗魔道書一覧</a>
      <p id="author">種類についての作者の文章</p>
      <a href="${official}">${jp}</a></section>
      <a rel="tag" href="/tag/north/">#クレセントアイル：北征編</a>`;
    translateAttirePage();
    translateAttirePage();
    assert.equal(d.querySelector('#level').textContent,'等级 96／品级 669');
    assert.equal(d.querySelector('dd').textContent,'发光');
    assert.equal(d.querySelector('#effects').innerHTML,'发光<br>变形');
    assert.equal(d.querySelector('#none').textContent,'无');
    assert.equal(d.querySelector('#vendor').innerHTML,'卡·因塔娜<br>摩杜纳');
    assert.equal(d.querySelector('#token').innerHTML,'白色未知蛮神图腾<br>10');
    assert.equal(d.querySelector('#mixed').innerHTML,'発光<br>作者の説明');
    assert.equal(d.querySelector('#type').textContent,'指虎');
    assert.equal(d.querySelector('#coffer').textContent,'钻石神兵武器箱（品级525）');
    assert.equal(d.querySelector('#duty-name').textContent,'钻石神兵狂想作战');
    assert.equal(d.querySelector('#foreign-vendor').textContent,'カ・インタナ');
    // Treasure sources and a coffer have exact display names, not inferred
    // weapon identities. An inconsistent map/area combination stays native.
    const dream = d.createElement('p');
    dream.id = 'dream-source';
    dream.innerHTML = 'マーケット取引可能<br>ドリーム・オブ・ウェポンチェスト<br>「宝物庫セノーテ・ジャジャグラル」';
    d.querySelector('#postContent').append(dream);
    translateAttirePage();
    assert.equal(dream.textContent,'可在市场交易幻梦武器箱加加财富天坑');
    assert.deepEqual([...d.querySelectorAll('dt')].map(el=>el.textContent),['拔刀效果','种类']);
    assert.equal(d.querySelector('.a--h2rich-maincopy').textContent,'同外观武器');
    assert.equal(d.querySelector('.a--h2rich-subcopy').hidden,true);
    assert.equal(d.querySelector('.wp-block-heading').textContent,'配套防具');
    assert.equal(d.querySelector('#catalogue').textContent,'【召唤师】魔导书一览');
    assert.equal(d.querySelector('#catalogue').pathname,'/arcanist_s_grimoire/');
    assert.equal(d.querySelector('#unrelated').textContent,'〖召喚士〗魔道書一覧');
    assert.equal(d.querySelector('#author').textContent,'種類についての作者の文章');
    assert.equal(d.querySelector('a[rel="tag"]').textContent,'#新月岛：北征之章');
    globalThis.location = new URL('https://attire.jp/market/');
    d.body.innerHTML = '<h1 id="jinrPostTitle">マーケット取引可能装備</h1><section id="postContent"><p>種類</p></section>';
    translateAttirePage();
    assert.equal(d.querySelector('h1').textContent,'可在市场交易的装备');
    assert.equal(d.querySelector('#postContent p').textContent,'種類');
  } finally {
    for (const [key,value] of Object.entries(prior)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
    await dom.happyDOM.close();
  }
});

test('装備手帳来源汇总：制作采集、AF、PvP 和季节活动', async () => {
  const keys = ['document','location','window','NodeFilter'];
  const prior = Object.fromEntries(keys.map(key => [key,globalThis[key]]));
  const dom = new TestWindow({url:'https://attire.jp/hand-land/'});
  try {
    const d = dom.document;
    Object.assign(globalThis,{document:d,window:dom,NodeFilter:dom.NodeFilter});
    const render = (path, markup) => {
      globalThis.location = new URL('https://attire.jp'+path);
      d.body.className = 'page';
      d.body.innerHTML = markup;
      translateAttirePage();
      translateAttirePage();
    };
    assert.ok(_applyV3({candidatePolicy:1,names:'テスト装備・アタイア\t测试套装\t1\t1\n曖昧・アタイア\t测试甲套装\t1\t1\n曖昧アタイア\t测试乙套装\t1\t1\nマインキープ・アタイア\t富矿套装\t0\t0\nファイターアーマー\t勇战套装\t0\t0\nドラゴンランサーアーマー\t枪龙套装\t0\t0\n早乙女装束\t早乙女装束\t0\t0'}));
    render('/hand-land/', '<h1 id="jinrPostTitle">ギャザラー＆クラフター</h1><section id="postContent">'
      + '<div class="c--tab-title">AF クラス別</div><h2>ギャザラーAF</h2><h3>採掘師</h3>'
      + '<a href="/minerise-work-shirt/">マインライズ</a><a href="/minesophs-work-shirt/">マインソフォス</a>'
      + '<a href="/augmented-minekings-work-shirt/">マインキング</a><a href="/augmented-fieldkeeps-shirt/">フィールドキープ</a>'
      + '<a href="/augmented-minekeeps-overalls/">マインキープ</a><a href="/test/">テスト装備</a><a href="/ambiguous/">曖昧</a>'
      + '<p id="author">マインライズ</p><a href="/unknown/">未知のセット</a></section>');
    assert.equal(d.querySelector('h1').textContent,'采集与制作职业');
    assert.equal(d.querySelector('.c--tab-title').textContent,'按职业汇总');
    assert.deepEqual([...d.querySelectorAll('h2,h3')].map(e=>e.textContent),['采集职业专属装备','采矿工']);
    assert.deepEqual([...d.querySelectorAll('#postContent a')].map(e=>e.textContent),['晗矿套装','地质专业套装','精矿套装','园野套装','富矿套装','测试套装','曖昧','未知のセット']);
    assert.equal(d.querySelector('#postContent a').pathname,'/minerise-work-shirt/');
    assert.equal(d.querySelector('#author').textContent,'マインライズ');
    render('/af-pld/', '<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/nyuusyuhouhou/af-nyuusyu/">入手方法：歴代ジョブAF</a></div></div>'
      + '<h1 id="jinrPostTitle">ナイト 歴代AF 男女着用SSまとめ</h1><section id="postContent">'
      + '<a href="/gallant-surcoat/">新生AFガラント/Gallant</a><a href="/caballarius-cuirass/">黄金AFカバラリアス/Caballarius</a></section>');
    assert.equal(d.querySelector('h1').textContent,'骑士历代职业专属装备试穿图汇总');
    assert.deepEqual([...d.querySelectorAll('#postContent a')].map(e=>e.textContent),['重生之境 英骑套装','金曦之遗辉 迅骑套装']);
    render('/af-war/', '<h1 id="jinrPostTitle">戦士 歴代AF 男女着用SSまとめ</h1><section id="postContent">'
      + '<a href="/fighters-cuirass/">新生AF ファイター/Fighter’s</a><a href="/unknown/">黄金AF 未確認/Unknown</a></section>');
    assert.deepEqual([...d.querySelectorAll('#postContent a')].map(e=>e.textContent),['重生之境 勇战套装','黄金AF 未確認/Unknown']);
    render('/af-drg/', '<h1 id="jinrPostTitle">竜騎士 歴代AF 男女着用SSまとめ</h1><section id="postContent">'
      + '<a href="/dragonlancers-plackart/">蒼天AF ドラゴンランサー/</a></section>');
    assert.equal(d.querySelector('#postContent a').textContent,'苍穹之禁城 枪龙套装');
    render('/af-sam/', '<h1 id="jinrPostTitle">侍 歴代AF 男女着用SSまとめ</h1><section id="postContent">'
      + '<a href="/saotome-jinbaori/">暁月AF 早乙女/Saotome</a><a href="/sakonji-haori/">黄金AF 左近士羽織/Sakonji</a>'
      + '<a href="/nameless-togi/">ジョブ取得時にもらえる装備品 無銘闘着/Nameless</a></section>');
    assert.deepEqual([...d.querySelectorAll('#postContent a')].map(e=>e.textContent),['晓月之终途 早乙女装束','金曦之遗辉 左近士装束','解锁职业时获得的装备 无名套装']);
    render('/pvp/', '<h1 id="jinrPostTitle">PvP装備</h1><section id="postContent"><h3>ヴァートゥ</h3>'
      + '<a href="/virtus-creed/">ヴァートゥ・クリード</a><h3>プレスティージ・ハイアラガン</h3></section>');
    assert.deepEqual([...d.querySelectorAll('h3')].map(e=>e.textContent),['美德','威望亚拉戈高位']);
    assert.equal(d.querySelector('#postContent a').textContent,'美德忠骑套装');
    render('/s-g/', '<h1 id="jinrPostTitle">シーズナル</h1><section id="postContent"><h2>定期開催</h2>'
      + '<a href="/heavensturn/"><span>Heavensturn</span><span>降神祭</span></a>'
      + '<a href="/little-ladies-day/">Little Ladies Day プリンセスデー</a>'
      + '<p id="mog">哲学（Philosophy）</p><p id="reward">鯰尾耳飾</p><p id="mog-note">作者の文章</p>'
      + '<a id="mog-pair" href="/mameshiba-earring/">神話（Mythology） 豆柴耳飾</a></section>');
    assert.equal(d.querySelector('h1').textContent,'季节活动');
    assert.equal(d.querySelector('h2').textContent,'定期活动');
    assert.deepEqual([...d.querySelectorAll('#postContent a')].map(e=>e.textContent),['降神节','女儿节','稀少神话神典石 豆柴耳饰']);
    assert.equal(d.querySelector('#postContent a').pathname,'/heavensturn/');
    assert.equal(d.querySelector('#mog').textContent,'稀少哲学神典石');
    assert.equal(d.querySelector('#reward').textContent,'鲶鱼耳饰');
    assert.equal(d.querySelector('#mog-note').textContent,'作者の文章');
    assert.equal(d.querySelector('#mog-pair').pathname,'/mameshiba-earring/');
    render('/all-saints-wake/', '<h1 id="jinrPostTitle">守護天節 / All Saints’ Wake</h1>');
    assert.equal(d.querySelector('h1').textContent,'守护天节');
    // Seasonal links and official store acquisition labels must not lose
    // their dates, native copy, nested nodes, or original destinations.
    const cardigan = 'ヴァレンティオンコージー・カーディガン';
    const gaia = 'ガイア・コスチュームセット';
    assert.ok(_applyV3({candidatePolicy:1,names:cardigan+'\t温暖恋人开襟毛衫\t1\t1\n'+gaia+'\t盖娅服装套装\t1\t1'}));
    render('/valentiones-day/', '<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/seasonal-event-all/">シーズナルイベント一覧</a></div></div>'
      + '<h1 id="jinrPostTitle">ヴァレンティオンデー / Valentiones Day</h1><section id="postContent">'
      + '<a id="reward-split" href="/cozy-valentione-cardigan/"><span>2026年</span><span>大きなケーキに宿る愛</span><strong>'+cardigan+'</strong></a>'
      + '<a id="reward-combined" href="/cozy-valentione-cardigan/">2026年 大きなケーキに宿る愛 '+cardigan+'</a>'
      + '<a id="reward-unknown" href="/unknown/">2026年 未確認の装備</a><p id="reward-copy">'+cardigan+'</p></section>');
    assert.equal(d.querySelector('h1').textContent,'恋人节');
    assert.equal(d.querySelector('#reward-split strong').textContent,'温暖恋人开襟毛衫');
    assert.equal(d.querySelector('#reward-split span:nth-child(2)').textContent,'大きなケーキに宿る愛');
    assert.equal(d.querySelector('#reward-combined').textContent,'2026年 大きなケーキに宿る愛 温暖恋人开襟毛衫');
    assert.equal(d.querySelector('#reward-combined').pathname,'/cozy-valentione-cardigan/');
    assert.equal(d.querySelector('#reward-unknown').textContent,'2026年 未確認の装備');
    assert.equal(d.querySelector('#reward-copy').textContent,cardigan);
    const store = 'https://store.finalfantasyxiv.com/ffxivstore/ja-jp/product/901';
    const official = 'https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/00000000003/';
    const storeMarkup = '<h1 id="jinrPostTitle">'+gaia+'</h1><section id="postContent">'
      + '<a href="'+official+'">'+gaia+'</a><p>女性専用装備</p><p>課金装備『<a id="store" href="'+store+'">'+gaia+'</a>』</p>'
      + '<a id="foreign-store" href="https://example.test/ffxivstore/ja-jp/product/901">'+gaia+'</a>'
      + '<div><span class="a--h2rich-subcopy">Moogle Treasure Trove</span><h2 class="a--h2rich-maincopy">モグモグ★コレクション</h2></div>'
      + '<a id="event" href="https://jp.finalfantasyxiv.com/lodestone/special/2026/Valentiones_Day/example">ヴァレンティオンデー</a></section>';
    render('/gaias-attire/',storeMarkup);
    assert.equal(d.querySelector('h1').textContent,'盖娅服装套装');
    assert.equal(d.querySelector('#postContent p').textContent,'女性专用装备');
    // Exact repeated AF instructions, not arbitrary prose or player posts.
    const eAf = 'Lv89のメインクエストをクリアするとオールドシャーレアンにいるヴァルサルードから受け取ることができるようになります。';
    const dAf = 'Lv99のメインクエストをクリアするとトライヨラにいるメワズンテから受け取ることができるようになります。';
    const afMarkup = (category, text) => '<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/'+category+'/">AF</a></div></div>'
      + '<h1 id="jinrPostTitle">'+gaia+'</h1><section id="postContent"><a href="'+official+'">'+gaia+'</a>'
      + '<p id="conditional">染色◯（条件あり）</p><div class="c--accordion-title">染色可能にする方法</div>'
      + '<p id="instructions">'+text+'</p><p id="other">作者：'+eAf+'</p></section>';
    render('/academics-coat/',afMarkup('af/artefact5','暁月のフィナーレのアーティファクト(AF)です<br>'+eAf+'<br>染色するためにはLv90のロールクエストのクリアが必要です。'));
    assert.equal(d.querySelector('#conditional').textContent,'满足条件后可染色');
    assert.equal(d.querySelector('.c--accordion-title').textContent,'染色解锁方式');
    assert.equal(d.querySelector('#instructions').innerHTML,'晓月之终途的职业专属装备（AF）。<br>完成89级主线任务后，可在旧萨雷安的瓦尔萨如德处领取。<br>完成90级职能任务后方可染色。');
    assert.equal(d.querySelector('#other').textContent,'作者：'+eAf);
    render('/heavensbound-mail/',afMarkup('af/artefact6','黄金のレガシーのアーティファクト(AF)です\n'+dAf+'<br>〖近接物理DPSロールクエスト 黄金編〗をすべてクリアする<br>※別ジョブでコンプリート済みであれば染色機能は自動的に有効化されます'));
    assert.equal(d.querySelector('#instructions').innerHTML,'金曦之遗辉的职业专属装备（AF）。\n完成99级主线任务后，可在图莱尤拉的梅瓦祖恩特处领取。<br>完成全部近战物理进攻职业的职能任务（金曦之章）<br>※若已使用其他职业完成对应的职能任务，则自动解锁染色功能。');
    render('/glamour-post/',afMarkup('glamour',eAf));
    assert.equal(d.querySelector('#conditional').textContent,'染色◯（条件あり）');
    assert.equal(d.querySelector('#instructions').textContent,eAf);
    const face = 'スタイルカタログ:テスト用眼鏡';
    const faceZh = '测试用眼镜样式';
    assert.ok(_applyV3({candidatePolicy:1,names:face+'\t'+faceZh+'\t1\t1',hash:'123456789ab\t'+faceZh}));
    render('/?p=125414','<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/faceaccessory/">フェイスアクセサリー</a></div></div>'
      + '<h1 id="jinrPostTitle">'+face+'（フェイスアクセサリー）</h1><section id="postContent">'
      + '<div><h2 class="a--h2rich-maincopy">カラーバリエーション</h2><span class="a--h2rich-subcopy">Color variations</span></div>'
      + '<a id="face-item" href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/123456789ab/">'+face+'</a>'
      + '<p id="face-market">マーケット取引：◯</p><p id="face-source">宝の地図G18 「宝物庫 ボルト・オネイロン」</p>'
      + '<p id="wrong-map">宝の地図G17 「宝物庫 ボルト・オネイロン」</p><p id="source-prose">宝物庫 ボルト・オネイロンについての説明</p>'
      + '<div class="c--accordion-contents"><a id="allied" href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/quest/?category2=4&amp;category3=45&amp;category4=62">友好部族エクストラストーリー</a>'
      + '<a id="friends" href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/quest/b10022ed563/">集うは我ら、信頼の絆</a>'
      + '<a id="wrong-friends" href="https://example.test/lodestone/playguide/db/quest/b10022ed563/">集うは我ら、信頼の絆</a></div></section>');
    assert.equal(d.querySelector('#jinrPostTitle').textContent,faceZh+'（面部配饰）');
    assert.equal(d.querySelector('#face-item').textContent,faceZh);
    assert.ok(decodeURIComponent(d.querySelector('#face-item').href).endsWith(faceZh));
    assert.equal(d.querySelector('.a--h2rich-maincopy').textContent,'颜色一览');
    assert.equal(d.querySelector('.a--h2rich-subcopy').hidden,true);
    assert.equal(d.querySelector('#face-market').textContent,'可在市场交易');
    assert.equal(d.querySelector('#face-source').textContent,'G18藏宝图：巡梦金库');
    assert.equal(d.querySelector('#wrong-map').textContent,'宝の地図G17 「宝物庫 ボルト・オネイロン」');
    assert.equal(d.querySelector('#source-prose').textContent,'宝物庫 ボルト・オネイロンについての説明');
    assert.equal(d.querySelector('#allied').textContent,'各族盟友任务');
    assert.equal(d.querySelector('#friends').textContent,'友谊地久天长');
    assert.equal(d.querySelector('#wrong-friends').textContent,'集うは我ら、信頼の絆');
    // Retain the AF fixture's original game-data entries for the subsequent tests.
    assert.ok(_applyV3({candidatePolicy:1,names:cardigan+'\t温暖恋人开襟毛衫\t1\t1\n'+gaia+'\t盖娅服装套装\t1\t1'}));
    const basicAf = '各ジョブのジョブクエストをコンプリートする';
    const repurchase = '各エリア遺失物管理人から再購入（1,000ギル）';
    render('/scholars-gown/', afMarkup('af/artefact',basicAf+'<br>Lv45：頭 手 脚 足<br>Lv50：胴<br>'+repurchase)
      .replace('</section>','<div><h2 class="a--h2rich-maincopy">学者AF</h2><span class="a--h2rich-subcopy">Scholar artefact</span></div><p id="unknown-af">不明AF</p></section>'));
    assert.equal(d.querySelector('#instructions').innerHTML,'完成对应职业的职业任务<br>45级：头部、手部、腿部、脚部<br>50级：身体<br>可在各地的失物管理人处重新购买（1,000 金币）');
    assert.equal(d.querySelector('.a--h2rich-maincopy').textContent,'学者职业专属装备');
    assert.equal(d.querySelector('.a--h2rich-subcopy').hidden,true);
    assert.equal(d.querySelector('#unknown-af').textContent,'不明AF');
    const kakalanShop = 'https://jp.finalfantasyxiv.com/lodestone/playguide/db/shop/124bcb85185/';
    assert.ok(_applyV3({candidatePolicy:1,names:cardigan+'\t温暖恋人开襟毛衫\t1\t1\n'+gaia+'\t盖娅服装套装\t1\t1\nスカラーアタイアの補材\t学士装备的改良材料\t1\t1\nカララント:スートブラック\t煤黑染剂\t1\t1'}));
    render('/augmented-scholars-gown/',afMarkup('af/afre','モードゥナ<br>工房「ダイヤモンドフォージ」<br>( 22.2 , 5.5 ) Z:0.5<br>欲しい部位のAF<br>(遺失物管理人より再購入可能)<br>部位別必要個数<br>頭：手：足…1<br>胴：脚…2')
      .replace('>AF</a>','>新生アーティファクトRE</a>')
      .replace('</section>','<a id="kakalan" href="'+kakalanShop+'">カカラン</a><a id="unknown-shop" href="https://example.test/lodestone/playguide/db/shop/124bcb85185/">カカラン</a><a id="augmentation" href="https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/1b3f836d461/">スカラーアタイアの補材</a><p id="dye-caption">スートブラック染色</p></section>'));
    assert.equal(d.querySelector('.a--post-cat a').textContent,'重生之境 改良型职业专属装备');
    assert.equal(d.querySelector('#instructions').innerHTML,'摩杜纳<br>钻石工房<br>( 22.2 , 5.5 ) Z:0.5<br>所需部位的职业专属装备<br>（可在失物管理人处重新购买）<br>各部位所需数量<br>头部、手部、脚部：1<br>身体、腿部：2');
    assert.equal(d.querySelector('#kakalan').textContent,'卡卡拉恩');
    assert.equal(d.querySelector('#kakalan').href,kakalanShop);
    assert.equal(d.querySelector('#unknown-shop').textContent,'カカラン');
    assert.equal(d.querySelector('#augmentation').textContent,'学士装备的改良材料');
    assert.equal(d.querySelector('#dye-caption').textContent,'煤黑染色');
    const guide = '〖暁月版〗禁書：新生古典装備の入手方法〖過去トークン装備〗';
    render('/creed-cuirass/',afMarkup('af/artefact2','Lv60忍者')
      .replace('</section>','<a id="guide" href="/al06/">'+guide+'</a><a id="other-guide" href="https://example.test/al06/">'+guide+'</a></section>'));
    assert.equal(d.querySelector('#instructions').textContent,'60级 忍者');
    assert.equal(d.querySelector('#guide').textContent,'【晓月版】60级职业专属装备获取方式（旧神典石装备）');
    assert.equal(d.querySelector('#other-guide').textContent,guide);
    // The historical guide is an article, not an item-detail page.
    const tomeTitle = '〖暁月版〗法典：ドマ様式装備の入手方法〖過去トークン装備〗';
    const tomeMarkup = '<div id="jinrPostMeta"><div class="a--post-cat"><a href="/category/nyuusyuhouhou/tomestone/">入手方法：過去トークン装備</a></div></div>'
      + '<h1 id="jinrPostTitle">'+tomeTitle+'</h1><section id="postContent">'
      + '<h2>アラガントームストーン:法典<br>ドマ様式装備</h2><table><tr><th>セントリオ記章</th><td>頭手足</td><td>35</td></tr></table>'
      + '<p id="guide-copy">セントリオ記章</p><p id="guide-prose">セントリオ記章についての説明</p></section>';
    render('/al05/', tomeMarkup);
    assert.equal(d.querySelector('#jinrPostTitle').textContent,'【晓月版】法典神典石：多玛风格装备获取方式（旧神典石装备）');
    assert.equal(d.querySelector('#postContent h2').innerHTML,'亚拉戈法典神典石<br>多玛风格装备');
    assert.equal(d.querySelector('th').textContent,'兵团徽章');
    assert.deepEqual([...d.querySelectorAll('td')].map(e=>e.textContent),['头部、手部、脚部','35']);
    assert.equal(d.querySelector('#guide-copy').textContent,'セントリオ記章');
    assert.equal(d.querySelector('#guide-prose').textContent,'セントリオ記章についての説明');
    render('/other/',tomeMarkup.replace('/category/nyuusyuhouhou/tomestone/','/category/glamour/'));
    assert.equal(d.querySelector('th').textContent,'セントリオ記章');
    const questBase = 'https://jp.finalfantasyxiv.com/lodestone/playguide/db/quest/';
    const bardQuest = questBase+'4c5e96e09d0/';
    render('/antiquated-storytellers-coat/',afMarkup('af/artefact3','吟遊詩人クエスト<br>『<a href="'+bardQuest+'">想い込められし歌</a>』<br>クエスト終了後にチェストを開けることで入手できます<br>再取得は遺失物管理人から再購入可能です<br>染色可能にするためには『禁断の地 エウレカ アネモス編』でアイテムを揃える必要があります'));
    assert.equal(d.querySelector('#instructions').textContent,'吟游诗人职业任务『和平颂歌』完成任务后，打开获得的装备箱即可领取装备。可在失物管理人处重新购买。若要获得可染色装备，需在禁地优雷卡 常风之地收集所需道具。');
    assert.equal(d.querySelector('#instructions a').href,bardQuest);
    const mainQuest = questBase+'34a689b3630/';
    const roleQuest = questBase+'5fec56883e2/';
    render('/weathered-wicce-coat/',afMarkup('af/artefact4','漆黒のヴィランズ 黒魔道士のアーティファクト(AF)です。<br>1:メインクエスト Lv79『<a href="'+mainQuest+'">輝きは不滅なりて</a>』をクリア<br>2:Lv80に到達<br>3:ソーサラー系DPSロールクエスト『<a href="'+roleQuest+'">やっと、また会えたね</a>』をクリア<br>染色可能装備は極シタデルボズヤ追憶戦で入手できます。')
      .replace('</section>','<a id="wrong-quest" href="'+roleQuest+'">輝きは不滅なりて</a><a id="foreign-quest" href="https://example.test/lodestone/playguide/db/quest/34a689b3630/">輝きは不滅なりて</a><p id="plain-quest">TANKロールクエスト『いつか君が言った言葉』をクリア</p></section>'));
    assert.equal(d.querySelector('#instructions').textContent,'暗影之逆焰的黑魔法师职业专属装备（AF）。1. 完成79级主线任务《光辉不灭》2. 达到80级3. 完成魔法进攻职业职能任务《终于又能见到你了》可染色装备可通过博兹雅堡垒追忆战获取。');
    assert.equal(d.querySelector('#plain-quest').textContent,'完成防护职业职能任务《你曾说过的话》');
    assert.equal(d.querySelector('#wrong-quest').textContent,'輝きは不滅なりて');
    assert.equal(d.querySelector('#foreign-quest').textContent,'輝きは不滅なりて');
    assert.equal(d.querySelector('#instructions a').href,mainQuest);
    render('/glamour-post/',afMarkup('glamour',basicAf));
    assert.equal(d.querySelector('#instructions').textContent,basicAf);
    render('/gaias-attire/',storeMarkup);
    assert.equal(d.querySelector('#store').textContent,'盖娅服装套装');
    assert.equal(d.querySelector('#store').href,store);
    assert.equal(d.querySelector('#foreign-store').textContent,gaia);
    assert.equal(d.querySelector('.a--h2rich-maincopy').textContent,'莫古莫古★大收集');
    assert.equal(d.querySelector('.a--h2rich-subcopy').hidden,true);
    assert.equal(d.querySelector('#event').textContent,'恋人节');
    render('/crafter-macro-generat/', '<h1 id="jinrPostTitle">クラフターマクロ生成ツール</h1><section id="postContent">'
      + '<h2>Crafter Macro Generat</h2><a id="launch" href="/wp-content/plugins/ff14-macro-tool/assets/tool.html?v=1785835485">FF14 制作マクロ自動生成ツール</a>'
      + '<a id="other" href="/other/">FF14 制作マクロ自動生成ツール</a><p>テスト中～！手作業でデータ登録しているので抜けが多いです</p></section>');
    assert.equal(d.querySelector('h1').textContent,'制作宏生成工具');
    assert.equal(d.querySelector('h2').textContent,'制作宏生成工具');
    assert.equal(d.querySelector('#launch').textContent,'FF14 制作宏自动生成工具');
    assert.equal(d.querySelector('#launch').search,'?v=1785835485');
    assert.equal(d.querySelector('#other').textContent,'FF14 制作マクロ自動生成ツール');
    assert.equal(d.querySelector('#postContent p').textContent,'テスト中～！手作業でデータ登録しているので抜けが多いです');
  } finally {
    for (const [key,value] of Object.entries(prior)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
    await dom.happyDOM.close();
  }
});

test('装備手帳中文搜索：原站 GET、候选选择及未匹配的原样提交', async () => {
  const keys = ['document','location','window','FormData','innerWidth','innerHeight','__zhxChineseSearchBound'];
  const prior = Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  const dom = new TestWindow({url:'https://attire.jp/field-commanders-coat/'});
  const urls = [];
  try {
    const d = dom.document;
    d.body.innerHTML = `<form role="search" method="get" id="JinrSearchBox" action="https://attire.jp/">
      <input type="search" class="a--searchform-input" name="s" placeholder="キーワードを入力して検索">
      <input type="hidden" name="post_type" value="post"><input type="submit"></form>
      <form role="search" method="get" action="/" class="wp-block-search"><input type="search" name="s"></form>
      <form role="search" method="get" action="https://foreign.invalid/"><input type="search" name="s"></form>
      <form method="post" action="/"><input name="s" type="search"><textarea>野战指挥官外套</textarea></form>`;
    Object.assign(globalThis,{document:d,window:dom,FormData:dom.FormData,innerWidth:1024,innerHeight:768,
      location:{href:dom.location.href,hostname:'attire.jp',assign:url=>urls.push(new URL(url))},__zhxChineseSearchBound:false});
    const {siteFiles} = readRuntimeV3('mirapri');
    assert.ok(_applyV3({candidatePolicy:1,identity:parseItemIds(siteFiles.itemIds.text)}));
    const search = createChineseSearchController();
    search.startChineseSearch('attire');
    _fireTablesReady();
    const [overlay,sidebar,foreign,comment] = d.querySelectorAll('form');
    const overlayInput = overlay.querySelector('[name="s"]');
    overlayInput.value = '野战指挥官外套';
    const submit = form => {
      const e = new dom.Event('submit',{bubbles:true,cancelable:true});
      form.dispatchEvent(e);
      return e.defaultPrevented;
    };
    assert.equal(submit(overlay),true);
    assert.equal(urls[0].origin,'https://attire.jp');
    assert.equal(urls[0].pathname,'/');
    assert.deepEqual([...urls[0].searchParams],[['post_type','post'],['s','フィールドコマンダーコート']]);
    assert.equal(overlayInput.value,'野战指挥官外套');
    const input = sidebar.querySelector('input');
    input.getBoundingClientRect = () => ({left:12,right:220,top:12,bottom:44,width:208,height:32});
    input.value = '雪崩斗手';
    input.dispatchEvent(new dom.Event('input',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,100));
    const choice = [...d.querySelectorAll('#zhx-chinese-suggest-list button')].find(b=>b.textContent.includes('雪崩斗手上衣'));
    assert.ok(choice,'原站侧栏输入框显示真实词库中的中文候选');
    const clicked = new dom.Event('pointerdown',{bubbles:true,cancelable:true});
    choice.dispatchEvent(clicked);
    assert.equal(urls.at(-1).searchParams.get('s'),'アバランチブロウラー・トップス');
    const count = urls.length;
    for (const text of ['没收录的任意中文','夜の幻装コート','フィールドコマンダーコート']) {
      input.value=text;
      assert.equal(submit(sidebar),false);
    }
    foreign.querySelector('input').value = overlayInput.value;
    comment.querySelector('input').value = overlayInput.value;
    assert.equal(submit(foreign),false);
    assert.equal(submit(comment),false);
    assert.equal(urls.length,count);
  } finally {
    for (const [key,value] of Object.entries(prior)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key]=value;
    }
    await dom.happyDOM.close();
  }
});
