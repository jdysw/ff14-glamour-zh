#!/usr/bin/env node
/* Browser-based localization coverage report: supports V1 and V1.1 exports. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const C=require('./audit-core.js');
const argv=process.argv.slice(2);
if(!argv[0]||argv.includes('--help')){
  console.log('用法：node generate-report.mjs <v1或v2审计.json> [输出目录] [--compare <旧版本.json>]');
  process.exit(argv.includes('--help')?0:2);
}
const input=path.resolve(argv[0]),out=path.resolve(argv[1]?.startsWith('--')||!argv[1]?path.dirname(input):argv[1]);
const ci=argv.indexOf('--compare');
const old=ci>=0&&argv[ci+1]?path.resolve(argv[ci+1]):null;
function read(file){const d=JSON.parse(fs.readFileSync(file,'utf8'));return C.migrate(d)}
const data=read(input);
const rows=Object.values(data.pages||{});
const searchSessions=data.searchAudit?.format==='zhx-search-audit-v1'
  ? (data.searchAudit.sessions||[]) : [];
const searchEvents=searchSessions.flatMap(s=>s.events||[]);
if(!rows.length&&!searchEvents.length)throw Error('没有汉化后页面记录或中文搜索诊断事件');
const summary={format:data.format,source:path.basename(input),createdAt:data.createdAt,
  totalSnapshots:rows.length,ok:0,failed:0,baselineVerified:0,baselineInferred:0,
  categories:{},perSite:{},generatedAt:new Date().toISOString()};
const groups=new Map(),all=[];
function addGroup(row,it,cat){
  // One candidate row per site + scope + kind + foreign string. Occurrences preserved.
  const key=[row.site,it.ctx?.scope,it.kind,it.text].join('\0');
  let g=groups.get(key);if(!g){g={site:row.site,scope:it.ctx?.scope||'unknown',kind:it.kind,
    text:it.text,before:it.before||'',category:cat,occurrences:0,pages:new Set(),
    examples:[]};groups.set(key,g)}
  g.occurrences++;g.pages.add(row.url||'');
  if(g.examples.length<3)g.examples.push(it.path||it.stablePath||'');
  if(!g.before&&it.before)g.before=it.before;
}
for(const row of rows){
  const site=row.site||'unknown',s=summary.perSite[site] ||= {snapshots:0,ok:0,failed:0,candidates:0};
  s.snapshots++;
  if(row.status!=='ok'){summary.failed++;s.failed++;continue}
  summary.ok++;s.ok++;
  if(row.baselineQuality==='manual-verified'||row.hasBaseline)summary.baselineVerified++;
  else if(row.baselineQuality==='partial-inferred')summary.baselineInferred++;
  for(const it of row.items||[]){
    const cat=C.category(it);
    summary.categories[cat]=(summary.categories[cat]||0)+1;
    all.push({row,it,cat});
    if(cat.startsWith('suspected')){addGroup(row,it,cat);s.candidates++}
  }
}
const suspects=[...groups.values()].sort((a,b)=>b.occurrences-a.occurrences||a.text.localeCompare(b.text));
summary.uniqueCandidates=suspects.length;summary.candidateOccurrences=suspects.reduce((s,g)=>s+g.occurrences,0);
summary.unvisitedSites=[...new Set(Object.values(C.SITES))].filter(s=>!summary.perSite[s]);
const csvCell=x=>'"'+String(x??'').replaceAll('"','""').replace(/\r?\n/g,' ')+'"';
const csvLine=x=>x.map(csvCell).join(',')+'\r\n';
let csv='\uFEFF'+csvLine(['站点','作用域','结果','出现次数','不同页面数','原文','译后残留','类型','示例路径']);
for(const g of suspects){csv+=csvLine([g.site,g.scope,g.category,g.occurrences,g.pages.size,g.before,g.text,g.kind,g.examples[0]])}
const lines=['# FF14 七站汉化覆盖审计 V1.1','',`生成时间：${summary.generatedAt}`,`源文件：${summary.source}`,'',
  '## 范围及质量','',`- 页面状态快照：${summary.totalSnapshots}；成功：${summary.ok}；失败：${summary.failed}`,
  `- 人工确认的原文基线：${summary.baselineVerified}；仅部分推断的原文：${summary.baselineInferred}`,
  `- 原始疑似命中：${summary.candidateOccurrences} 次；按站点、采集类型、原文归并：${suspects.length} 个不同候选`,
  `- 未覆盖站点：${summary.unvisitedSites.join('、')||'无'}`,'',
  '**警告：候选不等于已确认漏译；未采到基线不计算汉化率。**','',
  '## 逐站统计','', '|站点|有效快照|失败快照|候选命中|','|---|---:|---:|---:|'];
for(const [site,s] of Object.entries(summary.perSite))lines.push(`|${site}|${s.ok}|${s.failed}|${s.candidates}|`);
lines.push('','## 高频候选（前 80 条）','', '|站点|类型|原文 / 译后|次数|','|---|---|---|---:|');
for(const g of suspects.slice(0,80)){lines.push(`|${g.site}|${g.category}|${String(g.text).replaceAll('|','\\|').slice(0,100)}|${g.occurrences}|`)}
summary.searchDiagnostics={sessions:searchSessions.length,events:searchEvents.length,
  eventTypes:Object.fromEntries([...new Set(searchEvents.map(e=>e.type))].sort()
    .map(type=>[type,searchEvents.filter(e=>e.type===type).length]))};
if(searchEvents.length){
  lines.push('','## 中文搜索诊断（自愿开启）','',
    '会话：'+searchSessions.length+'；记录事件：'+searchEvents.length,
    '此部分为浏览器观察结果，未出现网络记录不表示浏览器没有发送请求。','','|时间|事件|路径|搜索输入|候选数|套装链接数|',
    '|---|---|---|---|---:|---:|');
  const cell=x=>String(x??'').replaceAll('|','\\|').replace(/[\r\n]+/g,' ').slice(0,110);
  for(const event of searchEvents.slice(-120)){
    const st=event.state||{};
    lines.push('|'+[event.at,event.type,event.page,st.input?.value,
      st.candidates?.rendered,st.gearsetLinks].map(cell).join('|')+'|');
  }
  lines.push('','搜索查询的参数与请求耗时、候选前几项可在 JSON 的 searchAudit.sessions[].events 中检查；导出前请核对隐私。');
}
let diff=null;
if(old){
  diff=C.compareRuns(Object.values(read(old).pages||{}),rows);
  summary.comparison={old:path.basename(old),introduced:diff.introduced.length,resolved:diff.resolved.length,persistent:diff.persistent.length,comparablePages:diff.comparablePages,skippedOldPages:diff.skippedOldPages,skippedNewPages:diff.skippedNewPages};
  lines.push('','## 与上一轮比较','',`- 新出现候选：${diff.introduced.length}`,
    `- 消失的候选：${diff.resolved.length}`,
    `- 持续存在候选：${diff.persistent.length}`,
    `- 可直接比较的页面与状态：${diff.comparablePages}；旧轮未复扫：${diff.skippedOldPages}；新增页面：${diff.skippedNewPages}`, 
    '','**注意：只有相同 URL、状态和元素位置才能用作回归对比；消失的元素不一定已修复，可能只是未采到。**');
}
fs.mkdirSync(out,{recursive:true});
const stamp='v1.1';
fs.writeFileSync(path.join(out,`ff14-审计报告-${stamp}.md`),lines.join('\n')+'\n');
fs.writeFileSync(path.join(out,`ff14-去重候选-${stamp}.csv`),csv);
fs.writeFileSync(path.join(out,`ff14-审计汇总-${stamp}.json`),JSON.stringify(summary,null,2));
if(diff)fs.writeFileSync(path.join(out,`ff14-版本差异-${stamp}.json`),JSON.stringify(diff,null,2));
console.log(JSON.stringify(summary,null,2));
