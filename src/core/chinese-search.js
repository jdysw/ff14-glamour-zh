/* @phase23-module-order:core/chinese-search */
/* @phase23-order-link:core/chinese-search<-core/data-manager */
import { resolveByZh } from './data-manager.js';

const SEARCH_SITES = Object.freeze({
  mirapri: true,
  fc: true,
  ronka: true,
  collection: true,
});

const SEARCH_EXCLUDE_RE = /author|player|title|comment|tag|username|email|password|作者|标题|标签|用户/i;
const SEARCH_INPUT_TYPES = new Set(['', 'text', 'search']);

function normalizeSearchQuery(value) {
  return String(value ?? '').trim().replace(/[ \\t\\u00a0]+/g, ' ');
}

function isChineseSearchQuery(value) {
  const q = normalizeSearchQuery(value);
  return q.length > 0 && /[\\u3400-\\u9fff]/u.test(q);
}

function searchInputScore(input) {
  if (!input) return -Infinity;
  const type = String(input.getAttribute?.('type') || '').toLowerCase();
  if (!SEARCH_INPUT_TYPES.has(type) || input.disabled || input.readOnly) return -Infinity;
  const meta = [
    input.getAttribute?.('name'),
    input.getAttribute?.('id'),
    input.getAttribute?.('placeholder'),
    input.getAttribute?.('aria-label'),
    input.getAttribute?.('title'),
  ].filter(Boolean).join(' ');
  if (SEARCH_EXCLUDE_RE.test(meta)) return -1000;
  let score = 0;
  if (/keyword/i.test(meta)) score += 100;
  if (/search/i.test(meta)) score += 80;
  if (/query|(^|[-_])q([-_]|$)/i.test(meta)) score += 70;
  if (/关键词|关键字|キーワード|検索|装備品|装備|검색|장비|키워드/u.test(meta)) score += 70;
  if (input.getAttribute?.('placeholder')) score += 5;
  return score;
}

function findSearchInput(form) {
  if (!form?.querySelectorAll) return null;
  const candidates = [...form.querySelectorAll('input')];
  let best = null;
  let bestScore = -Infinity;
  for (const input of candidates) {
    const score = searchInputScore(input);
    if (score > bestScore) {
      best = input;
      bestScore = score;
    }
  }
  if (bestScore >= 5) return best;
  const usable = candidates.filter((input) => searchInputScore(input) > -Infinity);
  return usable.length === 1 ? usable[0] : null;
}

function buildSearchUrl(action, entries, inputName, native, baseHref) {
  if (!inputName || !native) return null;
  let url;
  try {
    url = new URL(action || baseHref, baseHref);
  } catch {
    return null;
  }

  const grouped = new Map();
  for (const [key, value] of entries || []) {
    if (!key || typeof value !== 'string') continue;
    const values = grouped.get(key) || [];
    values.push(value);
    grouped.set(key, values);
  }

  for (const key of grouped.keys()) url.searchParams.delete(key);
  for (const [key, values] of grouped) {
    for (const value of values) url.searchParams.append(key, value);
  }
  url.searchParams.delete(inputName);
  url.searchParams.set(inputName, native);
  return url.toString();
}

function formEntries(form) {
  try {
    const fd = new FormData(form);
    return [...fd.entries()];
  } catch {
    return null;
  }
}

function rewriteInputTemporarily(input, native) {
  const previous = input.value;
  input.value = native;
  setTimeout(() => {
    if (!input.isConnected) return;
    if (input.value === native) input.value = previous;
  }, 0);
}

function handleChineseSearchSubmit(event, siteId) {
  if (!SEARCH_SITES[siteId]) return;
  const form = event.target;
  const input = findSearchInput(form);
  if (!input) return;

  const query = normalizeSearchQuery(input.value);
  if (!isChineseSearchQuery(query)) return;

  const native = resolveByZh(query);
  if (!native || native === query) return;

  const method = String(form.getAttribute?.('method') || 'get').toLowerCase();
  if (method === 'get' && input.name) {
    const entries = formEntries(form);
    const action = form.getAttribute?.('action') || globalThis.location?.href || '';
    const baseHref = globalThis.location?.href || action;
    const url = entries ? buildSearchUrl(action, entries, input.name, native, baseHref) : null;
    if (url) {
      event.preventDefault();
      event.stopPropagation();
      globalThis.location.assign(url);
      return;
    }
  }

  // 非 GET / 无 name 的搜索表单：只临时替换提交值，不改页面显示，不派发 input 事件。
  rewriteInputTemporarily(input, native);
}

function startChineseSearch(siteId) {
  if (!SEARCH_SITES[siteId]) return;
  if (typeof document === 'undefined' || !document.addEventListener) return;
  if (globalThis.__zhxChineseSearchBound) return;
  globalThis.__zhxChineseSearchBound = true;
  document.addEventListener('submit', (event) => {
    try {
      handleChineseSearchSubmit(event, siteId);
    } catch (error) {
      console.warn('[zhx] 中文装备搜索失败', error);
    }
  }, true);
}

export {
  SEARCH_SITES,
  buildSearchUrl,
  findSearchInput,
  handleChineseSearchSubmit,
  isChineseSearchQuery,
  normalizeSearchQuery,
  searchInputScore,
  startChineseSearch,
};
