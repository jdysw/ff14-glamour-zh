// Audit execution must be distinguished from complete seven-site scanning.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {summarizeLive,toManualV11,writeLiveReports} from '../../tools/coverage-audit/live-report.mjs';
import {SITES} from '../../tools/coverage-audit/audit.mjs';
import {redactItems,sanitizeEvidence} from '../../tools/coverage-audit/sanitize-evidence.mjs';
const at='2026-10-09T13:00:00Z';
const good=site=>({site,pageId:'home',
  url:site==='wiki'?'https://ff14.huijiwiki.com/wiki/物品:加特勒':SITES[site].pages[0].url,status:'ok',
  scannedAt:at,beforeCount:1,items:[{kind:'text',text:'搜索',before:'Search',
    path:'nav > button',ctx:{ui:true,user:false,ad:false}}]});
const bad=site=>({site,pageId:'home',url:SITES[site].pages[0].url,status:'failed',
  scannedAt:at,error:'Cloudflare / WAF',items:[]});
const part=summarizeLive([good('fc'),bad('mirapri')],at);
assert.equal(part.status,'partial');
assert.equal(part.bySite.mirapri.status,'failed');
assert.equal(part.bySite.ec.status,'failed');
assert.equal(part.pages.length,7);
const complete=summarizeLive(Object.keys(SITES).map(good),at);
assert.equal(complete.status,'scan-complete');
const v=toManualV11(complete);
assert.equal(v.format,'zhx-manual-audit-v2');
assert.equal(Object.keys(v.pages).length,7);
assert.ok(Object.values(v.pages).every(p=>!p.hasBaseline&&p.baselineQuality==='partial-inferred'));
const author=good('fc');
author.items=[{kind:'text',text:'玩家标题',before:'Author writing',path:'article > h2',
  ctx:{user:true,ui:false,ad:false}}];
const redacted=toManualV11(summarizeLive([author],at));
assert.equal(Object.values(redacted.pages).find(p=>p.site==='fc').items[0].text,'[内容已隐藏]');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'audit-live-'));
try{
  writeLiveReports(part,temp);
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'coverage-audit-live.json'))).status,'partial');
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'coverage-audit-live-v1.1.json'))).format,'zhx-manual-audit-v2');
  assert.match(fs.readFileSync(path.join(temp,'coverage-audit-live.md'),'utf8'),/WAF/);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
const redactedItems=redactItems([{kind:'text',text:'玩家标题',
  path:'div#gallery > article > h2.title',ctx:{user:false,ui:true,tag:'h2',cls:'title',ancestors:'gallery article-info'}}],'mirapri');
assert.equal(redactedItems[0].ctx.scope,'user');
assert.equal(redactedItems[0].text,'[内容已隐藏]');
const rawDir=fs.mkdtempSync(path.join(os.tmpdir(),'audit-raw-'));
const pubDir=fs.mkdtempSync(path.join(os.tmpdir(),'audit-pub-'));
try{
  fs.writeFileSync(path.join(rawDir,'fc-test.json'),JSON.stringify({...good('fc'),items:[{kind:'text',text:'玩家创作',
    path:'div.post-title',ctx:{user:true,ui:false}}]}));
  assert.equal(sanitizeEvidence(rawDir,pubDir),1);
  assert.doesNotMatch(fs.readFileSync(path.join(pubDir,'fc-test.json'),'utf8'),/玩家创作/);
}finally{fs.rmSync(rawDir,{recursive:true,force:true});fs.rmSync(pubDir,{recursive:true,force:true});}
console.log('✅ live-report: strict completeness, V1.1 compatibility, privacy redaction');
