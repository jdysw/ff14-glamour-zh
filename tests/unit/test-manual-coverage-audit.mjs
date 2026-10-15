import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const req=createRequire(import.meta.url);
const C=req('../../tools/manual-coverage-audit/audit-core.js');
const current={format:'zhx-manual-audit-v2',pages:{},baselines:{},settings:{}};
assert.deepEqual(C.readAudit(current),current,'Current audit records must remain readable');
assert.throws(()=>C.readAudit({format:'zhx-manual-audit-v1',pages:{}}),/zhx-manual-audit-v2/);
assert.equal(C.urlKey('https://mirapri.com/posts?token=x&sort=recent#i'),'https://mirapri.com/posts/?sort=recent');
assert.equal(C.allowedRoute('https://mirapri.com/login'),false);
assert.equal(C.siteFor('https://end-closet.com/detail/abc'),'endcloset');
for(const [url,lang] of [['https://miramiru.co/','ja'],['https://miramiru.co/en','en'],['https://miramiru.co/ko/mirapuri/abc','ko']]){
  assert.equal(C.siteFor(url),'miramiru');assert.equal(C.pageLanguage(url),lang);
}
assert.notEqual(C.urlKey('https://miramiru.co/en'),C.urlKey('https://miramiru.co/ko'));
assert.equal(C.allowedRoute('https://miramiru.co/ko/settings'),false);
assert.equal(C.siteFor('https://miramiru.co.evil.test/'),null);
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
