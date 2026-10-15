// Online acceptance: original Miramiru HTML + production bundle + locally
// generated V3 data, so deployment is not a prerequisite for testing the adapter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { seedV3Memory } from '../helpers/v3-cache.mjs';
import { readDist, repoRoot } from '../helpers/paths.mjs';

const port = Number(process.env.ZHX_CDP_PORT || 9223);
const locale = process.env.ZHX_MIRAMIRU_LOCALE || 'en';
const prefix = locale === 'ja' ? '' : '/' + locale;
const page = await newPage(port, 'https://miramiru.co' + prefix + '/mirapuri/cmv7sb7p8000004lbxukefqcv');
const c = page.cdp;
try {
  let loaded = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    loaded = await c.eval(`!!document.querySelector('a.eorzeadb_link img')`);
    if (loaded) break;
    await sleep(500);
  }
  assert.ok(loaded, 'Miramiru live equipment list must finish loading');
  if (process.env.ZHX_MIRAMIRU_STANDALONE !== '1') {
    await seedV3Memory(c, 'miramiru');
    await c.eval(`
    window.__zhxDiagOn = true;
    window.GM_getValue = (k,d) => window.__v3MemoryCache?.get(k) ?? d;
    window.GM_setValue = (k,v) => window.__v3MemoryCache.set(k, String(v));
    window.GM_xmlhttpRequest = o => o.onerror?.({status:0});
    `);
  }
  await c.callFn('function(source) { (0,eval)(source); }', [readDist()]);
  await sleep(1200);
  const result = await c.eval(`(() => ({
    links: [...document.querySelectorAll('a.eorzeadb_link')].map(a => ({href:a.href, text:a.innerText})),
    headings: [...document.querySelectorAll('h3')].map(e => e.textContent),
    nav: document.querySelector('header')?.innerText || '',
    dyes: [...document.querySelectorAll('span')].filter(e => e.textContent === '山栗棕').length,
    others: [...document.querySelectorAll('a[href*="/items/"]')].length,
    errors: window.__zhxErrs || [],
  }))()`);
  assert.ok(result.links.length >= 8);
  assert.ok(result.links.every(a => a.href.startsWith('https://ff14.huijiwiki.com/wiki/')));
  assert.ok(result.links.some(a => a.text.includes('库啵外套')));
  assert.ok(result.headings.includes('装备列表'));
  assert.ok(result.dyes > 0);
  assert.ok(result.others >= 8);
  assert.deepEqual(result.errors, []);
  const output = path.join(repoRoot, '.cache', 'miramiru-' + locale + '-live.png');
  fs.mkdirSync(path.dirname(output), {recursive:true});
  // Capture the translated equipment area, without scrolling the user's browser.
  const rect = await c.eval(`(() => {const r=document.querySelector('a.eorzeadb_link').getBoundingClientRect(); return {x:Math.max(0,r.left-35), y:r.top+scrollY-70, width:Math.min(850,innerWidth-r.left+35),height:900};})()`);
  const screenshot = await c.send('Page.captureScreenshot', {format:'png', captureBeyondViewport:true, clip:{...rect,scale:1}});
  fs.writeFileSync(output, Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify(result, null, 2));
  console.log('PASS Miramiru live detail: Chinese equipment/dyes and Wiki destinations; native outfit links preserved. Screenshot: ' + output);
} finally {
  await closePage(port, page.target.id);
}
