// Optional, real Chromium V8 coverage from the already-running E2E scenarios.
// Only the exact verified bundle is accepted; wrappers are accounted for by
// their measured source offset. Other scripts never become production hits.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {distFile,readDist} from './paths.mjs';
const coveredPages=new WeakSet();
const sources=new WeakMap();
const bundles=new WeakMap();

export function tagBrowserSource(cdp,text) {
  if(!coveredPages.has(cdp)||typeof text!=='string')return text;
  const {bundle,sha256}=bundles.get(cdp);
  const offset=text.indexOf(bundle);
  if(offset<0)return text;
  let registered=sources.get(cdp);
  if(!registered){registered=new Map();sources.set(cdp,registered);}
  const url=`zhx-coverage://${sha256}/${registered.size}.js`;
  registered.set(url,{offset,sha256});
  return text+'\n//# sourceURL='+url+'\n';
}

export async function beginBrowserCoverage(cdp) {
  if (!process.env.ZHX_E2E_COVERAGE_DIR) return;
  const bundle=readDist();
  bundles.set(cdp,{bundle,sha256:createHash('sha256').update(bundle).digest('hex')});
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage',{callCount:true,detailed:true});
  coveredPages.add(cdp);
}

export async function endBrowserCoverage(cdp,target) {
  const directory=process.env.ZHX_E2E_COVERAGE_DIR;
  if (!directory||!coveredPages.has(cdp)) return;
  const {bundle,sha256}=bundles.get(cdp);
  if(createHash('sha256').update(readDist()).digest('hex')!==sha256)throw new Error('Bundle changed during browser execution');
  const {result}=await cdp.send('Profiler.takePreciseCoverage');
  const scripts=[];
  for(const script of result){
    const registered=sources.get(cdp)?.get(script.url);
    if(!registered)continue;
    if(registered.sha256!==sha256)throw new Error('Bundle changed during browser execution');
    scripts.push({offset:registered.offset,functions:script.functions});
  }
  if(scripts.length){
    fs.mkdirSync(directory,{recursive:true});
    const id=createHash('sha256').update(String(target)).digest('hex').slice(0,20);
    fs.writeFileSync(path.join(directory,`${process.pid}-${id}.json`),JSON.stringify({bundle:path.basename(distFile),
      sha256:createHash('sha256').update(bundle).digest('hex'),scripts}));
  }
  await cdp.send('Profiler.stopPreciseCoverage');
  await cdp.send('Profiler.disable');
}
