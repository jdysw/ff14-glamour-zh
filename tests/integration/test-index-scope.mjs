// V3 按站索引与语言裁剪的浏览器集成回归。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';
import { seedV3Browser } from '../helpers/v3-cache.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const marker = "__zhxMark('ready');";
let script = readDist();
if (script.split(marker).length !== 2) throw new Error('就绪锚点必须唯一');
script = script.replace(marker, `window.__zhxDebug = Object.fromEntries(['nameMap', 'itemHash', 'ecidMap', 'koByZh'].map(k => [k, dataGetIndex(k)])); ${marker}`);
const rows = fs.readFileSync(itemsTsvPath, 'utf8').split('\n').map(line => line.split('\t'));
const dye = rows.find(row => row[2] === 'Snow White Dye');
const maid = rows.find(row => row[0] === '14972');
if (!dye || !maid) throw new Error('缺少固定回归物品');
const profiles = [
  ['ec', ['nameMap', 'itemHash'], 2],
  ['mirapri', ['nameMap', 'itemHash'], 3],
  ['fc', ['nameMap', 'itemHash'], 3],
  ['ronka', ['nameMap'], 4],
  ['collection', ['nameMap'], 3],
  ['endcloset', ['nameMap'], 4],
  ['wiki', ['ecidMap', 'koByZh'], null],
];
let passed = 0;
function check(label, condition) {
  if (!condition) throw new Error(label);
  passed++;
  console.log('✅ ' + label);
}
for (const [site, indexes, languageColumn] of profiles) {
  const tab = await newPage(PORT, fixtureUrl('ec-page.html'));
  const cdp = tab.cdp;
  try {
    await cdp.eval("localStorage.clear();");
    await seedV3Browser(cdp, site);
    await cdp.callFn(`function(site) {
      window.__zhxTestSite = site;
      window.__networkHits = [];
      window.GM_getValue = (key, fallback) => localStorage.getItem('gm:' + key) ?? fallback;
      window.GM_setValue = (key, value) => localStorage.setItem('gm:' + key, String(value));
      window.GM_xmlhttpRequest = options => { window.__networkHits.push(options.url); options.onerror?.(new Error('离线测试')); };
    }`, [site]);
    await cdp.eval(script);
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (await cdp.eval('!!window.__zhxDebug')) { ready = true; break; }
      await sleep(100);
    }
    check(site + ' 数据就绪', ready);
    const result = await cdp.callFn(`function(dye, maid, column) {
      const maps = window.__zhxDebug;
      return {
        counts: Object.fromEntries(Object.entries(maps).map(([key, value]) => [key, Object.keys(value || {}).length])),
        dye: column === null ? null : maps.nameMap[dye[column]],
        englishDye: maps.nameMap[dye[2]], dyeBase: maps.nameMap['Snow White'],
        maidId: maps.ecidMap[maid[1]], maidKo: maps.koByZh[maid[1]],
        network: window.__networkHits,
      };
    }`, [dye, maid, languageColumn]);
    for (const name of ['nameMap', 'itemHash', 'ecidMap', 'koByZh']) {
      check(site + ' ' + name + ' 按需加载', indexes.includes(name) ? result.counts[name] > 1000 : result.counts[name] === 0);
    }
    check(site + ' 缓存零网络', result.network.length === 0);
    if (languageColumn !== null) check(site + ' 原生语言染剂名称映射', result.dye === dye[1]);
    if (site === 'ec' || site === 'mirapri') {
      check(site + ' 英文染剂名称映射', result.englishDye === dye[1]);
      check(site + ' 染剂去掉 Dye 后仍可映射', result.dyeBase === dye[1]);
    }
    if (site === 'wiki') {
      check('Wiki ECID 反查', result.maidId === maid[6]);
      check('Wiki 韩文名称反查', result.maidKo === maid[4]);
    }
  } finally {
    await closePage(PORT, tab.target.id);
  }
}
console.log(`✅ V3 七站索引裁剪：${passed} 项通过`);
