import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newPage,closePage,sleep} from '../helpers/cdp.mjs';
import {seedV3Memory} from '../helpers/v3-cache.mjs';
import {readDist,fixtureUrl} from '../helpers/paths.mjs';
const port=Number(process.env.ZHX_CDP_PORT||9223);
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/miramiru-filter-options.json',import.meta.url),'utf8'));
const page=await newPage(port,fixtureUrl('miramiru-page.html'));
const c=page.cdp;
try{
  await seedV3Memory(c,'miramiru');
  await c.eval(`window.__zhxTestSite='miramiru';window.GM_getValue=(k,d)=>window.__v3MemoryCache.get(k)??d;
    window.GM_setValue=(k,v)=>window.__v3MemoryCache.set(k,v);window.GM_xmlhttpRequest=o=>o.onerror?.({status:0});`);
  await c.callFn('function(source){(0,eval)(source);}',[readDist()]);
  await sleep(500);
  for(const locale of ['en','ja','ko']){
    const field={en:'nameEn',ja:'nameJa',ko:'nameKo'}[locale];
    await c.callFn(`function(fixture,field,locale){
      document.querySelector('#filter-fixture')?.remove();
      const root=document.createElement('section');root.id='filter-fixture';document.body.append(root);
      const dialog=document.createElement('div');dialog.setAttribute('role','dialog');root.append(dialog);
      for(const row of fixture.options){
        const option=document.createElement('div');option.setAttribute('role','option');option.dataset.option=row.id;
        option.textContent=row[field];root.append(option);
        if(row.abbr){const button=document.createElement('button');button.dataset.job=row.id;button.title=row[field];
          button.textContent=locale==='ja'?row.abbrJa:row.abbr;button.onclick=()=>window.__selectedJob=row.id;dialog.append(button);}
      }
      for(const name of Object.keys(fixture.officialTags)){
        const option=document.createElement('li');option.setAttribute('role','option');option.dataset.tag=name;
        const button=document.createElement('button');const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.classList.add('lucide-shield');
        const label=document.createElement('span');label.className='truncate';label.append('#',name);
        const count=document.createElement('span');count.textContent='3 posts';button.append(icon,label,count);
        button.onclick=()=>window.__selectedTag=name;option.append(button);dialog.append(option);
      }
      const badge=document.createElement('span');badge.dataset.slot='badge';badge.id='rare-tag';badge.textContent='#正月';dialog.append(badge);
      const user=document.createElement('span');user.dataset.slot='badge';user.id='user-tag';user.textContent='#Head';dialog.append(user);
      const neutral=document.createElement('p');neutral.id='neutral-abbr';neutral.textContent='PLD';root.append(neutral);
    }`,[fixture,field,locale]);
    await sleep(400);
    const result=await c.eval(`(()=>({options:[...document.querySelectorAll('[data-option]')].map(e=>({id:e.dataset.option,text:e.textContent})),
      jobs:[...document.querySelectorAll('[data-job]')].map(e=>({id:e.dataset.job,text:e.textContent,title:e.title})),
      tags:[...document.querySelectorAll('[data-tag]')].map(e=>({name:e.dataset.tag,text:e.querySelector('.truncate').textContent,count:e.querySelector('span:last-child').textContent})),
      rare:document.querySelector('#rare-tag').textContent,user:document.querySelector('#user-tag').textContent,neutral:document.querySelector('#neutral-abbr').textContent}))()`);
    assert.deepEqual(result.options.map(e=>e.text),fixture.options.map(e=>e.zh),locale+' options');
    assert.deepEqual(result.jobs.map(e=>e.text),fixture.options.filter(e=>e.abbr).map(e=>e.shortZh),locale+' abbreviations');
    assert.deepEqual(result.jobs.map(e=>e.title),fixture.options.filter(e=>e.abbr).map(e=>e.zh),locale+' tooltips');
    for(const tag of result.tags){assert.equal(tag.text,'#'+fixture.officialTags[tag.name]);assert.equal(tag.count,'3 篇投稿');}
    assert.equal(result.rare,'#新年');assert.equal(result.user,'#Head');assert.equal(result.neutral,'PLD');
    await c.eval(`document.querySelector('[data-job="pld"]').click();document.querySelector('[data-tag] button').click();`);
    assert.equal(await c.eval('window.__selectedJob'),'pld');
    assert.equal(await c.eval('window.__selectedTag'),Object.keys(fixture.officialTags)[0]);
    console.log('PASS representative filter controls, official/custom tags and native identities: '+locale);
  }
}finally{await closePage(port,page.target.id)}
