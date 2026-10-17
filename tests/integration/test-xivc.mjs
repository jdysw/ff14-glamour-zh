// Exercise the xivc userscript against the cached native page and its real UI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {newPage,closePage,sleep} from '../helpers/cdp.mjs';
import {fixtureUrl,itemsTsvPath,repoRoot} from '../helpers/paths.mjs';

const port=Number(process.env.ZHX_CDP_PORT||9223);
const version=JSON.parse(fs.readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version;
execFileSync(process.execPath,['build/make-site-test.mjs','xivc'],{cwd:repoRoot,stdio:'pipe'});
const source=fs.readFileSync(new URL(`../../dist/ff14-xivc-zh-${version}-test.user.js`,import.meta.url),'utf8');
const rows=fs.readFileSync(itemsTsvPath,'utf8').split(/\r?\n/);
const row=rows.find(line=>line.startsWith('14972\t')).split('\t');
const secondRow=rows.find(line=>line.startsWith('14973\t')).split('\t');
const zh=row[1],english=row[2];
const secondZh=secondRow[1],secondEnglish=secondRow[2];
const secondParts=secondEnglish.split(' ');
const markText=secondParts.splice(1,1)[0];
const prefix=secondParts.shift()+' ';
const suffix=secondParts.length?' '+secondParts.join(' '):'';
const page=await newPage(port,fixtureUrl('xivc.html'));
const c=page.cdp;
try {
  await c.send('Network.enable');
  await c.send('Network.setBlockedURLs',{urls:['*']});
  await c.callFn(`function(){window.__zhxTestSite='xivc';window.__xivcSearchModel='';}`);
  await c.eval(source);
  const ready=Date.now()+5000;
  while(Date.now()<ready&&!(await c.eval(`document.querySelector('#item-search')?.dataset.zhxXivcSearch==='1'`)))await sleep(25);
  assert.equal(await c.eval(`document.querySelector('#item-search').placeholder`),'搜索装备……');
  assert.equal(await c.eval(`document.querySelector('#item-search').title`),
    '关键词可按任意顺序匹配。用引号搜索完整词组，用 -词 排除关键词。');
  assert.ok((await c.eval(`document.querySelector('#drawer-tabs').textContent`)).includes('装备'));

  await c.callFn(`function(zh,english){
    const slots=document.querySelector('#slot-list');
    slots.innerHTML='<div class="slot-row"><div class="slot-name">Head</div><div class="slot-item">'+english+'</div></div>';
    const grid=document.querySelector('#item-grid');
    grid.innerHTML='<div class="item-card unequip-card"><div class="item-card-name">Unequip</div></div>'
      +'<div class="item-card"><canvas></canvas><div class="item-card-name">'+english+'</div></div>';
    const input=document.querySelector('#item-search');
    input.addEventListener('input',event=>{window.__xivcSearchModel=event.target.value});
    window.__xivcTestNames={zh,english};
  }`,[zh,english]);
  const gearDeadline=Date.now()+5000;
  while(Date.now()<gearDeadline&&!(await c.eval(`document.querySelector('#item-grid .item-card:nth-child(2) .zhx-xivc-name')`)))await sleep(25);
  const gear=await c.eval(`(()=>{const card=document.querySelector('#item-grid .item-card:nth-child(2)');return {name:card.querySelector('.zhx-xivc-name')?.textContent,href:card.querySelector('.zhx-xivc-wiki')?.getAttribute('href'),slot:document.querySelector('#slot-list .slot-item .zhx-xivc-wiki')?.getAttribute('href')}})()`);
  assert.equal(gear.name,zh);
  assert.equal(decodeURIComponent(gear.href),`https://ff14.huijiwiki.com/wiki/物品:${zh}`);
  assert.equal(decodeURIComponent(gear.slot),`https://ff14.huijiwiki.com/wiki/物品:${zh}`);

  await c.callFn(`function(prefix,markText,suffix){const card=document.querySelector('#item-grid .item-card:nth-child(2)');window.__nativePickCount=0;card.addEventListener('click',()=>window.__nativePickCount++);const name=card.querySelector('.item-card-name');const mark=document.createElement('mark');mark.textContent=markText;name.append(document.createTextNode(prefix),mark,document.createTextNode(suffix))}`,[prefix,markText,suffix]);
  const markDeadline=Date.now()+5000;
  while(Date.now()<markDeadline&&await c.eval(`document.querySelector('#item-grid .item-card:nth-child(2) .zhx-xivc-name')?.textContent!==${JSON.stringify(secondZh)}`))await sleep(25);
  assert.equal(await c.eval(`document.querySelector('#item-grid .item-card:nth-child(2) .zhx-xivc-name').textContent`),secondZh,
    '已有中文标签后追加 direct text 与 mark，按完整新原名更新');
  assert.equal(decodeURIComponent(await c.eval(`document.querySelector('#item-grid .item-card:nth-child(2) .zhx-xivc-wiki').getAttribute('href')`)),
    `https://ff14.huijiwiki.com/wiki/物品:${secondZh}`);
  await c.eval(`document.querySelector('#item-grid .item-card:nth-child(2) .zhx-xivc-name').click()`);
  assert.equal(await c.eval('window.__nativePickCount'),1,'高亮结果译名点击仍触发父卡原生选取');
  await c.eval(`document.querySelector('#item-grid .item-card:nth-child(2) .zhx-xivc-wiki').click()`);
  assert.equal(await c.eval('window.__nativePickCount'),1,'独立 Wiki 点击不会触发父卡原生选取');

  await c.eval(`(()=>{const input=document.querySelector('#item-search');input.focus();input.value=${JSON.stringify(zh)};input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  const suggestionDeadline=Date.now()+5000;
  while(Date.now()<suggestionDeadline&&!(await c.eval(`(()=>{const list=document.querySelector('#zhx-chinese-suggest-list');return list&&!list.hidden&&list.querySelector('button[data-zhx-index]')})()`)))await sleep(25);
  const candidate=await c.eval(`(()=>{const b=document.querySelector('#zhx-chinese-suggest-list button[data-zhx-index]');return b?.textContent||''})()`);
  assert.ok(candidate.includes(zh),'xivc 装备搜索应显示中文候选');
  await c.eval(`document.querySelector('#zhx-chinese-suggest-list button[data-zhx-index]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))`);
  assert.equal(await c.eval(`document.querySelector('#item-search').value`),english,
    '选择中文候选后输入框保持原生英文值');
  assert.equal(await c.eval(`window.__xivcSearchModel`),english,
    '派发原生 input 后站点搜索模型与输入框一致');

  await c.callFn(`function(){const grid=document.querySelector('#item-grid');grid.innerHTML=
    '<div class="item-card unequip-card"><div class="item-card-name">Back</div></div>'
    +'<div class="item-card unequip-card"><div class="item-card-name">No Dye</div></div>'
    +'<div class="item-card"><div class="item-thumb"></div><div class="item-card-name">Soot Black</div></div>';}`);
  const dyeDeadline=Date.now()+5000;
  while(Date.now()<dyeDeadline&&await c.eval(`document.querySelector('#item-search').dataset.zhxXivcSearch==='1'`))await sleep(25);
  assert.equal(await c.eval(`document.querySelector('#item-search').dataset.zhxXivcSearch`),undefined);
  assert.deepEqual(await c.eval(`([...document.querySelectorAll('#item-grid .unequip-card .item-card-name')].map(e=>e.textContent))`),['返回','不染色']);
  assert.equal(await c.eval(`document.querySelectorAll('#item-grid .zhx-xivc-wiki').length`),0,
    '染色模式不把染剂名链接为装备');
  assert.equal(await c.eval(`document.querySelector('#fps').textContent`),'-- FPS');
  assert.equal(await c.eval(`window.__realStorageCalls||0`),0);
  console.log('PASS xivc cached native UI, gear Wiki, dye picker and native search model');
} finally {await closePage(port,page.target.id)}
