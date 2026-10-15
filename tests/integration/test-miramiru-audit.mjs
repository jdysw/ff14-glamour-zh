// Actual installer, three language URLs, source baseline, translated snapshot,
// exported Blob and default content redaction. HTTPS fixture has no external IO.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { seedV3Memory } from '../helpers/v3-cache.mjs';
import { readDist } from '../helpers/paths.mjs';

const port = Number(process.env.ZHX_CDP_PORT || 9223);
const installer = fs.readFileSync(new URL('../../tools/manual-coverage-audit/FF14-Coverage-Audit-V1.1.user.js', import.meta.url), 'utf8');
const locales = JSON.parse(fs.readFileSync(new URL('../fixtures/miramiru-locales.json', import.meta.url), 'utf8'));
for (const locale of ['ja','en','ko']) {
  const page = await newPage(port);
  const c = page.cdp;
  try {
    const labels = locales[locale];
    const html = `<!doctype html><meta charset="utf-8"><title>Miramiru</title><main>
      <h1>PlayerOriginalTitle</h1><p class="whitespace-pre-wrap">PrivatePlayerNote</p>
      <a href="/${locale}/users/test-author">TestAuthor</a><nav><button>${labels.Filter.filter}</button></nav>
      <h3>${labels.Equipment.title}</h3><button>Untranslated control</button>
      <a class="eorzeadb_link" href="https://na.finalfantasyxiv.com/lodestone/playguide/db/item/b2c13afee4b/"><img alt="Kupo Jacket"><span>Kupo Jacket</span></a>
      </main>`;
    await c.send('Fetch.enable', { patterns: [{urlPattern:'https://miramiru.co/*',requestStage:'Request'}] });
    c.on('Fetch.requestPaused', event => {
      void c.send('Fetch.fulfillRequest', {requestId:event.requestId,responseCode:200,
        responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:Buffer.from(html).toString('base64')});
    });
    const prefix = locale === 'ja' ? '' : '/' + locale;
    await c.send('Page.navigate', {url:'https://miramiru.co' + prefix + '/mirapuri/audit-fixture'});
    for(let i=0;i<40;i++){if(await c.eval('!!document.querySelector("main")'))break;await sleep(50)}
    await seedV3Memory(c, 'miramiru');
    await c.eval(`
      window.__menus = {};
      window.__auditStore = new Map([['zhx.audit.manual.mode','before']]);
      window.GM_getValue = (k,d) => window.__auditStore.has(k) ? window.__auditStore.get(k) : window.__v3MemoryCache?.get(k) ?? d;
      window.GM_setValue = (k,v) => {window.__auditStore.set(k,v);};
      window.GM_registerMenuCommand = (name,run) => {window.__menus[name]=run;};
      window.GM_xmlhttpRequest = o => o.onerror?.({status:0});
      const attach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function(opts){const root=attach.call(this,opts);if(this.id==='zhx-manual-audit-overlay')window.__auditRoot=root;return root;};
      URL.createObjectURL = blob => {window.__exportBlob=blob;return 'blob:fixture-export';};
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function(){window.__exportFile=this.download;};
    `);
    await c.callFn('function(source){(0,eval)(source);}', [installer]);
    await sleep(100);
    await c.eval(`Object.entries(window.__menus).find(([key])=>key.includes('采集当前页'))[1]()`);
    await c.callFn('function(source){(0,eval)(source);}', [readDist()]);
    await sleep(500);
    await c.eval(`(()=>{const mode=window.__auditRoot.querySelector('select');mode.value='after';mode.dispatchEvent(new Event('change'));})()`);
    await c.eval(`Object.entries(window.__menus).find(([key])=>key.includes('采集当前页'))[1]()`);
    await c.eval(`Object.entries(window.__menus).find(([key])=>key.includes('导出 JSON'))[1]()`);
    const exported = JSON.parse(await c.eval('window.__exportBlob.text()'));
    const row = Object.values(exported.pages)[0];
    assert.equal(exported.toolVersion, '1.3.2');
    assert.equal(row.site, 'miramiru');
    assert.equal(row.language, locale);
    assert.equal(row.hasBaseline, true);
    assert.equal(row.status, 'ok');
    assert.ok(row.items.some(it => it.text === '筛选' && it.before === labels.Filter.filter));
    assert.ok(row.items.some(it => it.text === '装备列表'));
    assert.ok(row.items.some(it => it.text === 'Untranslated control'));
    assert.ok(row.items.some(it => it.ctx.scope === 'user' && it.redacted));
    assert.ok(row.items.some(it => it.ctx.scope === 'item' && it.redacted));
    assert.ok(!JSON.stringify(row.items).includes('PrivatePlayerNote'));
    assert.match(await c.eval('window.__exportFile'), /^ff14-audit-v1\.3-/);
    console.log('PASS Miramiru audit installer, baseline pairing, export and redaction: ' + locale);
  } finally {
    await closePage(port, page.target.id);
  }
}
