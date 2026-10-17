import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {Window as TestWindow} from 'happy-dom';
const req=createRequire(import.meta.url);
const C=req('../../tools/manual-coverage-audit/audit-core.js');
const current={format:'zhx-manual-audit-v2',pages:{},baselines:{},settings:{}};
assert.deepEqual(C.readAudit(current),current,'Current audit records must remain readable');
assert.throws(()=>C.readAudit({format:'zhx-manual-audit-v1',pages:{}}),/zhx-manual-audit-v2/);
assert.equal(C.urlKey('https://mirapri.com/posts?token=x&sort=recent#i'),'https://mirapri.com/posts/?sort=recent');
assert.equal(C.allowedRoute('https://mirapri.com/login'),false);
assert.equal(C.siteFor('https://end-closet.com/detail/abc'),'endcloset');
assert.equal(C.siteFor('https://mirapri.ff14eden.work/#/'),'eden');
assert.equal(C.siteFor('https://xivc.app/'),'xivc');
assert.equal(C.siteFor('https://evilxivc.app/'),null);
assert.equal(C.allowedRoute('https://xivc.app/?token=secret&q=player&sort=popular#unknown'),true);
assert.equal(C.urlKey('https://xivc.app/?token=secret&q=player&zhx-search=private&zhx-slot=body&sort=popular#unknown'),'https://xivc.app/');
assert.equal(C.allowedRoute('https://xivc.app/unknown'),false);
assert.equal(C.urlKey('https://mirapri.ff14eden.work/#/components/popular-equipment?search=private&token=secret'),'https://mirapri.ff14eden.work/#/components/popular-equipment');
assert.notEqual(C.urlKey('https://mirapri.ff14eden.work/#/'),C.urlKey('https://mirapri.ff14eden.work/#/components/popular-equipment'));
assert.equal(C.allowedRoute('https://mirapri.ff14eden.work/#/components/profile'),false);
for(const [url,lang] of [['https://miramiru.co/','ja'],['https://miramiru.co/en','en'],['https://miramiru.co/ko/mirapuri/abc','ko']]){
  assert.equal(C.siteFor(url),'miramiru');assert.equal(C.pageLanguage(url),lang);
}
assert.notEqual(C.urlKey('https://miramiru.co/en'),C.urlKey('https://miramiru.co/ko'));
assert.equal(C.allowedRoute('https://miramiru.co/ko/settings'),false);
assert.equal(C.siteFor('https://miramiru.co.evil.test/'),null);
const xivcDom=new TestWindow({url:'https://xivc.app/'});
xivcDom.document.body.innerHTML='<div class="preset-name">My preset</div>'
  +'<div id="item-grid"><div class="item-card"><span class="item-card-name">Cedar Chest</span></div></div>'
  +'<div id="slot-list">'
  +'<div class="slot-row"><div class="slot-name">Head</div><div class="slot-item">Cedar Hat</div></div>'
  +'<div class="slot-row"><div class="slot-name" data-zhx-xivc-native="Body">身体</div><div class="slot-item">Cedar Chest</div></div>'
  +'<div class="slot-row"><div class="slot-name">Race</div><div class="slot-item">Midlander</div></div></div>'
  +'<div class="unequip-card"><span>Back</span><span>No Dye</span><span>Unequip</span></div>'
  +'<div class="preset-actions" title="Save preset">Save</div>';
const xivcContext=selector=>C.classifyContext(xivcDom.document.querySelector(selector),'text','xivc',xivcDom.location.href);
const presetContext=xivcContext('.preset-name');
assert.equal(presetContext.scope,'user');
assert.equal(C.category({kind:'text',text:'My preset',ctx:presetContext}),'excluded-user');
for(const selector of ['#item-grid .item-card-name','#slot-list .slot-row:nth-of-type(1) .slot-item',
  '#slot-list .slot-row:nth-of-type(2) .slot-item']){
  const itemContext=xivcContext(selector);
  assert.equal(itemContext.scope,'item');
  assert.equal(C.category({kind:'text',text:'Cedar Gear',ctx:itemContext}),'item-review');
}
const raceSlot=xivcContext('#slot-list .slot-row:nth-of-type(3) .slot-item');
assert.equal(raceSlot.scope,'ui');
assert.equal(C.category({kind:'text',text:'Midlander',ctx:raceSlot}),'suspected-no-baseline');
for(const text of ['Back','No Dye','Unequip']){
  const control=xivcDom.document.querySelector('.unequip-card span');
  control.textContent=text;
  const uiContext=C.classifyContext(control,'text','xivc',xivcDom.location.href);
  assert.equal(uiContext.scope,'ui');
  assert.equal(C.category({kind:'text',text,ctx:uiContext}),'suspected-no-baseline');
}
const presetActions=xivcDom.document.querySelector('.preset-actions');
const titleContext=C.classifyContext(presetActions,'attr:title','xivc',xivcDom.location.href);
assert.equal(titleContext.scope,'ui');
assert.equal(C.category({kind:'attr:title',text:presetActions.title,ctx:titleContext}),'suspected-no-baseline');
xivcDom.happyDOM.abort();
const node=(tag,classes,sel)=>({tagName:tag,id:'',className:classes,
  parentElement:null,closest:s=>sel&&s.includes(sel)?{}:null,getAttribute:()=>null});
assert.equal(C.classifyContext(node('H2','title','#gallery article h2.title'),'text','mirapri','https://mirapri.com/').scope,'user');
assert.equal(C.classifyContext(node('BUTTON','',''),'text','mirapri','https://mirapri.com/').scope,'ui');
assert.equal(C.classifyContext(node('IMG','glamour-card',''),'attr:alt','ec','https://ffxiv.eorzeacollection.com/').scope,'user');
assert.equal(C.classifyContext(node('SPAN','','a.eorzeadb_link'),'text','miramiru','https://miramiru.co/en/mirapuri/abc').scope,'item');
assert.equal(C.classifyContext(node('H1','','h1'),'text','miramiru','https://miramiru.co/mirapuri/abc').scope,'user');
assert.equal(C.classifyContext(node('SPAN','','/users/'),'text','miramiru','https://miramiru.co/ko').scope,'user');
assert.equal(C.classifyContext(node('BUTTON','',''),'text','miramiru','https://miramiru.co/ko').scope,'ui');
const customTag=node('SPAN','','');
customTag.closest=selector=>selector==='a[href*="?tag="]'?{}:selector==='[data-slot="badge"]'?{textContent:'#ハイランダー (41)'}:null;
assert.equal(C.classifyContext(customTag,'text','miramiru','https://miramiru.co/en/statistics').scope,'user');
assert.equal(C.classifyContext(node('P','whitespace-pre-wrap','main'),'text','miramiru','https://miramiru.co/en/faq').scope,'ui');
assert.equal(C.classifyContext(node('P','whitespace-pre-wrap','main .whitespace-pre-wrap'),'text','miramiru','https://miramiru.co/en/mirapuri/abc').scope,'user');
for (const text of ['Miramiru','FINAL FANTASY XIV © SQUARE ENIX CO., LTD. All Rights Reserved.']) {
  assert.equal(C.category({kind:'text',text,ctx:{scope:'ui'}}),'exempt-ui');
}
for(const text of ['装備一覧','장비 목록','Equipment List'])assert.equal(C.category({kind:'text',text,ctx:{scope:'ui'}}),'suspected-no-baseline');
const it=(text,path,scope='ui')=>({kind:'text',text,path,ctx:{scope,name:''}});
const pair=C.pair([it('検索','button#search')],[it('搜索','button#search')]);
assert.equal(pair.matched,1);assert.equal(pair.items[0].before,'検索');
assert.equal(C.category(pair.items[0]),'translated');
assert.equal(C.category(it('検索する','somewhere')),'suspected-no-baseline');
assert.equal(C.sanitizeItem(it('private player','x','user')).text,'[内容已隐藏]');
const old=[{status:'ok',site:'fc',url:'https://ff14-fc.com/',state:'a',items:[it('検索する','x')]}];
const now=[{status:'ok',site:'fc',url:'https://ff14-fc.com/',state:'a',items:[it('搜索','x')]}];
assert.equal(C.compareRuns(old,now).resolved.length,1);
assert.equal(C.compareRuns(old,[{...now[0],url:'https://ff14-fc.com/other/'}]).resolved.length,0);
const raw=fs.readFileSync(new URL('../../tools/manual-coverage-audit/FF14-Coverage-Audit-V1.1.user.js',import.meta.url),'utf8');
assert.ok(raw.includes('@run-at       document-start'));
assert.ok(raw.includes('@match        https://miramiru.co/*'));
assert.ok(raw.includes('inferred-old-value'));
assert.ok(raw.includes('原文基线'));
console.log('✅ manual coverage audit V1.1: cross-site scope, pairing, privacy, diff and install script');
