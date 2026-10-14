import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {SITE_POLICIES} from '../../src/core/site-policy.js';
import {newPage,closePage} from '../helpers/cdp.mjs';
import {fixtureUrl,repoRoot,readDist} from '../helpers/paths.mjs';
const port=Number(process.env.ZHX_CDP_PORT||9223);
execFileSync(process.execPath,['build/make-font-test.mjs'],{cwd:repoRoot,stdio:'pipe'});
const version=JSON.parse(fs.readFileSync(path.join(repoRoot,'package.json'),'utf8')).version;
const script=fs.readFileSync(path.join(repoRoot,'dist',`ff14-chinese-font-${version}-test.user.js`),'utf8');
const main=readDist();
assert.ok(script.includes('// @grant        none'));
assert.ok(!script.includes('@connect'));
for(const site of SITE_POLICIES){
  const page=await newPage(port);const c=page.cdp;
  try{
    // Subscribe before navigation: evaluating during the initial document swap
    // can destroy the function's execution context on fast CI runners.
    const loaded=c.waitForEvent('Page.loadEventFired');
    await c.send('Page.navigate',{url:fixtureUrl('miramiru-page.html')});
    await loaded;
    assert.equal(await c.eval('location.href'),fixtureUrl('miramiru-page.html'));
    await c.callFn(`function(site,source,companion){
      document.documentElement.lang='ja';
      window.__zhxTestSite=site;window.__zhxTestTables=[];
      window.GM_getValue=(k,d)=>d;window.GM_setValue=()=>{};window.GM_xmlhttpRequest=o=>o.onerror?.({status:0});
      const theme=document.createElement('style');theme.textContent='body,h2,input{font-family:Georgia} .fa,.material-icons{font-family:ExampleIconFont}';document.head.append(theme);
      document.body.insertAdjacentHTML('beforeend','<pre><code>code</code></pre><i class="fa">icon</i><span class="material-icons"><span>menu</span></span>');
      (0,eval)(source);(0,eval)(companion);(0,eval)(companion);
      const portal=document.createElement('div');portal.setAttribute('role','dialog');portal.innerHTML='<button>动态弹层</button>';document.body.append(portal);
    }`,[site.id,main,script]);
    const result=await c.eval(`({lang:document.documentElement.lang,count:document.querySelectorAll('#zhx-chinese-font').length,
      body:getComputedStyle(document.body).fontFamily,heading:getComputedStyle(document.querySelector('h2')).fontFamily,
      input:getComputedStyle(document.querySelector('input')).fontFamily,portal:getComputedStyle(document.querySelector('[role="dialog"] button')).fontFamily,
      code:getComputedStyle(document.querySelector('code')).fontFamily,icon:getComputedStyle(document.querySelector('.fa')).fontFamily,
      nestedIcon:getComputedStyle(document.querySelector('.material-icons span')).fontFamily})`);
    assert.equal(result.lang,'ja');assert.equal(result.count,1);
    for(const key of ['heading','input','portal'])assert.equal(result[key],result.body,site.id+':'+key);
    assert.ok(result.body.includes('Microsoft YaHei'));assert.match(result.code,/monospace/);
    assert.equal(result.icon,'ExampleIconFont');assert.equal(result.nestedIcon,'ExampleIconFont');
    // Reapply after a head/style replacement, as the main pageshow path does.
    await c.eval(`document.getElementById('zhx-chinese-font').remove()`);
    await c.eval(`window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))`);
    assert.equal(await c.eval(`document.querySelectorAll('#zhx-chinese-font').length`),1);
    console.log('PASS shared font contract: '+site.id);
  }finally{await closePage(port,page.target.id)}
}
