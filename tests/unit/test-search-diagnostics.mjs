import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const source = fs.readFileSync(new URL('../../tools/manual-coverage-audit/search-diagnostics.js', import.meta.url), 'utf8');
const installer = fs.readFileSync(new URL('../../tools/manual-coverage-audit/FF14-Coverage-Audit-V1.1.user.js', import.meta.url), 'utf8');

const storage = new Map();
function harness(path = '/gearsets') {
  const handlers = new Map();
  const loc = new URL('https://ffxiv.eorzeacollection.com' + path);
  const candidate = {
    getAttribute: k => k === 'data-zhx-index' ? '0' : null,
    querySelector: k => ({ textContent: k === '.zhx-suggest-zh' ? '幻境意象御敌套装' : 'Phantom Vision Fending' }),
  };
  const candidateBox = {
    hidden: false,
    getAttribute: k => k === 'role' ? 'listbox' : null,
    querySelectorAll: () => [candidate],
    querySelector: () => null,
  };
  const doc = {
    readyState: 'complete',
    addEventListener(type, fn) { const values = handlers.get(type) || []; values.push(fn); handlers.set(type, values); },
    querySelector(selector) { return selector === '[data-zhx-chinese-suggest]' ? candidateBox : null; },
    querySelectorAll() { return Array.from({ length: 5 }); },
  };
  const globalHandlers = new Map();
  let resources;
  class Observer {
    constructor(callback) { resources = callback; }
    observe() {}
  }
  const realm = {
    ZHXAuditCore: { siteFor: () => 'ec', allowedRoute: url => !url.includes('/login') },
    location: { ...{ href: loc.toString(), origin: loc.origin, hostname: loc.hostname, pathname: loc.pathname } },
    document: doc,
    PerformanceObserver: Observer,
    GM_getValue: async (k, d) => storage.get(k) ?? d,
    GM_setValue: (k, v) => storage.set(k, v),
    setTimeout, clearTimeout,
    URL,
    console,
    window: null,
  };
  realm.window = realm;
  realm.addEventListener = (type, fn) => { globalHandlers.set(type, fn); };
  vm.runInNewContext(source, realm, { filename: 'search-diagnostics.js' });
  return {
    api: realm.ZHXSearchAudit, realm, candidate,
    dispatch(type, target, rest = {}) {
      for (const fn of handlers.get(type) || []) fn({ type, target, isTrusted: true, ...rest });
    },
    network(entries) { resources?.({ getEntries: () => entries }); },
    pagehide() { globalHandlers.get('pagehide')?.(); },
  };
}
const searchInput = value => ({
  tagName: 'INPUT', disabled: false, readOnly: false, value, isConnected: true,
  form: null,
  attributes: { type: 'search', placeholder: '搜索…', id: 'gearset-search', 'aria-expanded': 'true' },
  getAttribute(name) { return this.attributes[name] || null; },
  closest() { return null; },
});
const mock = harness();
const { api, candidate } = mock;
assert.equal(api.getSummary().enabled, false, 'opt-in defaults off');
const input = searchInput('幻境');
assert.equal(api.isSearchInput(input), true, 'translated Chinese placeholder is a search field');
assert.equal(api.isSearchInput({ ...input, attributes: { ...input.attributes, type: 'password' } }), false,
  'never inspect passwords');
assert.equal(api.isSearchInput({ ...input, attributes: { ...input.attributes, id: 'search_by_player' } }), false,
  'never inspect player fields');
assert.equal(api.cleanValue('test@example.com'), '[redacted]', 'scrub email-like search samples');
assert.equal(api.cleanValue('123456789测试'), '[digits]测试', 'scrub long numeric tokens');
assert.deepEqual(JSON.parse(JSON.stringify(api.queryInfo('https://ffxiv.eorzeacollection.com/gearsets?search=Phantom%20Vision&token=super-secret'))),
  { path: '/gearsets', query: { search: 'Phantom Vision' }, otherParamNames: ['token'] },
  'only allow search parameter values; do not export secret values');

await api.init();
assert.equal(api.getSummary().events, 0, 'no implicit recording');
mock.dispatch('focusin', input);
assert.equal(api.getSummary().events, 0, 'no events before explicit start');
await api.start();
mock.dispatch('focusin', input);
mock.dispatch('compositionstart', input);
mock.dispatch('input', input);
mock.dispatch('compositionend', input);
mock.dispatch('keydown', input, { key: 'Enter' });
const button = {
  closest: selector => selector.includes('button[data-zhx-index]') ? candidate : null,
};
mock.dispatch('pointerdown', button);
const form = {
  getAttribute: k => k === 'method' ? 'get' : null,
  querySelectorAll: () => [input],
};
mock.dispatch('submit', form);
mock.network([{
  initiatorType: 'fetch',
  name: 'https://ffxiv.eorzeacollection.com/gearsets?search=Phantom%20Vision&token=sensitive',
  duration: 132, responseStatus: 200,
}, { initiatorType: 'fetch', name: 'https://some-other-domain.test/gearsets?search=SECRET', duration: 10 }]);
await new Promise(r => setTimeout(r, 520));
const events = (await api.exportState()).sessions[0].events;
assert.ok(events.some(e => e.type === 'enter'), 'records search submit intent');
assert.ok(events.some(e => e.type === 'candidate-pointerdown' && e.native === 'Phantom Vision Fending'),
  'records selected candidate native translation');
assert.ok(events.some(e => e.type === 'network' && e.request.query.search === 'Phantom Vision' && e.responseStatus === 200),
  'records only same-origin request metadata and response status');
assert.ok(!JSON.stringify(events).includes('sensitive'), 'never export secret request values');
assert.ok(!JSON.stringify(events).includes('some-other-domain'), 'never export cross-origin requests');
assert.ok(events.some(e => e.type === 'input-settled'), 'records asynchronous candidate UI state');
mock.pagehide();
await api.stop();
assert.equal(api.getSummary().enabled, false, 'recording stopped');
assert.equal(JSON.parse(storage.get('zhx.audit.search.v1')).enabled, false, 'stop persisted');
const savedCount = api.getSummary().events;
mock.dispatch('input', input);
assert.equal(api.getSummary().events, savedCount, 'no recording after stop');

await api.start();
mock.dispatch('input', input);
const beforeNavigation = api.getSummary().events;
const next = harness('/gearsets?search=Phantom%20Vision');
await next.api.init();
assert.equal(next.api.getSummary().enabled, true, 'opt-in recording resumes after navigation');
assert.equal((await next.api.exportState()).sessions[0].events.find(e => e.type === 'page-load')?.url?.query?.search,
  'Phantom Vision', 'resumed page load captures actual native search URL');
assert.ok(next.api.getSummary().events >= beforeNavigation, 'records preserved across navigation');
assert.equal(next.api.getSummary().sessions, 2, 'new session kept, old session retained');
const serialized = JSON.stringify(await next.api.exportState());
assert.ok(!serialized.includes('super-secret'));
await next.api.clear();
assert.equal(next.api.getSummary().sessions, 0, 'user can wipe all search records');

assert.ok(installer.includes('zhx-search-audit-v1'), 'installer bundles search diagnostics');
assert.ok(installer.includes('@version      1.2.0'), 'installer metadata upgraded');
console.log('✅ search diagnostics: opt-in, event chain, EC candidates, safe network, persistence, export, privacy');
