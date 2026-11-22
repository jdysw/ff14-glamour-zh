import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {newPage,closePage} from '../helpers/cdp.mjs';
import {readDist,fixturePath,fixtureUrl} from '../helpers/paths.mjs';
import {seedV3Memory} from '../helpers/v3-cache.mjs';
const html=fs.readFileSync(fixturePath('fc-subpages.html'),'utf8');
process.env.FF14_EQUIP_SLOTS_CSV ||= fileURLToPath(fixtureUrl('search-equipment-slots.csv'));
const slotCases = new Map([
  ['head', '女仆发带'], ['body', '女仆围裙装'], ['hand', '女仆腕带'],
  ['leg', '女仆蓬松裤'], ['foot', '女仆礼鞋'],
].map(([part, name]) => ['/equipment_search_parts/equipment_search_' + part + '/', name]));
const server=http.createServer((req,res)=>res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=Number(process.env.ZHX_CDP_PORT||9223);
try{
  for(const route of [...slotCases.keys(),'/summary_weapon/','/summary_equipment_af/','/equipment/southern_seas_swimsuit/']){
    const page=await newPage(port,`http://127.0.0.1:${server.address().port}${route}`);
    const c=page.cdp;
    try{
      await c.waitFor(`window.__originalLink`);
      await seedV3Memory(c,'fc');
      await c.eval(`window.__zhxTestSite='fc';window.__zhxDiagOn=true;
        window.GM_getValue=(k,d)=>window.__v3MemoryCache.get(k)??d;
        window.GM_setValue=(k,v)=>window.__v3MemoryCache.set(k,v);
        window.GM_xmlhttpRequest=request=>request.onerror?.({});`);
      await c.callFn('function(source){(0,eval)(source)}',[readDist()]);
      if (slotCases.has(route)) {
        await c.eval(`const field = document.querySelector('form input'); field.focus(); field.value='女仆';
          field.dispatchEvent(new Event('input', {bubbles:true}));`);
        await c.waitFor("document.querySelector('.zhx-suggest-zh')");
        assert.deepEqual(await c.eval("[...document.querySelectorAll('.zhx-suggest-zh')].map(e=>e.textContent)"), [slotCases.get(route)]);
        await c.eval(`field.value='南瓜管家'; field.dispatchEvent(new Event('input', {bubbles:true}));`);
        await c.waitFor("document.querySelector('.zhx-suggest-empty')");
        assert.equal(await c.eval(`let submitted; field.form.addEventListener('submit', event => {
          event.preventDefault(); submitted=field.value;
        }, {once:true}); field.form.requestSubmit(); submitted;`), '南瓜管家');
        console.log('PASS FC '+route+': suggestions and submission stay within the current slot');
        continue;
      }
      await c.waitFor(`document.querySelector('#punctuation-name').textContent==='梦羽妖灵王剑'`);
      const actual=await c.eval(`({
        title:document.title,toc:document.querySelector('#toc').textContent,
        intro:document.querySelector('#intro').textContent.trim(),rich:document.querySelector('#rich').textContent,
        long:document.querySelector('#long-intro').textContent,br:document.querySelectorAll('#long-intro br').length,
        sameLink:document.querySelector('#native-link')===window.__originalLink,
        sameStrong:document.querySelector('#description')===window.__originalStrong,
        href:document.querySelector('#native-link').getAttribute('href'),official:document.querySelector('#official-item').href,
        context:document.querySelector('#context-name').textContent,
        headers:[...document.querySelectorAll('article > h4')].map(e=>e.textContent),
        comment:document.querySelector('.comment-body').textContent,tweet:document.querySelector('.twitter-tweet').textContent,
        unknown:document.querySelector('#unknown').textContent,ambiguous:document.querySelector('#ambiguous-name').textContent
      })`);
      assert.equal(actual.toc,'目录');assert.match(actual.title,/武器装备/);assert.doesNotMatch(actual.title,/[ぁ-ヺ]/);
      assert.deepEqual(await c.eval(`[
        document.querySelector('#augmented-role-set').textContent,
        document.querySelector('#second-augmented-role-set').textContent,
        document.querySelector('#floating-toc').getAttribute('aria-label'),
        document.querySelector('#floating-toc').getAttribute('href'),
        document.querySelector('#back-to-sets').textContent,
        document.querySelector('#back-to-sets').getAttribute('href'),
        document.querySelector('#dawntrail').textContent,
        document.querySelector('#recommended-set').textContent
      ]`), ['改良型星战士制敌', '改良型圣堂潜行游击', '幻想试穿', '#sub-toc-2',
        '返回装备一览', '/equipment_series_search/', '最终幻想XIV：金曦之遗辉 典藏版', '宇宙动力套装']);
      assert.deepEqual(await c.eval(`[
        document.querySelector('#augmented-set').textContent,
        document.querySelector('#hiroshi').textContent,
        document.querySelector('#hiroshi').getAttribute('race'),
        document.querySelector('#side .title').textContent,
        document.querySelector('#side a').getAttribute('href'),
        document.querySelector('#side [data-zhixia-banner-span]').textContent
      ]`), ['改良型玄甲', '人族（宣传片男主风）', 'hiroshi', '▶ 装备推荐', '/message/', '联系与留言']);
      assert.deepEqual(await c.eval(`[
        document.querySelector('#filter-style').textContent,
        document.querySelector('label[for="filter-mask"]').textContent,
        document.querySelector('#filter-mask').value,
        document.querySelector('#article-mask').textContent
      ]`), ['外观款式', '面具与口罩 274', 'mask', '面罩']);
      const readingTime = await c.eval("document.querySelector('#reading-time').textContent");
      assert.equal(readingTime.includes('天赐祝福'), route === '/equipment/southern_seas_swimsuit/');
      assert.match(actual.intro,/本页汇总介绍/);assert.doesNotMatch(actual.rich,/[ぁ-ヺ]/);
      assert.match(actual.long,/特职任务/);assert.match(actual.long,/FF11/);assert.doesNotMatch(actual.long,/[ぁ-ヺ]/);
      assert.equal(actual.br,3);assert.equal(actual.sameLink,true);assert.equal(actual.sameStrong,true);
      assert.equal(actual.href,'/summary/af1/');assert.ok(actual.official.endsWith(encodeURIComponent('梦羽妖灵王剑')));
      assert.deepEqual(actual.headers,['战斗职业专属装备（AF6）','制作与采集职业专属装备（AF6）','100级']);
      if(route==='/summary_weapon/')assert.equal(actual.context,'幻梦武器');
      else assert.notEqual(actual.context,'幻梦武器','Weapon-only label must not leak into other categories');
      assert.match(actual.comment,/アーティファクト/);assert.match(actual.tweet,/戦闘ジョブ/);
      assert.equal(actual.unknown,'ミチノソウビテスト');assert.equal(actual.ambiguous,'ティリー フレイ');
      assert.equal(await c.eval(`document.querySelector('#kana-boundary').textContent`),'メールアドレスサンプル');
      assert.equal(await c.eval(`document.querySelector('#particle').textContent`),'《金曦之遗辉》的装备');
      const extended=await c.eval(`Object.fromEntries(['job-item','job-pair','hair-name','material-source','material-exchange','unknown-prose','filter-count'].map(id=>[id,document.getElementById(id).textContent]))`);
      assert.equal(extended['job-item'],'【战士】绝境伊甸之晨战斧');
      assert.equal(extended['job-pair'],'【骑士】烹饪之幻梦＆菜蔬之幻梦');
      assert.match(await c.eval("document.querySelector('#af6-reaper').textContent"), /钐镰客/);
      assert.equal(extended['hair-name'],'发型：半双马尾');
      assert.equal(await c.eval(`document.querySelector('#article-item').textContent`),'【FF14】泡狐龙猫花伞💍外观·获取方式【时尚配饰】');
      assert.equal(await c.eval(`document.querySelector('#related-items').textContent`),'塑形的相关物品');
      assert.equal(extended['material-source'],'奖杯水晶的获取方式');
      assert.equal(extended['material-exchange'],'使用1500个奖杯水晶兑换');
      assert.equal(extended['unknown-prose'],'ミチノソウビテストをする');
      assert.equal(await c.eval(`document.querySelector('#unknown-prefix').textContent`),'グリフィ');
      assert.equal(extended['filter-count'],'时装 (470)');
      assert.equal(await c.eval(`document.querySelector('.message-box-point').textContent`),'留言');
      assert.equal(await c.eval(`document.querySelector('.message-box p').textContent`),'ファッションアクセサリーを紹介する');
      assert.equal(await c.eval(`document.querySelector('.answer-box p').textContent`),'装備一覧にもどる');
      await c.eval(`document.querySelector('#native-link').click()`);assert.equal(await c.eval(`window.__nativeClicks`),1);
      await c.eval(`const p=document.querySelector('#linked');p.firstChild.nodeValue='また、';p.lastChild.nodeValue='についても見た目や入手方法をご紹介しているので、ぜひそちらもご覧ください。'`);
      await c.waitFor(`document.querySelector('#linked').textContent.startsWith('另外也介绍了')`);
      assert.equal(await c.eval(`document.querySelector('#native-link')===window.__originalLink`),true);
      console.log('PASS FC '+route+': categories, rich prose, titles, normalized item names and native links');
    }finally{await closePage(port,page.target.id)}
  }
} finally {
  const closed = new Promise(resolve => server.close(resolve));
  server.closeAllConnections();
  await closed;
}
