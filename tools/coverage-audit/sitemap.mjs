// Bounded, read-only sitemap discovery. A failed/blocked sitemap never means a site is empty.
import { normalizeSiteUrl, templateKey } from './coverage-core.mjs';

export function parseSitemapLocs(xml) {
  const urls = [];
  const re = /<loc(?:\s[^>]*)?>\s*([^<]+?)\s*<\/loc>/gi;
  for (const m of String(xml).matchAll(re)) {
    // Decode ampersand entities in one pass only: &amp;amp; must become
    // &amp;, never a second decoded '&' (double-unescape/security risk).
    const url = m[1].trim().replace(/&(?:amp|#0*38|#x0*26);/gi, '&');
    if (url) urls.push(url);
  }
  return { index: /<sitemapindex(?:\s|>)/i.test(xml), urls };
}

export async function discoverSitemapUrls({ hosts, fetcher = fetch, maxUrls = 120, maxIndexes = 3, timeoutMs = 10000 }) {
  const urls = [];
  const seen = new Set();
  const visitedIndexes = new Set();
  const queue = hosts.map((host) => 'https://' + host + '/sitemap.xml');
  while (queue.length && urls.length < maxUrls) {
    const site = queue.shift();
    if (visitedIndexes.has(site) || visitedIndexes.size >= hosts.length + maxIndexes) continue;
    visitedIndexes.add(site);
    try {
      const response = await fetcher(site, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) continue;
      const body = await response.text();
      if (body.length > 8_000_000) continue;
      const parsed = parseSitemapLocs(body);
      if (parsed.index) {
        for (const href of parsed.urls.slice(0, maxIndexes)) {
          try {
            const u = new URL(href, site);
            if (u.protocol === 'https:' && u.pathname.endsWith('.xml') &&
                hosts.includes(u.hostname) &&
                !visitedIndexes.has(u.href)) queue.push(u.href);
          } catch { /* invalid sitemap child URL */ }
        }
        continue;
      }
      for (const href of parsed.urls) {
        const url = normalizeSiteUrl(href, site, hosts);
        if (url && !seen.has(url)) {
          seen.add(url);
          urls.push(url);
          if (urls.length >= maxUrls) break;
        }
      }
    } catch {
      // WAF / network failures are expected; existing seeds/DOM links still run.
    }
  }
  // Sample different path templates first, not 120 near-identical user posts.
  const distinct = [];
  const counts = new Map();
  for (const u of urls) {
    const key = templateKey(u);
    if ((counts.get(key) || 0) >= 3) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
    distinct.push(u);
  }
  return distinct;
}
