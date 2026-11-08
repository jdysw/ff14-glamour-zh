// One matrix for the same user contract across standalone search widgets.
// Native event values and visible input are checked separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {newPage,closePage,sleep} from '../helpers/cdp.mjs';
import {fixtureUrl,itemsTsvPath,readDist} from '../helpers/paths.mjs';
import {seedV3Memory} from '../helpers/v3-cache.mjs';
const port=Number(process.env.ZHX_CDP_PORT||9223);
process.env.FF14_EQUIP_SLOTS_CSV ||= fileURLToPath(fixtureUrl('search-equipment-slots.csv'));
const row=fs.readFileSync(itemsTsvPath,'utf8').split(/\r?\n/).find(line=>line.startsWith('14972\t')).split('\t');
const chinese=row[1];
const cases=[
  ...[['en',2],['ja',3],['ko',4]].map(([language,column])=>({site:'miramiru',language,column,fixture:'miramiru-search.html',selector:'#miramiru-gear',inline:true,controlled:true})),
  {site:'ronka',fixture:'ronka-search.html',selector:'#search-input',column:4,inline:true},
  {site:'collection',fixture:'collection-search.html',selector:'input[name="keyword"]',column:3,inline:true},
  ...[['endcloset',4],['ronka',4],['collection',3],['ec',2]].map(([site,column])=>({site,column,fixture:'standalone-search.html',selector:'#equipment-search'})),
];
async function until(c,expression,label){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){if(await c.eval(expression))return;await sleep(25)}
  throw new Error(label+' did not become ready: '+JSON.stringify(await c.eval(`({
    inputs:[...document.querySelectorAll('input')].map(i=>({id:i.id,value:i.value,slot:i.dataset.zhxMiramiruSlot,placeholder:i.placeholder})),
    suggest:document.querySelector('#zhx-chinese-suggest-list')?.textContent,errors:window.__zhxErrs})`)));
}
for(const entry of cases){
  const page=await newPage(port);const c=page.cdp;
  try{
    const loaded=c.waitForEvent('Page.loadEventFired');
    await c.send('Page.navigate',{url:fixtureUrl(entry.fixture)});await loaded;
    await seedV3Memory(c,entry.site);
    await c.callFn(`function(site,selector,language){
      if(language)document.documentElement.lang=language;
      window.__zhxTestSite=site;window.__zhxDiagOn=true;window.__inputs=[];
      window.GM_getValue=(k,d)=>window.__v3MemoryCache.get(k)??d;
      window.GM_setValue=(k,v)=>window.__v3MemoryCache.set(k,v);window.GM_xmlhttpRequest=o=>o.onerror?.({});
      document.querySelector(selector).addEventListener('input',e=>window.__inputs.push(e.target.value));
    }`,[entry.site,entry.selector,entry.language]);
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
      if(entry.controlled)assert.equal(await c.eval(`(()=>{
        const box=document.querySelector('#zhx-chinese-suggest-list'),r=box.querySelector('button').getBoundingClientRect();
        return !!box.closest('[role="dialog"]')&&box.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
      })()`),true,'Native modal must allow real pointer hits on Chinese suggestions');
      await c.eval(`document.querySelector('#zhx-chinese-suggest-list button[data-zhx-index]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))`);
      await until(c,`window.__inputs.includes(${JSON.stringify(row[entry.column])})`,'native search event');
      if(entry.controlled){
        await until(c,`window.__selectedGear===${JSON.stringify(row[entry.column])}`,'native item selection');
        assert.equal(await value(),row[entry.column],'Controlled equipment picker retains its native model');
        await type('管家燕尾服');
        await until(c,`document.querySelector('#zhx-chinese-suggest-list')?.textContent==='未找到对应装备'`,'slot-filtered empty state');
        assert.equal(await c.eval(`document.querySelectorAll('#zhx-chinese-suggest-list button[data-zhx-index]').length`),0,'Head picker excludes body gear');
        await c.eval(`const title=document.querySelector('#general-query');title.focus();title.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));title.value='女仆';title.dispatchEvent(new Event('input',{bubbles:true}))`);
        await sleep(150);
        assert.equal(await c.eval(`document.querySelector('#general-query').value`),'女仆');
        assert.equal(await c.eval(`!document.querySelector('#zhx-chinese-suggest-list')||document.querySelector('#zhx-chinese-suggest-list').hidden`),true,
          JSON.stringify(await c.eval(`({active:document.activeElement.id,fields:[...document.querySelectorAll('input')].map(i=>({id:i.id,slot:i.dataset.zhxMiramiruSlot})),list:document.querySelector('#zhx-chinese-suggest-list').outerHTML.slice(0,300)})`)));
      }else assert.equal(await value(),chinese,'Choosing a suggestion must retain the Chinese display');
      await type('不存在的装备xyz');await sleep(700);
      assert.equal(await value(),'不存在的装备xyz');
      if(entry.site==='ronka'){
        await c.eval(`const el=document.querySelector('#legacy-search input');el.value='女仆';el.dispatchEvent(new Event('input',{bubbles:true}))`);
        await sleep(700);
        assert.equal(await c.eval(`document.querySelector('#legacy-search input').value`),'女仆');
        const menus = await c.eval(`(async () => {
          const samples=[];
          for (const index of [0,1,1,0]) {
            document.querySelectorAll('.item-searcher .search-button')[index].click();
            await new Promise(requestAnimationFrame);
            const rows=[...document.querySelectorAll('.item-searcher')];
            samples.push({
              text:rows.map(row=>row.textContent),
              names:rows.map(row=>row.querySelector('[data-zhx-item]')?.dataset.zhxItem),
              wiki:rows.map(row=>row.querySelector('.post-search-modal a').getAttribute('href')),
              native:rows[1].querySelectorAll('.post-search-modal a')[2].getAttribute('href'),
              active:rows.findIndex(row=>row.querySelector('.modal-active')),
            });
          }
          return samples;
        })()`);
        for(const [index,sample] of menus.entries()){
          assert.equal(sample.text.some(text=>/[가-힣]/.test(text)),false,'No original-language frame after equipment menu remount: '+JSON.stringify(sample));
          assert.deepEqual(sample.names,['女仆发带','管家燕尾服']);
          assert.deepEqual(sample.wiki,['女仆发带','管家燕尾服'].map(name=>'https://ff14.huijiwiki.com/wiki/物品:'+encodeURIComponent(name)));
          assert.equal(sample.native,'https://lookbook.ronkacloset.com/?keyword=집사 재킷');
          assert.equal(sample.active,[0,1,-1,0][index]);
        }
        console.log('PASS ronka: equipment menus stay translated before each paint, native search links unchanged');
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
