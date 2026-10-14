import assert from 'node:assert/strict';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { seedV3Browser } from '../helpers/v3-cache.mjs';
import { readDist, fixtureUrl } from '../helpers/paths.mjs';

const port = Number(process.env.ZHX_CDP_PORT || 9223);
const page = await newPage(port, fixtureUrl('miramiru-page.html'));
const c = page.cdp;
try {
  const standalone = process.env.ZHX_MIRAMIRU_STANDALONE === '1';
  if (!standalone) await seedV3Browser(c, 'miramiru');
  await c.eval(`
    window.__zhxTestSite = 'miramiru';
    window.__zhxDiagOn = true;
    window.__requests = [];
    window.GM_getValue = (k,d) => localStorage.getItem('gm:' + k) ?? d;
    window.GM_setValue = (k,v) => localStorage.setItem('gm:' + k, String(v));
    window.GM_xmlhttpRequest = o => { window.__requests.push(o.url); o.onerror?.({status:0}); };
  `);
  const storageBefore = await c.eval('JSON.stringify(Object.entries(localStorage).sort())');
  if (standalone) {
    await c.eval(`
      for (const name of ['GM_getValue', 'GM_setValue', 'GM_listValues', 'GM_deleteValue']) {
        window[name] = () => { throw new Error('Standalone preview accessed real GM storage'); };
      }
    `);
  }
  await c.callFn('function(source) { (0,eval)(source); }', [readDist()]);
  await sleep(900);
  const actual = await c.eval(`(() => ({
    name: document.querySelector('#name').textContent,
    link: document.querySelector('a.eorzeadb_link').getAttribute('href'),
    dye: document.querySelector('#dye').textContent,
    header: document.querySelector('h2').textContent,
    filter: document.querySelector('#filter').textContent,
    official: document.querySelector('#official').getAttribute('href'),
    other: document.querySelector('#other').getAttribute('href'),
    input: document.querySelector('input').value,
    placeholder: document.querySelector('input').placeholder,
    textarea: document.querySelector('textarea').value,
    commentPlaceholder: document.querySelector('textarea').placeholder,
    editable: document.querySelector('[contenteditable]').textContent,
    unknown: document.querySelector('#unknown').textContent,
    script: window.fixtureValue,
    title: document.title,
    requests: window.__requests,
    errors: window.__zhxErrs || [],
  }))()`);
  assert.equal(actual.name, '库啵外套');
  assert.equal(actual.link, 'https://ff14.huijiwiki.com/wiki/物品:' + encodeURIComponent('库啵外套'));
  assert.equal(actual.dye, '山栗棕');
  assert.equal(actual.header, '装备列表');
  assert.equal(actual.filter, '筛选');
  assert.match(actual.official, /^https:\/\/jp\.finalfantasyxiv\.com/);
  assert.equal(actual.other, '/en/items/30048');
  assert.equal(actual.input, 'Kupo Jacket');
  assert.equal(actual.textarea, 'Kupo Jacket');
  assert.equal(actual.commentPlaceholder, '写下评论…');
  assert.equal(actual.editable, 'Kupo Jacket');
  assert.equal(actual.script, 'Kupo Jacket');
  assert.equal(actual.unknown, 'Unmapped Equipment Name');
  assert.equal(actual.placeholder, '搜索标题、装备或标签');
  assert.match(actual.title, /FF14 幻化展示/);
  assert.deepEqual(actual.requests, []);
  assert.deepEqual(actual.errors, []);
  if (standalone) assert.equal(await c.eval('JSON.stringify(Object.entries(localStorage).sort())'), storageBefore);

  // React may reuse a name/link node for a different item or an unknown item.
  await c.eval(`(() => {
    const link = document.querySelector('a.eorzeadb_link');
    link.href = 'https://na.finalfantasyxiv.com/lodestone/playguide/db/item/bdcbba797e9/';
    link.querySelector('img').alt = 'Thavnairian Babouches';
    document.querySelector('#name').firstChild.nodeValue = 'Thavnairian Babouches';
    const label = document.createElement('span'); label.id = 'dynamic'; label.textContent = 'Equipment List'; document.body.append(label);
  })()`);
  await sleep(500);
  const changed = await c.eval(`({name: document.querySelector('#name').textContent,
    href: document.querySelector('a.eorzeadb_link').getAttribute('href'), dynamic: document.querySelector('#dynamic').textContent})`);
  assert.equal(changed.name, '萨维奈尖头鞋');
  assert.ok(changed.href.endsWith(encodeURIComponent(changed.name)));
  assert.equal(changed.dynamic, '装备列表');
  await c.eval(`(() => {
    const link = document.querySelector('a.eorzeadb_link');
    link.href = 'https://na.finalfantasyxiv.com/lodestone/playguide/db/item/deadbeef/';
    link.querySelector('img').alt = 'Unknown Item';
    document.querySelector('#name').firstChild.nodeValue = 'Unknown Item';
  })()`);
  await sleep(500);
  assert.match(await c.eval(`document.querySelector('a.eorzeadb_link').getAttribute('href')`), /deadbeef/);
  assert.equal(await c.eval(`document.querySelector('#name').textContent`), 'Unknown Item');
  // Self-authored title/href mutations must settle, rather than rescheduling forever.
  const ticks = await c.eval('window.__zhxDiagRecord().obs.ticks');
  await sleep(600);
  assert.equal(await c.eval('window.__zhxDiagRecord().obs.ticks'), ticks);
  console.log('PASS Miramiru: Chinese UI/items/dyes, Wiki links, native links, user input, React updates, stable observer, offline V3');
} finally {
  await closePage(port, page.target.id);
}
