#!/usr/bin/env node
// Full public FC equipment catalogue audit; never substitute random cards for inventory.
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { newPage, closePage, sleep } from '../tests/helpers/cdp.mjs';
import { ensureChrome, DEFAULT_PORT } from '../tests/helpers/chrome.mjs';
import { readRuntimeV3 } from '../tests/helpers/v3-cache.mjs';
import { parseItemIds } from '../src/core/data/item-identity.js';
import { _applyV3, _fireTablesReady } from '../src/core/data/data-manager.js';
import { trimFCNode, _trFCAttr, translateFCTitle } from '../src/sites/ff14-fc.js';

const URL = 'https://ff14-fc.com/equipment_series_search/';
const OUT = path.resolve('tests/.cache/fc-series-audit');
const KANA = /[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/u;
const SUFFIX = /(?:套装|装束|组合)(?:·[阴阳]|（[^（）]+）)?$/u;

// Run in the original, untranslated document. Only read the site's native
// search-result cards, not footer recommendations, advertisements or posts.
function catalogueSnapshot() {
  const root = document.querySelector('#search-filter-results-8722');
  if (!root) return null;
  const count = /検索結果\s*[:：]?\s*([\d,]+)\s*件/u.exec(root.innerText);
  const route = href => {
    try {
      const u = new globalThis.URL(href, location.href);
      if (u.origin === location.origin && /^\/equipment\/[^/]+\/?$/u.test(u.pathname))
        return u.pathname.replace(/\/?$/, '/');
    } catch { /* not an equipment link */ }
    return null;
  };
  const rows = [];
  for (const card of root.querySelectorAll('.equipment-search-results-content > dl')) {
    const h = card.querySelector('dd h4');
    const native = h?.textContent.trim();
    if (!native) continue;
    const title = card.querySelector('h3')?.textContent.trim() || null;
    const headingPath = route(h.closest('a[href]')?.getAttribute('href'));
    const paths = [...new Set([...card.querySelectorAll('a[href]')].map(a => route(a.getAttribute('href'))).filter(Boolean))];
    const target = headingPath || (paths.length === 1 ? paths[0] : null);
    rows.push({ native, path: target, headingLinked: !!headingPath, articleTitle: title });
  }
  const next = [...root.querySelectorAll('a[rel="next"],a.next,a.nextpostslink,.pagination a.next,.nav-links a.next')]
    .find(a => a.getClientRects().length);
  return { expected: count ? Number(count[1].replaceAll(',', '')) : null, rows, next: next?.href || null };
}

function advanceCatalogue() {
  const root = document.querySelector('#search-filter-results-8722');
  if (!root) return false;
  const card = root.querySelector('.equipment-search-results-content > dl:last-of-type');
  card?.scrollIntoView({block:'end'});
  window.scrollTo(0, document.documentElement.scrollHeight);
  const more = [...root.querySelectorAll('button,input[type="button"],a[href="#"]')]
    .find(el => el.getClientRects().length && !el.disabled &&
      /^(?:もっと見る|もっと読み込む|さらに表示|さらに読み込む|次の\d+件を表示|Load more|Show more)$/iu.test((el.textContent || el.value || '').trim()));
  if (more) more.click();
  return true;
}

const signature = snapshot => JSON.stringify(snapshot?.rows.map(r => [r.path,r.native]) || []);
function nextCatalogueUrl(href) {
  if (!href) return null;
  const u = new globalThis.URL(href, URL);
  const base = new globalThis.URL(URL);
  return u.origin === base.origin && /^\/equipment_series_search\/(?:page\/\d+\/)?$/u.test(u.pathname) ? u.href : null;
}

async function changedSnapshot(cdp, previous, deadlineMs = 15000) {
  const until = Date.now() + deadlineMs;
  do {
    await sleep(500);
    const current = await cdp.eval('(' + catalogueSnapshot.toString() + ')()').catch(() => null);
    if (current?.rows.length && signature(current) !== previous) return current;
  } while (Date.now() < until);
  return null;
}

function addCatalogueRows(report, snapshot, seen) {
  if (snapshot.expected !== null) {
    if (report.expected === null) report.expected = snapshot.expected;
    else if (report.expected !== snapshot.expected) throw new Error('Native result count changed during scan');
  }
  for (const row of snapshot.rows) {
    if (!row.path) {
      const key = 'unlinked:' + row.native + ':' + (row.articleTitle || '');
      if (!seen.has(key)) seen.set(key, row);
      continue;
    }
    const prior = seen.get(row.path);
    if (prior && prior.native !== row.native) throw new Error('Conflicting names for one equipment URL: ' + row.path);
    seen.set(row.path, row);
  }
  report.catalogue = [...seen.values()];
  report.collected = report.catalogue.length;
  report.linked = report.catalogue.filter(r => r.path).length;
  report.unlinked = report.collected - report.linked;
  console.log('Catalogue progress: ' + report.collected + ' / ' + report.expected + '; linked ' + report.linked);
  save(report);
}

function save(report) {
  fs.mkdirSync(OUT,{recursive:true});
  fs.writeFileSync(path.join(OUT,'fc-series-audit.json'),JSON.stringify(report,null,2));
}

async function collectCatalogue(report) {
  const chrome = await ensureChrome({port:DEFAULT_PORT});
  let target;
  const seen = new Map();
  const visited = new Set([URL]);
  try {
    target = await newPage(chrome.port,'about:blank');
    const c = target.cdp;
    await c.send('Network.enable');
    const responses = [];
    c.on('Network.responseReceived',e => {
      if (e.type === 'Document') responses.push({url:e.response.url,status:e.response.status});
    });
    await c.send('Network.setBlockedURLs',{urls:['*doubleclick.net*','*google-analytics*','*googletagmanager*','*twitter.com*','*facebook.net*']});
    await c.send('Page.navigate',{url:URL});
    let snapshot = await changedSnapshot(c,'[]',60000);
    if (!snapshot) throw new Error('Native catalogue did not load (network, WAF or changed markup)');
    const actual = await c.eval('location.href');
    if (!nextCatalogueUrl(actual) || responses.some(r => r.url === actual && r.status >= 400))
      throw new Error('Catalogue navigation failed');
    for (let step=0; step<200;step++) {
      addCatalogueRows(report,snapshot,seen);
      if (report.expected && report.collected >= report.expected) break;
      const previous = signature(snapshot);
      const next = nextCatalogueUrl(snapshot.next);
      if (next && !visited.has(next)) {
        visited.add(next);
        await c.send('Page.navigate',{url:next});
      } else {
        await c.eval('(' + advanceCatalogue.toString() + ')()');
      }
      const updated = await changedSnapshot(c,previous);
      if (!updated) {
        // One native retry, then preserve partial evidence instead of
        // reporting a successful but silently truncated catalogue.
        await c.eval('window.scrollBy(0,-Math.min(600,window.innerHeight))');
        await sleep(700);
        await c.eval('(' + advanceCatalogue.toString() + ')()');
        snapshot = await changedSnapshot(c,previous);
      } else snapshot = updated;
      if (!snapshot) throw new Error('Pagination/infinite scroll stopped before native total');
    }
    if (!report.expected || report.collected !== report.expected || report.unlinked)
      throw new Error('Native total not reconciled with unique equipment URLs');
    report.catalogueComplete = true;
  } finally {
    if (target) await closePage(chrome.port,target.target.id);
    chrome.stop();
  }
}

function withAnchor(doc, row, tag, parent, linked) {
  const h = doc.createElement(tag);
  h.textContent = row.native;
  if (linked && row.path) {
    const a = doc.createElement('a');
    a.href = 'https://ff14-fc.com' + row.path;
    parent.append(a);
    a.append(h);
  } else parent.append(h);
  return h;
}

function translatedTitle(h) {
  trimFCNode(h.firstChild);
  return h.textContent;
}

// Compare production source code in equivalent native heading contexts,
// without downloading every detail page or relying on random recommendations.
function replay(row, doc) {
  globalThis.location = new globalThis.URL(URL);
  const root = doc.createElement('div');
  doc.body.append(root);
  root.id = 'search-filter-results-8722';
  const cards = doc.createElement('div');
  cards.className = 'equipment-search-results-content';
  const card = doc.createElement('dl');
  const dd = doc.createElement('dd');
  root.append(cards);
  cards.append(card);
  card.append(dd);
  if (!row.headingLinked && row.path) {
    const link = doc.createElement('a');
    link.href = 'https://ff14-fc.com' + row.path;
    card.append(link);
  }
  const catalogue = withAnchor(doc,row,'h4',dd,row.headingLinked);
  const catalogueZh = translatedTitle(catalogue);
  const articleCard = row.articleTitle
    ? translatedTitle(withAnchor(doc,{...row,native:row.articleTitle},'h3',dd,false)) : null;
  const sidebar = doc.createElement('div');
  sidebar.id = 'scrollad';
  const dl = doc.createElement('dl');
  root.append(sidebar);
  sidebar.append(dl);
  const rec = withAnchor(doc,row,'h5',dl,true);
  const img = doc.createElement('img');
  img.alt = row.native;
  rec.parentElement.append(img);
  const recommendationZh = translatedTitle(rec);
  _trFCAttr(img,'alt');
  let detailZh = null;
  let documentTitle = null;
  if (row.path) {
    globalThis.location = new globalThis.URL(row.path,'https://ff14-fc.com');
    detailZh = translatedTitle(withAnchor(doc,row,'h5',root,false));
    if (row.articleTitle) {
      doc.title = row.articleTitle;
      translateFCTitle();
      documentTitle = doc.title;
    }
  }
  const result = { translated:{ catalogueZh, recommendationZh, imageZh:img.alt, detailZh },
    articleTitles:{card:articleCard,document:documentTitle} };
  root.remove();
  return result;
}

function evidenceFor(native, items, series) {
  const exact = items.filter(r => r.names.ja === native);
  const alias = !exact.length && native.endsWith('・コスチュームセット')
    ? items.filter(r => r.names.ja === native.slice(0,-'コスチュームセット'.length)+'アタイア') : [];
  const stem = native.replace(/(?:RE|SP)$/u,'');
  const family = items.filter(r => {
    const ja = r.names.ja || '';
    if (ja === native || !ja.startsWith(stem) || ja.length <= stem.length) return false;
    if (native.endsWith('RE') && !ja.endsWith('RE')) return false;
    if (native.endsWith('SP') && !ja.endsWith('SP')) return false;
    if (!/(?:RE|SP)$/u.test(native) && /(?:RE|SP)$/u.test(ja)) return false;
    return /^[・の\u30a1-\u30fa]/u.test(ja.slice(stem.length)) && r.glam === '1';
  });
  const selected = exact.length ? exact : alias.length ? alias : family;
  return {
    type: exact.length ? 'exact-item' : alias.length ? 'shop-alias' : family.length ? 'family-candidates' : 'none',
    count: selected.length,
    series: series.get(native) || null,
    items: selected.slice(0,12).map(r => ({ id:r.id, ja:r.names.ja, zh:r.zh, slot:r.slot }))
  };
}

function review(row, translated, evidence, articleTitles) {
  const issues = [];
  const names = Object.values(translated).filter(v => v !== null);
  if (names.some(v => KANA.test(v))) issues.push('kana-residual');
  if (names.some(v => /套装套装|装束套装|夏装组合套装|套装装备/u.test(v))) issues.push('duplicate-set-suffix');
  if (new Set(names).size > 1) issues.push('context-disagreement');
  const titles = Object.values(articleTitles).filter(Boolean);
  if (titles.some(title => KANA.test(title))) issues.push('article-title-kana-residual');
  const expectedHead = ['【FF14】' + row.native, '〖FF14〗' + row.native];
  const nativeHead = expectedHead.find(head => row.articleTitle?.startsWith(head));
  if (nativeHead && /^(?:装備)?(?:👗|各種族での見た目・入手方法)/u.test(row.articleTitle.slice(nativeHead.length))) {
    const expected = ['【FF14】' + translated.catalogueZh, '〖FF14〗' + translated.catalogueZh];
    if (titles.length !== 2 || titles.some(title => !expected.some(head => title.startsWith(head))))
      issues.push('article-title-set-disagreement');
  }
  const afTitle = row.articleTitle && /^[【〖]FF14[】〗].{1,24}?AF(?:\d{1,2}|[（(]PvP[）)])/u.test(row.articleTitle)
    && ['【' + row.native + '】','〖' + row.native + '〗'].some(end => row.articleTitle.endsWith(end));
  if (afTitle) {
    const expected = ['【' + translated.catalogueZh + '】','〖' + translated.catalogueZh + '〗'];
    if (titles.length !== 2 || titles.some(title => !expected.some(end => title.endsWith(end))))
      issues.push('af-title-set-disagreement');
    if (titles.some(title => KANA.test(title))) issues.push('af-title-kana-residual');
  }
  if (row.native.startsWith('レプリカ・') && names.some(v => !v.includes('（复制品）')))
    issues.push('missing-replica-qualifier');
  const canonical = [...new Set(evidence.items.map(r => r.zh))];
  if (evidence.type === 'exact-item' || evidence.type === 'shop-alias') {
    if (canonical.length > 1) issues.push('ambiguous-official-item');
    else if (canonical.length === 1 && names.some(v => v !== canonical[0])) issues.push('exact-item-name-difference');
  } else {
    // Prefix matches and generated series are evidence, not proof of identity.
    // Every non-exact record remains in the manual review queue.
    issues.push(evidence.type === 'none' ? 'no-independent-item-evidence' : 'family-needs-verification');
    if (names.every(v => v === row.native)) issues.push('unchanged-name');
    if (evidence.type === 'family-candidates' && names.some(v => !SUFFIX.test(v))) issues.push('possible-missing-set-suffix');
  }
  return issues;
}

function auditCatalogue(report) {
  const {siteFiles,dict} = readRuntimeV3('fc');
  const identity = parseItemIds(siteFiles.itemIds.text);
  if (!identity || !_applyV3({candidatePolicy:1,identity,series:siteFiles.series.text,
    dup:siteFiles.dup.text,alias:siteFiles.alias.text,hash:siteFiles.hash.text,dict:dict.text}))
    throw new Error('Invalid checkout V3 FC data');
  const series = new Map(siteFiles.series.text.split('\n').filter(l=>l.includes('|')).map(l=>l.split('|')));
  const dom = new Window({url:URL});
  try {
    globalThis.window = dom;
    globalThis.document = dom.document;
    globalThis.location = dom.location;
    globalThis.NodeFilter = dom.NodeFilter;
    _fireTablesReady();
    report.dataRows = identity.rows.length;
    const officialRows = fs.readFileSync('data/source/ff14-items.tsv','utf8').split('\n').slice(1)
      .map(line => line.split('\t')).filter(parts => parts.length === 9);
    const normalizeEnglish = value => value.toLowerCase().replace(/[^a-z0-9]/g,'');
    const englishIndex = new Map();
    for (const [id,zh,en,ja] of officialRows) {
      const key = normalizeEnglish(en);
      if (!key || !/(?:套装|装束|组合)$/u.test(zh)) continue;
      if (!englishIndex.has(key)) englishIndex.set(key,[]);
      englishIndex.get(key).push({id,zh,en,ja});
    }
    report.officialSourceRows = officialRows.length;
    report.results = report.catalogue.map(row => {
      const {translated,articleTitles} = replay(row,dom.document);
      const evidence = evidenceFor(row.native,identity.rows,series);
      const slug = row.path?.split('/')[2] || '';
      const englishCandidates = englishIndex.get(normalizeEnglish(slug)) || [];
      return {...row,translated,articleTitles,evidence,englishCandidates,issues:review(row,translated,evidence,articleTitles)};
    });
    // Identical translated names on different native equipment pages need
    // semantic review, even if every individual card replay is consistent.
    const byDisplayName = new Map();
    for (const row of report.results) {
      const name = row.translated.catalogueZh;
      if (!byDisplayName.has(name)) byDisplayName.set(name, []);
      byDisplayName.get(name).push(row);
    }
    for (const group of byDisplayName.values()) {
      if (new Set(group.map(row => row.path)).size > 1)
        for (const row of group) row.issues.push('duplicate-display-name');
    }
    report.issueCounts = {};
    for (const row of report.results)
      for (const issue of row.issues) report.issueCounts[issue] = (report.issueCounts[issue] || 0) + 1;
    report.checked = report.results.length;
    report.reviewCount = report.results.filter(r => r.issues.length).length;
    report.articleTitleCount = report.results.filter(r => r.articleTitle).length;
    report.articleCardKanaCount = report.results.filter(r => KANA.test(r.articleTitles.card || '')).length;
    report.documentTitleKanaCount = report.results.filter(r => KANA.test(r.articleTitles.document || '')).length;
  } finally { dom.close(); }
}

const report = {site:'fc',url:URL,expected:null,collected:0,linked:0,unlinked:0,catalogueComplete:false,checked:0,catalogue:[],errors:[]};
try { await collectCatalogue(report); }
catch(e) { report.errors.push(String(e.message || e)); }
try { if (report.catalogue.length) auditCatalogue(report); }
catch(e) { report.errors.push(String(e.message || e)); }
report.status = report.catalogueComplete && report.checked === report.expected && !report.errors.length ? 'complete' : 'partial';
report.semanticStatus = report.status !== 'complete' || report.reviewCount ? 'needs-review' : 'no-detected-issues';
save(report);
console.log(JSON.stringify({status:report.status,semanticStatus:report.semanticStatus,expected:report.expected,collected:report.collected,checked:report.checked,linked:report.linked,reviewCount:report.reviewCount,articleTitleCount:report.articleTitleCount,articleCardKanaCount:report.articleCardKanaCount,documentTitleKanaCount:report.documentTitleKanaCount,issueCounts:report.issueCounts,errors:report.errors},null,2));
if (report.status !== 'complete') process.exitCode = 1;
