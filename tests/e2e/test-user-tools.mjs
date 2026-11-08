import assert from 'node:assert/strict';
import {newPage,closePage} from '../helpers/cdp.mjs';
import {seedV3Memory} from '../helpers/v3-cache.mjs';
import {readDist,fixtureUrl} from '../helpers/paths.mjs';

const port=Number(process.env.ZHX_CDP_PORT||9223);
for(const site of ['ronka','endcloset','miramiru','fc','eden']){
  const page=await newPage(port,fixtureUrl('ronka-search.html'));
  const c=page.cdp;
  try{
    await seedV3Memory(c,site==='eden'?'miramiru':site);
    await c.callFn(`function(site){
      document.documentElement.lang='en';
      document.body.innerHTML='<article><h2 class="post-title"></h2><p class="post-content"></p></article>'
        +'<div class="post-item-information"><p id="gear"></p></div>'
        +'<div><img id="reused"></div><span id="slide" aria-label="Previous slide"></span>'
        +'<footer id="legal">記載されている会社名・製品名・システム名などは、各社の商標、または登録商標です。</footer>';
      const native=site==='miramiru'?"Butler's Jacket":'집사 재킷';
      document.querySelector('.post-title').textContent=native;
      document.querySelector('.post-content').textContent=native;
      document.querySelector('#gear').textContent=native;
      document.querySelector('#reused').alt='집사 재킷';
      if(site==='miramiru'){
        const link=document.createElement('a');link.className='eorzeadb_link';
        link.href='https://na.finalfantasyxiv.com/lodestone/playguide/db/item/295d9dcd78a/';
        document.querySelector('#gear').replaceWith(link);link.id='gear';link.textContent=native;
      }
      window.__zhxTestSite=site;window.__zhxDiagOn=true;window.__menus=new Map();
      window.GM_registerMenuCommand=(label,callback)=>window.__menus.set(label,callback);
      window.GM_getValue=(k,d)=>window.__v3MemoryCache.get(k)??d;
      window.GM_setValue=(k,v)=>window.__v3MemoryCache.set(k,v);
      window.GM_listValues=()=>[...window.__v3MemoryCache.keys()];
      window.GM_deleteValue=k=>window.__v3MemoryCache.delete(k);
      window.GM_xmlhttpRequest=request=>request.onerror?.({});
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text}}});
    }`,[site]);
    await c.callFn('function(source){(0,eval)(source)}',[readDist()]);
    await c.waitFor(`Object.hasOwn(window.__zhxMarks||{},'ready')`);
    if(['ronka','endcloset','miramiru'].includes(site)){
      const expected=site==='miramiru'?"Butler's Jacket":'집사 재킷';
      const result=await c.eval(`({title:document.querySelector('.post-title').textContent,
        description:document.querySelector('.post-content').textContent,
        authoredLink:document.querySelector('.post-content').dataset.zhxItem,
        gear:document.querySelector('#gear').textContent})`);
      assert.equal(result.title,expected);assert.equal(result.description,expected);
      assert.equal(result.authoredLink,undefined);assert.equal(result.gear,'管家燕尾服');
    }
    if(site==='ronka'){
      await c.waitFor(`document.querySelector('#reused').alt==='管家燕尾服'`);
      await c.eval(`document.querySelector('#reused').alt='메이드 머리띠'`);
      await c.waitFor(`document.querySelector('#reused').alt==='女仆发带'`);
    }
    if(site==='fc'){
      assert.equal(await c.eval(`document.querySelector('#slide').getAttribute('aria-label')`),'上一张图片');
      await c.eval(`document.querySelector('#slide').setAttribute('aria-label','Go to slide 3')`);
      await c.waitFor(`document.querySelector('#slide').getAttribute('aria-label')==='切换到第 3 张'`);
    }
    if(site==='eden')assert.match(await c.eval(`document.querySelector('#legal').textContent`),/各公司的商标/);
    if(site==='miramiru'){
      const placeholder=await c.eval(`(async()=>{
        const dialog=document.createElement('div');dialog.setAttribute('role','dialog');
        dialog.innerHTML='<input role="combobox" placeholder="Search Body gear">';document.body.append(dialog);
        await new Promise(requestAnimationFrame);return dialog.querySelector('input').placeholder;
      })()`);
      assert.equal(placeholder,'搜索身体装备');
      await c.eval(`document.querySelector('#gear').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,altKey:true}))`);
      await c.waitFor(`document.querySelector('#zhx-tools-panel')`);
      assert.equal(await c.eval(`document.querySelector('#zhx-tools-panel').getAttribute('aria-label')`),'管家燕尾服');
      const link=await c.eval(`document.querySelector('#zhx-tools-panel a[href*="ronkacloset"]').href`);
      assert.equal(new URL(link).searchParams.get('keyword'),'집사 재킷');
      await c.eval(`[...document.querySelectorAll('#zhx-tools-panel button')].find(b=>b.textContent==='复制英文名称').click()`);
      await c.waitFor(`window.__copied==="Butler's Jacket"`);
      await c.eval(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
      assert.equal(await c.eval(`!!document.querySelector('#zhx-tools-panel')`),false);
      await c.eval(`window.__menus.get('词库状态')()`);
      assert.match(await c.eval(`document.querySelector('#zhx-tools-panel').textContent`),/已就绪/);
      await c.eval(`window.__menus.get('立即检查词库更新')()`);
      await c.waitFor(`document.querySelector('#zhx-tools-panel').textContent.includes('检查完成')`);
      assert.match(await c.eval(`document.querySelector('#gear').href`),/ff14.huijiwiki.com/);
    }
    console.log('PASS '+site+': authored content, dynamic localization and applicable user tools');
  }finally{await closePage(port,page.target.id)}
}
