// 四站共用的独立搜索框：直接回车、点击搜索、中文显示与属性翻译回归。
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';
import { v3CacheEntries } from '../helpers/v3-cache.mjs';
const port = Number(process.env.ZHX_CDP_PORT || 9223);
const lines = fs.readFileSync(itemsTsvPath, 'utf8').split(/\r?\n/);
const row = lines.find((line) => line.startsWith('14972\t')).split('\t');
const items = [lines[0], lines.find((line) => line.startsWith('14972\t')), lines.find((line) => line.startsWith('20489\t'))].join('\n') + '\n';
const source = readDist();
let passed = 0;
for (const [site, column] of [['endcloset', 4], ['ronka', 4], ['collection', 3], ['ec', 2]]) {
  const page = await newPage(port, fixtureUrl('standalone-search.html'));
  const c = page.cdp;
  try {
    const entries = v3CacheEntries(site, '');
    await c.callFn('function(site,entries){window.__zhxTestSite=site;window.__zhxTestTables=["items"];window.GM_getValue=(k,d)=>entries[k]??d;window.GM_setValue=(k,v)=>entries[k]=v;window.GM_xmlhttpRequest=o=>o.onerror?.({});}', [site, entries]);
    await c.eval(source);
    await sleep(1500);
    const inputChinese = () => c.eval('(()=>{const input=document.getElementById("equipment-search");input.focus();input.value="女仆发带";input.dispatchEvent(new Event("input",{bubbles:true}));})()');
    await inputChinese();
    await c.eval('document.getElementById("equipment-search").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}))');
    assert.equal(await c.eval('window.__searches.at(-1)'), row[column], site + ' 回车搜索应使用原生名');
    await sleep(150);
    assert.equal(await c.eval('document.getElementById("equipment-search").value'), '女仆发带', site + ' 回车后保留中文显示');
    await inputChinese();
    await c.eval('document.getElementById("run-search").click()');
    assert.equal(await c.eval('window.__searches.at(-1)'), row[column], site + ' 按钮搜索应使用原生名');
    await sleep(150);
    assert.equal(await c.eval('document.getElementById("equipment-search").value'), '女仆发带');
    if (site === 'endcloset') {
      assert.equal(await c.eval('document.getElementById("ordinary").dataset.zhxItem'), undefined);
      await c.eval('document.getElementById("ordinary").setAttribute("title","Run search (Enter)")');
      await sleep(400);
      assert.equal(await c.eval('document.getElementById("ordinary").title'), '执行搜索（回车）');
      assert.equal(await c.eval('document.getElementById("count").textContent'), '共 739 套幻化，显示 20 项');
    }
    passed++;
    console.log('通过：' + site + ' 直接回车与按钮搜索');
  } finally { await closePage(port, page.target.id); }
}
console.log('四站通过 ' + passed + '/4');
