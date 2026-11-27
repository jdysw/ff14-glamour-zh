#!/usr/bin/env node
// Explicit scan completion status and privacy-redacted bridge to V1.1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SITES, CACHE_DIR, buildReport, classifyResiduals, isAuditResultFile } from './audit.mjs';
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
      if(!entry.isFile()||!isAuditResultFile(entry.name))continue;
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
    if(!selected.some(r=>r.site===site))selected.push({site,pageId:'runner',url:site==='wiki'?'https://ff14.huijiwiki.com/wiki/':SITES[site].pages[0].url,
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
    // A runner can stop before saving its planned seed pages. One valid page
    // is not proof that the configured audit was completed.
    const attempted=new Set(list.map(p=>p.pageId));
    const required=SITES[site].pages.map(p=>site==='wiki'&&p.url.startsWith('fixture:')?'item-live':p.id);
    const missingSeeds=required.filter(id=>!attempted.has(id));
    const labels=list.filter(p=>p.status==='ok').flatMap(p=>p.items.filter(it=>it.ctx?.scope==='item'));
    const assessed=labels.filter(it=>typeof it.itemLabelForeign==='boolean');
    bySite[site]={status:!ok?'failed':failed||missingSeeds.length?'partial':'scan-complete',scanned:list.length,ok,failed,missingSeeds,
      itemLabels:{observed:labels.length,assessed:assessed.length,foreign:assessed.filter(it=>it.itemLabelForeign).length}};
  }
  const states=Object.values(bySite);
  const status=states.every(s=>s.status==='scan-complete')?'scan-complete':
    states.some(s=>s.ok)?'partial':'failed';
  const groups=new Map();
  for(const p of pages){
    if(p.status!=='ok')continue;
    for(const it of p.items){
      if(it.redacted||it.ctx?.scope!=='ui'||!['real','wrong'].includes(it.category))continue;
      const key=JSON.stringify([p.site,it.text]);
      const g=groups.get(key)||{site:p.site,text:it.text,occurrences:0,pageIds:new Set(),collapsed:0};
      g.occurrences++;
      g.pageIds.add(p.pageId);
      if(it.ctx?.collapsed)g.collapsed++;
      groups.set(key,g);
    }
  }
  const candidates=[...groups.values()].map(g=>({...g,pageIds:[...g.pageIds],pages:g.pageIds.size}))
    .sort((a,b)=>b.pages-a.pages||b.occurrences-a.occurrences||a.site.localeCompare(b.site)||a.text.localeCompare(b.text));
  return {generatedAt:now,status,scope:'bounded public pages, NOT site-wide localization coverage',
    stats:coverageStats(pages),bySite,candidates,pages};
}
function toV11Item(it){
  const ctx={...(it.ctx||{})};
  ctx.scope=ctx.ad?'ad':ctx.user?'user':ctx.scope||
    (it.kind==='document:title'?'metadata':it.kind==='attr:alt'?'unknown':ctx.ui?'ui':'unknown');
  ctx.ui=ctx.scope==='ui';ctx.user=ctx.scope==='user';
  const safe=manual.sanitizeItem({...it,ctx,stablePath:it.stablePath||it.path},false);
  if(['unknown','metadata','ad'].includes(safe.ctx.scope)){
    safe.text='[未确认内容已隐藏]';
    if(safe.before!=null)safe.before='[未确认内容已隐藏]';
  }
  return safe;
}
export function toManualAudit(report){
  const pages={};
  for(const p of report.pages){
    const items=manual.normalizeItems(p.items||[],p.site).map(toV11Item);
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
// Redacted evidence remains useful without recovering or exporting the
// actual website label. Candidate IDs are public Item table identities.
export function collectItemReview(pages){
  return pages.filter(p=>p.status==='ok').flatMap(p=>p.items.flatMap(it=>{
    if(it.ctx?.scope!=='item')return [];
    const identity=it.itemIdentityEvidence;
    if(!it.itemLabelForeign&&!['name-needs-review','ambiguous-source'].includes(identity?.status))return [];
    return [{site:p.site,pageId:p.pageId,kind:it.kind,path:it.stablePath||it.path,
      foreign:it.itemLabelForeign===true,identity:identity||{status:'unassessed'}}];
  }));
}
export function writeLiveReports(report,out){
  fs.mkdirSync(out,{recursive:true});
  const {pages,candidates,...summary}=report;
  summary.distinctUiCandidates=candidates.length;
  const itemReview=collectItemReview(pages);
  summary.itemReviewOccurrences=itemReview.length;
  fs.writeFileSync(path.join(out,'coverage-audit-live-item-review.json'),JSON.stringify(itemReview,null,2)+'\n','utf8');
  fs.writeFileSync(path.join(out,'coverage-audit-live-candidates.json'),JSON.stringify(candidates,null,2)+'\n','utf8');
  const header=['# FF14 汉化审计（'+Object.keys(report.bySite).length+' 站）','',
    '本轮扫描状态：**'+summary.status+'**（仅限采集到的页面，不能代表整站汉化率）','',
    '|站点|状态|有效页面|失败页面|未采集种子|','|---|---|---:|---:|---:|'];
  for(const [k,v] of Object.entries(report.bySite))
    header.push('|'+k+'|'+v.status+'|'+v.ok+'|'+v.failed+'|'+v.missingSeeds.length+'|');
  header.push('','WAF、404、跨站跳转、超时均记为失败，不得当作零漏译。','',
    '## 物品标签独立复核','',
    '以下为已采集标签的出现次数（不是不同物品数）。仅检测日文假名和韩文，不能证明名称官译正确；历史证据没有标记的标签列为未评估。','',
    '|站点|标签出现次数|已评估|含日/韩文|未评估|','|---|---:|---:|---:|---:|');
  for(const [k,v] of Object.entries(report.bySite)){
    const x=v.itemLabels;
    header.push('|'+k+'|'+x.observed+'|'+x.assessed+'|'+(x.assessed?x.foreign:'—')+'|'+(x.observed-x.assessed)+'|');
  }
  header.push('');
  fs.writeFileSync(path.join(out,'coverage-audit-live.md'),header.join('\n')+'\n'+buildReport(pages),'utf8');
  fs.writeFileSync(path.join(out,'coverage-audit-live.json'),JSON.stringify(summary,null,2)+'\n','utf8');
  fs.writeFileSync(path.join(out,'coverage-audit-live-manual.json'),JSON.stringify(toManualAudit(report),null,2)+'\n','utf8');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  const opt=(key,fallback)=>{const i=args.indexOf(key);return i>=0&&args[i+1]?args[i+1]:fallback;};
  const report=summarizeLive(loadLiveResults(path.resolve(opt('--input',CACHE_DIR))));
  writeLiveReports(report,path.resolve(opt('--out','tests/.cache/coverage-report')));
  console.log(JSON.stringify({status:report.status,stats:report.stats,bySite:report.bySite,distinctUiCandidates:report.candidates.length,topUiCandidates:report.candidates.slice(0,100)},null,2));
  if(args.includes('--strict')&&report.status!=='scan-complete')process.exitCode=1;
}
