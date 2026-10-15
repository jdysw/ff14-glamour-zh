// Audit execution must be distinguished from complete seven-site scanning.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {summarizeLive,toManualAudit,writeLiveReports,loadLiveResults} from '../../tools/coverage-audit/live-report.mjs';
import {SITES} from '../../tools/coverage-audit/audit.mjs';
import {redactItems,sanitizeEvidence} from '../../tools/coverage-audit/sanitize-evidence.mjs';
// The report requires every configured site; CI must schedule the same set.
const workflow=fs.readFileSync(new URL('../../.github/workflows/live-coverage-audit.yml',import.meta.url),'utf8');
const matrix=workflow.match(/site: \[([^\]]+)\]/)?.[1].split(',').map(s=>s.trim());
assert.deepEqual(matrix?.sort(),Object.keys(SITES).sort(),'CI matrix must include every audit site');
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
assert.equal(part.pages.length,Object.keys(SITES).length);
const complete=summarizeLive(Object.keys(SITES).map(good),at);
assert.equal(complete.status,'scan-complete');
const v=toManualAudit(complete);
assert.equal(v.format,'zhx-manual-audit-v2');
assert.equal(Object.keys(v.pages).length,Object.keys(SITES).length);
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
}finally{fs.rmSync(rawDir,{recursive:true,force:true});fs.rmSync(pubDir,{recursive:true,force:true});}
console.log('✅ live-report: strict completeness, current manual audit export, privacy redaction');
