// Regression based on the Eorzea Collection 14-page browser audit, 2026-10-09.
// These fixtures deliberately test the actual module functions, not copied logic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entries = name => JSON.parse(fs.readFileSync(path.join(root, 'dict', name), 'utf8')).entries;
const DICT_EC = { ...entries('dict-common.json'), ...entries('dict-ec.json') };
const source = fs.readFileSync(path.join(root, 'src/sites/eorzea-collection.js'), 'utf8')
  .split('\n').filter(line => !/^import |^export /.test(line)).join('\n');
const titleKeep = new WeakSet();
const body = { items: [] };
const document = { title: 'Glamour Collection | Eorzea Collection', documentElement: body, body };
const captured = [];
const stubs = {
  DICT_EC, document, dictGetRevision: () => 0,
  createObserver: opts => { captured.push(opts); return { disconnect() {} }; },
  queryIn: (scope, selector) => body.items.filter(node => node.hasAttribute(selector.slice(1, -1))),
  localScope: node => node || null, _zhixiaTitleKeep: titleKeep,
  _markScan: () => {}, safe: fn => fn, SKIP_TAGS: new Set(), EC_ITEM_SKIP_SEL: '.item-only',
  NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
};
const itemSource = fs.readFileSync(path.join(root, 'src/core/item-resolver.js'), 'utf8');
const start = itemSource.indexOf('  function trEC(text) {');
const end = itemSource.indexOf('  // 日文 → 中文', start);
assert.ok(start >= 0 && end > start);
const patterns = new Function(...Object.keys(stubs), source + '\nreturn PATTERNS_EC;')(...Object.values(stubs));
stubs.trEC = new Function('DICT_EC','PATTERNS_EC','tryEnToZh',
  itemSource.slice(start, end) + '\nreturn trEC;')(DICT_EC,patterns,() => null);
const api = new Function(...Object.keys(stubs), source +
  '\nreturn { trimECNode, translateECAttrs, translateECTitle, startEC };')(...Object.values(stubs));
for (const [original, translated] of [
  ['Requirements', '要求'], ['Allowed', '允许'], ['Not Allowed', '不允许'],
  ['Rules for screenshots', '截图规则'], ['Search for option', '搜索选项'],
  ['main navigation', '主导航'], ['pagination', '分页导航'],
  ['Go to Page 3', '前往第 3 页'], ['Go to slide 2', '切换到第 2 张'],
  ['Page 1 of 8541', '第 1 页 / 共 8541 页'],
  ['Browse All Round glasses', '浏览全部圆框眼镜'],
  ['Basic (White)', '普通（白色）'], ['Mogstation exclusive', '官方商城专属'],
]) assert.equal(stubs.trEC(original), translated, original);
assert.equal(stubs.trEC('Eorzea Collection'), 'Eorzea Collection', 'keep brand');
assert.equal(stubs.trEC('Some player-made glamour title'), 'Some player-made glamour title');
const node = (attrs, authored = false) => ({
  nodeType: 1, tagName: 'A', attrs: { ...attrs }, dataset: {},
  hasAttribute(key) { return Object.hasOwn(this.attrs,key); },
  getAttribute(key) { return this.attrs[key] ?? null; },
  setAttribute(key,value) { this.attrs[key] = value; },
  closest(sel) { return authored && sel.includes('[class*="s-comment"]') ? {} : null; },
});
const nav = node({ title: 'Glamours', 'aria-label': 'main navigation' });
const search = node({ 'aria-label': 'Search for option' });
const player = node({ title: 'Patron Challenge' }, true);
body.items = [nav,search,player];
api.translateECAttrs();
assert.equal(nav.getAttribute('title'), '幻化');
assert.equal(nav.getAttribute('aria-label'), '主导航');
assert.equal(search.getAttribute('aria-label'), '搜索选项');
assert.equal(player.getAttribute('title'), 'Patron Challenge', 'skip user content');
nav.setAttribute('title','About');
api.translateECAttrs();
assert.equal(nav.getAttribute('title'), '关于', 'translate changed attrs, no sticky flag');
const link = node({});
const textNode = { nodeValue: 'Glamours', parentElement: link };
api.trimECNode(textNode);
assert.equal(textNode.nodeValue, '幻化');
assert.equal(link.getAttribute('title'), null, 'do not synthesize English hover tooltips');
assert.equal(link.dataset.zhixiaSourceText,'Glamours');
api.translateECTitle();
assert.equal(document.title, '幻化收藏 | Eorzea Collection');
document.title = 'The Crafty Fox | Glams for Arkania | Eorzea Collection';
api.translateECTitle();
assert.equal(document.title, 'The Crafty Fox | Glams for Arkania | Eorzea Collection');
document.createTreeWalker = () => ({ nextNode: () => false });
api.startEC();
assert.equal(captured.length,1);
assert.equal(captured[0].attributes,true);
assert.deepEqual(captured[0].attributeFilter,['title','alt','aria-label','placeholder']);
console.log('✅ EC manual 14-page audit translation regression passed');
