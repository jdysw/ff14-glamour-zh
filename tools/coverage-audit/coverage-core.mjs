// Shared, deterministic primitives for coverage auditing (no browser/network required).
// Keep all site-specific navigation heuristics here so local/cloud collectors agree.
const OMIT_PARAMS = /^(utm_|fbclid$|gclid$|ref$|source$|share$|session|token|nonce)/i;
const DANGEROUS_PATH = /\/(login|logout|sign-?out|register|signup|delete|remove|checkout|account|settings|admin|api)(\/|$)/i;
const ASSET_EXT = /\.(?:png|jpe?g|gif|svg|webp|css|js|xml|json|zip|pdf|woff2?|ico)$/i;

export function normalizeSiteUrl(candidate, base, allowedHosts) {
  try {
    const u = new URL(candidate, base);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!allowedHosts.some((host) => u.hostname === host || u.hostname.endsWith('.' + host))) return null;
    if (DANGEROUS_PATH.test(u.pathname) || ASSET_EXT.test(u.pathname)) return null;
    u.hash = '';
    u.username = '';
    u.password = '';
    for (const k of [...u.searchParams.keys()]) if (OMIT_PARAMS.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    if (u.pathname !== '/') u.pathname = u.pathname.replace(/\/+$/, '') + '/';
    return u.toString();
  } catch {
    return null;
  }
}

// Route *templates*, not individual user-generated posts, are the primary coverage unit.
export function templateKey(url) {
  const u = new URL(url);
  const parts = u.pathname.split('/').filter(Boolean).map((s) => {
    if (/^\d+$|^[0-9a-f]{8}-[0-9a-f-]{16,}$/i.test(s)) return ':id';
    if (/^[0-9a-f]{20,}$/i.test(s)) return ':hash';
    return s;
  });
  // The first two levels distinguish e.g. equipment_search_parts/equipment_search_foot
  // while bounding unbounded detail-page crawls.
  return u.hostname + '/' + parts.slice(0, 3).join('/') + (parts.length > 3 ? '/…' : '');
}

export function selectDiscoveredPages({ seedPages, linksByUrl, allowedHosts, maxPages = 60, perTemplate = 3, maxDepth = 2 }) {
  const pending = seedPages.map((p) => ({ url: p.url, depth: 0, id: p.id, type: p.type }));
  const visited = new Set();
  const templateCount = new Map();
  const selected = [];
  const cap = Math.max(1, maxPages);
  while (pending.length && selected.length < cap) {
    const entry = pending.shift();
    const url = normalizeSiteUrl(entry.url, entry.url, allowedHosts);
    if (!url || visited.has(url)) continue;
    visited.add(url);
    const key = templateKey(url);
    if ((templateCount.get(key) || 0) >= perTemplate) continue;
    templateCount.set(key, (templateCount.get(key) || 0) + 1);
    selected.push({ ...entry, url, type: entry.type || 'discovered', template: key });
    if (entry.depth >= maxDepth) continue;
    for (const link of linksByUrl[url] || linksByUrl[entry.url] || []) {
      const next = normalizeSiteUrl(link, url, allowedHosts);
      if (next && !visited.has(next)) pending.push({ url: next, depth: entry.depth + 1 });
    }
  }
  return selected;
}

// A source/after pair distinguishes real untranslated English UI from benign English names.
// Matched paths may not survive a JS framework re-render, so unmatched after entries are
// conservatively classified without alleging a translator regression.
export function pairSnapshots(before = [], after = []) {
  const keyed = new Map();
  const makeKey = (it) => (it.kind || 'text') + '\u0000' + (it.path || '');
  for (const item of before) {
    const k = makeKey(item);
    if (!keyed.has(k)) keyed.set(k, []);
    keyed.get(k).push(item.text);
  }
  return after.map((item) => {
    const queue = keyed.get(makeKey(item)) || [];
    return { ...item, before: queue.length ? queue.shift() : null };
  });
}

export function latestResults(results) {
  // Old audit caches remain readable, but the newest scan wins for each page.
  const latest = new Map();
  for (const r of results) {
    const pages = r.pages || [r];
    for (const p of pages) {
      const one = { ...p, site: r.site || p.site, scannedAt: p.scannedAt || r.scannedAt || '' };
      if (!one.site || !one.url || String(one.url).startsWith('fixture:')) continue;
      const key = one.site + '\u0000' + one.url;
      const old = latest.get(key);
      if (!old || (one.scannedAt || '') >= (old.scannedAt || '')) latest.set(key, one);
    }
  }
  return [...latest.values()];
}

export function coverageStats(results) {
  const stats = { pages: 0, failed: 0, completed: 0, candidates: 0, untranslated: 0, wrong: 0, english: 0, templates: new Set(), bySite: {} };
  for (const page of latestResults(results)) {
    stats.pages++;
    const site = stats.bySite[page.site] ||= { pages: 0, completed: 0, failed: 0, untranslated: 0, templates: new Set() };
    site.pages++;
    if (page.error || page.status === 'failed') { stats.failed++; site.failed++; continue; }
    stats.completed++; site.completed++;
    const template = page.template || templateKey(page.url);
    stats.templates.add(template);
    site.templates.add(template);
    for (const item of page.items || []) {
      stats.candidates++;
      if (item.category === 'real') { stats.untranslated++; site.untranslated++; }
      if (item.category === 'wrong') stats.wrong++;
      if (item.category === 'real' && /^[\x00-\x7f]+$/.test(item.text)) stats.english++;
    }
  }
  stats.templateCount = stats.templates.size;
  delete stats.templates;
  for (const site of Object.values(stats.bySite)) {
    site.templateCount = site.templates.size;
    delete site.templates;
  }
  return stats;
}

// Using original source and final text avoids mistaking Japanese kanji for Chinese.
export function classifyChangedText(text, original) {
  if (original == null || original === text) return 'unchanged';
  if (/[\u3040-\u30ff\uac00-\ud7af\u1100-\u11ff]/.test(text)) return 'partial';
  if (/[a-zA-Z]{2}/.test(text) && /[\u4e00-\u9fff]/.test(text)) return 'potential-partial';
  return 'translated';
}

// Guard against a false assertion of full coverage when some subdomains aren't injected.
export function extractMatches(header) {
  return [...header.matchAll(/^\/\/\s*@match\s+(\S+)/gm)].map((m) => m[1]);
}
export function matchPatternCoversHost(pattern, host) {
  try {
    const u = new URL(pattern.replace(/\*$/, 'example'));
    return u.hostname === host || (u.hostname.startsWith('*.') && host.endsWith(u.hostname.slice(1)));
  } catch { return false; }
}
export function unmatchedHosts(siteHosts, header) {
  const patterns = extractMatches(header);
  return [...new Set(siteHosts)].filter((host) => !patterns.some((p) => matchPatternCoversHost(p, host)));
}
