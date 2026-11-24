function normalizeSearchQuery(value) {
  return String(value ?? '').trim().replace(/[ \t\u00a0]+/g, ' ');
}

// 只有装备库列表页的查询可以按“套装系列 + 职能”映射。其它 EC 页面
function isChineseSearchQuery(value) {
  const q = normalizeSearchQuery(value);
  return q.length > 0 && /[\u3400-\u9fff]/u.test(q);
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

function rewriteInputNatively(input, native, programmatic) {
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
  programmatic.add(input);
  try {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } catch { /* 事件派发失败不影响替换结果 */ }
  finally { programmatic.delete(input); }
  return true;
}
function restoreStandaloneDisplay(input, shown, native, converted) {
  const token = {};
  converted.set(input, token);
  // React 结果加载期间可能再次回写受控值；有限次恢复显示，用户继续输入即取消。
  for (const delay of [0, 100, 500, 1500, 3000]) {
    setTimeout(() => {
      if (converted.get(input) !== token || input.isConnected === false) return;
      if (input.value === native) setInputValueSilently(input, shown);
      if (delay === 3000) converted.delete(input);
    }, delay);
  }
}

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

function submitNativeForm(event, form, input, native) {
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

const NATIVE_PICK_TIMEOUT_MS = 4000;

function createNativeOptionPicker() {
  let pending = null;

  function cancel() {
    if (!pending) return;
    pending.observer?.disconnect();
    clearTimeout(pending.timer);
    pending = null;
  }

  function attempt(expected = pending) {
    if (!expected || pending !== expected) return;
    const { input, root, row, selector, controlFor } = pending;
    // An edit or a detached component invalidates a late network result.
    if (input.isConnected === false || input.value !== row.native) {
      cancel();
      return;
    }
    const options = [...root.querySelectorAll(selector)].filter(option =>
      option.isConnected !== false && option.getAttribute?.('aria-disabled') !== 'true'
      && !option.classList?.contains('vs__dropdown-option--disabled'));
    const original = [];
    const translated = [];
    for (const option of options) {
      const match = nativeOptionMatch(option, row);
      if (match === 'native') original.push(option);
      if (match === 'zh') translated.push(option);
    }
    const matches = original.length ? original : translated;
    if (matches.length !== 1) return;
    cancel();
    controlFor(matches[0]).click?.();
  }

  function arm(input, row, { rootFor, selector, controlFor }) {
    cancel();
    const root = rootFor(input);
    if (!root?.querySelectorAll) return null;
    const pick = { input, root, row, selector, controlFor };
    pending = pick;
    const run = () => attempt(pick);
    pick.timer = setTimeout(() => { if (pending === pick) cancel(); }, NATIVE_PICK_TIMEOUT_MS);
    if (typeof MutationObserver === 'function') {
      pick.observer = new MutationObserver(run);
      pick.observer.observe(root, { childList: true, subtree: true, characterData: true });
    }
    return run;
  }

  return { cancel, attempt, arm, get input() { return pending?.input; }, get root() { return pending?.root; } };
}

// The EC localization walker may replace the label. Prefer the preserved
// original equipment name; compare translated text only as a unique fallback.
function nativeOptionMatch(option, row) {
  const itemId = option.getAttribute?.('data-item-id');
  if (row.itemId && itemId) return String(row.itemId) === itemId ? 'native' : null;
  const clean = text => String(text || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const source = option.getAttribute?.('data-zhx-miramiru-native') || option.getAttribute?.('data-zhixia-source-text');
  if (source) return clean(source) === clean(row.native) ? 'native' : null;
  if (clean(option.textContent) === clean(row.native)) return 'native';
  if (option.getAttribute?.('role') === 'option') {
    const labels = [...option.querySelectorAll('span')].filter(label => !label.childElementCount);
    if (labels.some(label => clean(label.textContent) === clean(row.native))) return 'native';
    if (labels.some(label => clean(label.textContent) === clean(row.zh))) return 'zh';
  }
  return clean(option.textContent) === clean(row.zh) ? 'zh' : null;
}

// Preserve the framework's own input listener (React tracks the instance setter).
function createSearchInputTransport() {
  const converted = new WeakMap();
  const programmatic = new WeakSet();
  return {
    isProgrammatic: input => programmatic.has(input),
    clearDisplayRestore: input => converted.delete(input),
    rewrite: (input, native) => rewriteInputNatively(input, native, programmatic),
    restore: (input, shown, native) => restoreStandaloneDisplay(input, shown, native, converted),
  };
}

export { normalizeSearchQuery, isChineseSearchQuery, buildSearchUrl, submitNativeForm,
  createNativeOptionPicker, createSearchInputTransport };
