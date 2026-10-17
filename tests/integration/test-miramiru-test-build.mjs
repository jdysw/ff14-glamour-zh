// Exercise the actual downloadable userscript, with no preseeded V3 cache.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { repoRoot,fixtureUrl } from '../helpers/paths.mjs';
import {newPage,closePage,sleep} from '../helpers/cdp.mjs';

execFileSync(process.execPath, ['build/make-site-test.mjs', 'miramiru'], { cwd: repoRoot, stdio: 'pipe' });
const version = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
const file = path.join(repoRoot, 'dist', `ff14-miramiru-zh-${version}-test.user.js`);
const source = fs.readFileSync(file, 'utf8');
const header = source.split('// ==/UserScript==')[0];
assert.ok(header.includes('/miramiru-test'));
assert.ok(header.includes('// @grant        none'));
assert.ok(!header.includes('@connect'));
assert.equal((header.match(/^\/\/ @match /gm) || []).length, 1);
execFileSync(process.execPath, ['--check', file], { cwd: repoRoot, stdio: 'inherit' });
// Only the standalone artifact's distinct contract belongs here. Translation,
// three locales and React updates are already covered by test-miramiru.
const port=Number(process.env.ZHX_CDP_PORT||9223);
const page=await newPage(port);const c=page.cdp;
try{
  const loaded=c.waitForEvent('Page.loadEventFired');
  await c.send('Page.navigate',{url:fixtureUrl('miramiru-page.html')});await loaded;
  await c.eval(`window.__zhxTestSite='miramiru';window.__realStorageCalls=0;
    for(const name of ['GM_getValue','GM_setValue','GM_listValues','GM_deleteValue'])window[name]=()=>{window.__realStorageCalls++;throw new Error('Real storage forbidden')};`);
  const before=await c.eval('JSON.stringify(Object.entries(localStorage).sort())');
  await c.callFn('function(source){(0,eval)(source)}',[source]);
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){if(await c.eval(`document.querySelector('#name').textContent==='库啵外套'`))break;await sleep(25)}
  assert.equal(await c.eval(`document.querySelector('#name').textContent`),'库啵外套','Embedded data must work without seeding any runtime cache');
  assert.equal(await c.eval('window.__realStorageCalls'),0);
  assert.equal(await c.eval('JSON.stringify(Object.entries(localStorage).sort())'),before);
}finally{await closePage(port,page.target.id)}
console.log('PASS standalone install: embedded data, own namespace, no GM storage or localStorage changes');
