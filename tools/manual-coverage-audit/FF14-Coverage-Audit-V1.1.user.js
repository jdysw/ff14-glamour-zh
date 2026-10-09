// ==UserScript==
// @name         FF14 七站汉化覆盖审计 V1.1
// @namespace    https://github.com/jdysw/ff14-glamour-zh
// @version      1.1.1
// @description  原文变化见证、UI/玩家内容分类、跨状态采集与私密导出。不上传数据。
// @match        https://mirapri.com/*
// @match        https://ffxiv.eorzeacollection.com/*
// @match        https://ff14-fc.com/*
// @match        https://lookbook.ronkacloset.com/*
// @match        https://www.ffxivcollection.com/*
// @match        https://weapon.ffxivcollection.com/*
// @match        https://end-closet.com/*
// @match        https://ff14.huijiwiki.com/*
// @noframes
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

/* FF14 manual coverage audit v1.1 - shared pure logic (Node and userscript). */
(function (global) {
  'use strict';
  const SITES = Object.freeze({
    'mirapri.com':'mirapri','ffxiv.eorzeacollection.com':'ec','ff14-fc.com':'fc',
    'lookbook.ronkacloset.com':'ronka','www.ffxivcollection.com':'collection',
    'weapon.ffxivcollection.com':'collection','end-closet.com':'endcloset',
    'ff14.huijiwiki.com':'wiki'
  });
  const FORMATS = ['zhx-manual-audit-v1','zhx-manual-audit-v2'];
  const AUTHORED = {
    mirapri: ['#gallery article .article-info .title','#gallery article h2.title',
      '#gallery article figure','#gallery article img[alt]',
      '#photoDetail article .title','#photoDetail article .description',
      '.article-info .title','.comment-body','.comment-content','.user-comment'],
    ec: ['.glamour-title','.glamour-description','.glamour-card .title',
      '.user-description','.user-content','.comment-content','.glamour-comment'],
    endcloset: ['/detail/','.concept-title','.concept-description','.author-description',
      '[class*="userComment"]','[class*="creatorComment"]'],
    ronka: ['.post-title','.lookbook-title','.post-content','.comment-text'],
    collection: ['.user-post-title','.post-content','.author-description'],
    fc: ['.comment-content','.comment-body','.user-content','.post-author'],
    wiki: ['.comment-content','.user-profile','.mw-userpage-content']
  };
  const AD_RE = /(adsbygoogle|ad-slot|adunit|ad-container|affiliate|amazon|rakuten|aswift|sponsored)/i;
  const USER_RE = /(glamour.*(author|title|description)|post[-_](title|author|content)|comment[-_](text|body|content)|nickname|username|player-name|user-content|creator-description)/i;
  const ITEM_RE = /(item-name|equipment[-_]?name|gear-name|item-title|equip[-_]?list|item-tooltip)/i;
  const UI_RE = /^(BUTTON|INPUT|SELECT|TEXTAREA|OPTION|LABEL|SUMMARY|NAV|H1|H2|H3|H4|TH)$/;
  const ALT_ART = /(glamour|post|gallery|concept|snapshot|lookbook|artwork|portrait|thumbnail|avatar)/i;
  const ROUTE_BLOCK = /(?:^|\/)(?:login|logout|sign-?out|signup|register|account|profile|settings|admin|api|delete|remove|checkout)(?:\/|$)/i;
  const SAFE_ID = /^[\w-]{1,85}$/;
  const normalize = s => String(s || '').replace(/\s+/g, ' ').trim();
  function urlKey(raw) {
    const u = new URL(raw);
    if(u.protocol !== 'https:' || !SITES[u.hostname]) throw new Error('unsupported https site');
    u.hash='';u.username='';u.password='';
    for(const k of [...u.searchParams.keys()]){
      if(/^(utm_|fbclid$|gclid$|ref$|source$|share$|session|token|nonce|access|secret|auth|pass|email|sid$|code$|q$|query$|search$)/i.test(k))u.searchParams.delete(k);
    }
    u.searchParams.sort();
    if(u.pathname !== '/')u.pathname = u.pathname.replace(/\/+$/,'') + '/';
    return u.toString();
  }
  function siteFor(url){try{return SITES[new URL(url).hostname]||null}catch{return null}}
  function allowedRoute(url){try{return !ROUTE_BLOCK.test(new URL(url).pathname)}catch{return false}}
  function trimHref(raw,origin){try{const u=new URL(raw,origin);if(u.protocol!=='https:')return '';u.username='';u.password='';u.search='';u.hash='';return u.toString().slice(0,260)}catch{return ''}}
  function fnv(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
  function classifyContext(el,kind,site,url){
    const cls=String(el.className?.baseVal || el.className || '')+' '+String(el.parentElement?.className?.baseVal || el.parentElement?.className || '');
    let ancestors='';for(let p=el.parentElement,n=0;p&&n<5;p=p.parentElement,n++)ancestors+=' '+String(p.className?.baseVal||p.className||'')+' '+String(p.id||'');
    const full=cls+' '+String(el.id||'')+' '+ancestors;
    const control=UI_RE.test(el.tagName||'') && /^(BUTTON|INPUT|SELECT|OPTION|TEXTAREA|SUMMARY|LABEL)$/.test(el.tagName)
      || !!el.closest?.('button,[role="button"],[role="tab"],[role="switch"],[role="checkbox"],select,option');
    const exactSel=(AUTHORED[site]||[]).filter(x=>!x.startsWith('/'));
    const authored=exactSel.some(x=>{try{return !!el.closest?.(x)}catch{return false}}) || USER_RE.test(full);
    const likelyGallery = site==='mirapri' && !!el.closest?.('#gallery article h2.title, #gallery article .article-info .title');
    const ad=AD_RE.test(full);
    const item=ITEM_RE.test(full);
    const artImage=kind==='attr:alt' && (ALT_ART.test(full) || el.closest?.('#gallery article,.glamour-card,.concept-card'));
    let scope='unknown';
    if(ad)scope='ad';
    else if((authored||likelyGallery||artImage) && !control)scope='user';
    else if(item && !control)scope='item';
    else if(kind==='document:title')scope='metadata';
    else if(control||!!el.closest?.('nav,header,footer,form,[role="navigation"],[role="menu"],[role="tablist"],[role="dialog"],.pagination,.pager')||UI_RE.test(el.tagName||''))scope='ui';
    // Attribute labels are NOT UI by default. They may be creator-supplied titles.
    return {scope,ui:scope==='ui',user:scope==='user',ad,control,confidence:scope==='unknown'?0.35:scope==='user'?0.92:0.86,
      tag:String(el.tagName||'').toLowerCase(),cls:cls.slice(0,150),id:String(el.id||'').slice(0,75),
      ancestors:ancestors.slice(0,220),role:el.getAttribute?.('role')||'',name:el.getAttribute?.('name')||'',
      href:trimHref(el.getAttribute?.('href')||'',url)};
  }
  function stablePath(el) {
    const parts=[];let current=el;
    while(current && current.nodeType===1 && parts.length<8){
      let part=(current.tagName||'').toLowerCase();
      if(current.id&&SAFE_ID.test(current.id)&&!current.id.startsWith('zhx-')){parts.unshift(part+'#'+current.id);break}
      const test=current.getAttribute?.('data-testid')||current.getAttribute?.('data-test');
      if(test&&SAFE_ID.test(test)){parts.unshift(part+'[test='+test+']');break}
      const href=current.tagName==='A'?trimHref(current.getAttribute('href'), 'https://'+(current.ownerDocument?.location?.hostname||'mirapri.com')+'/'):'';
      if(href){parts.unshift(part+'[href#'+fnv(href)+']');break}
      const controls=current.getAttribute?.('aria-controls');
      if(controls&&SAFE_ID.test(controls)){parts.unshift(part+'[controls='+controls+']');break}
      let index=1;for(let prev=current.previousElementSibling;prev;prev=prev.previousElementSibling)if(prev.tagName===current.tagName)index++;
      part+=':nth-of-type('+index+')';parts.unshift(part);current=current.parentElement;
    }
    return parts.join(' > ');
  }
  function stableKey(it){
    // Keep structural pairing only when route/widget identity is unchanged; no text-based identity.
    return it.kind+'|'+(it.stablePath||it.path||'')+'|'+(it.ctx?.name||'');
  }
  function scopeEligible(it){return it.ctx?.scope==='ui'}
  function category(it){
    if(it.ctx?.ad)return 'excluded-ad';
    if(it.ctx?.user || it.ctx?.scope==='user')return 'excluded-user';
    if(it.ctx?.scope==='item')return 'item-review';
    if(it.ctx?.scope==='metadata')return 'metadata-review';
    if(it.ctx?.scope==='unknown')return 'needs-review';
    if(!scopeEligible(it))return 'needs-review';
    const t=normalize(it.text), b=normalize(it.before);
    if(it.before!==null&&it.before!==undefined){
      if(b===t)return hasForeign(t)?'suspected-untranslated':'unchanged';
      if(hasForeign(t))return 'suspected-partial';
      return 'translated';
    }
    return hasForeign(t)?'suspected-no-baseline':'unverified';
  }
  function hasForeign(s){return /[\u3040-\u30ff\uac00-\ud7af]/.test(s)||/[A-Za-z]{2,}/.test(s)&&!/[\u3400-\u9fff]/.test(s)}
  function pair(before, after){
    const byPath=new Map();for(const it of before||[]){const k=stableKey(it),q=byPath.get(k)||[];q.push(it);byPath.set(k,q)}
    let matched=0,ambiguous=0;
    const items=after.map(it=>{
      const queue=byPath.get(stableKey(it))||[];
      if(queue.length===1){matched++;return {...it,before:queue.shift().text,matchQuality:'structural'}}
      if(queue.length>1){ambiguous++;return {...it,before:null,matchQuality:'ambiguous'}}
      return {...it,before:null,matchQuality:'unmatched'};
    });
    return {items,matched,ambiguous,total:after.length};
  }
  function stateSignature(doc){
    const markers=[];
    for(const el of [...doc.querySelectorAll('[aria-expanded="true"],[aria-selected="true"],dialog[open],[role="dialog"],[data-state="open"]')].slice(0,25)){
      markers.push((el.tagName||'').toLowerCase()+':'+(el.id||'')+':'+(el.getAttribute('role')||'')+':'+(el.getAttribute('name')||''));
    }
    for(const el of [...doc.querySelectorAll('select')].slice(0,20)){
      // option values can contain user-entered data: store only option index.
      markers.push('select:'+(el.id||el.name||'')+':'+el.selectedIndex);
    }
    return fnv(markers.join('|'));
  }
  function snapshotKey(url,state,label=''){return url+'|'+state+'|'+normalize(label).slice(0,32)}
  function sanitizeItem(it,includeUser=false){
    const out={...it,ctx:{...it.ctx}};
    delete out.ctx.parentText;
    delete out.ctx.originalText;
    if(!includeUser&&['user','item'].includes(out.ctx.scope)){
      out.text='[内容已隐藏]';if(out.before!=null)out.before='[内容已隐藏]';out.redacted=true;
    }
    return out;
  }
  function upgradeLegacyItems(items,site){
    const src=items||[];
    const optionKeys=new Set(src.filter(it=>it.kind==='option').map(it=>(it.path||'')+'\0'+normalize(it.text)));
    return src.filter(it=>!(it.kind==='text'&&optionKeys.has((it.path||'')+'\0'+normalize(it.text))))
      .map(it=>{
        const ctx={...(it.ctx||{})},path=it.path||'';
        const signature=String(ctx.cls||'')+' '+String(ctx.ancestors||'')+' '+path;
        const galleryTitle=site==='mirapri' && /\btitle\b/.test(String(ctx.cls||''))
          && /gallery|article-info/.test(signature) && ctx.tag==='h2';
        const galleryImg=site==='mirapri' && it.kind==='attr:alt' && /gallery|article-info/.test(signature);
        const authored=ctx.user||galleryTitle||galleryImg||USER_RE.test(signature);
        const itemName=ITEM_RE.test(signature);
        let scope='unknown';
        if(ctx.ad)scope='ad';
        else if(authored&&!ctx.control)scope='user';
        else if(itemName&&!ctx.control)scope='item';
        else if(it.kind==='document:title')scope='metadata';
        else if(ctx.control||ctx.ui&&it.kind==='text'||it.kind==='option')scope='ui';
        else if(it.kind.startsWith('attr:')&&/nav|header|footer|button|input|form|pagination|pager|label/.test(signature))scope='ui';
        ctx.scope=scope;ctx.user=scope==='user';ctx.ui=scope==='ui';
        return {...it,ctx,stablePath:it.stablePath||it.path};
      });
  }
  function migrate(data){
    if(!data||!FORMATS.includes(data.format))throw Error('不支持的审计 JSON 格式');
    const out={format:'zhx-manual-audit-v2',createdAt:data.createdAt||new Date().toISOString(),
      baselines:{},pages:{},settings:{},migration:data.format};
    if(data.format==='zhx-manual-audit-v2')return data;
    for(const [url,row] of Object.entries(data.baselines||{})){
      const id=snapshotKey(url,'legacy','');out.baselines[id]={...row,key:id,state:'legacy',method:'manual',items:upgradeLegacyItems(row.items,row.site)};
    }
    for(const [url,row] of Object.entries(data.pages||{})){
      const id=snapshotKey(url,'legacy','');out.pages[id]={...row,key:id,state:'legacy',label:'',round:'legacy',hasBaseline:!!row.hasBaseline,items:upgradeLegacyItems(row.items,row.site)};
    }
    return out;
  }
  function compareRuns(oldRows,newRows){
    const keyRow=row=>(row.site||'')+'|'+(row.url||'')+'|'+(row.state||'default')+'|'+(row.label||'');
    const oldOk=new Set(oldRows.filter(r=>r.status==='ok').map(keyRow));
    const nowOk=new Set(newRows.filter(r=>r.status==='ok').map(keyRow));
    const comparable=new Set([...oldOk].filter(k=>nowOk.has(k)));
    function indexed(rows){const map=new Map();for(const row of rows){
      if(row.status!=='ok'||!comparable.has(keyRow(row)))continue;
      for(const it of row.items||[]){if(!category(it).startsWith('suspected'))continue;
        const key=keyRow(row)+'|'+(it.kind||'')+'|'+(it.stablePath||it.path||'')+'|'+normalize(it.text);
        map.set(key,{...it,site:row.site,url:row.url,state:row.state});
      }}return map}
    const old=indexed(oldRows),now=indexed(newRows);
    const introduced=[...now].filter(([key])=>!old.has(key)).map(([,v])=>v);
    const resolved=[...old].filter(([key])=>!now.has(key)).map(([,v])=>v);
    const persistent=[...now].filter(([key])=>old.has(key)).map(([,v])=>v);
    return {introduced,resolved,persistent,comparablePages:comparable.size,
      skippedOldPages:oldOk.size-comparable.size,skippedNewPages:nowOk.size-comparable.size};
  }

  const api={SITES,AUTHORED,FORMATS,urlKey,siteFor,allowedRoute,trimHref,fnv,classifyContext,stablePath,stableKey,upgradeLegacyItems,
    category,hasForeign,pair,stateSignature,snapshotKey,sanitizeItem,migrate,compareRuns};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.ZHXAuditCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);

/* FF14 manual browser audit v1.1.1. Bundled after audit-core.js. */
(function(){
'use strict';
const C=globalThis.ZHXAuditCore;
const site=C.siteFor(location.href);
if(!site)return;
const KEY='zhx.audit.manual.v2',OLD='zhx.audit.manual.v1';
const MODE='zhx.audit.manual.mode', AUTO='zhx.audit.manual.autosave';
const ROUND='zhx.audit.manual.round', LABEL='zhx.audit.manual.label';
const CAP=6000,MAX_SNAPSHOTS=320,MAX_BASELINES=320;
const BAD=new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','IFRAME','SVG']);
const ATTRS=['title','alt','aria-label','placeholder'];
let busy=false,box,status,stats,modePick,autoCheck,roundInput,labelInput,privateCheck;
let lastMut=performance.now(),afterReady=false;
// A document-start observer records pre-mutation values where possible. These are
// *inferred* evidence, never a verified before snapshot: userscripts may execute
// before us, and oldValue may be a dynamic (not foreign) intermediate state.
const witnessedText=new WeakMap(), witnessedAttrs=new WeakMap();
const clock=()=>new Date().toISOString();
function watchMutations(){
  const obs=new MutationObserver(records=>{
    if(records.some(m=>!m.target?.closest?.('#zhx-manual-audit-overlay'))) lastMut=performance.now();
    for(const m of records){
      if(m.type==='characterData'&&m.oldValue&&!witnessedText.has(m.target))witnessedText.set(m.target,m.oldValue);
      if(m.type==='attributes'&&ATTRS.includes(m.attributeName)&&m.oldValue){
        let attrs=witnessedAttrs.get(m.target);
        if(!attrs){attrs=new Map();witnessedAttrs.set(m.target,attrs)}
        if(!attrs.has(m.attributeName))attrs.set(m.attributeName,m.oldValue);
      }
    }
  });
  obs.observe(document,{subtree:true,childList:true,characterData:true,characterDataOldValue:true,attributes:true,attributeOldValue:true,attributeFilter:ATTRS});
  window.addEventListener('zhx:translation-ready',()=>{afterReady=true;},{passive:true});
}
watchMutations();
async function readyForCapture(){
  const t0=performance.now();
  while(performance.now()-t0<15000){
    const now=performance.now(),quiet=now-lastMut;
    if(document.readyState!=='loading'&&now-t0>=1800&&quiet>=1200)return afterReady?'signaled+stable':'dom-stable-unverified';
    await new Promise(r=>setTimeout(r,250));
  }
  return 'timeout-unverified';
}
function detectBlocked(){
  const t=(document.title||'').toLowerCase();const b=(document.body?.innerText||'').slice(0,5000).toLowerCase();
  if((/just a moment|attention required|access denied|blocked/.test(t+' '+b)||b.includes('performing security verification'))
    &&/cloudflare|security service|verify you are not a bot|blocked/.test(b))return 'Cloudflare/WAF verification';
  if((t==='404'||/404\s*not found|page not found/.test(t))&&/404|not found|could not be found/.test(b))return '404 route';
  if((t.includes('sitemap')||b.includes('xml sitemap index'))&&/xml sitemap|sub-sitemap|sitemap generator/.test(b))return 'sitemap';
  return null;
}
function collect(){
  const items=[],seen=new Set(),visibility=new WeakMap();
  if(!document.body)return items;
  function visible(el){
    if(!el||!el.isConnected)return false;
    if(visibility.has(el))return visibility.get(el);
    let ok=true;
    if(el.id==='zhx-manual-audit-overlay'||el.closest?.('#zhx-manual-audit-overlay'))ok=false;
    if(ok&&(el.getAttribute?.('aria-hidden')==='true'||el.hasAttribute?.('hidden')))ok=false;
    if(ok){const style=getComputedStyle(el);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)ok=false;}
    if(ok&&el.parentElement)ok=visible(el.parentElement);
    if(ok&&el.tagName!=='OPTION'&&el.getClientRects().length===0)ok=false;
    visibility.set(el,ok);return ok;
  }
  function skip(el){
    if(!el||BAD.has(el.tagName))return true;
    if(el.closest?.('script,style,noscript,template,iframe,svg,[contenteditable="true"],input[type="password"],textarea'))return true;
    return false;
  }
  function push(el,val,kind,node,attr=''){
    if(skip(el)||!visible(el))return;
    const raw=String(val??'').replace(/\s+/g,' ').trim();
    if(!raw||raw.length>500)return;
    const path=C.stablePath(el),ctx=C.classifyContext(el,kind,site,location.href);
    const key=kind+'\u0000'+path+'\u0000'+raw;
    if(seen.has(key))return;seen.add(key);
    let before=null,quality='none';
    if(node&&witnessedText.has(node)){
      const old=witnessedText.get(node)?.replace(/\s+/g,' ').trim();
      if(old&&old!==raw){before=old;quality='inferred-old-value'}
    }
    if(attr){const old=witnessedAttrs.get(el)?.get(attr)?.replace(/\s+/g,' ').trim();if(old&&old!==raw){before=old;quality='inferred-old-value'}}
    items.push({kind,text:raw,path,stablePath:path,ctx,before,matchQuality:quality});
  }
  const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{
    acceptNode(n){const el=n.parentElement;
      if(!el||el.tagName==='OPTION'||skip(el)||!visible(el))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  for(let n;(n=tw.nextNode());)push(n.parentElement,n.nodeValue,'text',n);
  for(const el of document.querySelectorAll('[placeholder],[title],[aria-label],[alt],[value],option')){
    if(el.tagName==='OPTION')push(el,el.textContent,'option'); // once; no duplicate text node
    for(const a of ATTRS)if(el.hasAttribute(a))push(el,el.getAttribute(a),'attr:'+a,null,a);
    if(/^(INPUT|BUTTON)$/.test(el.tagName)&&/^(button|submit|reset)$/i.test(el.getAttribute('type')||''))push(el,el.getAttribute('value'),'attr:value',null,'value');
  }
  if(document.title){const ctx={scope:'metadata',tag:'title',ui:false,user:false,ad:false,confidence:.9};
    items.push({kind:'document:title',text:document.title,path:'head > title',stablePath:'head > title',ctx,before:null,matchQuality:'none'});}
  return items;
}
function cleanURL(){return C.urlKey(location.href)}
function blank(){return {format:'zhx-manual-audit-v2',createdAt:clock(),toolVersion:'1.1.1',baselines:{},pages:{},settings:{}}}
async function get(k,d){try{return await GM_getValue(k,d)}catch{return d}}
async function set(k,v){return GM_setValue(k,v)}
async function load(){
  const now=await get(KEY,'');
  if(now){try{return C.migrate(JSON.parse(now))}catch(e){console.warn('[audit] damaged v2 storage',e)}}
  const old=await get(OLD,'');
  if(old){try{const migrated=C.migrate(JSON.parse(old));await save(migrated);return migrated}catch(e){console.warn('[audit] v1 migration failed',e)}}
  return blank();
}
async function save(data){await set(KEY,JSON.stringify(data))}
function say(s,bad=false){if(status){status.textContent=s;status.dataset.error=String(!!bad)}}
const readLabel=()=>String(labelInput?.value||'').trim().slice(0,32);
const readRound=()=>String(roundInput?.value||'default').trim().slice(0,32)||'default';
async function capture(automatic=false){
  if(busy)return;
  if(!C.allowedRoute(location.href)){say('已排除账号、提交或敏感操作路径。',true);return}
  busy=true;
  try{
    const readiness=automatic?await readyForCapture():'manually-triggered';
    const url=cleanURL(),state=C.stateSignature(document),label=readLabel(),round=readRound();
    const mode=await get(MODE,'after'),data=await load();
    const key=C.snapshotKey(url,state,label),recordKey=round+'|'+key;
    const blocked=detectBlocked();
    if(blocked){
      if(mode==='after')data.pages[recordKey]={site,url,key,state,label,round,items:[],status:'failed',error:blocked,scannedAt:clock()};
      await save(data);await count(data);say('无法审计：'+blocked+'。已标记失败，非零漏译。',true);return;
    }
    const all=collect();
    if(all.length>CAP){say('节点超过单页安全限额 '+CAP+'，未保存以免遗漏。',true);return;}
    if(mode==='before'){
      if(!data.baselines[key]&&Object.keys(data.baselines).length>=MAX_BASELINES)throw Error('已达基线数量限制，先导出归档');
      data.baselines[key]={site,url,state,label,key,items:all,capturedAt:clock(),method:'manual-verified'};
      say('已保存人工原文基线：'+all.length+' 项。重新启用汉化脚本后对同一状态采集。');
    }else{
      if(!data.pages[recordKey]&&Object.keys(data.pages).length>=MAX_SNAPSHOTS)throw Error('快照数量达到上限，先导出归档');
      const baseline=data.baselines[key];
      let matched=0,ambiguous=0,items=all;
      if(baseline){const p=C.pair(baseline.items,all);items=p.items;matched=p.matched;ambiguous=p.ambiguous;}
      const beforeMatched=baseline ? matched : all.filter(it=>it.matchQuality==='inferred-old-value').length;
      const baselineQuality=baseline?'manual-verified':beforeMatched?'partial-inferred':'none';
      data.pages[recordKey]={site,url,pageId:'manual-'+site,key,state,label,round,status:'ok',
        items,beforeCount:baseline?.items.length??null,hasBaseline:!!baseline,
        baselineQuality,matched,ambiguous,observedOldValues:beforeMatched,
        readiness,scannedAt:clock(),source:'manual-browser-v1.1',title:document.title};
      say((automatic?'自动':'手动')+'完成 '+all.length+' 条，'+
        (baseline?`人工基线匹配 ${matched}/${all.length}`:`推断原文 ${beforeMatched} 条（不能据此计算汉化率）`)+
        '；采集状态 '+readiness);
    }
    await save(data);await count(data);
  }catch(e){say('采集失败：'+String(e.message||e),true);console.error('[FF14 audit v1.1]',e)}
  finally{busy=false}
}
async function count(d){const x=d||await load();if(stats)stats.textContent=`原文状态 ${Object.keys(x.baselines).length} / 译后快照 ${Object.keys(x.pages).length}`}
function download(data,name){const blob=new Blob([data],{type:'application/json;charset=utf-8'});
  const uri=URL.createObjectURL(blob),a=document.createElement('a');a.href=uri;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(uri),2000);
}
async function exportJSON(){
  const d=await load();if(!Object.keys(d.pages).length&&!Object.keys(d.baselines).length){say('尚无数据。',true);return}
  // Never leak parentText. Player content and unverified names are redacted by default.
  const out=JSON.parse(JSON.stringify(d)),includeUser=!!privateCheck?.checked;
  for(const row of [...Object.values(out.baselines),...Object.values(out.pages)]){
    if(Array.isArray(row.items))row.items=row.items.map(item=>C.sanitizeItem(item,includeUser));
  }
  out.exportedAt=clock();out.exportOptions={includeUserContent:includeUser};
  download(JSON.stringify(out,null,2),'ff14-audit-v1.1-'+clock().replace(/[:.]/g,'-')+'.json');
  say('已导出 '+Object.keys(out.pages).length+' 个快照；'+(includeUser?'包含玩家内容，请审查隐私。':'玩家内容已默认脱敏。'));
}
async function clear(){if(!confirm('清空所有审计记录（包含 V1.0 导入数据）？请先导出备份。'))return;
  await set(KEY,JSON.stringify(blank()));await set(OLD,'');await count();say('已清空。')}
function btn(text,fn){const x=document.createElement('button');x.type='button';x.textContent=text;x.addEventListener('click',fn);return x}
async function init(){
  if(!document.body){await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}))}
  const host=document.createElement('div');host.id='zhx-manual-audit-overlay';
  Object.assign(host.style,{position:'fixed',bottom:'14px',right:'14px',zIndex:'2147483647',width:'304px'});
  document.body.append(host);box=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');style.textContent=`:host{all:initial}*{box-sizing:border-box}
  .panel{background:#132039;color:#eaf1fa;border:1px solid #476085;border-radius:12px;padding:12px;font:12px/1.5 system-ui,sans-serif;box-shadow:0 6px 25px #0009}
  .head{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:14px}
  .body{display:grid;gap:8px;margin-top:9px}label{display:flex;align-items:center;gap:6px}input[type=text],select,button{font:inherit;border:1px solid #526b8f;background:#243653;color:#fff;border-radius:6px;padding:5px 7px}
  input[type=text]{width:100%;min-width:60px}button{cursor:pointer}button:hover{background:#35517b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .hint{font-size:11px;color:#c6d1e2}.bad{color:#ffb9b9}.closed .body{display:none}#status{max-height:85px;overflow:auto;overflow-wrap:anywhere}#status[data-error=true]{color:#ffb9b9}`;
  box.append(style);const panel=document.createElement('div');panel.className='panel';
  const head=document.createElement('div');head.className='head';head.append(document.createTextNode('FF14 汉化审计 V1.1'));
  head.append(btn('−',()=>{panel.classList.toggle('closed');head.lastChild.textContent=panel.classList.contains('closed')?'+':'−'}));panel.append(head);
  const body=document.createElement('div');body.className='body';
  const hint=document.createElement('div');hint.className='hint';hint.textContent='只读采集；同一网址可保留不同状态和版本。自动推断的原文不等同于完整基线。';body.append(hint);
  modePick=document.createElement('select');for(const [v,name] of [['after','翻译后 / 残留扫描'],['before','原文基线 / 关闭正式汉化']]){const o=document.createElement('option');o.value=v;o.textContent=name;modePick.append(o)}
  modePick.value=await get(MODE,'after');modePick.addEventListener('change',async()=>{await set(MODE,modePick.value);say(modePick.value==='before'?'采集原文前需关闭正式汉化脚本并刷新页面。':'汉化模式请开启正式脚本并刷新。')});
  const m=document.createElement('label');m.textContent='模式';m.append(modePick);body.append(m);
  roundInput=document.createElement('input');roundInput.type='text';roundInput.placeholder='例如：PR27-before';roundInput.value=await get(ROUND,'default');
  roundInput.addEventListener('change',()=>set(ROUND,readRound()));const r=document.createElement('label');r.textContent='扫描轮次';r.append(roundInput);body.append(r);
  labelInput=document.createElement('input');labelInput.type='text';labelInput.placeholder='可选：筛选展开 / 移动端';labelInput.value=await get(LABEL,'');
  labelInput.addEventListener('change',()=>set(LABEL,readLabel()));const l=document.createElement('label');l.textContent='交互状态标签';l.append(labelInput);body.append(l);
  const ac=document.createElement('label');autoCheck=document.createElement('input');autoCheck.type='checkbox';autoCheck.checked=!!await get(AUTO,false);
  autoCheck.addEventListener('change',async()=>{await set(AUTO,autoCheck.checked);say('自动采集等待 DOM 稳定；若汉化仍在加载，请手动重新采集。')});
  ac.append(autoCheck,document.createTextNode('页面加载后自动采集（等待稳定）'));body.append(ac);
  const priv=document.createElement('label');privateCheck=document.createElement('input');privateCheck.type='checkbox';
  priv.append(privateCheck,document.createTextNode('导出玩家内容 / 物品名（默认隐藏）'));body.append(priv);
  body.append(btn('采集当前页面／状态',()=>capture(false)));
  const actions=document.createElement('div');actions.className='grid';actions.append(btn('导出 JSON',()=>exportJSON()),btn('清空记录',()=>clear()));body.append(actions);
  stats=document.createElement('div');stats.className='hint';body.append(stats);
  status=document.createElement('div');status.id='status';status.className='hint';
  status.textContent=C.allowedRoute(location.href)?'可采集。请确认网站内容与翻译均已加载。':'账号或敏感操作路径：审计已禁用。';body.append(status);
  panel.append(body);box.append(panel);await count();
  if(autoCheck.checked&&C.allowedRoute(location.href))void capture(true);
}
try{GM_registerMenuCommand('FF14 V1.1：采集当前页',()=>capture(false));GM_registerMenuCommand('FF14 V1.1：导出 JSON',()=>exportJSON());}catch{}
void init().catch(err=>console.error('[FF14 manual audit init]',err));
})();
