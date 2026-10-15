import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { seedV3Memory } from '../helpers/v3-cache.mjs';
import { readDist, fixtureUrl } from '../helpers/paths.mjs';

const port = Number(process.env.ZHX_CDP_PORT || 9223);
const page = await newPage(port, fixtureUrl('miramiru-page.html'));
const c = page.cdp;
try {
  const standalone = process.env.ZHX_MIRAMIRU_STANDALONE === '1';
  if (!standalone) await seedV3Memory(c, 'miramiru');
  await c.eval(`
    window.__zhxTestSite = 'miramiru';
    window.__zhxDiagOn = true;
    window.__requests = [];
    window.GM_getValue = (k,d) => window.__v3MemoryCache?.get(k) ?? d;
    window.GM_setValue = (k,v) => window.__v3MemoryCache.set(k, String(v));
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
  const fonts = await c.eval(`(() => {
    const code=document.createElement('code');code.textContent='code';code.style.fontFamily='monospace';document.body.append(code);
    const portal=document.createElement('div');portal.setAttribute('role','dialog');portal.style.fontFamily='Georgia';portal.textContent='动态弹层';document.body.append(portal);
    return {body:getComputedStyle(document.body).fontFamily,heading:getComputedStyle(document.querySelector('h2')).fontFamily,
      input:getComputedStyle(document.querySelector('input')).fontFamily,portal:getComputedStyle(portal).fontFamily,code:getComputedStyle(code).fontFamily};
  })()`);
  for (const key of ['body','heading','input','portal']) {
    assert.equal(fonts[key], fonts.body, key + ' uses the Chinese font stack');
    assert.ok(fonts[key].includes('Microsoft YaHei'), key);
  }
  assert.equal(fonts.code, 'monospace');
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
  await c.eval(`(()=>{const span=document.createElement('span');span.id='split-counter';span.append('7','건');document.body.append(span)})()`);
  await sleep(300);
  assert.equal(await c.eval(`document.querySelector('#split-counter').textContent`),'7 篇投稿');
  // Self-authored title/href mutations must settle, rather than rescheduling forever.
  const ticks = await c.eval('window.__zhxDiagRecord().obs.ticks');
  await sleep(600);
  assert.equal(await c.eval('window.__zhxDiagRecord().obs.ticks'), ticks);
  const locales = JSON.parse(fs.readFileSync(new URL('../fixtures/miramiru-locales.json', import.meta.url), 'utf8'));
  const names = {en:'Kupo Jacket',ja:'クポクポジャケット',ko:'쿠뽀쿠뽀 재킷'};
  const dyes = {en:'Chestnut Brown',ja:'チェスナットブラウン',ko:'밤색'};
  for (const [locale, labels] of Object.entries(locales)) {
    await c.callFn(`function(locale, labels, name, dye) {
      document.documentElement.lang = locale;
      document.querySelector('#dynamic').textContent = labels.Equipment.title;
      document.querySelector('#filter').textContent = labels.Filter.filter;
      document.querySelector('input').placeholder = labels.Filter.keywordPlaceholder;
      document.querySelector('#unknown').textContent = name;
      document.querySelector('#dye').textContent = dye;
      const link = document.querySelector('a.eorzeadb_link');
      link.href = 'https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/b2c13afee4b/';
      link.querySelector('img').alt = name;
      document.querySelector('#name').firstChild.nodeValue = name;
    }`, [locale, labels, names[locale], dyes[locale]]);
    await sleep(500);
    const translated = await c.eval(`({heading:document.querySelector('#dynamic').textContent,
      filter:document.querySelector('#filter').textContent, plain:document.querySelector('#unknown').textContent,
      name:document.querySelector('#name').textContent, dye:document.querySelector('#dye').textContent,
      placeholder:document.querySelector('input').placeholder, href:document.querySelector('a.eorzeadb_link').href})`);
    assert.equal(translated.heading, '装备列表', locale);
    assert.equal(translated.filter, '筛选', locale);
    assert.equal(translated.plain, '库啵外套', locale + ' names index');
    assert.equal(translated.name, '库啵外套', locale);
    assert.equal(translated.dye, '山栗棕', locale);
    assert.equal(translated.placeholder, '搜索标题、装备或标签', locale);
    assert.ok(translated.href.endsWith(encodeURIComponent('库啵外套')), locale);
  }
  console.log('PASS Miramiru: Chinese UI/items/dyes, Wiki links, native links, user input, React updates, stable observer, offline V3');
} finally {
  await closePage(port, page.target.id);
}
