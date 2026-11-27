// Offline replay of previously observed, redacted public EC catalogue names.
// This tests the current resolver, not DOM rendering, site availability,
// actual membership of a gearset, or completed semantic acceptance.
import fs from 'node:fs';
import path from 'node:path';
import { readRuntimeV3 } from '../../tests/helpers/v3-cache.mjs';
import { _applyV3, _fireTablesReady, dataGetIndex } from '../../src/core/data/data-manager.js';
import { ecAccessoryDisplayName, ecGearsetDisplayName } from '../../src/sites/eorzea-collection/catalog.js';

const [output, ...dirs] = process.argv.slice(2);
if (!output || !dirs.length) throw Error('Usage: ec-catalog-replay.mjs <report.json> <redacted evidence dir> [...]');
globalThis.window = globalThis;
globalThis.location = new URL('https://ffxiv.eorzeacollection.com/gearsets');
const runtime = readRuntimeV3('ec');
const files = Object.fromEntries(Object.entries(runtime.siteFiles).map(([key, meta]) => [key, meta.text]));
files.candidatePolicy = runtime.manifest.candidatePolicy;
if (runtime.dict) files.dict = runtime.dict.text;
if (!_applyV3(files)) throw Error('Candidate runtime data could not be loaded');
_fireTablesReady();
if (Object.keys(dataGetIndex('nameMap') || {}).length < 45000) throw Error('Official Item index unavailable');

const seen = new Map();
const routes = new Set(['/gearsets', '/accessories']);
const safeName = value => typeof value === 'string' && value.length <= 110 && value.length > 0 && !/[\r\n<>]/u.test(value);
function add(row) {
  if (!routes.has(row.route) || !safeName(row.native)) return;
  if (typeof row.sourceAfter !== 'string' || row.sourceAfter.length > 200
      || !/^[\w-]{1,160}$/u.test(row.pageId || '') || !/^[a-f0-9]{40}$/u.test(row.sourceRevision || '')) return;
  const key = row.route + '\u0000' + row.native;
  const old = seen.get(key);
  if (!old || String(row.scannedAt || '') >= String(old.scannedAt || '')) {
    seen.set(key, {route:row.route,native:row.native,sourceAfter:row.sourceAfter,
      pageId:row.pageId,sourceRevision:row.sourceRevision,scannedAt:row.scannedAt || ''});
  }
}
function visit(dir) {
  if (!fs.existsSync(dir)) throw Error('Evidence directory missing');
  for (const file of fs.readdirSync(dir, {withFileTypes:true})) {
    const filename = path.join(dir, file.name);
    if (file.isDirectory()) visit(filename);
    else if (file.isFile() && file.name === 'ec-catalog-replay.json') {
      const prior = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (prior.format === 'ec-public-catalogue-replay-v1') for (const item of prior.results || []) add(item);
    } else if (file.isFile() && /^ec-[\w-]+-cloud\.json$/u.test(file.name)) {
      const page = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (page.site !== 'ec' || page.status !== 'ok') continue;
      const url = new URL(page.url);
      if (url.origin !== 'https://ffxiv.eorzeacollection.com' || !routes.has(url.pathname)) continue;
      for (const item of page.items || []) {
        if (item.redacted || item.kind !== 'attr:alt' || item.ctx?.scope !== 'ui'
            || item.ctx.user || !/\bcollection-image\b/u.test(item.ctx.cls || '')
            || typeof item.before !== 'string' || !item.before.endsWith(' image')) continue;
        add({route:url.pathname,native:item.before.slice(0,-6),sourceAfter:item.text,
          pageId:page.pageId,sourceRevision:page.revision,scannedAt:page.scannedAt});
      }
    }
  }
}
for (const dir of dirs) visit(dir);
if (!seen.size) throw Error('No observed catalogue names in redacted evidence');
const results = [...seen.values()].map(row => {
  const translated = row.route === '/accessories' ? ecAccessoryDisplayName(row.native) : ecGearsetDisplayName(row.native);
  const predicted = translated && /[\p{Script=Han}]/u.test(translated) ? translated + '图片' : null;
  return {...row,predicted,
    status:predicted ? predicted === row.sourceAfter ? 'matches-observed' : 'candidate-changed' : 'unresolved'};
}).sort((a,b)=>a.route.localeCompare(b.route)||a.native.localeCompare(b.native));
const priorResiduals = results.filter(row=>!/\p{Script=Han}/u.test(row.sourceAfter));
const counts = {
  distinctObservedTitles:results.length,
  resolverProducedChinese:results.filter(row=>row.predicted).length,
  unresolved:results.filter(row=>!row.predicted).length,
  previouslyEnglish:priorResiduals.length,
  previouslyEnglishNowResolved:priorResiduals.filter(row=>row.predicted).length
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({format:'ec-public-catalogue-replay-v1',
  candidateRevision:process.env.ZHX_AUDIT_SHA || '', scope:'offline resolver replay; not live or semantic acceptance',
  counts,results},null,2)+'\n');
console.log('EC catalogue replay:',JSON.stringify(counts));
console.log('EC catalogue unresolved titles:', JSON.stringify(results.filter(row=>!row.predicted).map(row=>row.native)));
