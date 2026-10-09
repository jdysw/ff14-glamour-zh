#!/usr/bin/env node
// Explicit scan completion status and privacy-redacted bridge to V1.1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SITES, CACHE_DIR, buildReport, classifyResiduals } from './audit.mjs';
import { coverageStats, latestResults, templateKey } from './coverage-core.mjs';
const require = createRequire(import.meta.url);
const manual = require('../manual-coverage-audit/audit-core.js');

export function loadLiveResults(dir) {
  const rows=[];
  if (!fs.existsSync(dir)) return rows;
  const visit=folder=>{
    for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
      const full=path.join(folder,entry.name);
      if(entry.isDirectory()){visit(full);continue;}
      if(!entry.isFile()||!/^(mirapri|ec|fc|ronka|collection|endcloset|wiki)-.+\.json$/.test(entry.name))continue;
      try {
        const d=JSON.parse(fs.readFileSync(full,'utf8'));
        if(d.site&&(Array.isArray(d.items)||Array.isArray(d.pages)))rows.push(d);
      }catch(e){console.error('Skipping bad evidence '+full+': '+e.message);}
    }
  };
  visit(dir);
  return rows;
}
export function summarizeLive(rows,now=new Date().toISOString()){
  const expected=Object.keys(SITES);
  const selected=latestResults(rows);
  for(const site of expected){
    if(!selected.some(r=>r.site===site))selected.push({site,pageId:'runner',url:SITES[site].pages[0].url,
      status:'failed',error:'No evidence saved for this site',scannedAt:now,items:[]});
  }
  const pages=selected.map(p=>{
    const ok=p.status==='ok'&&!p.error;
    return {...p,status:ok?'ok':'failed',items:ok?classifyResiduals((p.items||[]).map(it=>({...it,site:p.site}))):[],
      error:ok?null:(p.error||'Scanner did not finish'),template:p.template||templateKey(p.url)};
  });
  const bySite={};
  for(const site of expected){
    const list=pages.filter(p=>p.site===site);
    const ok=list.filter(p=>p.status==='ok').length,failed=list.length-ok;
    bySite[site]={status:!ok?'failed':failed?'partial':'scan-complete',scanned:list.length,ok,failed};
  }
  const states=Object.values(bySite);
  const status=states.every(s=>s.status==='scan-complete')?'scan-complete':
    states.some(s=>s.ok)?'partial':'failed';
  return {generatedAt:now,status,scope:'bounded public pages, NOT site-wide localization coverage',
    stats:coverageStats(pages),bySite,pages};
}
function toV11Item(it){
  const ctx={...(it.ctx||{})};
  ctx.scope=ctx.ad?'ad':ctx.user?'user':ctx.scope||
    (it.kind==='document:title'?'metadata':it.kind==='attr:alt'?'unknown':ctx.ui?'ui':'unknown');
  ctx.ui=ctx.scope==='ui';ctx.user=ctx.scope==='user';
  return manual.sanitizeItem({...it,ctx,stablePath:it.stablePath||it.path},false);
}
export function toManualV11(report){
  const pages={};
  for(const p of report.pages){
    const items=(p.items||[]).map(toV11Item);
    const paired=items.some(it=>it.before!=null);
    const url=manual.urlKey(p.url);
    const key=manual.snapshotKey(url,'default',p.pageId||'');
    pages[key]={site:p.site,url,pageId:p.pageId,key,state:'default',label:p.pageId||'',
      round:'ci-live',status:p.status,error:p.error||null,template:p.template,
      scannedAt:p.scannedAt,baselineQuality:paired?'partial-inferred':'none',
      hasBaseline:false,beforeCount:p.beforeCount||null,items};
  }
  return {format:'zhx-manual-audit-v2',createdAt:report.generatedAt,
    source:'ci-live',settings:{evidence:'best-effort paired; not manual verified'},
    baselines:{},pages};
}
export function writeLiveReports(report,out){
  fs.mkdirSync(out,{recursive:true});
  const {pages,...summary}=report;
  const header=['# FF14 七站自动化汉化审计','',
    '本轮扫描状态：**'+summary.status+'**（仅限采集到的页面，不能代表整站汉化率）','',
    '|站点|状态|有效页面|失败页面|','|---|---|---:|---:|'];
  for(const [k,v] of Object.entries(report.bySite))
    header.push('|'+k+'|'+v.status+'|'+v.ok+'|'+v.failed+'|');
  header.push('','WAF、404、跨站跳转、超时均记为失败，不得当作零漏译。','');
  fs.writeFileSync(path.join(out,'coverage-audit-live.md'),header.join('\n')+'\n'+buildReport(pages),'utf8');
  fs.writeFileSync(path.join(out,'coverage-audit-live.json'),JSON.stringify(summary,null,2)+'\n','utf8');
  fs.writeFileSync(path.join(out,'coverage-audit-live-v1.1.json'),JSON.stringify(toManualV11(report),null,2)+'\n','utf8');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  const opt=(key,fallback)=>{const i=args.indexOf(key);return i>=0&&args[i+1]?args[i+1]:fallback;};
  const report=summarizeLive(loadLiveResults(path.resolve(opt('--input',CACHE_DIR))));
  writeLiveReports(report,path.resolve(opt('--out','tests/.cache/coverage-report')));
  console.log(JSON.stringify({status:report.status,stats:report.stats,bySite:report.bySite},null,2));
  if(args.includes('--strict')&&report.status!=='scan-complete')process.exitCode=1;
}
