/* FF14 manual coverage audit - shared pure logic (Node and userscript). */
(function (global) {
  'use strict';
  const TOOL_VERSION = '1.3.6';
  const SITES = Object.freeze({
    'mirapri.com':'mirapri','ffxiv.eorzeacollection.com':'ec','ff14-fc.com':'fc',
    'lookbook.ronkacloset.com':'ronka','www.ffxivcollection.com':'collection',
    'weapon.ffxivcollection.com':'collection','end-closet.com':'endcloset',
    'ff14.huijiwiki.com':'wiki','miramiru.co':'miramiru','mirapri.ff14eden.work':'eden','attire.jp':'attire'
  });
  const FORMAT = 'zhx-manual-audit-v2';
  const AUTHORED = {
    mirapri: ['#gallery article .article-info .title','#gallery article h2.title',
      '#gallery article figure','#gallery article img[alt]',
      '#photoDetail article .title','#photoDetail article .description',
      '.article-info .title','.comment-body','.comment-content','.user-comment'],
    ec: ['.glamour-title','.glamour-description','.glamour-card .title',
      '.user-description','.user-content','.comment-content','.glamour-comment'],
    endcloset: ['/detail/','.concept-title','.concept-description','.author-description',
      '[class*="userComment"]','[class*="creatorComment"]'],
    ronka: ['.post-title','.lookbook-title','.post-content','.comment-text','.post-box img.post-thumbnail'],
    collection: ['.user-post-title','.post-content','.author-description'],
    fc: ['.comment-content','.comment-body','.user-content','.post-author'],
    wiki: ['.comment-content','.user-profile','.mw-userpage-content'],
    miramiru: ['a[href*="/users/"],a[href*="/tags/"],a[href*="/mirapuri/"]']
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
    const route = u.hostname==='mirapri.ff14eden.work' ? edenRoute(u) : '';
    u.hash=route;u.username='';u.password='';
    for(const k of [...u.searchParams.keys()]){
      if(/^(utm_|fbclid$|gclid$|ref$|source$|share$|session|token|nonce|access|secret|auth|pass|email|sid$|code$|q$|query$|search$)/i.test(k))u.searchParams.delete(k);
    }
    // WordPress search may contain user-entered words. Keep only the route state in exported evidence.
    if(u.hostname==='attire.jp'&&u.searchParams.has('s'))u.searchParams.set('s','[query omitted]');
    u.searchParams.sort();
    if(u.pathname !== '/')u.pathname = u.pathname.replace(/\/+$/,'') + '/';
    return u.toString();
  }
  function siteFor(url){try{return SITES[new URL(url).hostname]||null}catch{return null}}
  function pageLanguage(url){
    if(siteFor(url)!=='miramiru')return null;
    const segment=new URL(url).pathname.split('/')[1];
    return segment==='en'||segment==='ko'?segment:'ja';
  }
  function miramiruScope(el,kind,url){
    if(el.closest?.('a.eorzeadb_link,[data-zhx-miramiru-zh]'))return 'item';
    const path=new URL(url).pathname;
    // Full-size and thumbnail alt texts inherit player-supplied titles.
    // They are not UI labels even though the image sits inside a button.
    if(/\/mirapuri\//.test(path)&&kind==='attr:alt'&&el.closest?.('button')&&
        / - (?:Thumbnail )?\d+$/.test(el.getAttribute?.('alt')||''))return 'user';
    if(/\/about\/contributors\/?$/.test(path)&&el.closest?.('h2.text-lg.font-semibold')&&
        !['テストユーザーの皆様','各位测试用户'].includes(el.textContent?.trim()))return 'user';
    if(el.closest?.('a[href*="/users/"],a[href*="/tags/"],a[href*="/mirapuri/"]'))return 'user';
    const tagLink=el.closest?.('a[href*="?tag="]');
    if(tagLink&&el.closest?.('[data-slot="badge"]')?.textContent?.trim().startsWith('#'))return 'user';
    if(/\/(?:mirapuri|users)\//.test(path)&&el.closest?.('h1,main .whitespace-pre-wrap'))return 'user';
    if(el.closest?.('h3')||kind==='attr:alt'){
      for(let p=el.parentElement,n=0;p&&n<3;p=p.parentElement,n++){
        if(p.querySelector?.('a[href*="/mirapuri/"]'))return 'user';
      }
    }
    if(/^\/(?:en\/|ko\/|ja\/)?terms\/?$/.test(path)&&el.closest?.('main .legal-content'))return 'ui';
    if(/^\/(?:en\/|ko\/|ja\/)?sponsors\/?$/.test(path)&&el.closest?.('main')&&kind==='text')return 'ui';
    if(/^\/(?:en\/|ko\/|ja\/)?(?:about|faq|collection)\/?$/.test(path)&&el.closest?.('main'))return 'ui';
    return null;
  }
  function edenRoute(u){
    const route=u.hash.split('?')[0].replace(/^#/, '') || '/';
    return /^\/(?:components\/(?:popular-equipment|glamour-recipe-maker|dye-finder|help|q&a|policy|contest|gallery\/[\w-]{1,85}))?\/?$/.test(route)?route:'';
  }
  function edenScope(el,url){
    if(el.closest?.('.image-container .overlay,.recipe-dialog-title-text,.recipe-dialog-user,.recipe-dialog-text,.gallery-hero-text,.gallery-tile-title,.gallery-tile-img'))return 'user';
    if(el.closest?.('[data-zhx-item],.v-data-table td,.v-list-item__title,.v-window-item .flex-grow-1,#equipment-view h6'))return 'item';
    if(url&&/^#\/components\/contest\/?(?:\?|$)/u.test(new URL(url).hash)){
      if(el.closest?.('.prize-card :is(.prize-name,.prize-image)'))return 'item';
      if(el.closest?.('.contest-card .v-card__text'))return 'ui';
    }
    return null;
  }
  function fcScope(el,kind,url){
    // Keep quoted posts and their image descriptions private.
    if(el.closest?.('.twitter-tweet,.comment-body,.comment-content'))return 'user';
    if(el.closest?.('#info-drop a.eorzeadb_link'))return 'item';
    const link=el.closest?.('a[href]');
    if(!link)return null;
    let target;
    try{target=new URL(link.getAttribute('href'),url)}catch{return null}
    if(target.origin!==new URL(url).origin||!/^\/(?:equipment|summary)\/[^/]+\/?$/u.test(target.pathname))return null;
    if(kind==='text'&&el.closest?.('#scrollad h5,.article_list__ttl,.kanren-t h5,.p-navi h5'))return 'ui';
    if(kind==='attr:alt'&&el.closest?.('#scrollad img,.related_post__equipment img,.kanren img'))return 'item';
    return null;
  }
  function ronkaScope(el,kind){
    // Match the native equipment-name nodes used by the Ronka translator.
    // A post-content ancestor does not make these official item labels authored prose.
    if(kind==='text'&&el.closest?.('.item-searcher .post-item-information > p'))return 'item';
    return null;
  }
  function queryEcho(el,kind,url,text){
    if(kind!=='text'||typeof text!=='string')return false;
    const u=new URL(url);
    if(u.hostname==='lookbook.ronkacloset.com'){
      const active=el.closest?.('.filter-item-active');
      const heading=active?.parentElement?.previousElementSibling;
      if(heading?.matches?.('.filter-title')&&/^(?:검색어|关键词)$/u.test(heading.textContent.trim()))return true;
    }
    const key=u.hostname==='lookbook.ronkacloset.com'?'keyword':u.hostname==='attire.jp'?'s':null;
    const value=key&&u.searchParams.get(key);
    if(!value)return false;
    const clean=s=>s.replace(/\s+/gu,' ').trim();
    const raw=clean(text),query=clean(value);
    if(u.hostname==='lookbook.ronkacloset.com'&&el.closest?.('.filter-keyword'))
      return raw===query||raw==='搜索：'+query||raw==='搜索： '+query;
    if(u.hostname==='attire.jp'&&el.closest?.('#breadCrumb,#jinrPostTitle')){
      const match=/^「(.+)」的搜索结果(?:：[\d,]+ 条)?$/u.exec(raw);
      return !!match&&clean(match[1])===query;
    }
    return false;
  }
  function attireScope(el,kind,url,text){
    if(el.closest?.('a[href*="/lodestone/playguide/db/item/"],[data-zhx-attire-item]'))return 'item';
    const card=el.closest?.('a.c--post-link[rel~="bookmark"],.o--postlist-item > a.c--post-link[href]');
    if(card){
      if(el.closest?.('.a--post-category'))return 'ui';
      const category=card.querySelector?.('.a--post-category');
      const label=category?.textContent?.trim();
      const title=card.querySelector?.('.a--post-title')?.textContent?.trim()||'';
      if(!label||category.classList?.contains('category-glamour')||['ミラプリ','幻化'].includes(label)
        ||/^(?:ミラプリ|幻化)\s*[:：]/u.test(title))return 'user';
      if(kind==='attr:alt'||el.closest?.('.a--post-title'))return 'item';
    }
    if(el.closest?.('#comments,.comment-list,.a--post-author,.widget_recent_entries'))return 'user';
    const doc=el.ownerDocument;
    const categories=[...(doc?.querySelectorAll?.('#jinrPostMeta .a--post-cat a[href]')||[])];
    const glamour=categories.some(a=>a.pathname?.split('/').includes('glamour'));
    if(glamour&&kind==='text'&&el.closest?.('#breadCrumb')&&/^幻化：/u.test(text||''))return 'user';
    // This article mixes acquisition requirements and the editor's own
    // experiences in one paragraph. Only the text after the verified
    // editorial boundary (and its following paragraphs) is authored prose.
    if(kind==='text'&&new URL(url).pathname.replace(/\/$/u,'')==='/field-commanders-coat'){
      const paragraph=el.closest?.('.c--accordion-contents p');
      if(paragraph){
        const marker='白のロングコートに';
        const whole=paragraph.textContent||'';
        const boundary=whole.indexOf(marker);
        const offset=typeof text==='string'?whole.indexOf(text.trim()):-1;
        if(boundary>=0&&offset>=boundary)return 'user';
        for(let sibling=paragraph.previousElementSibling;sibling;sibling=sibling.previousElementSibling){
          if(sibling.tagName==='P'&&sibling.textContent.includes(marker))return 'user';
        }
      }
    }
    if(el.closest?.('nav,#globalMenuList,#hamburgerMenuList,#footerMenuList,#breadCrumb,#jinrPostMeta .a--post-cat,a[rel~="tag"],.a--post-category,.widget_nav_menu .menu a,a.tag-cloud-link,.wp-block-tag-cloud a,.wp-block-categories a,.wp-block-archives a'))return 'ui';
    if(el.closest?.('#postContent .a--sns-label,#postContent .a--postlist-more'))return 'ui';
    if(glamour&&el.closest?.('#jinrPostTitle,#postContent'))return 'user';
    if(el.closest?.('#jinrPostTitle')){
      const guide=categories.some(a=>a.pathname?.split('/').some(p=>['tomestone','af-nyuusyu','seriesb'].includes(p)));
      return !doc?.body?.matches?.('.single')||guide?'ui':'item';
    }
    if(el.closest?.('#postContent')){
      if(kind==='attr:alt')return 'item';
      if(el.closest?.('.a--h2rich-maincopy,.a--h2rich-subcopy,.a--richmenu-text,.c--tab-title,.c--accordion-title,.rtoc-item,.wp-block-heading'))return 'ui';
      if(el.closest?.('h2,h3,h4,h5,h6,th,dt'))return 'ui';
      if(el.closest?.('.c--accordion-contents td,.c--accordion-contents dd,.c--accordion-contents strong'))return 'ui';
      // Only the site-authored acquisition accordion, not arbitrary
      // collapsible player content, contains exchange/material metadata.
      const acquisition=el.closest?.('.c--accordion-contents');
      if(acquisition){
        const heading=acquisition.previousElementSibling?.textContent?.trim()||'';
        if(/^(?:入手方法などはこちら|查看获取方式等信息|入手方法|获取方式)$/.test(heading))return 'ui';
      }
      return 'unknown';
    }
    return null;
  }
  function allowedRoute(url){try{const u=new URL(url);const site=siteFor(url);return !!site&&!ROUTE_BLOCK.test(u.pathname)&&(site!=='eden'||!!edenRoute(u))}catch{return false}}
  function trimHref(raw,origin){try{const u=new URL(raw,origin);if(u.protocol!=='https:')return '';u.username='';u.password='';u.search='';u.hash='';return u.toString().slice(0,260)}catch{return ''}}
  function fnv(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
  function classifyContext(el,kind,site,url,text){
    const cls=String(el.className?.baseVal || el.className || '')+' '+String(el.parentElement?.className?.baseVal || el.parentElement?.className || '');
    let ancestors='';for(let p=el.parentElement,n=0;p&&n<5;p=p.parentElement,n++)ancestors+=' '+String(p.className?.baseVal||p.className||'')+' '+String(p.id||'');
    const full=cls+' '+String(el.id||'')+' '+ancestors;
    const control=UI_RE.test(el.tagName||'') && /^(BUTTON|INPUT|SELECT|OPTION|TEXTAREA|SUMMARY|LABEL)$/.test(el.tagName)
      || !!el.closest?.('button,a[data-slot="button"],[role="button"],[role="tab"],[role="switch"],[role="checkbox"],[role="combobox"],select,option');
    const exactSel=(AUTHORED[site]||[]).filter(x=>!x.startsWith('/'));
    const authored=exactSel.some(x=>{try{return !!el.closest?.(x)}catch{return false}}) || USER_RE.test(full);
    const likelyGallery = site==='mirapri' && !!el.closest?.('#gallery article h2.title, #gallery article .article-info .title');
    const link=el.closest?.('a[href]');
    const linked=trimHref(link?.getAttribute?.('href')||'',url);
    const ad=AD_RE.test(full)||/^https:\/\/(?:www\.)?(?:amazon\.co\.jp|amzn\.to|rakuten\.co\.jp)\//i.test(linked);
    const echo=queryEcho(el,kind,url,text);
    const siteScope=site==='miramiru'?miramiruScope(el,kind,url):site==='eden'?edenScope(el,url):site==='fc'?fcScope(el,kind,url):site==='attire'?attireScope(el,kind,url,text):site==='ronka'?ronkaScope(el,kind):null;
    const item=ITEM_RE.test(full)||siteScope==='item';
    const artImage=kind==='attr:alt' && (ALT_ART.test(full) || el.closest?.('#gallery article,.glamour-card,.concept-card'));
    let scope='unknown';
    if(ad)scope='ad';
    else if(echo)scope='user';
    else if(siteScope==='item'&&!control&&(site==='ronka'||site==='attire'&&/\ba--post-title\b/u.test(cls)))scope='item';
    else if((authored||likelyGallery||artImage||siteScope==='user') && siteScope!=='ui' && (!control||kind==='attr:alt'))scope='user';
    else if(item && !control)scope='item';
    else if(kind==='document:title')scope='metadata';
    else if(siteScope==='ui'||control||!!el.closest?.('nav,header,footer,form,[role="navigation"],[role="menu"],[role="tablist"],[role="dialog"],.pagination,.pager')||UI_RE.test(el.tagName||''))scope='ui';
    // Attribute labels are NOT UI by default. They may be creator-supplied titles.
    return {scope,ui:scope==='ui',user:scope==='user',ad,control,queryEcho:echo,confidence:scope==='unknown'?0.35:scope==='user'?0.92:0.86,
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
  const UI_EXEMPT=new Set(['Miramiru','FINAL FANTASY XIV © SQUARE ENIX CO., LTD. All Rights Reserved.',
    'FFXIV','FF14','SQUARE ENIX','Discord','X','Ko-fi','XIVAPI','PR','OGP']);
  function category(it){
    if(it.ctx?.ad)return 'excluded-ad';
    if(it.ctx?.user || it.ctx?.scope==='user')return 'excluded-user';
    if(it.ctx?.scope==='item')return 'item-review';
    if(it.ctx?.scope==='metadata')return 'metadata-review';
    if(it.ctx?.scope==='unknown')return 'needs-review';
    if(!scopeEligible(it))return 'needs-review';
    const t=normalize(it.text), b=normalize(it.before);
    if(UI_EXEMPT.has(t))return 'exempt-ui';
    if(it.before!==null&&it.before!==undefined){
      if(b===t)return hasForeign(t)?'suspected-untranslated':'unchanged';
      if(hasForeign(t))return 'suspected-partial';
      return 'translated';
    }
    return hasForeign(t)?'suspected-no-baseline':'unverified';
  }
  // These verified Japanese UI labels contain no kana, so a script-only
  // detector would otherwise silently treat them as translated Chinese.
  const KANJI_UI=new Set(['検索','装備一覧','詳細','新着','投稿一覧','閲覧数','種族','性別','統計','投稿日時','入手元','非表示']);
  function hasForeign(s){return KANJI_UI.has(normalize(s))||/[\u3040-\u30ff\uac00-\ud7af]/.test(s)||/[A-Za-z]{2,}/.test(s)&&!/[\u3400-\u9fff]/.test(s)}
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
  function normalizeItems(items,site){
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
        const itemName=ctx.scope==='item'||ITEM_RE.test(signature);
        let scope='unknown';
        if(ctx.ad)scope='ad';
        else if(ctx.queryEcho===true)scope='user';
        else if(ctx.scope==='item'&&!ctx.control&&(site==='ronka'||site==='attire'&&!ctx.user&&/\ba--post-title\b/u.test(String(ctx.cls||''))))scope='item';
        else if(ctx.scope==='ui'&&!ctx.user)scope='ui';
        else if(ctx.scope==='user'&&it.kind==='attr:alt'||authored&&!ctx.control)scope='user';
        else if(itemName&&!ctx.control)scope='item';
        else if(it.kind==='document:title')scope='metadata';
        else if(ctx.control||ctx.ui&&it.kind==='text'||it.kind==='option')scope='ui';
        else if(it.kind.startsWith('attr:')&&/nav|header|footer|button|input|form|pagination|pager|label/.test(signature))scope='ui';
        ctx.scope=scope;ctx.user=scope==='user';ctx.ui=scope==='ui';
        return {...it,ctx,stablePath:it.stablePath||it.path};
      });
  }
  function readAudit(data){
    if(!data||data.format!==FORMAT)throw Error('仅支持当前审计格式 zhx-manual-audit-v2');
    return data;
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

  const api={TOOL_VERSION,SITES,AUTHORED,FORMAT,urlKey,siteFor,pageLanguage,miramiruScope,edenScope,fcScope,attireScope,ronkaScope,queryEcho,allowedRoute,trimHref,fnv,classifyContext,stablePath,stableKey,normalizeItems,
    category,hasForeign,pair,stateSignature,snapshotKey,sanitizeItem,readAudit,compareRuns};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.ZHXAuditCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
