// One matrix for the same user contract across standalone search widgets.
// Native event values and visible input are checked separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newPage,closePage,sleep} from '../helpers/cdp.mjs';
import {fixtureUrl,itemsTsvPath,readDist} from '../helpers/paths.mjs';
import {seedV3Memory} from '../helpers/v3-cache.mjs';
const port=Number(process.env.ZHX_CDP_PORT||9223);
const row=fs.readFileSync(itemsTsvPath,'utf8').split(/\r?\n/).find(line=>line.startsWith('14972\t')).split('\t');
const chinese=row[1];
const cases=[
  {site:'ronka',fixture:'ronka-search.html',selector:'#search-input',column:4,inline:true},
  {site:'collection',fixture:'collection-search.html',selector:'input[name="keyword"]',column:3,inline:true},
  ...[['endcloset',4],['ronka',4],['collection',3],['ec',2]].map(([site,column])=>({site,column,fixture:'standalone-search.html',selector:'#equipment-search'})),
];
async function until(c,expression,label){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){if(await c.eval(expression))return;await sleep(25)}
  throw new Error(label+' did not become ready');
}
for(const entry of cases){
  const page=await newPage(port);const c=page.cdp;
  try{
    const loaded=c.waitForEvent('Page.loadEventFired');
    await c.send('Page.navigate',{url:fixtureUrl(entry.fixture)});await loaded;
    await seedV3Memory(c,entry.site);
    await c.callFn(`function(site,selector){
      window.__zhxTestSite=site;window.__zhxDiagOn=true;window.__inputs=[];
      window.GM_getValue=(k,d)=>window.__v3MemoryCache.get(k)??d;
      window.GM_setValue=(k,v)=>window.__v3MemoryCache.set(k,v);window.GM_xmlhttpRequest=o=>o.onerror?.({});
      document.querySelector(selector).addEventListener('input',e=>window.__inputs.push(e.target.value));
    }`,[entry.site,entry.selector]);
    await c.callFn('function(source){(0,eval)(source)}',[readDist()]);
    await until(c,`Object.hasOwn(window.__zhxMarks||{},'ready')`,'data');
    const type=value=>c.callFn(`function(selector,value){const el=document.querySelector(selector);el.focus();el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))}`,[entry.selector,value]);
    const value=()=>c.callFn('function(selector){return document.querySelector(selector).value}',[entry.selector]);
    await type(chinese);
    if(entry.inline){
      await until(c,`(()=>{const list=document.querySelector('#zhx-chinese-suggest-list');return list&&!list.hidden&&list.querySelector('button[data-zhx-index]')})()`,'suggestions');
      // This negative check spans the old debounce window: typing must not search.
      await sleep(1000);
      assert.equal(await value(),chinese);
      assert.equal(await c.callFn('function(native){return window.__inputs.includes(native)}',[row[entry.column]]),false);
      await c.eval(`document.querySelector('#zhx-chinese-suggest-list button[data-zhx-index]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))`);
      await until(c,`window.__inputs.includes(${JSON.stringify(row[entry.column])})`,'native search event');
      assert.equal(await value(),chinese,'Choosing a suggestion must retain the Chinese display');
      await type('不存在的装备xyz');await sleep(700);
      assert.equal(await value(),'不存在的装备xyz');
      if(entry.site==='ronka'){
        await c.eval(`const el=document.querySelector('#legacy-search input');el.value='女仆';el.dispatchEvent(new Event('input',{bubbles:true}))`);
        await sleep(700);
        assert.equal(await c.eval(`document.querySelector('#legacy-search input').value`),'女仆');
      }
    }else{
      await c.callFn(`function(selector){document.querySelector(selector).dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))}`,[entry.selector]);
      assert.equal(await c.eval('window.__searches.at(-1)'),row[entry.column]);
      await until(c,`document.querySelector(${JSON.stringify(entry.selector)}).value===${JSON.stringify(chinese)}`,'Chinese display');
      await type(chinese);await c.eval(`document.querySelector('#run-search').click()`);
      assert.equal(await c.eval('window.__searches.at(-1)'),row[entry.column]);
      await until(c,`document.querySelector(${JSON.stringify(entry.selector)}).value===${JSON.stringify(chinese)}`,'Chinese display');
    }
    console.log('PASS '+entry.site+': '+(entry.inline?'suggestion selection, no automatic search':'Enter and search button'));
  }finally{await closePage(port,page.target.id)}
}
