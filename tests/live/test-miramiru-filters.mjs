import assert from 'node:assert/strict';
import {newPage,closePage,sleep} from '../helpers/cdp.mjs';
import {readDist} from '../helpers/paths.mjs';
const port=Number(process.env.ZHX_CDP_PORT||9223);
const locale=process.env.ZHX_MIRAMIRU_LOCALE||'en';
const prefix=locale==='ja'?'':'/'+locale;
const page=await newPage(port,'https://miramiru.co'+prefix+'?filter=open#mirapuri');
const c=page.cdp;
async function waitFor(expression){
  for(let i=0;i<50;i++){if(await c.eval(expression))return;await sleep(200)}
  throw new Error('Timed out: '+expression);
}
async function selectItem(text){
  const point=await c.callFn(`function(text){const e=[...document.querySelectorAll('[data-slot="select-item"]')].find(e=>e.textContent===text);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}`,[text]);
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  await waitFor(`!document.querySelector('[data-slot="select-item"]')`);
}
try{
  await waitFor(`!!document.querySelector('[role="dialog"] input')`);
  await c.callFn('function(source){(0,eval)(source);}',[readDist()]);
  await waitFor(`[...document.querySelectorAll('[role="dialog"] button')].some(e=>e.textContent.trim()==='骑士')`);
  const roles=await c.eval(`document.querySelector('[role="dialog"]').innerText`);
  for(const role of ['防护职业','治疗职业','近战输出','远程物理输出','远程魔法输出','制作职业','采集职业'])assert.ok(roles.includes(role),locale+': '+role);
  assert.equal(await c.eval(`[...document.querySelectorAll('[role="dialog"] button')].find(e=>e.textContent.trim()==='白魔').title`),'白魔法师');
  await c.eval(`[...document.querySelectorAll('[role="dialog"] button')].find(e=>e.textContent.trim()==='骑士').click()`);
  await waitFor(`(new URL(location.href).searchParams.get('jobs')||'').split(',').includes('pld')`);
  await c.eval(`(()=>{const b=[...document.querySelectorAll('[role="dialog"] button[role="combobox"]')].find(e=>e.textContent.trim()==='种族');b.scrollIntoView({block:'center'});b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',button:0}));})()`);
  await waitFor(`!![...document.querySelectorAll('[data-slot="select-item"]')].find(e=>e.textContent==='猫魅族')`);
  const races=await c.eval(`[...document.querySelectorAll('[data-slot="select-item"]')].map(e=>e.textContent)`);
  for(const race of ['人族','猫魅族','拉拉菲尔族','鲁加族','敖龙族','维埃拉族','硌狮族','精灵族'])assert.ok(races.includes(race));
  await selectItem('猫魅族');
  await waitFor(`new URL(location.href).searchParams.get('race')==='miqote'`);
  await c.eval(`(()=>{const b=[...document.querySelectorAll('[role="dialog"] button[role="combobox"]')].find(e=>e.textContent.trim()==='性别');b.scrollIntoView({block:'center'});b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',button:0}));})()`);
  await waitFor(`!![...document.querySelectorAll('[data-slot="select-item"]')].find(e=>e.textContent==='女性')`);
  assert.deepEqual(await c.eval(`[...document.querySelectorAll('[data-slot="select-item"]')].map(e=>e.textContent)`),['全部','男性','女性']);
  await selectItem('女性');
  await waitFor(`new URL(location.href).searchParams.get('gender')==='FEMALE'`);
  await sleep(350);
  await c.eval(`(()=>{const input=document.querySelector('input[placeholder="按标签筛选"]');input.scrollIntoView({block:'center'});input.blur();input.focus();})()`);
  await waitFor(`!![...document.querySelectorAll('li[role="option"] button')].find(e=>e.textContent.includes('#酷帅'))`);
  await c.eval(`[...document.querySelectorAll('li[role="option"] button')].find(e=>e.textContent.includes('#酷帅')).click()`);
  await waitFor(`new URL(location.href).searchParams.get('tag')==='クール'`);
  await waitFor(`[...document.querySelectorAll('[data-slot="badge"]')].some(e=>e.textContent.includes('#酷帅'))`);
  assert.equal(await c.eval(`document.querySelector('input[placeholder="按标签筛选"]')?.value||''`),'');
  const colors=await c.eval(`[...document.querySelectorAll('[role="dialog"] button[aria-label]')].map(e=>e.getAttribute('aria-label'))`);
  for(const color of ['灰色系','红色系','棕色系','黄色系','绿色系','蓝色系','紫色系','特殊色'])assert.ok(colors.includes(color),color);
  await c.eval(`[...document.querySelectorAll('[role="dialog"] button')].find(e=>e.textContent.trim()==='按装备搜索').click()`);
  await waitFor(`!!document.querySelector('input[placeholder="搜索头部装备"]')`);
  console.log('PASS live native filter: Chinese options/tags, gear placeholders, jobs=pld, race=miqote, gender=FEMALE and tag=クール: '+locale);
}catch(error){
  console.log(await c.eval(`({dialog:document.querySelector('[role="dialog"]')?.innerText.slice(-4500),
    tagInput:document.querySelector('input[placeholder="按标签筛选"]')?.outerHTML,
    options:[...document.querySelectorAll('li[role="option"]')].map(e=>e.outerHTML.slice(0,1300)),
    requests:performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/tags')).map(e=>({url:e.name,status:e.responseStatus}))})`));
  throw error;
}finally{await closePage(port,page.target.id)}
