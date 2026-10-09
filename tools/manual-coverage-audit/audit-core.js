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
