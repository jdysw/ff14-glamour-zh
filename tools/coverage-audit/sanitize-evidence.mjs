#!/usr/bin/env node
// Fail-closed privacy bridge: raw site snapshots stay on the runner.
// Artifacts upload only sanitized evidence, never raw user or item descriptions.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const C=require('../manual-coverage-audit/audit-core.js');
export function redactItems(items,site){
  return C.upgradeLegacyItems(items||[],site).map(it=>{
    const item=C.sanitizeItem(it,false);
    if(['unknown','metadata','ad'].includes(item.ctx?.scope)){
      item.text='[未确认内容已隐藏]';
      if(item.before!=null)item.before='[未确认内容已隐藏]';
      item.redacted=true;
    }
    return item;
  });
}
export function sanitizeEvidence(source,target){
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
    if(!/^(mirapri|ec|fc|ronka|collection|endcloset|wiki)-.+\.json$/.test(entry.name))continue;
    const row=JSON.parse(fs.readFileSync(from,'utf8'));
    if(!row.site||(!Array.isArray(row.items)&&!Array.isArray(row.pages)))continue;
    const cleaned={...row};
    if(Array.isArray(cleaned.items))cleaned.items=redactItems(cleaned.items,cleaned.site);
    if(Array.isArray(cleaned.pages))cleaned.pages=cleaned.pages.map(p=>({...p,items:redactItems(p.items,p.site||cleaned.site)}));
    fs.writeFileSync(to,JSON.stringify(cleaned,null,2)+'\n','utf8');count++;
  }
  return count;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length!==2)throw Error('Usage: node sanitize-evidence.mjs <raw-directory> <artifact-directory>');
  console.log('Prepared '+sanitizeEvidence(path.resolve(args[0]),path.resolve(args[1]))+' sanitized evidence files');
}
