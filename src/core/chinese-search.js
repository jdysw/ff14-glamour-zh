/* @phase23-module-order:core/chinese-search */
/* @phase23-order-link:core/chinese-search<-core/data-manager */
import { onTablesReady, resolveByZh, resolvePartialByZh, suggestByZh } from './data-manager.js';
import { resolveECGearsetSearch, suggestECGearsetsByZh } from '../sites/eorzea-collection.js';

// 站点能力表：统一交互由 Core 调度；form 与 SPA 输入的提交路径各用原站行为。
const SEARCH_SITES = Object.freeze({
  mirapri: { vueSelect: false },
  fc: { vueSelect: false },
  ronka: { vueSelect: false },
  collection: { vueSelect: false },
  ec: { vueSelect: true },
  endcloset: { vueSelect: false },
});
let _activeSearchSiteId = null;

const SEARCH_EXCLUDE_RE = /author|player|title|comment|tag|username|email|password|作者|标题|标签|用户/i;
const SEARCH_INPUT_TYPES = new Set(['', 'text', 'search']);
const _searchInputCache = new WeakMap();

function normalizeSearchQuery(value) {
  return String(value ?? '').trim().replace(/[ \t\u00a0]+/g, ' ');
}

// 只有装备库列表页的查询可以按“套装系列 + 职能”映射。其它 EC 页面
// （如 /glamours、装备部位 vue-select）继续使用单件装备索引。
function isECGearsetsPage() {
  const loc = globalThis.location;
  return /^\/gearsets\/?$/.test(loc?.pathname || '')
    && /(^|\.)eorzeacollection\.com$/i.test(loc?.hostname || '');
}

function resolveSearchNative(query, gearsets = false) {
  if (gearsets) {
    const gearset = resolveECGearsetSearch(query);
    if (gearset) return gearset;
  }
  return resolveByZh(query) || resolvePartialByZh(query);
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
  // 其值不参与表单序列化，输入即触发站点检索；完全排除，交给独立搜索框路径处理。
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
const _convertedInputs = new WeakMap();
const _programmaticInputs = new WeakSet();
const _selectedSearchRows = new WeakMap();

function isSearchInput(input) {
  const form = input?.form;
  if (!form) return false;
  const cached = _searchInputCache.get(form);
  if (cached && cached !== input) _searchInputCache.delete(form);
  return findSearchInput(form) === input;
}

// 1.4.2 后续修复（b 方案）：可挂候选面板的输入框 = 表单搜索框 + 独立搜索框
// （ronka / collection 无 form 站，以及 EC vue-select 部位筛选器）。
// 输入停顿一律不自动转换；仅候选面板点选（转换式搜索）与表单提交（临时替换）时转换。
function isSuggestibleInput(input) {
  if (isSearchInput(input)) return true;
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
  _selectedSearchRows.set(input, row);
  hideSuggestions(true);
  try {
    input.setSelectionRange(input.value.length, input.value.length);
  } catch {
    /* 输入类型变化时忽略光标定位失败 */
  }
  // 独立搜索框（React 站点，b 方案）：选中候选后做「转换式搜索」——
  // 用原生名触发站内检索，随后输入框显示恢复为中文。
  // 两类控件遵循相同选择语义：选择候选就执行一次站内搜索。
  // 原站表单必须经过 requestSubmit（触发现有校验及捕获监听），不能调用 form.submit()。
  if (isStandaloneSearchInput(input)) convertStandaloneForSearch(input, false, row.native);
  else if (isSearchInput(input) && typeof input.form?.requestSubmit === 'function') {
    input.form.requestSubmit();
  }
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

  const rows = isECGearsetsPage() ? suggestECGearsetsByZh(query) : suggestByZh(query);

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
  if (!_programmaticInputs.has(input)) {
    _convertedInputs.delete(input);
    _selectedSearchRows.delete(input);
  }
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

function handleSuggestionKeydown(event) {
  if (_suggestInput !== event.target || !_suggestBox || _suggestBox.hidden || !_suggestRows.length) return false;
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
  } else return false;
  return true;
}

function handleSearchKeydown(event) {
  const input = event.target;
  if (event.isComposing || _composingInputs.has(input) || event.keyCode === 229) return;
  if (handleSuggestionKeydown(event)) return;
  // 显式搜索与候选点选使用同一转换链；保留原回车事件交给站点处理。
  if (event.key === 'Enter' && isStandaloneSearchInput(input) && convertStandaloneForSearch(input, true)) hideSuggestions(true);
}

function handleSuggestionPointerDown(event) {
  const button = event.target?.closest?.('button[data-zhx-index]');
  if (!button || !_suggestBox?.contains(button)) return;
  event.preventDefault();
  selectSuggestion(Number(button.dataset.zhxIndex));
}

function handleCompositionStart(event) {
  const input = event.target;
  if (isSuggestibleInput(input)) {
    _composingInputs.add(input);
    if (_suggestInput === input) hideSuggestions(true);
  }
}

function handleCompositionEnd(event) {
  const input = event.target;
  if (!isSuggestibleInput(input)) return;
  _composingInputs.delete(input);
  scheduleSuggestions(input);
}

// ── 独立搜索框（1.4.2 后续修复；b 方案）──
// ronka 等站点的搜索框不属于任何 form（React 客户端过滤、无提交事件可拦）；
// b 方案：打字期间不做任何自动转换；候选面板点选后做「转换式搜索」
//（用原生名触发站内检索，随后输入框显示恢复为中文，见 convertStandaloneForSearch）。
const STANDALONE_SEARCH_HINT_RE = /검색어|키워드|キーワード|搜索|搜尋|検索|search|关键词|關鍵詞|keyword/i;
const STANDALONE_EXCLUDE_TYPES = new Set(['hidden', 'password', 'email', 'tel', 'url', 'number', 'date', 'datetime-local', 'month', 'week', 'time', 'color', 'range', 'file', 'checkbox', 'radio', 'button', 'submit', 'reset', 'image']);

function isStandaloneSearchInput(input) {
  if (!input) return false;
  if (String(input.tagName || '').toUpperCase() !== 'INPUT') return false;
  const type = String(input.getAttribute?.('type') || '').toLowerCase();
  if (STANDALONE_EXCLUDE_TYPES.has(type)) return false;
  if (input.disabled || input.readOnly) return false;
  // 1.4.2 后续修复：vue-select 搜索输入框（EC 部位筛选器，如 "Any head"）——
  // 不依赖 form 归属：输入即触发站点装备检索（EC 实测 POST /gear/<slot>/search）；
  // b 方案后与独立搜索框统一：打字不转换，候选面板点选时做「转换式搜索」。
  if (/vs__search/.test(String(input.className || ''))) {
    return SEARCH_SITES[_activeSearchSiteId]?.vueSelect === true;
  }
  if (input.form) return false;
  const meta = [
    input.getAttribute?.('placeholder'),
    input.getAttribute?.('aria-label'),
    input.getAttribute?.('name'),
    input.getAttribute?.('id'),
    input.getAttribute?.('title'),
  ].filter(Boolean).join(' ');
  const field = [input.getAttribute?.('name'), input.getAttribute?.('id')].filter(Boolean).join(' ');
  if (SEARCH_EXCLUDE_RE.test(field) || /search by title|作者|用户名|评论|タイトル|プレイヤー|작성자/i.test(meta)) return false;
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
  _programmaticInputs.add(input);
  try {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } catch { /* 事件派发失败不影响替换结果 */ }
  finally { _programmaticInputs.delete(input); }
  return true;
}

// b 方案（2026-10-08）：点选候选后的「转换式搜索」——用原生名触发站点检索（派发 input），
// 随后把输入框显示恢复为中文（静默设值，不再派发事件；若站点已改写则不动）。
function convertStandaloneForSearch(input, allowPartial = false, selectedNative = null) {
  try {
    if (!input || input.isConnected === false || _composingInputs.has(input)) return false;
    const shown = input.value;
    const query = normalizeSearchQuery(shown);
    if (query.length < 2 || !isChineseSearchQuery(query)) return false;
    const native = selectedNative
      || (isECGearsetsPage() ? resolveECGearsetSearch(query) : null)
      || resolveByZh(query) || (allowPartial ? resolvePartialByZh(query) : null);
    if (!native || native === query) return false;
    if (!rewriteInputNatively(input, native)) return false;
    restoreStandaloneDisplay(input, shown, native);
    return true;
  } catch { return false; /* 转换失败时保留站点原有搜索行为 */ }
}

function restoreStandaloneDisplay(input, shown, native) {
  const token = {};
  _convertedInputs.set(input, token);
  // React 结果加载期间可能再次回写受控值；有限次恢复显示，用户继续输入即取消。
  for (const delay of [0, 100, 500, 1500, 3000]) {
    setTimeout(() => {
      if (_convertedInputs.get(input) !== token || input.isConnected === false) return;
      if (input.value === native) setInputValueSilently(input, shown);
      if (delay === 3000) _convertedInputs.delete(input);
    }, delay);
  }
}

// 从搜索按钮所在的最小容器查找独立搜索框，避免影响其他字段或候选按钮。
function findStandaloneTriggerInput(button) {
  let root = button.parentElement || button.parentNode;
  for (let depth = 0; root && depth < 8; depth++, root = root.parentElement || root.parentNode) {
    if (root === document.body || root === document.documentElement) return null;
    const inputs = [...(root.querySelectorAll?.('input') || [])].filter(isStandaloneSearchInput);
    if (_suggestInput && inputs.includes(_suggestInput)) return _suggestInput;
    if (inputs.length === 1) return inputs[0];
    if (inputs.length > 1 || root === document.body) return null;
  }
  return null;
}

function handleStandaloneSearchClick(event) {
  const button = event.target?.closest?.('button, input[type="submit"], [role="button"]');
  if (!button || button.disabled || _suggestBox?.contains(button)) return;
  const label = [button.textContent, button.getAttribute?.('title'), button.getAttribute?.('aria-label'), button.value]
    .filter(Boolean).join(' ').trim();
  if (/clear|reset|取消|重置|清空|初期化|초기화|지우기/i.test(label)) return;
  if (!/搜索|搜尋|查询|查找|검색|検索|\bsearch\b|필터\s*적용|应用筛选|適用|\bapply\b/i.test(label)) return;
  const input = findStandaloneTriggerInput(button);
  if (input && convertStandaloneForSearch(input, true)) hideSuggestions(true);
}

// 静默设值：更新输入框显示，但不派发 input 事件（避免二次触发站点检索）。
function setInputValueSilently(input, value) {
  try {
    const descriptor = typeof HTMLInputElement !== 'undefined' && HTMLInputElement.prototype
      ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      : null;
    if (descriptor?.set) {
      descriptor.set.call(input, value);
      if (input.value === value) return true;
    }
  } catch { /* 回退：直接赋值 */ }
  try {
    input.value = value;
    return input.value === value;
  } catch {
    return false;
  }
}

function handleStandaloneSearchInput(event) {
  const input = event.target;
  if (isSearchInput(input)) return;
  if (isStandaloneSearchInput(input)) {
    // b 方案（2026-10-08）：输入停顿不自动转换（禁止输入即搜索）；仅候选面板点选时转换。
    // 1.4.2 后续修复：独立搜索框也显示智能候选面板（ronka / collection / EC vue-select）。
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
  document.addEventListener('click', handleStandaloneSearchClick, true);
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

  const selected = _selectedSearchRows.get(input);
  const native = selected?.zh === query && selected.native
    ? selected.native
    : resolveSearchNative(query, siteId === 'ec' && isECGearsetsPage());
  _selectedSearchRows.delete(input);
  // 套装页优先系列/职能片段映射；其余站点仍以物品总表 + 公共子串兜底。
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
  _activeSearchSiteId = siteId;
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
  isECGearsetsPage,
  resolveSearchNative,
  positionSuggestionBox,
  searchInputScore,
  startChineseSearch,
};
