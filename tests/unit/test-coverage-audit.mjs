// Offline audit engine regression tests. Do not require Chrome, networking, or the live sites.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITES, COLLECTOR_JS, classify, classifyResiduals, buildReport, isResidual,
} from '../../tools/coverage-audit/audit.mjs';
import {
  normalizeSiteUrl, templateKey, selectDiscoveredPages, pairSnapshots,
  latestResults, coverageStats, classifyChangedText, unmatchedHosts,
} from '../../tools/coverage-audit/coverage-core.mjs';
import { LINKS_JS } from '../../tools/coverage-audit/coverage-collector.mjs';
import { parseSitemapLocs, discoverSitemapUrls } from '../../tools/coverage-audit/sitemap.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const header = fs.readFileSync(path.join(root, 'build/userscript-header.txt'), 'utf8');

assert.equal(Object.keys(SITES).length, 7, 'all seven active adapters must be audited');
assert.ok(SITES.endcloset, 'EndCloset must not be omitted');
assert.ok(SITES.collection.hosts.some((host) => host === 'weapon.ffxivcollection.com'));
assert.deepEqual(SITES.fc.pages.filter((p) => ['head','body','hand','leg','foot'].includes(p.id)).map((p) => p.id), ['head','body','hand','leg','foot']);
assert.ok(SITES.fc.pages.some((p) => p.type === 'filtered'));
assert.deepEqual(unmatchedHosts(['weapon.ffxivcollection.com', 'www.ffxivcollection.com'], header), []);
assert.ok(header.includes('@match        https://end-closet.com/*'));
assert.equal(unmatchedHosts(['unknown.example.net'], header).length, 1);

assert.equal(normalizeSiteUrl('https://example.com/item/?utm_source=x&a=2#part', 'https://example.com/', ['example.com']),
  'https://example.com/item/?a=2');
assert.equal(normalizeSiteUrl('https://badexample.com/', 'https://example.com/', ['example.com']), null);
assert.equal(normalizeSiteUrl('javascript:alert(1)', 'https://example.com/', ['example.com']), null);
assert.equal(normalizeSiteUrl('https://example.com/logout/', 'https://example.com/', ['example.com']), null);
assert.equal(normalizeSiteUrl('https://example.com/image.png', 'https://example.com/', ['example.com']), null);
assert.ok(templateKey('https://example.com/item/12345').endsWith('item/:id'));
const seed = [{ id: 'home', url: 'https://example.com/', type: 'home' }];
const paths = {
  'https://example.com/': ['https://example.com/equip/1/', 'https://example.com/equip/2/', 'https://other.com/'],
  'https://example.com/equip/1/': ['https://example.com/detail/4/'],
  'https://example.com/equip/2/': [],
};
const crawled = selectDiscoveredPages({ seedPages: seed, linksByUrl: paths,
  allowedHosts: ['example.com'], perTemplate: 1, maxPages: 20, maxDepth: 3 });
assert.equal(crawled.length, 3);
assert.ok(crawled.some((p) => p.url.includes('/detail/4/')));

const before = [
  { kind: 'text', path: 'main > button', text: 'Show Results' },
  { kind: 'text', path: 'main > span', text: '次へ' },
];
const after = [
  { kind: 'text', path: 'main > button', text: 'Show Results', ctx: { ui: true, tag: 'button' } },
  { kind: 'text', path: 'main > span', text: '次へ', ctx: { ui: true } },
];
const joined = pairSnapshots(before, after);
assert.equal(joined[0].before, 'Show Results');
assert.equal(joined[1].before, '次へ');
assert.equal(classify('Show Results', { ui: true, kind: 'text', tag: 'button' }), 'real', 'untranslated English UI');
assert.equal(classify('次へ', { ui: true, before: '次へ' }), 'real', 'Japanese kanji is not translated Chinese');
assert.equal(classify('すべて已筛选', { ui: true, before: 'すべて' }), 'wrong', 'partial translation');
assert.equal(classify('提交搜索', { ui: true }), 'ok');
assert.equal(classify('Some random English username', { ui: false, kind: 'text' }), 'ok');
assert.equal(classify('検索', { cls: 'post-card', ui: true }), 'real', 'post-card must not blanket-ignore UI');
assert.equal(classify('검색', { cls: 'username', ui: true }), 'user');
assert.equal(classify('검색', { ad: true }), 'ad');
assert.equal(classify('Eorzea Collection', { ui: true }), 'exempt');
assert.equal(isResidual('Search', { ui: true }), true);
assert.equal(isResidual('Search', { ui: false }), false);
assert.equal(classifyChangedText('次へ', '次へ'), 'unchanged');
assert.equal(classifyChangedText('下一页', '次へ'), 'translated');

const classified = classifyResiduals(joined.map((x) => ({ ...x, site: 'ec' })));
assert.deepEqual(classified.map((x) => x.category), ['real', 'real']);

const old = { site: 'ec', pageId: 'home', url: 'https://example.com/', scannedAt: '2026-10-08T00:00:00Z',
  items: [{ text: 'Search', category: 'real' }] };
const next = { site: 'ec', pageId: 'home', url: 'https://example.com/', scannedAt: '2026-10-09T00:00:00Z',
  items: [{ text: 'Show Results', category: 'real' }] };
const fail = { site: 'fc', pageId: 'search', url: 'https://example.com/search/', scannedAt: '2026-10-09T00:00:00Z',
  items: [], status: 'failed', error: 'HTTP 403' };
const previousSlash = { ...old, url: 'https://example.com/equip', pageId: 'legacy',
  scannedAt: '2026-10-08T03:00:00Z' };
const newerSlash = { ...next, url: 'https://example.com/equip/', pageId: 'current',
  scannedAt: '2026-10-09T03:00:00Z' };
const mergedPaths = latestResults([previousSlash, newerSlash]);
assert.equal(mergedPaths.length, 1, 'path with and without / is same URL');
assert.equal(mergedPaths[0].pageId, 'current');
const aggregate = latestResults([{ site: 'fc', scannedAt: '2026-10-09',
  pages: [{ id: 'home', url: 'https://example.com/', items: [] },
          { id: 'search', url: 'https://example.com/search/', items: [] }] }]);
assert.deepEqual(aggregate.map((p) => p.pageId), ['home', 'search'], 'page ID must survive aggregation');
const latest = latestResults([old, next, fail]);
assert.equal(latest.length, 2);
assert.equal(latest.find((x) => x.site === 'ec').items[0].text, 'Show Results');
const stats = coverageStats([old, next, fail]);
assert.equal(stats.pages, 2);
assert.equal(stats.completed, 1);
assert.equal(stats.failed, 1);
assert.equal(stats.untranslated, 1);
assert.equal(stats.english, 1);
const report = buildReport([old, next, fail]);
assert.match(report, /失败：1/);
assert.match(report, /HTTP 403/);
assert.match(report, /Show Results/);
assert.doesNotMatch(report, /Search \|/); // stale snapshot excluded
const cloudRaw = { site: 'ec', url: 'https://example.com/cloud/', pageId: 'cloud',
  scannedAt: '2026-10-09T01:00:00Z',
  items: [{ kind: 'text', text: 'Show Results', path: 'main>button', ctx: { ui: true, tag: 'button' }, before: 'Show Results' }] };
const cloudReport = buildReport([cloudRaw]);
assert.match(cloudReport, /真漏译候选：1/);
assert.match(cloudReport, /Show Results/);


const xml = '<sitemapindex><sitemap><loc>https://example.com/detail.xml</loc></sitemap></sitemapindex>';
assert.deepEqual(parseSitemapLocs(xml), { index: true, urls: ['https://example.com/detail.xml'] });
assert.deepEqual(parseSitemapLocs('<urlset><loc>https://example.com/?a=1&amp;b=2</loc>' +
  '<loc>https://example.com/?a=1&amp;amp;b=2</loc><loc>https://example.com/?a=1&#38;b=2</loc></urlset>').urls,
  ['https://example.com/?a=1&b=2', 'https://example.com/?a=1&amp;b=2', 'https://example.com/?a=1&b=2'],
  'XML entities must be decoded exactly once');
const mockPages = {
  'https://example.com/sitemap.xml': '<sitemapindex><sitemap><loc>https://example.com/detail.xml</loc></sitemap></sitemapindex>',
  'https://example.com/detail.xml': '<urlset><url><loc>https://example.com/equip/1/</loc></url><url><loc>https://external.test/login/</loc></url><url><loc>https://example.com/equip/2/</loc></url></urlset>',
};
const sitemapUrls = await discoverSitemapUrls({
  hosts: ['example.com'], fetcher: async (url) => ({ ok: !!mockPages[url], text: async () => mockPages[url] || '' }),
});
assert.deepEqual(sitemapUrls, ['https://example.com/equip/1/', 'https://example.com/equip/2/']);

// Simulate minimal visible DOM to verify a standalone action link is captured
// as UI, while an ordinary user-submitted link is not considered UI.
const { runInNewContext } = await import('node:vm');
function anchorContext(cls, label) {
  const el = {
    tagName: 'A', className: cls, id: '', textContent: label, parentElement: null,
    getAttribute: () => null, closest: () => null,
  };
  const fakeDocument = {
    title: '', body: { nodeType: 1 },
    createTreeWalker() { return { nextNode() { return null; } }; },
    querySelectorAll() { return [el]; },
    documentElement: {},
  };
  el.isConnected = true;
  el.getClientRects = () => [{ width: 10 }];
  el.hasAttribute = () => false;
  el.parentElement = fakeDocument.body;
  el.closest = () => null;
  fakeDocument.body.tagName = 'BODY';
  fakeDocument.body.className = '';
  fakeDocument.body.parentElement = null;
  fakeDocument.body.getAttribute = () => null;
  fakeDocument.body.textContent = '';
  const result = runInNewContext(COLLECTOR_JS, {
    document: fakeDocument,
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  });
  return result;
}
assert.equal(anchorContext('button-link', 'Show Results')[0]?.ctx.ui, true);
assert.equal(anchorContext('content-entry', 'Player nickname')[0]?.ctx.ui, false);
assert.doesNotThrow(() => new Function(COLLECTOR_JS));
assert.doesNotThrow(() => new Function(LINKS_JS));
console.log('✅ coverage-audit: host contracts, URL crawl, snapshots, JA/KO/EN, report and collector passed');
