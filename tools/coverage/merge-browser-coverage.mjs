// Supplement native LCOV with actual E2E-executed source lines. Browser branch
// counts are deliberately not inferred from line hits; native branch data stays.
import fs from 'node:fs';
import path from 'node:path';
import {SourceMap} from 'node:module';
import {createHash} from 'node:crypto';

const root=process.cwd();
const directory=process.argv[2]||'tests/.cache/e2e-coverage';
const report=process.argv[3]||'tests/.cache/coverage/lcov.info';
const bundlePath=path.resolve('dist/ff14-glamour-zh.greasyfork.user.js');
const bundle=fs.readFileSync(bundlePath,'utf8');
const sha256=createHash('sha256').update(bundle).digest('hex');
const map=new SourceMap(JSON.parse(fs.readFileSync(bundlePath+'.map','utf8')));
const starts=[0];
for(let at=0;at<bundle.length;at++)if(bundle[at]==='\n')starts.push(at+1);
const mapped=[];
for(let line=0;line<starts.length;line++){
  const text=bundle.slice(starts[line],starts[line+1]??bundle.length);
  const column=text.search(/\S/);
  if(column<0)continue;
  const entry=map.findEntry(line,column);
  if(entry.generatedLine!==line||!entry.originalSource)continue;
  const filename=path.resolve(path.dirname(bundlePath),entry.originalSource);
  const relative=path.relative(root,filename).replaceAll('\\','/');
  if(!relative.startsWith('src/')||!Number.isInteger(entry.originalLine))continue;
  mapped.push({offset:starts[line]+column,source:relative,line:entry.originalLine+1});
}
if(!mapped.length)throw new Error('No production source positions in bundle sourcemap');
const hits=new Map();
const files=fs.readdirSync(directory,{recursive:true}).filter(name=>name.endsWith('.json'));
let accepted=0;
for(const file of files){
  const data=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
  if(data.bundle!==path.basename(bundlePath)||data.sha256!==sha256)throw new Error('Coverage bundle mismatch: '+file);
  for(const script of data.scripts){
    accepted++;
    const ranges=script.functions.flatMap(fn=>fn.ranges).sort((a,b)=>a.startOffset-b.startOffset||b.endOffset-a.endOffset);
    const active=[];
    let cursor=0;
    for(const point of mapped){
      const offset=point.offset+script.offset;
      while(cursor<ranges.length&&ranges[cursor].startOffset<=offset){
        const range=ranges[cursor++];
        while(active.length&&active.at(-1).endOffset<=range.startOffset)active.pop();
        active.push(range);
      }
      while(active.length&&active.at(-1).endOffset<=offset)active.pop();
      const containing=active.at(-1);
      if(!containing)continue;
      let lines=hits.get(point.source);
      if(!lines){lines=new Map();hits.set(point.source,lines);}
      lines.set(point.line,Math.max(lines.get(point.line)||0,containing.count));
    }
  }
}
if(!accepted)throw new Error('No exact-bundle browser execution coverage was collected');
const native=fs.readFileSync(report,'utf8').split('end_of_record');
const output=[];
for(const section of native){
  const rows=section.trim().split('\n');
  const source=rows.find(line=>line.startsWith('SF:'))?.slice(3).replaceAll('\\','/');
  if(!source)continue;
  const browser=hits.get(source);
  if(browser){
    const lines=new Map();
    const retained=rows.filter(line=>{
      if(line.startsWith('DA:')){const [number,count]=line.slice(3).split(',').map(Number);lines.set(number,count);return false;}
      return !/^(LF|LH):/.test(line);
    });
    for(const [line,count]of browser)lines.set(line,Math.max(lines.get(line)||0,count));
    for(const [line,count]of [...lines].sort((a,b)=>a[0]-b[0]))retained.push(`DA:${line},${count}`);
    retained.push('LF:'+lines.size,'LH:'+[...lines.values()].filter(Boolean).length);
    output.push(retained.join('\n')+'\nend_of_record');
    hits.delete(source);
  }else output.push(rows.join('\n')+'\nend_of_record');
}
for(const [source,lines]of hits){
  const rows=['SF:'+source,...[...lines].sort((a,b)=>a[0]-b[0]).map(([line,count])=>`DA:${line},${count}`),
    'LF:'+lines.size,'LH:'+[...lines.values()].filter(Boolean).length,'end_of_record'];
  output.push(rows.join('\n'));
}
fs.writeFileSync(report,output.join('\n')+'\n');
console.log(`Merged ${accepted} exact-bundle Chromium executions into ${report}; native branch counts retained.`);
