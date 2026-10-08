// Exercise the End Closet adapter with DOM and observer stubs, without network access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../src/sites/endcloset.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/export\s*\{[^}]*\};/s, '');
let observer;
const ctx = vm.createContext({
  DICT_ENDCLOSET: { '검색': '搜索' },
  resolveByName: (name) => ({ '메이드 드레스': '女仆礼服' })[name] || null,
  SKIP_TAGS: new Set(['SCRIPT', 'STYLE', 'TEXTAREA']),
  NodeFilter: { FILTER_REJECT: 2, FILTER_ACCEPT: 1, SHOW_TEXT: 4, SHOW_ELEMENT: 1 },
  document: { title: '', documentElement: {}, createTreeWalker: () => ({ nextNode: () => false }) },
  createObserver: (options) => { observer = options; },
  safe: (fn) => fn,
  _markScan: () => {}, localScope: (root) => root,
  ensureZhxItemStyle: () => {}, bindZhxItemClick: () => {}, startChineseSearch: () => {},
  console: { log: () => {} },
});
vm.runInContext(source, ctx);
function text(value, skip = false) {
  const parentElement = { dataset: {}, closest: () => skip ? {} : null, setAttribute: () => {} };
  return { nodeType: 3, nodeValue: value, parentElement };
}
let pass = 0;
let fail = 0;
function check(name, run) {
  try { run(); pass++; console.log('PASS ' + name); }
  catch (error) { fail++; console.error('FAIL ' + name + ': ' + error.message); }
}
check('UI labels translate without becoming Wiki links', () => {
  const node = text('검색');
  ctx._ecProcNode(node);
  assert.equal(node.nodeValue, '搜索');
  assert.equal(node.parentElement.dataset.zhxItem, undefined);
});
check('Equipment translates and receives its canonical Wiki name', () => {
  const node = text('  메이드 드레스  ');
  ctx._ecProcNode(node);
  assert.equal(node.nodeValue, '  女仆礼服  ');
  assert.equal(node.parentElement.dataset.zhxItem, '女仆礼服');
});
check('A newly added skipped text node keeps its original text', () => {
  const node = text('메이드 드레스', true);
  ctx.translateEndClosetPage(node);
  assert.equal(node.nodeValue, '메이드 드레스');
  assert.equal(node.parentElement.dataset.zhxItem, undefined);
});
check('Dynamic characterData changes get translated', () => {
  ctx.startEndCloset();
  const node = text('메이드 드레스');
  observer.handler([], [node]);
  assert.equal(node.nodeValue, '女仆礼服');
});
check('A newly added element itself has its placeholder translated', () => {
  const attributes = { placeholder: '검색' };
  const node = { nodeType: 1, tagName: 'INPUT', closest: () => null,
    getAttribute: (name) => attributes[name], setAttribute: (name, value) => { attributes[name] = value; } };
  ctx.translateEndClosetPage(node);
  assert.equal(attributes.placeholder, '搜索');
});
check('Search candidate UI is excluded from translation', () => {
  let selector;
  ctx._ecAcceptNode({ nodeType: 1, tagName: 'SPAN', closest: (value) => { selector = value; return null; } });
  assert.ok(selector.includes('#zhx-chinese-suggest-list'));
});
console.log(`${pass} passed / ${fail} failed`);
process.exitCode = fail ? 1 : 0;
