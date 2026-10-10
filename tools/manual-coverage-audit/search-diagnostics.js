/* Search diagnostics for the existing FF14 manual localization audit.
 * Opt-in, local-only, no request interception or page behavior changes. */
(function (global) {
  'use strict';
  const C = global.ZHXAuditCore;
  const KEY = 'zhx.audit.search.v1';
  const MAX_SESSIONS = 3;
  const MAX_EVENTS = 360;
  const SEARCH_HINT = /search|keyword|query|検索|检索|檢索|搜索|搜尋|装备|裝備|套装|套裝|装備|검색|키워드/i;
  const PRIVATE_HINT = /password|passcode|token|secret|api[-_]?key|auth|mail|e-mail|user(name)?|player|author|creator|login|comment|title|description|留言|邮箱|郵箱|用户|用戶|玩家|作者|标题|標題|账户|帳戶/i;
  const HAN = /[\u3400-\u9fff]/u;
  const INPUT_TYPES = new Set(['', 'text', 'search']);
  const now = () => new Date().toISOString();
  const empty = () => ({ format: 'zhx-search-audit-v1', enabled: false, sessions: [] });
  let state = empty(), started = false, bound = false, ready = null;
  let subscribed = null, saveTimer = null, settleTimer = null;
  let active = null, lastChineseInput = null, lastInputTime = 0;
  let resourceWatcher = null;

  function cleanValue(raw) {
    const value = String(raw ?? '').trim().replace(/\s+/gu, ' ').slice(0, 96);
    if (!value || /@|https?:|(?:bearer|password|token|secret|api[_-]?key)/i.test(value)) return '[redacted]';
    return value.replace(/\d{6,}/g, '[digits]').slice(0, 96);
  }
  function cleanMeta(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').replace(/[^\w\s\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af\-._]/gu, '').slice(0, 72);
  }
  function allowed() {
    try { return !!C?.siteFor(location.href) && C.allowedRoute(location.href); }
    catch { return false; }
  }
  function currentPath() {
    try { return new URL(location.href).pathname.slice(0, 120); }
    catch { return ''; }
  }
  function isSearchInput(input) {
    if (!input || input.tagName !== 'INPUT' || input.disabled || input.readOnly) return false;
    if (!INPUT_TYPES.has(String(input.getAttribute?.('type') || '').toLowerCase())) return false;
    if (input.closest?.('#zhx-manual-audit-overlay')) return false;
    const id = input.getAttribute?.('id') || '';
    const name = input.getAttribute?.('name') || '';
    const ph = input.getAttribute?.('placeholder') || '';
    const label = input.getAttribute?.('aria-label') || '';
    const meta = [id, name, ph, label].join(' ');
    if (PRIVATE_HINT.test(meta)) return false;
    if (SEARCH_HINT.test(meta)) return true;
    // EC Gearsets has a standalone Search... input, sometimes without a name.
    return /^\/gearsets(?:\/[a-z-]+)?\/?$/i.test(currentPath())
      && location.hostname === 'ffxiv.eorzeacollection.com'
      && (String(input.getAttribute?.('type') || '') === 'search');
  }
  function inputInfo(input) {
    if (!isSearchInput(input)) return null;
    return {
      id: cleanMeta(input.getAttribute('id')),
      name: cleanMeta(input.getAttribute('name')),
      placeholder: cleanMeta(input.getAttribute('placeholder')),
      className: cleanMeta(typeof input.className === 'string' ? input.className : ''),
      type: String(input.getAttribute('type') || 'text').slice(0, 12),
      inForm: !!input.form,
      value: cleanValue(input.value),
      length: String(input.value || '').length,
      hasChinese: HAN.test(String(input.value || '')),
      ariaExpanded: input.getAttribute('aria-expanded') || null,
      ariaControls: cleanMeta(input.getAttribute('aria-controls')),
      connected: input.isConnected !== false,
    };
  }
  function candidateInfo() {
    const el = document.querySelector?.('[data-zhx-chinese-suggest]');
    if (!el) return { exists: false };
    const buttons = [...el.querySelectorAll('button[data-zhx-index]')];
    return {
      exists: true, hidden: !!el.hidden, role: el.getAttribute('role') || '',
      rendered: buttons.length,
      first: buttons.slice(0, 4).map(b => ({
        zh: cleanValue(b.querySelector('.zhx-suggest-zh')?.textContent || ''),
        native: cleanValue(b.querySelector('.zhx-suggest-native')?.textContent || ''),
      })),
      empty: !!el.querySelector('.zhx-suggest-empty'),
    };
  }
  function domState(input = active) {
    let count = null;
    try {
      if (location.hostname === 'ffxiv.eorzeacollection.com' && /^\/gearsets/.test(currentPath())) {
        count = document.querySelectorAll('a[href*="/gearset/"]').length;
      }
    } catch { /* DOM may change during navigation */ }
    return {
      input: inputInfo(input), candidates: candidateInfo(), gearsetLinks: count,
      searchBoundVisible: global.__zhxChineseSearchBound === true,
      readyState: document.readyState || 'unknown',
      // Neither the searchBound flag nor the link count alone proves the search succeeded.
    };
  }
  function queryInfo(raw) {
    try {
      const u = new URL(raw, location.href);
      if (u.origin !== location.origin) return null;
      const params = {};
      for (const key of ['search', 'keyword', 'query']) {
        if (u.searchParams.has(key)) params[key] = cleanValue(u.searchParams.get(key));
      }
      return { path: u.pathname.slice(0, 120), query: params,
        otherParamNames: [...u.searchParams.keys()].filter(k => !['search','keyword','query'].includes(k))
          .slice(0, 12).map(cleanMeta) };
    } catch { return null; }
  }
  function activeSession() {
    return state.sessions[0] || null;
  }
  function notify() {
    try { subscribed?.(getSummary()); } catch { /* no UI dependency */ }
  }
  function getSummary() {
    return { enabled: !!state.enabled, events: activeSession()?.events.length || 0,
      sessions: state.sessions.length, startedAt: activeSession()?.startedAt || null, allowed: allowed() };
  }
  function enqueueSave(immediate = false) {
    if (saveTimer) clearTimeout(saveTimer);
    if (immediate) {
      saveTimer = null;
      try { void GM_setValue(KEY, JSON.stringify(state)); }
      catch { /* recording continues in memory */ }
    } else saveTimer = setTimeout(() => enqueueSave(true), 220);
  }
  function logEvent(type, details = {}, input = active) {
    if (!state.enabled || !allowed()) return;
    const session = activeSession();
    if (!session) return;
    session.events.push({ at: now(), type, page: currentPath(), ...details, state: domState(input) });
    if (session.events.length > MAX_EVENTS) session.events.splice(0, session.events.length - MAX_EVENTS);
    enqueueSave(/^(enter|submit|candidate-|pagehide|network|start|stop)/.test(type));
    notify();
  }
  function setActive(input) {
    if (isSearchInput(input)) active = input;
  }
  function onFocus(event) {
    if (!isSearchInput(event.target)) return;
    setActive(event.target);
    logEvent('focus', {}, active);
  }
  function onInput(event) {
    const input = event.target;
    if (!isSearchInput(input)) return;
    setActive(input);
    const value = String(input.value || '');
    if (!HAN.test(value) && lastChineseInput !== input) return;
    if (HAN.test(value)) lastChineseInput = input;
    const t = Date.now();
    // Record the last value in each burst; do not create one entry per keystroke.
    if (t - lastInputTime > 500) logEvent('input', { trusted: event.isTrusted === true }, input);
    lastInputTime = t;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => logEvent('input-settled', {}, input), 300);
  }
  function onKey(event) {
    const input = event.target;
    if (!isSearchInput(input)) return;
    if (!['Enter', 'ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) return;
    setActive(input);
    logEvent(event.key === 'Enter' ? 'enter' : 'key-' + event.key,
      { composing: !!event.isComposing }, input);
    if (event.key === 'Enter') setTimeout(() => logEvent('after-enter', {}, input), 450);
  }
  function onComposition(event) {
    if (!isSearchInput(event.target)) return;
    setActive(event.target);
    logEvent(event.type, {}, active);
  }
  function onSubmit(event) {
    const form = event.target;
    const inputs = [...(form?.querySelectorAll?.('input') || [])].filter(isSearchInput);
    const input = inputs.find(x => HAN.test(String(x.value || ''))) || inputs[0];
    if (!input) return;
    setActive(input);
    logEvent('submit', { method: String(form.getAttribute?.('method') || 'get').toLowerCase(),
      action: queryInfo(form.getAttribute?.('action') || location.href) }, input);
    setTimeout(() => logEvent('after-submit', {}, input), 450);
  }
  function onSelect(event) {
    const candidate = event.target?.closest?.('[data-zhx-chinese-suggest] button[data-zhx-index]');
    if (candidate) {
      logEvent('candidate-' + event.type, {
        index: Number(candidate.getAttribute('data-zhx-index')),
        zh: cleanValue(candidate.querySelector('.zhx-suggest-zh')?.textContent),
        native: cleanValue(candidate.querySelector('.zhx-suggest-native')?.textContent),
      });
      setTimeout(() => logEvent('after-candidate', {}, active), 500);
      return;
    }
    const button = event.target?.closest?.('button,input[type="submit"],[role="button"]');
    if (!button || !active || !isSearchInput(active)) return;
    const text = String(button.textContent || button.getAttribute?.('title') || '').slice(0, 90);
    if (/search|搜尋|搜索|查询|检索|検索|검색|apply/i.test(text)) logEvent('search-click', {}, active);
  }
  function onResource(entry) {
    if (!state.enabled || !allowed() || !['fetch', 'xmlhttprequest'].includes(entry.initiatorType)) return;
    const info = queryInfo(entry.name);
    if (!info) return;
    if (!/\/(?:gearsets?|search)(?:\/|$)/i.test(info.path) && !Object.keys(info.query).length) return;
    logEvent('network', { request: info, initiator: entry.initiatorType,
      responseStatus: Number.isInteger(entry.responseStatus) && entry.responseStatus > 0 ? entry.responseStatus : null,
      durationMs: Math.round(entry.duration) });
  }
  function bind() {
    if (bound) return;
    bound = true;
    for (const [type, fn] of [
      ['focusin', onFocus], ['input', onInput], ['change', onInput], ['keydown', onKey],
      ['compositionstart', onComposition], ['compositionend', onComposition],
      ['submit', onSubmit], ['pointerdown', onSelect], ['click', onSelect],
    ]) document.addEventListener(type, fn, true);
    window.addEventListener('pagehide', () => { logEvent('pagehide', { url: queryInfo(location.href) }); enqueueSave(true); }, true);
    window.addEventListener('pageshow', () => { logEvent('pageshow', { url: queryInfo(location.href) }); }, true);
    window.addEventListener('popstate', () => logEvent('popstate', { url: queryInfo(location.href) }), true);
    try {
      resourceWatcher = new PerformanceObserver(list => {
        for (const item of list.getEntries()) onResource(item);
      });
      resourceWatcher.observe({ type: 'resource', buffered: false });
    } catch { resourceWatcher = null; }
  }
  async function init() {
    if (ready) return ready;
    ready = (async () => {
      try {
        const raw = await GM_getValue(KEY, '');
        const old = raw ? JSON.parse(raw) : null;
        if (old?.format === 'zhx-search-audit-v1' && Array.isArray(old.sessions)) {
          state = { format: 'zhx-search-audit-v1', enabled: !!old.enabled,
            sessions: old.sessions.slice(0, MAX_SESSIONS).map(s => ({
              startedAt: s.startedAt || now(),
              endedAt: s.endedAt || null,
              events: Array.isArray(s.events) ? s.events.slice(-MAX_EVENTS) : [],
            })) };
        }
      } catch { state = empty(); }
      if (state.enabled && allowed()) {
        if (!activeSession()) state.sessions.unshift({ startedAt: now(), endedAt: null, events: [] });
        bind(); logEvent('page-load', { resumed: true, url: queryInfo(location.href) });
      }
      notify();
    })();
    return ready;
  }
  async function start() {
    await init();
    if (!allowed()) return false;
    if (!state.enabled) {
      state.enabled = true;
      state.sessions.unshift({ startedAt: now(), endedAt: null, events: [] });
      state.sessions = state.sessions.slice(0, MAX_SESSIONS);
    }
    bind(); logEvent('start', { url: queryInfo(location.href) });
    enqueueSave(true); notify();
    return true;
  }
  async function stop() {
    await init();
    if (state.enabled) {
      logEvent('stop');
      state.enabled = false;
      if (activeSession()) activeSession().endedAt = now();
      enqueueSave(true);
    }
    notify();
  }
  async function clear() {
    await init();
    state = empty();
    active = null; lastChineseInput = null;
    enqueueSave(true); notify();
  }
  async function exportState() {
    await init();
    return { format: 'zhx-search-audit-v1', note: 'Opt-in search fields only; never request/response bodies',
      sessions: JSON.parse(JSON.stringify(state.sessions)) };
  }
  function snapshot() {
    logEvent('manual-snapshot', { url: queryInfo(location.href) });
  }
  function onUpdate(fn) { subscribed = fn; notify(); }

  const api = { init, start, stop, clear, exportState, snapshot, onUpdate,
    getSummary, isSearchInput, cleanValue, queryInfo };
  global.ZHXSearchAudit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
