// Public, read-only checks for the 2026-10-15 audit follow-up. No submissions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scanUrlLocal} from '../../tools/coverage-audit/run-scan.mjs';
import {classifyResiduals} from '../../tools/coverage-audit/audit.mjs';
import {ensureChrome} from '../helpers/chrome.mjs';
const port=Number(process.env.ZHX_CDP_PORT||9223);
const chrome=await ensureChrome(port);
const itemsTsv=fs.readFileSync(new URL('../../data/ff14-items.tsv',import.meta.url),'utf8');
const failures=[];
const routes=['contests','news','statistics','about','support','?login=true','new']
  .filter(route=>!process.env.ZHX_FOLLOWUP_ROUTES||process.env.ZHX_FOLLOWUP_ROUTES.split(',').includes(route));
assert.ok(routes.length,'Select at least one known public route');
try{
  for(const locale of ['ja','en','ko'])for(const route of routes){
    const prefix=locale==='ja'?'':'/'+locale;
    const url='https://miramiru.co'+prefix+'/'+route;
    const result=await scanUrlLocal({site:'miramiru',pageId:locale+':'+route,url,port,itemsTsv,waitMs:1500});
    const candidates=classifyResiduals(result.items.map(it=>({...it,site:'miramiru'})))
      .filter(it=>['real','wrong'].includes(it.category));
    if(candidates.length){
      const failure={url,text:candidates.map(it=>it.text)};failures.push(failure);console.log('REVIEW '+JSON.stringify(failure));
    }else console.log('PASS follow-up public UI: '+url);
  }
  assert.deepEqual(failures,[],'Unexpected residuals in bounded public UI samples');
}finally{if(chrome.spawned)chrome.stop()}
