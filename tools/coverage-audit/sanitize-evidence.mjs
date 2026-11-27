#!/usr/bin/env node
// Fail-closed privacy bridge: raw site snapshots stay on the runner.
// Artifacts upload only sanitized evidence, never raw user or item descriptions.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { isAuditResultFile } from './audit.mjs';
const require=createRequire(import.meta.url);
const C=require('../manual-coverage-audit/audit-core.js');
// Only export candidate IDs and equality results derived from public game
// data. The inferred original label is not proof of the equipment identity.
export function indexOfficialItems(tsv){
  const index=new Map();
  for(const line of tsv.split(/\r?\n/u).slice(1)){
    const fields=line.split('\t');
    const [id,zh,en,ja]=fields;
    if(fields.length!==9||!/^\d+$/u.test(id)||!zh)continue;
    for(const name of new Set([zh,en,ja].filter(Boolean))){
      const rows=index.get(name)||[];
      rows.push({id,zh});
      index.set(name,rows);
    }
  }
  if(!index.size)throw Error('No official Item names in the source table');
  return index;
}
function itemIdentityEvidence(it,index){
  if(!index||it.category==='user'||it.ctx?.queryEcho)return null;
  const source=it.before?.trim();
  if(!source)return {status:'no-source'};
  const matches=index.get(source)||[];
  if(!matches.length)return {status:'unmatched-source'};
  const ids=[...new Set(matches.map(row=>row.id))];
  const names=new Set(matches.map(row=>row.zh));
  const status=names.size>1?'ambiguous-source':
    names.has(it.text?.trim())?'name-match':'name-needs-review';
  return {status,candidateIds:ids.slice(0,16),candidateCount:ids.length};
}
export function redactItems(items,site,officialItems=null){
  return C.normalizeItems(items||[],site).map(it=>{
    // Preserve only a boolean signal before item labels are redacted.
    // This is a script check, not a verified item translation or a count
    // of distinct items. Old evidence without the flag remains unassessed.
    const item=C.sanitizeItem(it,false);
    if(it.ctx?.scope==='item'&&!it.redacted){
      item.itemLabelForeign=/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(it.text||'');
      const identity=itemIdentityEvidence(it,officialItems);
      if(identity)item.itemIdentityEvidence=identity;
    }
    if(['unknown','metadata','ad'].includes(item.ctx?.scope)){
      item.text='[未确认内容已隐藏]';
      if(item.before!=null)item.before='[未确认内容已隐藏]';
      item.redacted=true;
    }
    return item;
  });
}
export function sanitizeEvidence(source,target,officialItems=null){
  if(!fs.existsSync(source))throw Error('Audit evidence directory missing');
  fs.mkdirSync(target,{recursive:true});
  let count=0;
  for(const entry of fs.readdirSync(source,{withFileTypes:true})){
    if(!entry.isFile())continue;
    const from=path.join(source,entry.name),to=path.join(target,entry.name);
    if(/^scan-log-[\w-]+\.txt$/.test(entry.name)){
      // Logs can contain URL paths with player titles. Export only domain-level URLs.
      const log=fs.readFileSync(from,'utf8').replace(/https:\/\/[^\s"']+/g,raw=>{
        try {return new URL(raw).origin+'/[path omitted]';} catch {return '[URL hidden]';}
      });
      fs.writeFileSync(to,log,'utf8');continue;
    }
    if(!isAuditResultFile(entry.name))continue;
    const row=JSON.parse(fs.readFileSync(from,'utf8'));
    if(!row.site||(!Array.isArray(row.items)&&!Array.isArray(row.pages)))continue;
    const cleaned={...row};
    if(Array.isArray(cleaned.items))cleaned.items=redactItems(cleaned.items,cleaned.site,officialItems);
    if(Array.isArray(cleaned.pages))cleaned.pages=cleaned.pages.map(p=>({...p,items:redactItems(p.items,p.site||cleaned.site,officialItems)}));
    fs.writeFileSync(to,JSON.stringify(cleaned,null,2)+'\n','utf8');count++;
  }
  return count;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length!==2)throw Error('Usage: node sanitize-evidence.mjs <raw-directory> <artifact-directory>');
  const source=fs.readFileSync(new URL('../../data/source/ff14-items.tsv',import.meta.url),'utf8');
  const officialItems=indexOfficialItems(source);
  console.log('Prepared '+sanitizeEvidence(path.resolve(args[0]),path.resolve(args[1]),officialItems)+' sanitized evidence files');
}
