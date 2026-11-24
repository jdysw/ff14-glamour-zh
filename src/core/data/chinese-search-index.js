// Per-generation Chinese reverse lookup. No dependency on DOM, storage or the
// runtime data loader; the caller supplies site preferences and item identity lookup.
import { _lcs90 } from '../cache-primitives.js';

export const normalizeSearchText = value => String(value ?? '').trim().replace(/[ \t\u00a0]+/g, ' ');
export const isChineseSearchPhrase = key => key.length >= 2 && /[\u3400-\u9fff]/u.test(key);

const CANONICAL = 0;
const ALIAS = 1;
const MAX_PARTIAL_NAMES = 1000;
const SUGGEST_ABS_MAX = 3000;

function searchNames({ names, aliases, glam, candidatePolicy, preferJapanese }) {
  const matches = Object.create(null);
  const kinds = Object.create(null);
  const put = (zh, native, kind) => {
    if (!zh || !native) return;
    const key = normalizeSearchText(zh);
    const value = normalizeSearchText(native);
    if (!key || !value || matches[key] !== undefined) return;
    matches[key] = value;
    kinds[key] = kind;
  };
  if (candidatePolicy !== 1) return { matches, kinds };

  const entries = Object.entries(names || {});
  if (preferJapanese) {
    // Eden 首页候选优先日文，避免同一装备的英文查询无结果。
    for (const [native, zh] of entries) {
      if (glam?.[native] === '1' && /[\u3040-\u30ff\u3400-\u9fff]/u.test(native) && !/[\uac00-\ud7af]/u.test(native))
        put(zh, native, CANONICAL);
    }
  }
  for (const [native, zh] of entries) {
    if (glam?.[native] === '1') put(zh, native, CANONICAL);
  }
  for (const [alias, zhs] of Object.entries(aliases || {})) {
    const key = normalizeSearchText(alias);
    if (!key || matches[key] !== undefined) continue;
    const list = Array.isArray(zhs) ? zhs : [zhs];
    for (const zh of list) {
      const native = matches[normalizeSearchText(zh)];
      if (native) {
        matches[key] = native;
        kinds[key] = ALIAS;
        break;
      }
    }
  }
  return { matches, kinds };
}

// The lazily built ordered lists and bigram buckets belong to this catalog;
// replacing the catalog frees all its derived indexes together.
export function createSearchCatalog(options) {
  const { matches, kinds } = searchNames(options);
  const keysByKind = [];
  const gramsByKind = [];
  const keys = kind => keysByKind[kind] ??= Object.keys(matches)
    .filter(name => kinds[name] === kind).sort((a, b) => a.localeCompare(b));

  function buildGrams(kind) {
    const index = new Map();
    for (const name of keys(kind)) {
      for (let pos = 0; pos + 1 < name.length; pos++) {
        const gram = name.slice(pos, pos + 2);
        const bucket = index.get(gram);
        if (!bucket) index.set(gram, [name]);
        else if (bucket[bucket.length - 1] !== name) bucket.push(name);
      }
    }
    return index;
  }

  // Narrow to the least common bigram first. Callers still check the full query.
  function candidates(kind, terms) {
    const index = gramsByKind[kind] ??= buildGrams(kind);
    let smallest = null;
    const seen = new Set();
    for (const term of terms) {
      for (let pos = 0; pos + 1 < term.length; pos++) {
        const gram = term.slice(pos, pos + 2);
        if (seen.has(gram)) continue;
        seen.add(gram);
        const bucket = index.get(gram);
        if (!bucket) return [];
        if (!smallest || bucket.length < smallest.length) smallest = bucket;
      }
    }
    return smallest || keys(kind);
  }

  const lookup = name => matches[name] || null;
  return { candidates, keys, lookup };
}

// English common fragments must end at a word edge, e.g. not "ai" in "maid".
function hasWordEdge(needle, names) {
  for (const name of names) {
    for (let i = name.indexOf(needle); i !== -1; i = name.indexOf(needle, i + 1)) {
      const left = i === 0 || !/[0-9A-Za-z]/.test(name[i - 1]);
      const end = i + needle.length;
      const right = end >= name.length
        || !/[0-9A-Za-z]/.test(name[end])
        || !/[0-9A-Za-z]/.test(name[end - 1]);
      if (left && right) return true;
    }
  }
  return false;
}

function partialMatch(catalog, query) {
  const nativeNames = [];
  for (const kind of [CANONICAL, ALIAS]) {
    for (const name of catalog.candidates(kind, [query])) {
      if (name === query || !name.includes(query)) continue;
      const native = catalog.lookup(name);
      if (native) nativeNames.push(native);
      if (nativeNames.length > MAX_PARTIAL_NAMES) break;
    }
    if (nativeNames.length > MAX_PARTIAL_NAMES) break;
  }
  if (!nativeNames.length) return null;
  const match = nativeNames.length === 1 ? nativeNames[0] : _lcs90(nativeNames);
  return match && /[A-Za-z]/.test(match) && !hasWordEdge(match, nativeNames) ? null : match;
}

function suggestionScore(name, query, kind, terms) {
  if (name === query) return 0;
  if (name.startsWith(query)) return kind === CANONICAL ? 1 : 3;
  if (name.includes(query)) return kind === CANONICAL ? 2 : 4;
  if (terms.length > 1 && terms.every(term => name.includes(term))) return 5 + kind;
  return -1;
}

function suggestionVariants(options, kind, name, native, language) {
  const values = kind === CANONICAL ? [name] : options.aliases?.[name] || [];
  const identities = language && options.lookupIdentities
    ? values.flatMap(zh => options.lookupIdentities(zh)).filter(row => row.glam === '1') : [];
  if (!identities.length) return [{ native, group: options.slots?.[native] ?? 5 }];
  return identities.filter(row => row.names[language])
    .map(row => ({ native: row.names[language], itemId: row.id, group: row.slot }));
}

function appendSuggestion(buckets, name, score, row, scope, limit) {
  if (scope instanceof Set && !scope.has(row.native)) return;
  if (typeof scope === 'number' && scope !== row.group) return;
  const bucket = buckets[row.group][score];
  if (bucket.length >= limit) return;
  const suggestion = { zh: name, native: row.native };
  if (row.itemId) suggestion.itemId = row.itemId;
  bucket.push(suggestion);
}

function gatherSuggestions(catalog, options, buckets, query, kind, filters) {
  const { terms, limit, scope, language } = filters;
  for (const name of catalog.candidates(kind, terms)) {
    const score = suggestionScore(name, query, kind, terms);
    const native = catalog.lookup(name);
    if (score < 0 || !native) continue;
    for (const row of suggestionVariants(options, kind, name, native, language))
      appendSuggestion(buckets, name, score, row, scope, limit);
  }
}

function flattenSuggestions(buckets, limit) {
  const rows = [];
  // Bucket order preserves body part before match quality, also at the cap.
  for (const bucket of buckets.flat()) {
    for (const row of bucket) {
      rows.push(row);
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

export function createChineseSearchIndex(options) {
  const catalog = createSearchCatalog(options);
  return {
    lookup: catalog.lookup,
    partial: query => partialMatch(catalog, query),
    suggest(query, limit, scope, language) {
      const raw = Number(limit);
      const max = Number.isFinite(raw) && raw > 0 ? Math.min(raw, SUGGEST_ABS_MAX) : SUGGEST_ABS_MAX;
      const filters = { terms: query.split(/\s+/u), limit: max, scope, language };
      const buckets = Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => []));
      for (const kind of [CANONICAL, ALIAS])
        gatherSuggestions(catalog, options, buckets, query, kind, filters);
      return flattenSuggestions(buckets, max);
    },
  };
}
