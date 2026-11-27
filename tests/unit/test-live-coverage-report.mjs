// Audit execution must be distinguished from complete seven-site scanning.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {summarizeLive,toManualAudit,writeLiveReports,loadLiveResults,collectItemReview} from '../../tools/coverage-audit/live-report.mjs';
import {SITES} from '../../tools/coverage-audit/audit.mjs';
import {SITE_POLICIES} from '../../src/core/site-policy.js';
import {redactItems,sanitizeEvidence,indexOfficialItems} from '../../tools/coverage-audit/sanitize-evidence.mjs';
// The report requires every configured site; CI must schedule the same set.
const workflow=fs.readFileSync(new URL('../../.github/workflows/live-coverage-audit.yml',import.meta.url),'utf8');
const matrix=workflow.match(/site: \[([^\]]+)\]/)?.[1].split(',').map(s=>s.trim());
assert.deepEqual(matrix?.sort(),Object.keys(SITES).sort(),'CI matrix must include every audit site');
assert.deepEqual(Object.keys(SITES).sort(), SITE_POLICIES.map(site=>site.id).sort(), 'Every production adapter must have a live-audit entry');
const at='2026-10-09T13:00:00Z';
const good=(site,p=SITES[site].pages[0])=>({site,pageId:site==='wiki'?'item-live':p.id,
  url:site==='wiki'?'https://ff14.huijiwiki.com/wiki/物品:加特勒':p.url,status:'ok',
  scannedAt:at,beforeCount:1,items:[{kind:'text',text:'搜索',before:'Search',
    path:'nav > button',ctx:{ui:true,user:false,ad:false}}]});
const bad=site=>({site,pageId:'home',url:SITES[site].pages[0].url,status:'failed',
  scannedAt:at,error:'Cloudflare / WAF',items:[]});
const part=summarizeLive([good('fc'),bad('mirapri')],at);
assert.equal(part.status,'partial');
assert.equal(part.bySite.mirapri.status,'failed');
assert.equal(part.bySite.ec.status,'failed');
assert.equal(part.pages.length,Object.keys(SITES).length);
const partialSeeds=summarizeLive(Object.keys(SITES).map(site=>good(site)),at);
assert.equal(partialSeeds.status,'partial');
assert.ok(partialSeeds.bySite.attire.missingSeeds.includes('dawntrail'));
const complete=summarizeLive(Object.entries(SITES).flatMap(([site,cfg])=>cfg.pages.map(p=>good(site,p))),at);
assert.equal(complete.status,'scan-complete');
assert.ok(Object.values(complete.bySite).every(s=>s.missingSeeds.length===0));
const example=good('attire');
example.items=[{kind:'text',text:'入手方法',before:'入手方法',path:'h2',ctx:{scope:'ui',ui:true,collapsed:true}},
  {kind:'text',text:'入手方法',before:'入手方法',path:'h3',ctx:{scope:'ui',ui:true}},
  {kind:'text',text:'非公開',redacted:true,ctx:{scope:'ui',ui:true}}];
const groups=summarizeLive([example],at).candidates;
assert.equal(groups.length,1);
assert.equal(groups[0].occurrences,2);
assert.equal(groups[0].pages,1);
assert.equal(groups[0].collapsed,1);
const v=toManualAudit(complete);
assert.equal(v.format,'zhx-manual-audit-v2');
assert.equal(Object.keys(v.pages).length,complete.pages.length);
assert.ok(Object.values(v.pages).every(p=>!p.hasBaseline&&p.baselineQuality==='partial-inferred'));
const author=good('fc');
author.items=[{kind:'text',text:'玩家标题',before:'Author writing',path:'article > h2',
  ctx:{user:true,ui:false,ad:false}}];
const redacted=toManualAudit(summarizeLive([author],at));
assert.equal(Object.values(redacted.pages).find(p=>p.site==='fc').items[0].text,'[内容已隐藏]');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'audit-live-'));
try{
  writeLiveReports(part,temp);
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'coverage-audit-live.json'))).status,'partial');
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'coverage-audit-live-manual.json'))).format,'zhx-manual-audit-v2');
  assert.match(fs.readFileSync(path.join(temp,'coverage-audit-live.md'),'utf8'),/WAF/);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
const redactedItems=redactItems([{kind:'text',text:'玩家标题',
  path:'div#gallery > article > h2.title',ctx:{user:false,ui:true,tag:'h2',cls:'title',ancestors:'gallery article-info'}}],'mirapri');
assert.equal(redactedItems[0].ctx.scope,'user');
assert.equal(redactedItems[0].text,'[内容已隐藏]');
const itemEvidence=redactItems([
  {kind:'text',text:'未翻訳の装備名',path:'a',ctx:{scope:'item'}},
  {kind:'text',text:'已翻译的装备',path:'b',ctx:{scope:'item'}},
  {kind:'text',text:'[内容已隐藏]',redacted:true,path:'c',ctx:{scope:'item'}},
],'attire');
assert.equal(itemEvidence[0].itemLabelForeign,true);
assert.equal(itemEvidence[1].itemLabelForeign,false);
assert.equal(itemEvidence[2].itemLabelForeign,undefined);
assert.ok(itemEvidence.every(it=>it.text==='[内容已隐藏]'));
const labelReport=summarizeLive([{...good('attire'),items:itemEvidence}],at);
assert.deepEqual(labelReport.bySite.attire.itemLabels,{observed:3,assessed:2,foreign:1});
assert.equal(labelReport.candidates.length,0);
const official=indexOfficialItems('id\tzh\ten\tja\ta\tb\tc\td\te\n9289\t朴素长裙\tplain long skirt\tロングスカート\t1\t1\t1\t1\t1\n');
const idEvidence=redactItems([
  {kind:'text',before:'ロングスカート',text:'长裙',path:'a',ctx:{scope:'item'}},
  {kind:'text',before:'ロングスカート',text:'朴素长裙',path:'b',ctx:{scope:'item'}},
  {kind:'text',before:'玩家原创名称',text:'未翻訳',path:'c',ctx:{scope:'item'}},
  {kind:'text',before:'ロングスカート',text:'玩家私人内容',path:'d',ctx:{scope:'user',user:true}},
],'fc',official);
assert.deepEqual(idEvidence[0].itemIdentityEvidence,{status:'name-needs-review',candidateIds:['9289'],candidateCount:1});
assert.equal(idEvidence[1].itemIdentityEvidence.status,'name-match');
assert.equal(idEvidence[2].itemIdentityEvidence.status,'unmatched-source');
assert.equal(idEvidence[3].itemIdentityEvidence,undefined);
assert.doesNotMatch(JSON.stringify(idEvidence),/玩家原创名称|玩家私人内容|ロングスカート|朴素长裙/);
const itemReview=collectItemReview(summarizeLive([{...good('fc'),items:idEvidence}],at).pages);
assert.equal(itemReview.length,2);
assert.deepEqual(itemReview[0].identity.candidateIds,['9289']);
const ronkaLabels=redactItems([
  {kind:'text',text:'경비원 권총집 조끼',path:'p',ctx:{scope:'item',ancestors:'post-content post-item-information'}},
  {kind:'text',text:'保镖枪带背心',path:'p',ctx:{scope:'item',ancestors:'post-content post-item-information'}},
  {kind:'text',text:'유저 X',path:'p.filter-item-active',ctx:{scope:'user',queryEcho:true}},
],'ronka');
assert.deepEqual(ronkaLabels.map(it=>it.ctx.scope),['item','item','user']);
assert.ok(ronkaLabels.every(it=>it.redacted&&it.text==='[内容已隐藏]'));
assert.deepEqual(summarizeLive([{...good('ronka'),items:ronkaLabels}],at).bySite.ronka.itemLabels,{observed:2,assessed:2,foreign:1});
const rawDir=fs.mkdtempSync(path.join(os.tmpdir(),'audit-raw-'));
const pubDir=fs.mkdtempSync(path.join(os.tmpdir(),'audit-pub-'));
try{
  fs.writeFileSync(path.join(rawDir,'fc-test.json'),JSON.stringify({...good('fc'),items:[{kind:'text',text:'玩家创作',
    path:'div.post-title',ctx:{user:true,ui:false}}]}));
  assert.equal(sanitizeEvidence(rawDir,pubDir),1);
  assert.doesNotMatch(fs.readFileSync(path.join(pubDir,'fc-test.json'),'utf8'),/玩家创作/);
  fs.writeFileSync(path.join(rawDir,'miramiru-home-ja.json'),JSON.stringify(good('miramiru')));
  assert.equal(sanitizeEvidence(rawDir,pubDir),2);
  assert.ok(loadLiveResults(pubDir).some(row=>row.site==='miramiru'));
  const attire=good('attire');
  attire.items=[
    {kind:'text',text:'入手方法',path:'h2',ctx:{ui:true,user:false,scope:'ui',cls:'a--post-title'}},
    {kind:'text',text:'玩家作品标题',path:'h1',ctx:{ui:false,user:true,scope:'user'}},
  ];
  fs.writeFileSync(path.join(rawDir,'attire-home.json'),JSON.stringify(attire));
  assert.equal(sanitizeEvidence(rawDir,pubDir),3);
  assert.ok(loadLiveResults(pubDir).some(row=>row.site==='attire'));
  const safe=fs.readFileSync(path.join(pubDir,'attire-home.json'),'utf8');
  assert.match(safe,/入手方法/);
  assert.doesNotMatch(safe,/玩家作品标题/);
}finally{fs.rmSync(rawDir,{recursive:true,force:true});fs.rmSync(pubDir,{recursive:true,force:true});}
console.log('✅ live-report: strict completeness, current manual audit export, privacy redaction');
