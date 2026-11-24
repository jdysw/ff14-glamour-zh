import * as searchData from './data/data-manager.js';
import { EC_ACCESSORY_SLOT_NATIVES } from './search-equipment-categories.js';
import { itemNames, miramiruLanguage, nativeLanguage } from './item-languages.js';
import { createSearchPanel, isSuggestionQuery } from './chinese-search-panel.js';
import { normalizeSearchQuery, isChineseSearchQuery, buildSearchUrl, submitNativeForm,
  createNativeOptionPicker, createSearchInputTransport } from './chinese-search-submit.js';

// Controlled inputs keep the native value. Ordinary standalone searches restore
// their Chinese display after passing the native value to the site.
const SEARCH_SITES = Object.freeze({
  mirapri: {},
  fc: {},
  ronka: {},
  collection: {},
  ec: { standaloneVue: true },
  endcloset: { identitySearch: true },
  eden: { standalone: input => input.dataset?.zhxEdenSearch === '1',
    keepNative: true, identitySearch: true },
  miramiru: { standalone: input => input.dataset?.zhxMiramiruSlot !== undefined,
    keepNative: true, standaloneOnly: true,
    results: {
      rootFor: input => input.parentElement,
      selector: '[role="option"]',
      controlFor: option => option.querySelector('button') || option,
    },
  },
});
const SEARCH_EXCLUDE_RE = /author|player|title|comment|tag|username|email|password|作者|标题|标签|用户/i;
const SEARCH_INPUT_TYPES = new Set(['', 'text', 'search']);
const _searchInputCache = new WeakMap();

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
  if (SEARCH_EXCLUDE_RE.test(meta)) return -Infinity; // 已排除字段不能进入兜底搜索框候选。
  let score = 0;
  if (/装備名(?:の一部)?を入力して検索|装備名.*検索|検索.*装備名/u.test(meta)) score += 120;
  if (/keyword/i.test(meta)) score += 100;
  if (/search/i.test(meta)) score += 80;
  // EC 主搜索框在正式汉化后占位符变成「搜索」，name/id 均可能为空。
  // 提交表单时必须为该输入框赋予与英文 Search 相同的识别优先级。
  if (/搜索|搜尋|检索|檢索/u.test(meta)) score += 80;
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


export function createChineseSearchController(data = searchData) {
  const { onTablesReady, resolveByZh, resolveByName, resolvePartialByZh, suggestByZh,
    dataGetIndex, hasItemIdentities, itemById, findItemsByName } = data;
  let _activeSearchSiteId = null;
  let searchStrategy;
  let policy = {};
  const catalogPage = () => searchStrategy?.isCatalogPage() ?? false;
  const submitSpecialSearch = (input, native) => searchStrategy?.submit(input, native) ?? false;

  function miramiruScopedSuggestions(query, input) {
    const key = input.dataset.zhxMiramiruSlot;
    const slot = EC_ACCESSORY_SLOT_NATIVES[key] || Number(key);
    const rows = new Map();
    const language = controlSearchLanguage(input);
    if (hasItemIdentities()) return suggestByZh(query, 0, slot, language);
    for (const row of suggestByZh(query, 0, slot)) {
      const zh = resolveByName(row.native) || row.zh;
      const native = itemNames(zh)[language];
      if (native && !rows.has(native)) rows.set(native, { zh, native });
    }
    return [...rows.values()];
  }

  const SEARCH_LANGUAGES = { fc: 'ja', mirapri: 'ja', collection: 'ja', ec: 'en', ronka: 'ko', eden: 'ja' };
  function searchLanguage(value) {
    const lang = String(value || '').replaceAll('"', '').toLowerCase().split(/[-_]/)[0];
    return ['en', 'ja', 'ko'].includes(lang) ? lang : null;
  }

  function controlSearchLanguage(input, site = _activeSearchSiteId) {
    const explicit = searchLanguage(input?.dataset?.searchLanguage || input?.getAttribute?.('lang'));
    if (explicit) return explicit;
    if (site === 'miramiru') return miramiruLanguage();
    if (site === 'endcloset') {
      let saved;
      try { saved = globalThis.localStorage?.getItem('language'); } catch { /* storage can be disabled */ }
      return searchLanguage(saved) || searchLanguage(document.documentElement?.lang) || 'ko';
    }
    if (site === 'eden' && input?.dataset?.zhxEdenMaker === '1') {
      const label = document.querySelector('#equipment-view h6[data-zhx-eden-native]')?.dataset.zhxEdenNative;
      if (label) {
        const matches = ['ja', 'en', 'ko'].filter(lang => findItemsByName(label, lang).length);
        if (matches.length === 1) return matches[0];
        return nativeLanguage(label);
      }
    }
    return SEARCH_LANGUAGES[site] || null;
  }

  function chosenNative(row, input, site) {
    return row?.itemId ? itemById(row.itemId)?.names[controlSearchLanguage(input, site)] || null : row?.native;
  }

  function fcArmorSlot(input) {
    if (_activeSearchSiteId !== 'fc' || input?.name !== '_sf_search[]') return null;
    const path = globalThis.location?.pathname || '';
    const part = /^\/equipment_search_parts\/equipment_search_(head|body|hand|leg|foot)\/?$/.exec(path)?.[1];
    return part ? ['head', 'body', 'hand', 'leg', 'foot'].indexOf(part) : null;
  }

  function suggestionsFor(query, input) {
    if (_activeSearchSiteId === 'miramiru') return miramiruScopedSuggestions(query, input);
    const language = controlSearchLanguage(input);
    const fcSlot = fcArmorSlot(input);
    if (fcSlot !== null) return suggestByZh(query, 0, fcSlot, language);
    return searchStrategy?.suggestScoped(query, input, language, suggestByZh)
      ?? suggestByZh(query, 0, null, language);
  }

  // Only an exact or a single unambiguous in-category name can be converted
  // without choosing the explicit suggestion.
  function scopedNative(query, input, allowPartial) {
    const rows = suggestionsFor(query, input);
    const exact = rows.filter(row => row.zh === query);
    if (exact.length === 1) return exact[0].native;
    return allowPartial && rows.length === 1 ? rows[0].native : null;
  }

  function multiwordSearchRows(query, input) {
    return isChineseSearchQuery(query) && /\s/u.test(query.trim())
      ? new Set(suggestionsFor(query, input).map(row => row.native)) : null;
  }

  function requireMultiwordSelection(event, input) {
    const query = normalizeSearchQuery(input.value);
    if (_composingInputs.has(input) || _selectedSearchRows.get(input)?.zh === query) return false;
    const rows = multiwordSearchRows(query, input);
    const variants = hasItemIdentities() ? suggestionsFor(query, input)
      .filter(row => row.itemId && (rows || row.zh === query)) : [];
    if ((!rows || rows.size < 2) && new Set(variants.map(row => row.itemId)).size < 2) return false;
    event.preventDefault();
    event.stopPropagation();
    input.focus?.({ preventScroll: true });
    panel.hide();
    panel.show(input, true);
    return true;
  }

  function resolveSearchNative(query, gearsets = false) {
    if (gearsets) {
      const gearset = searchStrategy?.resolveCatalog(query);
      if (gearset) return gearset;
      // 多个套装命中却没有安全的英文公共词时，交给候选列表选择；
      // 不能回退到无关的单件物品索引，随意改写用户的套装查询。
      if (searchStrategy?.suggestCatalog(query).length > 0) return null;
    }
    return resolveByZh(query) || resolvePartialByZh(query);
  }

  const _composingInputs = new WeakSet();
  const _selectedSearchRows = new WeakMap();
  const nativePick = createNativeOptionPicker();
  const inputTransport = createSearchInputTransport();
  let suggestDataReady = false;

  function isSearchInput(input) {
    if (policy.standaloneOnly) return false;
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

  function nativeKeyboard(input) {
    return searchStrategy?.ownsKeyboard(input) ?? false;
  }

  function commitSuggestion(input, row) {
    const native = chosenNative(row, input);
    if (!native) return false;
    if (native !== row.native) row = { ...row, native };
    input.focus({ preventScroll: true });
    // EC's vue-select owns the input's value. Never write a temporary Chinese
    // label into this controlled field; it can race the component's own v-model
    // updates and make subsequent typing appear to be ignored/reset.
    if (!nativeKeyboard(input)) input.value = row.zh;
    _selectedSearchRows.set(input, row);
    panel.dismiss();
    try {
      input.setSelectionRange(input.value.length, input.value.length);
    } catch {
      /* 输入类型变化时忽略光标定位失败 */
    }
    // 独立搜索框（React 站点，b 方案）：选中候选后做「转换式搜索」——
    // 用原生名触发站内检索，随后输入框显示恢复为中文。
    // 两类控件遵循相同选择语义：选择候选就执行一次站内搜索。
    // EC Gearsets 候选点击必须使用原站 GET 检索，不能仅派发 input 事件；
    // 站点的动态组件可能在事件后重新写入中文，导致结果恒为空。
    if (submitSpecialSearch(input, row.native)) return true;
    // EC vue-select needs an actual native-option selection, not merely an
    // input event that leaves the dropdown waiting for a second click.
    if (nativeKeyboard(input) || policy.results) {
      const attempt = armNativePick(input, row);
      if (!convertStandaloneForSearch(input, false, row.native)) nativePick.cancel();
      else attempt?.();
      return true;
    }
    // 原站表单必须经过 requestSubmit（触发现有校验及捕获监听），不能调用 form.submit()。
    if (isStandaloneSearchInput(input)) convertStandaloneForSearch(input, false, row.native);
    else if (isSearchInput(input) && typeof input.form?.requestSubmit === 'function') {
      input.form.requestSubmit();
    }
    return true;
  }

  function handleSearchInput(event) {
    const input = event.target;
    // Programmatic native-name input is part of the pending EC selection;
    // a real subsequent keystroke cancels it before a late XHR response.
    if (nativePick.input === input && !inputTransport.isProgrammatic(input)) {
      nativePick.cancel();
    }
    if (!inputTransport.isProgrammatic(input)) {
      inputTransport.clearDisplayRestore(input);
      _selectedSearchRows.delete(input);
    }
    if (isSuggestibleInput(input)) {
      if (!_composingInputs.has(input)) panel.schedule(input);
    } else if (panel.input === input) panel.hide();
  }

  function handleSearchFocus(event) {
    const input = event.target;
    if (nativePick.input && nativePick.input !== input) nativePick.cancel();
    if (!isSuggestibleInput(input)) { panel.dismiss(); return; }
    if (_composingInputs.has(input)) return;
    panel.schedule(input);
  }

  function handleSearchKeydown(event) {
    const input = event.target;
    if (event.isComposing || _composingInputs.has(input) || event.keyCode === 229) return;
    if (panel.handleKeydown(event)) return;
    if (event.key !== 'Enter') return;
    if (isSuggestibleInput(input) && requireMultiwordSelection(event, input)) return;
    // Gearsets 的 search GET 参数是网站的查询入口；按回车时立即导航，
    // 而不是向可能有异步状态的前端组件派发临时原生名 input。
    if (submitSpecialSearch(input)) {
      event.preventDefault();
      event.stopPropagation();
      panel.hide();
      return;
    }
    // 其他站点显式搜索保留原站回车事件。
    if (isStandaloneSearchInput(input) && convertStandaloneForSearch(input, true)) panel.hide();
  }

  // Only the custom option is intercepted; clicks elsewhere dismiss our UI
  // without canceling any site-native pointer handlers (including EC vue-select).
  function handleSearchPointerDown(event) {
    if (nativePick.root && event.target && !nativePick.root.contains(event.target)) nativePick.cancel();
    panel.handlePointerDown(event);
  }

  function handleCompositionStart(event) {
    const input = event.target;
    if (isSuggestibleInput(input)) {
      _composingInputs.add(input);
      if (panel.input === input) panel.hide();
    }
  }

  function handleCompositionEnd(event) {
    const input = event.target;
    if (!isSuggestibleInput(input)) return;
    _composingInputs.delete(input);
    panel.schedule(input);
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
    if (policy.standalone) return policy.standalone(input);
    // 1.4.2 后续修复：vue-select 搜索输入框（EC 部位筛选器，如 "Any head"）——
    // 不依赖 form 归属：输入即触发站点装备检索（EC 实测 POST /gear/<slot>/search）；
    // b 方案后与独立搜索框统一：打字不转换，候选面板点选时做「转换式搜索」。
    if (/vs__search/.test(String(input.className || ''))) {
      return policy.standaloneVue === true;
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

  // b 方案（2026-10-08）：点选候选后的「转换式搜索」——用原生名触发站点检索（派发 input），
  // 随后把输入框显示恢复为中文（静默设值，不再派发事件；若站点已改写则不动）。
  function edenMakerNative(input, native) {
    if (_activeSearchSiteId !== 'eden' || input.dataset?.zhxEdenMaker !== '1') return native;
    const shown = document.querySelector('#equipment-view h6[data-zhx-eden-native]')?.dataset.zhxEdenNative || '';
    // 站点制作器可能显示英文装备，而首页固定按日文检索。
    if (!/[a-z]/i.test(shown) || /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(shown)) return native;
    const names = dataGetIndex('nameMap');
    const zh = names?.[native];
    if (!zh) return native;
    for (const key in names) {
      if (names[key] === zh && /[a-z]/i.test(key) && !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(key)) return key;
    }
    return native;
  }

  function identityOnlyNative(input, query, allowPartial) {
    const rows = suggestionsFor(query, input);
    const exact = rows.filter(row => row.zh === query);
    if (exact.length === 1) return exact[0].native;
    if (!exact.length && allowPartial && rows.length === 1) return rows[0].native;
    return null;
  }

  function commitEdenMakerCandidate(input, selectedNative) {
    if (_activeSearchSiteId !== 'eden' || !selectedNative || input.dataset?.zhxEdenMaker !== '1') return;
    // Vuetify combobox 以回车提交选中值；候选点击需走同一原生事件。
    queueMicrotask(() => {
      if (input.isConnected) input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));
    });
  }

  function miramiruStandaloneNative(input, query, allowPartial, selectedNative) {
    const rows = suggestionsFor(query, input);
    const selected = _selectedSearchRows.get(input);
    const matching = rows.filter(row => selectedNative
      ? row.native === selectedNative && (!selected?.itemId || selected.itemId === row.itemId)
      : row.zh === query);
    let row = null;
    if (matching.length === 1) row = matching[0];
    else if (!selectedNative && allowPartial && rows.length === 1) row = rows[0];
    if (!row) return null;
    if (!nativePick.input) armNativePick(input, row);
    return row.native;
  }

  function identityStandaloneNative(input, query, allowPartial, selectedNative) {
    if (selectedNative) return chosenNative(_selectedSearchRows.get(input), input) || selectedNative;
    const rows = multiwordSearchRows(query, input);
    if (rows) return rows.size === 1 ? rows.values().next().value : null;
    return identityOnlyNative(input, query, allowPartial);
  }

  function legacyStandaloneNative(input, query, allowPartial) {
    if (searchStrategy?.context(input)) return scopedNative(query, input, allowPartial);
    const gearset = catalogPage() ? searchStrategy?.resolveCatalog(query) : null;
    return gearset || resolveByZh(query) || (allowPartial ? resolvePartialByZh(query) : null);
  }

  function standaloneNative(input, query, allowPartial, selectedNative) {
    if (hasItemIdentities() && policy.identitySearch)
      return identityStandaloneNative(input, query, allowPartial, selectedNative);
    const rows = selectedNative ? null : multiwordSearchRows(query, input);
    if (rows && rows.size !== 1) return null;
    if (_activeSearchSiteId === 'miramiru') return miramiruStandaloneNative(input, query, allowPartial, selectedNative);
    const native = selectedNative || rows?.values().next().value || legacyStandaloneNative(input, query, allowPartial);
    return edenMakerNative(input, native);
  }

  function commitStandaloneNative(input, native, selectedNative, shown) {
    if (!inputTransport.rewrite(input, native)) return false;
    commitEdenMakerCandidate(input, selectedNative);
    if (policy.results) nativePick.attempt();
    // Restoring display on a controlled field can desynchronize the site's model.
    if (!nativeKeyboard(input) && !policy.keepNative) inputTransport.restore(input, shown, native);
    return true;
  }

  function convertStandaloneForSearch(input, allowPartial = false, selectedNative = null) {
    try {
      if (!input || input.isConnected === false || _composingInputs.has(input)) return false;
      const shown = input.value;
      const query = normalizeSearchQuery(shown);
      if (query.length < 2 || !isChineseSearchQuery(query)) return false;
      const native = standaloneNative(input, query, allowPartial, selectedNative);
      if (!native || native === query) return false;
      return commitStandaloneNative(input, native, selectedNative, shown);
    } catch { return false; /* 转换失败时保留站点原有搜索行为 */ }
  }

  function findStandaloneTriggerInput(button) {
    let root = button.parentElement || button.parentNode;
    for (let depth = 0; root && depth < 8; depth++, root = root.parentElement || root.parentNode) {
      if (root === document.body || root === document.documentElement) return null;
      const inputs = [...(root.querySelectorAll?.('input') || [])].filter(isStandaloneSearchInput);
      if (panel.input && inputs.includes(panel.input)) return panel.input;
      if (inputs.length === 1) return inputs[0];
      if (inputs.length > 1 || root === document.body) return null;
    }
    return null;
  }

  function handleStandaloneSearchClick(event) {
    const button = event.target?.closest?.('button, input[type="submit"], [role="button"]');
    if (!button || button.disabled || panel.contains(button)) return;
    const label = [button.textContent, button.getAttribute?.('title'), button.getAttribute?.('aria-label'), button.value]
      .filter(Boolean).join(' ').trim();
    if (/clear|reset|取消|重置|清空|初期化|초기화|지우기/i.test(label)) return;
    if (!/搜索|搜尋|查询|查找|검색|検索|\bsearch\b|필터\s*적용|应用筛选|適用|\bapply\b/i.test(label)) return;
    const input = findStandaloneTriggerInput(button);
    if (!input || _composingInputs.has(input) || requireMultiwordSelection(event, input)) return;
    if (submitSpecialSearch(input)) {
      event.preventDefault();
      event.stopPropagation();
      panel.hide();
      return;
    }
    if (convertStandaloneForSearch(input, true)) panel.hide();
  }

  function armNativePick(input, row) {
    const options = policy.results ?? searchStrategy?.nativeOptions;
    return options ? nativePick.arm(input, row, options) : null;
  }
  const panel = createSearchPanel({
    accepts: isSuggestibleInput,
    canShow: input => _activeSearchSiteId !== 'miramiru' || document.activeElement === input,
    // The local catalogue and bundled facewear data don't depend on the V3 item index.
    canSuggest: input => suggestDataReady || catalogPage() || searchStrategy?.context(input)?.kind === 'facewear',
    suggest: suggestionsFor,
    labels: input => ({
      empty: catalogPage() ? '未找到对应套装' : '未找到对应装备',
      ambiguous: searchStrategy?.isCatalogInput(input)
        ? '匹配到多套套装，请选择一项后搜索。'
        : '匹配到多件装备，请选择一项后搜索。',
    }),
    // Radix modal drawers disable pointer events outside their own portal.
    hostFor: input => _activeSearchSiteId === 'miramiru' ? input.closest('[role="dialog"]') : null,
    nativeKeyboard,
    commit: commitSuggestion,
  });

  function bindChineseSearchUi() {
    document.addEventListener('input', handleSearchInput, true);
    document.addEventListener('focusin', handleSearchFocus, true);
    document.addEventListener('keydown', handleSearchKeydown, true);
    document.addEventListener('compositionstart', handleCompositionStart, true);
    document.addEventListener('compositionend', handleCompositionEnd, true);
    document.addEventListener('pointerdown', handleSearchPointerDown, true);
    document.addEventListener('click', handleStandaloneSearchClick, true);

    panel.bind();
  }

  // EC Gearsets 原生路由提交单独处理，避免与其它站点的 GET/POST 表单分支
  // 交叉嵌套；成功时消费事件，失败时由既有站点提交链处理。
  function handleSpecialFormSubmit(event, input, query, selected) {
    const native = selected?.zh === query ? selected.native : null;
    if (!submitSpecialSearch(input, native)) return false;
    _selectedSearchRows.delete(input);
    event.preventDefault();
    event.stopPropagation();
    panel.hide();
    return true;
  }

  function identityFormNative(query, siteId, input) {
    if (!hasItemIdentities()) return undefined;
    const matches = suggestionsFor(query, input).filter(row => row.itemId && row.zh === query);
    if (matches.length) return matches.length === 1 ? matches[0].native : null;
    if (siteId === 'endcloset') return identityOnlyNative(input, query, true);
    return undefined;
  }

  function nativeForSubmittedSearch(query, siteId, input, selected) {
    if (selected?.zh === query && selected.native) return chosenNative(selected, input, siteId);
    const rows = multiwordSearchRows(query, input);
    if (rows) return rows.size === 1 ? rows.values().next().value : null;
    if (fcArmorSlot(input) !== null || (siteId === 'ec' && searchStrategy?.context(input)))
      return scopedNative(query, input, true);
    const identity = identityFormNative(query, siteId, input);
    if (identity !== undefined) return identity;
    return resolveSearchNative(query, siteId === 'ec' && catalogPage());
  }

  function handleChineseSearchSubmit(event, siteId) {
    if (!SEARCH_SITES[siteId]) return;
    const form = event.target;
    _searchInputCache.delete(form);
    const input = findSearchInput(form);
    if (!input || _composingInputs.has(input)) return;

    const query = normalizeSearchQuery(input.value);
    if (!isChineseSearchQuery(query)) return;

    const selected = _selectedSearchRows.get(input);
    if (requireMultiwordSelection(event, input)) return;
    if (siteId === _activeSearchSiteId && handleSpecialFormSubmit(event, input, query, selected)) return;
    const native = nativeForSubmittedSearch(query, siteId, input, selected);
    _selectedSearchRows.delete(input);
    // 套装页优先系列/职能片段映射；其余站点仍以物品总表 + 公共子串兜底。
    if (!native || native === query) return;

    submitNativeForm(event, form, input, native);
  }

  function startChineseSearch(siteId, strategy) {
    if (!SEARCH_SITES[siteId]) return;
    _activeSearchSiteId = siteId;
    policy = SEARCH_SITES[siteId];
    searchStrategy = strategy;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    if (globalThis.__zhxChineseSearchBound) return;
    globalThis.__zhxChineseSearchBound = true;
    bindChineseSearchUi();
    onTablesReady(() => {
      suggestDataReady = true;
      if (panel.input?.isConnected && isSuggestionQuery(panel.input.value)) panel.show(panel.input);
    });
    document.addEventListener('submit', (event) => {
      try {
        handleChineseSearchSubmit(event, siteId);
      } catch (error) {
        console.warn('[zhx] 中文装备搜索失败', error);
      }
    }, true);
  }

  return { startChineseSearch, handleChineseSearchSubmit, suggestionsFor, scopedNative,
    resolveSearchNative, isStandaloneSearchInput };
}

const { startChineseSearch, handleChineseSearchSubmit } = createChineseSearchController();

export {
  buildSearchUrl, findSearchInput, handleChineseSearchSubmit, isChineseSearchQuery,
  normalizeSearchQuery, searchInputScore, startChineseSearch,
};
