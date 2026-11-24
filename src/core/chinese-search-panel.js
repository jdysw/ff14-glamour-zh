import { normalizeSearchQuery, isChineseSearchQuery } from './chinese-search-submit.js';

export function isSuggestionQuery(value) {
  return normalizeSearchQuery(value).length >= 2 && isChineseSearchQuery(value);
}

// 候选列表可视行数：数据全量渲染（显示所有含输入字的装备），
// 列表高度限 8 行，超出的通过滚轮在列表内滑动翻看。
const SUGGEST_VISIBLE_ROWS = 8;
const SUGGEST_ROW_HEIGHT = 44;   // 触摸目标不少于 44px，与 CSS 对齐
const SUGGEST_RENDER_BATCH = 80;  // 首批至多 80 行，滚动接近底部时渐进追加
const SUGGEST_DEBOUNCE_MS = 70;
const SUGGEST_HIDE_DELAY_MS = 120;

// The caller provides results and commits; the panel owns all transient list state.
export function createSearchPanel({ accepts, canShow, canSuggest, suggest, labels, hostFor, nativeKeyboard, commit }) {
  let _suggestBox = null;
  let _suggestInput = null;
  let _suggestRows = [];
  let _suggestRendered = 0;
  let _suggestActive = -1;
  let _suggestTimer = null;
  let _suggestHideTimer = null;
  let _suggestStyleReady = false;
  let renderedSuggestionQuery = '';

  function ensureSuggestionStyle() {
    if (_suggestStyleReady || typeof document === 'undefined') return;
    const host = document.head || document.documentElement;
    if (!host?.appendChild || !document.createElement) return;
    const style = document.createElement('style');
    style.textContent = [
      '[data-zhx-chinese-suggest]{position:fixed;display:block;box-sizing:border-box;overflow:auto;margin:0;padding:4px;background:#fff;border:1px solid rgba(0,0,0,.16);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:2147483647;font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      '[data-zhx-chinese-suggest][hidden]{display:none;}',
      '[data-zhx-chinese-suggest] button{display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;width:100%;min-height:44px;margin:0;padding:10px 10px;border:0;border-radius:6px;background:transparent;color:#222;text-align:left;cursor:pointer;}',
      '[data-zhx-chinese-suggest] button:hover,[data-zhx-chinese-suggest] button[data-active="1"]{background:#f0f2f5;}',
      '[data-zhx-chinese-suggest] .zhx-suggest-zh{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '[data-zhx-chinese-suggest] .zhx-suggest-native{margin-left:12px;overflow:hidden;color:#777;font-size:12px;text-overflow:ellipsis;white-space:nowrap;}',
      '[data-zhx-chinese-suggest] .zhx-suggest-empty{box-sizing:border-box;min-height:40px;padding:10px;color:#777;text-align:center;}',
      '[data-zhx-chinese-suggest] .zhx-suggest-hint{padding:8px 10px;color:#444;border-bottom:1px solid #eee;}',
    ].join('');
    host.appendChild(style);
    _suggestStyleReady = true;
  }

  function positionSuggestionBox(input) {
    if (!_suggestBox || _suggestBox.hidden || !input?.getBoundingClientRect) return;
    const rect = input.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    // 手机软键盘会缩小 visualViewport，但不一定同步更新 innerHeight。
    const view = globalThis.visualViewport;
    const viewportWidth = Number(view?.width) || Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0;
    const viewportHeight = Number(view?.height) || Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0;
    const viewLeft = Number(view?.offsetLeft) || 0;
    const viewTop = Number(view?.offsetTop) || 0;
    const roomWidth = Math.max(0, viewportWidth - margin * 2);
    const width = Math.min(Math.max(rect.width, 180), roomWidth);
    const left = Math.min(Math.max(viewLeft + margin, rect.left), viewLeft + Math.max(margin, viewportWidth - width - margin));
    const belowSpace = Math.max(0, viewTop + viewportHeight - rect.bottom - gap - margin);
    const aboveSpace = Math.max(0, rect.top - viewTop - gap - margin);
    const openBelow = belowSpace >= SUGGEST_ROW_HEIGHT * 2 || belowSpace >= aboveSpace;
    const available = openBelow ? belowSpace : aboveSpace;
    const rowsHeight = SUGGEST_VISIBLE_ROWS * SUGGEST_ROW_HEIGHT + 8;
    const maxHeight = Math.max(0, Math.min(rowsHeight, available));
    const top = openBelow ? rect.bottom + gap : Math.max(viewTop + margin, rect.top - gap - maxHeight);
    _suggestBox.style.left = left + 'px';
    _suggestBox.style.top = top + 'px';
    _suggestBox.style.width = width + 'px';
    _suggestBox.style.maxHeight = maxHeight + 'px';
    const portal = _suggestBox.parentElement;
    if (portal?.getAttribute('role') === 'dialog') {
      const style = getComputedStyle(portal);
      if (style.transform !== 'none' || (style.translate && style.translate !== 'none')) {
        const origin = portal.getBoundingClientRect();
        _suggestBox.style.left = (left - origin.left - portal.clientLeft + portal.scrollLeft) + 'px';
        _suggestBox.style.top = (top - origin.top - portal.clientTop + portal.scrollTop) + 'px';
      }
    }
  }

  // 滚动/缩放时保持候选框（1.4.2 后续修复）：输入框仍在视口内 → 跟随重定位（保持打开）；
  // 已滚出视口 → 关闭。滚动本身不再直接关闭候选框（无滚动条的候选框、滚到列表边界后
  // 继续滚动会链式带动页面滚动——这些场景都不应让候选框消失）。
  function syncSuggestionsOnScroll() {
    if (!_suggestBox || _suggestBox.hidden) return;
    const input = _suggestInput;
    if (!input || input.isConnected === false) {
      hideSuggestions();
      return;
    }
    const rect = input.getBoundingClientRect?.();
    if (!rect) {
      hideSuggestions();
      return;
    }
    const view = globalThis.visualViewport;
    const width = Number(view?.width) || Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0;
    const height = Number(view?.height) || Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0;
    const left = Number(view?.offsetLeft) || 0;
    const top = Number(view?.offsetTop) || 0;
    const onScreen = rect.bottom > top && rect.top < top + height && rect.right > left && rect.left < left + width;
    if (!onScreen) {
      hideSuggestions();
      return;
    }
    positionSuggestionBox(input);
  }

  function hideSuggestions() {
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
      _suggestInput.removeAttribute('aria-activedescendant');
    }
    _suggestRows = [];
    _suggestRendered = 0;
    _suggestActive = -1;
  }

  // Explicit dismissal prevents a pending V3 ready callback reopening stale UI.
  function dismissSuggestions() {
    hideSuggestions();
    _suggestInput = null;
  }

  function scheduleSuggestions(input) {
    if (_suggestTimer) clearTimeout(_suggestTimer);
    _suggestTimer = setTimeout(() => {
      _suggestTimer = null;
      showSuggestions(input);
    }, SUGGEST_DEBOUNCE_MS);
  }

  function appendSuggestionBatch() {
    if (!_suggestBox || !_suggestRows.length) return;
    const end = Math.min(_suggestRows.length, _suggestRendered + SUGGEST_RENDER_BATCH);
    for (let index = _suggestRendered; index < end; index++) {
      const row = _suggestRows[index];
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'zhx-chinese-suggest-' + index;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', 'false');
      button.dataset.zhxIndex = String(index);
      if (row.itemId) {
        button.dataset.zhxItemId = String(row.itemId);
        button.title = '物品 ID ' + row.itemId;
      }
      const zh = document.createElement('span');
      zh.className = 'zhx-suggest-zh';
      zh.textContent = row.zh;
      const native = document.createElement('span');
      native.className = 'zhx-suggest-native';
      let statusSuffix = '';
      if (row.provisional) statusSuffix = ' · EC 结果待确认';
      else if (row.descriptive) statusSuffix = ' · 描述性译名';
      native.textContent = row.native + statusSuffix;
      button.append(zh, native);
      _suggestBox.appendChild(button);
    }
    _suggestRendered = end;
  }

  function updateSuggestionActive(index) {
    if (!_suggestBox) return;
    _suggestActive = index;
    while (index >= _suggestRendered && _suggestRendered < _suggestRows.length) appendSuggestionBatch();
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

  function appendSelectionHint(input) {
    const hint = document.createElement('div');
    hint.className = 'zhx-suggest-hint';
    hint.setAttribute('role', 'status');
    hint.textContent = labels(input).ambiguous;
    _suggestBox.appendChild(hint);
  }

  function showSuggestions(input, needsSelection = false) {
    if (!canShow(input)) { dismissSuggestions(); return; }
    if (!accepts(input) || !input.isConnected) {
      hideSuggestions();
      return;
    }
    const query = normalizeSearchQuery(input.value);
    // 在数据尚未就绪时也要记住当前输入框，数据 ready 回调才能补显示候选。
    _suggestInput = input;
    if (!isSuggestionQuery(query)) {
      hideSuggestions();
      return;
    }
    if (!canSuggest(input)) {
      hideSuggestions();
      return;
    }

    const seen = new Set();
    const rows = suggest(query, input).filter(row => {
      const key = row.itemId ?? row.native;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    ensureSuggestionStyle();
    if (!_suggestBox) {
      _suggestBox = document.createElement('div');
      _suggestBox.id = 'zhx-chinese-suggest-list';
      _suggestBox.dataset.zhxChineseSuggest = '';
      _suggestBox.setAttribute('role', 'listbox');
    }
    if (!_suggestBox) return;
    // Radix modal drawers disable pointer events outside their own portal.
    // Keep suggestions inside the native dialog so real clicks and focus work.
    const host = hostFor(input) || document.body || document.documentElement;
    if (_suggestBox.parentElement !== host) host.appendChild(_suggestBox);
    _suggestBox.style.pointerEvents = 'auto';

    _suggestInput = input;
    _suggestRows = rows;
    renderedSuggestionQuery = query;
    _suggestRendered = 0;
    _suggestActive = -1;
    _suggestBox.replaceChildren();

    if (!rows.length) {
      const message = document.createElement('div');
      message.className = 'zhx-suggest-empty';
      message.textContent = labels(input).empty;
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
    if (needsSelection) appendSelectionHint(input);
    appendSuggestionBatch();

    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', _suggestBox.id);
    _suggestBox.hidden = false;
    positionSuggestionBox(input);
  }

  function handleSearchBlur(event) {
    if (_suggestInput !== event.target) return;
    if (_suggestHideTimer) clearTimeout(_suggestHideTimer);
    const blurred = event.target;
    _suggestHideTimer = setTimeout(() => {
      _suggestHideTimer = null;
      // 1.4.2 后续修复：延迟内焦点可能已移到另一个搜索框（表单框 ↔ 独立框切换），
      // 仅当 _suggestInput 仍是被失焦的框时才隐藏，避免误藏新框的候选面板。
      if (_suggestInput === blurred) dismissSuggestions();
    }, SUGGEST_HIDE_DELAY_MS);
  }

  function handleSuggestionKeydown(event) {
    // The native widget may own its keyboard navigation. Our panel remains pointer-selectable.
    if (nativeKeyboard(event.target)) return false;
    if (_suggestInput !== event.target || !_suggestBox || _suggestBox.hidden || !_suggestRows.length) return false;
    if (normalizeSearchQuery(event.target.value) !== renderedSuggestionQuery) return false;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      updateSuggestionActive((_suggestActive + 1) % _suggestRows.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      updateSuggestionActive((_suggestActive + _suggestRows.length - 1) % _suggestRows.length);
    } else if (event.key === 'Escape') {
      // Do not swallow native Escape handling.
      dismissSuggestions();
    } else if (event.key === 'Enter' && _suggestActive >= 0) {
      event.preventDefault();
      event.stopPropagation();
      selectSuggestion(_suggestActive);
    } else return false;
    return true;
  }

  function handleSuggestionPointerDown(event) {
    const target = event.target;
    if (!target || !_suggestInput) return;
    if (_suggestBox?.contains(target)) {
      const button = target.closest?.('button[data-zhx-index]');
      if (!button || !_suggestBox.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      selectSuggestion(Number(button.dataset.zhxIndex));
      return;
    }
    if (target === _suggestInput || _suggestInput.contains?.(target)) return;
    // Also cancel pending candidates before the V3 item table is ready.
    dismissSuggestions();
  }

  function bind() {
    document.addEventListener('focusout', handleSearchBlur, true);
    document.addEventListener('scroll', (event) => {
      // 列表自身滚动（滚轮翻看全部装备）无需处理；页面滚动只做同步——
      // 输入框仍在视口内则保持打开并跟随重定位，已滚出视口才关闭。
      if (_suggestBox && event.target && _suggestBox.contains(event.target)) {
        if (event.target === _suggestBox && !_suggestBox.hidden
            && _suggestBox.scrollTop + _suggestBox.clientHeight >= _suggestBox.scrollHeight - SUGGEST_ROW_HEIGHT * 2) {
          appendSuggestionBatch();
        }
        return;
      }
      syncSuggestionsOnScroll();
    }, true);
    globalThis.addEventListener?.('resize', () => syncSuggestionsOnScroll());
    globalThis.visualViewport?.addEventListener?.('resize', () => syncSuggestionsOnScroll());
    globalThis.visualViewport?.addEventListener?.('scroll', () => syncSuggestionsOnScroll());
  }

  function selectSuggestion(index) {
    const row = _suggestRows[index];
    const input = _suggestInput;
    if (!row || !input) return;
    if (normalizeSearchQuery(input.value) !== renderedSuggestionQuery || !commit(input, row))
      showSuggestions(input);
  }

  return {
    get input() { return _suggestInput; },
    contains: node => _suggestBox?.contains(node),
    show: showSuggestions,
    schedule: scheduleSuggestions,
    hide: hideSuggestions,
    dismiss: dismissSuggestions,
    bind,
    handleKeydown: handleSuggestionKeydown,
    handlePointerDown: handleSuggestionPointerDown,
  };
}
