/* @phase23-module-order:core/chinese-search */
/* @phase23-order-link:core/chinese-search<-core/data-manager */
import { onTablesReady, resolveByZh, suggestByZh } from './data-manager.js';

const SEARCH_SITES = Object.freeze({
  mirapri: true,
  fc: true,
  ronka: true,
  collection: true,
  // 1.4.2 后续修复：Eorzea Collection（英文站）——中文装备名 → 英文名。
  // 覆盖场景：部位筛选器（vue-select，输入触发 POST /gear/<slot>/search）
  // 与装备库页搜索框（/gearsets、/accessories 的 "Search..." 框）。
  ec: true,
});

const SEARCH_EXCLUDE_RE = /author|player|title|comment|tag|username|email|password|作者|标题|标签|用户/i;
const SEARCH_INPUT_TYPES = new Set(['', 'text', 'search']);
const _searchInputCache = new WeakMap();

function normalizeSearchQuery(value) {
  return String(value ?? '').trim().replace(/[ \t\u00a0]+/g, ' ');
}

function isChineseSearchQuery(value) {
  const q = normalizeSearchQuery(value);
  return q.length > 0 && /[\u3400-\u9fff]/u.test(q);
}

function searchInputScore(input) {
  if (!input) return -Infinity;
  const type = String(input.getAttribute?.('type') || '').toLowerCase();
  if (!SEARCH_INPUT_TYPES.has(type) || input.disabled || input.readOnly) return -Infinity;
  // 1.4.2 后续修复：vue-select 搜索框（EC 部位筛选器）不是表单搜索框——
  // 其值不参与表单序列化，输入即触发站点检索；完全排除，交给独立搜索框自动转换路径。
  if (/vs__search/.test(String(input.className || ''))) return -Infinity;
  const meta = [
    input.getAttribute?.('name'),
    input.getAttribute?.('id'),
    input.getAttribute?.('placeholder'),
    input.getAttribute?.('aria-label'),
    input.getAttribute?.('title'),
  ].filter(Boolean).join(' ');
  if (SEARCH_EXCLUDE_RE.test(meta)) return -1000;
  let score = 0;
  if (/装備名(?:の一部)?を入力して検索|装備名.*検索|検索.*装備名/u.test(meta)) score += 120;
  if (/keyword/i.test(meta)) score += 100;
  if (/search/i.test(meta)) score += 80;
  if (/query|(^|[-_])q([-_]|$)/i.test(meta)) score += 70;
  if (/关键词|关键字|キーワード|検索|装備品|装備|검색|장비|키워드/u.test(meta)) score += 70;
  if (input.getAttribute?.('placeholder')) score += 5;
  return score;
}

function findSearchInput(form) {
  if (!form?.querySelectorAll) return null;
  const cached = _searchInputCache.get(form);
  if (cached && cached.isConnected !== false
      && (!form.contains || form.contains(cached))) {
    return cached;
  }

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

  let result = null;
  if (bestScore >= 5) result = best;
  else {
    const usable = candidates.filter((input) => searchInputScore(input) > -Infinity);
    result = usable.length === 1 ? usable[0] : null;
  }
  if (result) _searchInputCache.set(form, result);
  return result;
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
    // 1.4.2 后续修复：空值参数不得进入搜索 URL —— mirapri 实测（2026-10-07）：
    // 空筛选参数（cl/j/r/t/c/fav 等）会被站方当作「生效的无效筛选」→ 搜索恒为 0 结果；
    // 剔除空值后 ?keyword=X 正常返回（25 条/页），有效筛选（如 j=15）保留后亦正常。
    if (!key || typeof value !== 'string' || value === '') continue;
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


const SUGGEST_MIN_CHARS = 2;
// 候选列表可视行数：数据全量渲染（显示所有含输入字的装备），
// 列表高度限 8 行，超出的通过滚轮在列表内滑动翻看。
const SUGGEST_VISIBLE_ROWS = 8;
const SUGGEST_ROW_HEIGHT = 40;   // 与 CSS 中 button min-height:40px 对齐
const SUGGEST_DEBOUNCE_MS = 70;
const SUGGEST_HIDE_DELAY_MS = 120;

let _suggestBox = null;
let _suggestInput = null;
let _suggestRows = [];
let _suggestActive = -1;
let _suggestTimer = null;
let _suggestHideTimer = null;
let _suggestStyleReady = false;
let _suggestDataReady = false;
const _composingInputs = new WeakSet();

function isSearchInput(input) {
  const form = input?.form;
  if (!form) return false;
  const cached = _searchInputCache.get(form);
  if (cached && cached !== input) _searchInputCache.delete(form);
  return findSearchInput(form) === input;
}

// 1.4.2 后续修复：可挂候选面板的输入框 = 表单搜索框 + 纯独立搜索框（ronka / collection 等无 form 站）。
// EC 的 vue-select（vs__search）维持纯自动转换，不挂候选面板（保持既有行为）。
function isSuggestibleInput(input) {
  if (isSearchInput(input)) return true;
  if (/vs__search/.test(String(input?.className || ''))) return false;
  return isStandaloneSearchInput(input);
}

function isSuggestionQuery(value) {
  const query = normalizeSearchQuery(value);
  return query.length >= SUGGEST_MIN_CHARS && /[\u3400-\u9fff]/u.test(query);
}

function ensureSuggestionStyle() {
  if (_suggestStyleReady || typeof document === 'undefined') return;
  const host = document.head || document.documentElement;
  if (!host?.appendChild || !document.createElement) return;
  const style = document.createElement('style');
  style.textContent = [
    '[data-zhx-chinese-suggest]{position:fixed;display:block;box-sizing:border-box;overflow:auto;margin:0;padding:4px;background:#fff;border:1px solid rgba(0,0,0,.16);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:2147483647;font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '[data-zhx-chinese-suggest][hidden]{display:none;}',
    '[data-zhx-chinese-suggest] button{display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;width:100%;min-height:40px;margin:0;padding:8px 10px;border:0;border-radius:6px;background:transparent;color:#222;text-align:left;cursor:pointer;}',
    '[data-zhx-chinese-suggest] button:hover,[data-zhx-chinese-suggest] button[data-active="1"]{background:#f0f2f5;}',
    '[data-zhx-chinese-suggest] .zhx-suggest-zh{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '[data-zhx-chinese-suggest] .zhx-suggest-native{margin-left:12px;overflow:hidden;color:#777;font-size:12px;text-overflow:ellipsis;white-space:nowrap;}',
    '[data-zhx-chinese-suggest] .zhx-suggest-empty{box-sizing:border-box;min-height:40px;padding:10px;color:#777;text-align:center;}',
  ].join('');
  host.appendChild(style);
  _suggestStyleReady = true;
}

function positionSuggestionBox(input) {
  if (!_suggestBox || _suggestBox.hidden || !input?.getBoundingClientRect) return;
  const rect = input.getBoundingClientRect();
  const gap = 4;
  const margin = 8;
  const viewportWidth = Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0;
  const viewportHeight = Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0;
  const width = Math.min(Math.max(rect.width, 180), Math.max(180, viewportWidth - margin * 2));
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportWidth - width - margin));
  const belowSpace = Math.max(0, viewportHeight - rect.bottom - gap - margin);
  const aboveSpace = Math.max(0, rect.top - gap - margin);
  const openBelow = belowSpace >= 120 || belowSpace >= aboveSpace;
  const available = openBelow ? belowSpace : aboveSpace;
  // 可视 8 行（行高 40px + 容器纵向 padding 8）：数据全量在列表内，超出部分滚轮翻看。
  const rowsHeight = SUGGEST_VISIBLE_ROWS * SUGGEST_ROW_HEIGHT + 8;
  const maxHeight = Math.max(80, Math.min(rowsHeight, available));
  let top = openBelow
    ? rect.bottom + gap
    : Math.max(margin, rect.top - gap - maxHeight);
  // 兜底：只要上方有足够空间，就不能让候选框仍落在输入框下方。
  // 这样可以避免异常/不完整的视口尺寸信息造成错误的展开方向。
  if (top >= rect.top && aboveSpace >= 120) {
    top = Math.max(margin, rect.top - gap - maxHeight);
  }
  _suggestBox.style.left = left + 'px';
  _suggestBox.style.top = top + 'px';
  _suggestBox.style.width = width + 'px';
  _suggestBox.style.maxHeight = maxHeight + 'px';
}

// 滚动/缩放时保持候选框（1.4.2 后续修复）：输入框仍在视口内 → 跟随重定位（保持打开）；
// 已滚出视口 → 关闭。滚动本身不再直接关闭候选框（无滚动条的候选框、滚到列表边界后
// 继续滚动会链式带动页面滚动——这些场景都不应让候选框消失）。
function syncSuggestionsOnScroll() {
  if (!_suggestBox || _suggestBox.hidden) return;
  const input = _suggestInput;
  if (!input || input.isConnected === false) {
    hideSuggestions(true);
    return;
  }
  const rect = input.getBoundingClientRect?.();
  if (!rect) {
    hideSuggestions(true);
    return;
  }
  const viewportWidth = Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0;
  const viewportHeight = Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0;
  const onScreen = rect.bottom > 0 && rect.top < viewportHeight && rect.right > 0 && rect.left < viewportWidth;
  if (!onScreen) {
    hideSuggestions(true);
    return;
  }
  positionSuggestionBox(input);
}

function hideSuggestions(clearInputState = false) {
  if (_suggestTimer) {
    clearTimeout(_suggestTimer);
    _suggestTimer = null;
  }
  if (_suggestHideTimer) {
    clearTimeout(_suggestHideTimer);
    _suggestHideTimer = null;
  }
  if (_suggestBox) _suggestBox.hidden = true;
  if (_suggestInput) {
    _suggestInput.setAttribute('aria-expanded', 'false');
    if (clearInputState) _suggestInput.removeAttribute('aria-activedescendant');
  }
  _suggestRows = [];
  _suggestActive = -1;
}

function scheduleSuggestions(input) {
  if (_suggestTimer) clearTimeout(_suggestTimer);
  _suggestTimer = setTimeout(() => {
    _suggestTimer = null;
    showSuggestions(input);
  }, SUGGEST_DEBOUNCE_MS);
}

function selectSuggestion(index) {
  const row = _suggestRows[index];
  if (!row || !_suggestInput) return;
  const input = _suggestInput;
  input.focus({ preventScroll: true });
  input.value = row.zh;
  hideSuggestions(true);
  try {
    input.setSelectionRange(input.value.length, input.value.length);
  } catch {
    /* 输入类型变化时忽略光标定位失败 */
  }
  // 独立搜索框（React 站点）：选中候选后自动转换为站点原生名，让站内搜索生效。
  if (isStandaloneSearchInput(input)) scheduleStandaloneConversion(input);
}

function updateSuggestionActive(index) {
  if (!_suggestBox) return;
  _suggestActive = index;
  const buttons = _suggestBox.querySelectorAll('button[data-zhx-index]');
  for (const button of buttons) {
    const active = Number(button.dataset.zhxIndex) === index;
    button.dataset.active = active ? '1' : '0';
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  const activeButton = buttons[index];
  if (activeButton) {
    activeButton.scrollIntoView({ block: 'nearest' });
    if (activeButton.id) _suggestInput?.setAttribute('aria-activedescendant', activeButton.id);
  } else {
    _suggestInput?.removeAttribute('aria-activedescendant');
  }
}

function showSuggestions(input) {
  if (!isSuggestibleInput(input) || !input.isConnected) {
    hideSuggestions(true);
    return;
  }
  const query = normalizeSearchQuery(input.value);
  // 在数据尚未就绪时也要记住当前输入框，数据 ready 回调才能补显示候选。
  _suggestInput = input;
  if (!isSuggestionQuery(query)) {
    hideSuggestions(true);
    return;
  }
  if (!_suggestDataReady) {
    hideSuggestions(true);
    return;
  }

  const rows = suggestByZh(query);   // 全量候选（显示所有含输入字的装备）；可视区域由列表高度控制

  ensureSuggestionStyle();
  if (!_suggestBox) {
    _suggestBox = document.createElement('div');
    _suggestBox.id = 'zhx-chinese-suggest-list';
    _suggestBox.dataset.zhxChineseSuggest = '';
    _suggestBox.setAttribute('role', 'listbox');
    (document.body || document.documentElement)?.appendChild(_suggestBox);
  }
  if (!_suggestBox) return;

  _suggestInput = input;
  _suggestRows = rows;
  _suggestActive = -1;
  _suggestBox.replaceChildren();

  if (!rows.length) {
    const message = document.createElement('div');
    message.className = 'zhx-suggest-empty';
    message.textContent = '未找到对应装备';
    message.setAttribute('role', 'status');
    _suggestBox.setAttribute('role', 'status');
    _suggestBox.appendChild(message);
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', _suggestBox.id);
    _suggestBox.hidden = false;
    positionSuggestionBox(input);
    return;
  }

  _suggestBox.setAttribute('role', 'listbox');
  rows.forEach((row, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'zhx-chinese-suggest-' + index;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');
    button.dataset.zhxIndex = String(index);
    const zh = document.createElement('span');
    zh.className = 'zhx-suggest-zh';
    zh.textContent = row.zh;
    const native = document.createElement('span');
    native.className = 'zhx-suggest-native';
    native.textContent = row.native;
    button.append(zh, native);
    _suggestBox.appendChild(button);
  });

  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', _suggestBox.id);
  _suggestBox.hidden = false;
  positionSuggestionBox(input);
}

function handleSearchInput(event) {
  const input = event.target;
  if (isSearchInput(input)) {
    if (_composingInputs.has(input)) return;
    scheduleSuggestions(input);
    return;
  }
  // 独立搜索框（无 form）：由 handleStandaloneSearchInput 调度（候选 + 自动转换），此处不清候选。
  if (isStandaloneSearchInput(input)) return;
  if (_suggestInput === input) hideSuggestions(true);
}

function handleSearchFocus(event) {
  const input = event.target;
  if (!isSuggestibleInput(input) || _composingInputs.has(input)) return;
  scheduleSuggestions(input);
}

function handleSearchBlur(event) {
  if (_suggestInput !== event.target) return;
  if (_suggestHideTimer) clearTimeout(_suggestHideTimer);
  const blurred = event.target;
  _suggestHideTimer = setTimeout(() => {
    _suggestHideTimer = null;
    // 1.4.2 后续修复：延迟内焦点可能已移到另一个搜索框（表单框 ↔ 独立框切换），
    // 仅当 _suggestInput 仍是被失焦的框时才隐藏，避免误藏新框的候选面板。
    if (_suggestInput === blurred) hideSuggestions(true);
  }, SUGGEST_HIDE_DELAY_MS);
}

function handleSearchKeydown(event) {
  if (_suggestInput !== event.target || !_suggestBox || _suggestBox.hidden || !_suggestRows.length) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    updateSuggestionActive((_suggestActive + 1) % _suggestRows.length);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    updateSuggestionActive((_suggestActive + _suggestRows.length - 1) % _suggestRows.length);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    hideSuggestions(true);
  } else if (event.key === 'Enter' && _suggestActive >= 0) {
    event.preventDefault();
    event.stopPropagation();
    selectSuggestion(_suggestActive);
  }
}

function handleSuggestionPointerDown(event) {
  const button = event.target?.closest?.('button[data-zhx-index]');
  if (!button || !_suggestBox?.contains(button)) return;
  event.preventDefault();
  selectSuggestion(Number(button.dataset.zhxIndex));
}

function handleCompositionStart(event) {
  const input = event.target;
  if (isSearchInput(input)) {
    _composingInputs.add(input);
    if (_suggestInput === input) hideSuggestions(true);
  }
}

function handleCompositionEnd(event) {
  const input = event.target;
  if (!isSearchInput(input)) return;
  _composingInputs.delete(input);
  scheduleSuggestions(input);
}

// ── 独立搜索框自动转换（1.4.2 后续修复）──
// ronka 等站点的搜索框不属于任何 form（React 客户端过滤、无提交事件可拦）；
// 输入停止后把完整中文装备名自动替换为站点原生名（React 兼容方式），让站内搜索照常工作。
const STANDALONE_SEARCH_HINT_RE = /검색어|키워드|キーワード|搜索|搜尋|検索|search|关键词|關鍵詞|keyword/i;
const STANDALONE_CONVERT_DELAY_MS = 650;
const STANDALONE_EXCLUDE_TYPES = new Set(['hidden', 'password', 'email', 'tel', 'url', 'number', 'date', 'datetime-local', 'month', 'week', 'time', 'color', 'range', 'file', 'checkbox', 'radio', 'button', 'submit', 'reset', 'image']);

let _standaloneTimer = null;
let _standaloneInput = null;

function isStandaloneSearchInput(input) {
  if (!input) return false;
  if (String(input.tagName || '').toUpperCase() !== 'INPUT') return false;
  const type = String(input.getAttribute?.('type') || '').toLowerCase();
  if (STANDALONE_EXCLUDE_TYPES.has(type)) return false;
  if (input.disabled || input.readOnly) return false;
  // 1.4.2 后续修复：vue-select 搜索输入框（EC 部位筛选器，如 "Any head"）——
  // 不依赖 form 归属：输入即触发站点装备检索（EC 实测 POST /gear/<slot>/search），
  // 与独立搜索框相同地做「中文全名 → 原生名」自动转换。
  if (/vs__search/.test(String(input.className || ''))) return true;
  if (input.form) return false;
  const meta = [
    input.getAttribute?.('placeholder'),
    input.getAttribute?.('aria-label'),
    input.getAttribute?.('name'),
    input.getAttribute?.('id'),
    input.getAttribute?.('title'),
  ].filter(Boolean).join(' ');
  return STANDALONE_SEARCH_HINT_RE.test(meta);
}

function rewriteInputNatively(input, native) {
  let applied = false;
  try {
    const descriptor = typeof HTMLInputElement !== 'undefined' && HTMLInputElement.prototype
      ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      : null;
    if (descriptor?.set) {
      descriptor.set.call(input, native);
      applied = input.value === native;
    }
  } catch { /* 回退：直接赋值 */ }
  if (!applied) {
    try {
      input.value = native;
      applied = input.value === native;
    } catch { /* 忽略 */ }
  }
  if (!applied) return false;
  try {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } catch { /* 事件派发失败不影响替换结果 */ }
  return true;
}

function scheduleStandaloneConversion(input) {
  if (_standaloneTimer) clearTimeout(_standaloneTimer);
  _standaloneInput = input;
  _standaloneTimer = setTimeout(() => {
    _standaloneTimer = null;
    const element = _standaloneInput;
    _standaloneInput = null;
    try {
      if (!element || element.isConnected === false) return;
      const query = normalizeSearchQuery(element.value);
      if (query.length < 2 || !isChineseSearchQuery(query)) return;
      const native = resolveByZh(query);
      if (!native || native === query) return;
      rewriteInputNatively(element, native);
    } catch { /* 静默：转换失败不影响用户输入 */ }
  }, STANDALONE_CONVERT_DELAY_MS);
}

function handleStandaloneSearchInput(event) {
  const input = event.target;
  if (isSearchInput(input)) return;
  if (isStandaloneSearchInput(input)) {
    scheduleStandaloneConversion(input);
    // 1.4.2 后续修复：独立搜索框也显示智能候选面板（ronka / collection 等站）。
    if (isSuggestibleInput(input)) scheduleSuggestions(input);
  }
}

function bindChineseSearchUi() {
  document.addEventListener('input', handleSearchInput, true);
  document.addEventListener('input', handleStandaloneSearchInput, true);
  document.addEventListener('focusin', handleSearchFocus, true);
  document.addEventListener('focusout', handleSearchBlur, true);
  document.addEventListener('keydown', handleSearchKeydown, true);
  document.addEventListener('compositionstart', handleCompositionStart, true);
  document.addEventListener('compositionend', handleCompositionEnd, true);
  document.addEventListener('pointerdown', handleSuggestionPointerDown, true);
  document.addEventListener('scroll', (event) => {
    // 列表自身滚动（滚轮翻看全部装备）无需处理；页面滚动只做同步——
    // 输入框仍在视口内则保持打开并跟随重定位，已滚出视口才关闭。
    if (_suggestBox && event.target && _suggestBox.contains(event.target)) return;
    syncSuggestionsOnScroll();
  }, true);
  globalThis.addEventListener?.('resize', () => syncSuggestionsOnScroll());
}

function handleChineseSearchSubmit(event, siteId) {
  if (!SEARCH_SITES[siteId]) return;
  const form = event.target;
  _searchInputCache.delete(form);
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
  bindChineseSearchUi();
  onTablesReady(() => {
    _suggestDataReady = true;
    if (_suggestInput?.isConnected && isSuggestionQuery(_suggestInput.value)) showSuggestions(_suggestInput);
  });
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
  positionSuggestionBox,
  searchInputScore,
  startChineseSearch,
};
