// Exercise the End Closet adapter with DOM and observer stubs, without network access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../src/sites/endcloset.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/export\s*\{[^}]*\};/s, '');
let observer;
const ctx = vm.createContext({
  DICT_ENDCLOSET: JSON.parse(fs.readFileSync(new URL('../../dict/dict-endcloset.json', import.meta.url), 'utf8')).entries,
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
check('导航、筛选与三语界面词均有译文', () => {
  for (const [raw, zh] of [['좋아요 목록', '我的点赞'], ['Run search (Enter)', '执行搜索（回车）'],
    ['フィルター', '筛选'], ['선택 모드', '选择模式'], ['나이트', '骑士'], ['하얀눈색', '素雪白']]) {
    assert.equal(ctx.trEndCloset(raw), zh);
  }
});
check('普通按钮同时翻译 title 与 aria-label', () => {
  const attributes = { title: '검색 실행 (Enter)', 'aria-label': '메뉴 열기' };
  ctx._ecProcNode({ nodeType: 1, tagName: 'BUTTON', getAttribute: (name) => attributes[name],
    setAttribute: (name, value) => { attributes[name] = value; } });
  assert.equal(attributes.title, '执行搜索（回车）');
  assert.equal(attributes['aria-label'], '打开菜单');
});
check('图片属性在站点重渲染后可再次翻译', () => {
  const attributes = { alt: '좋아요 목록' };
  const node = { nodeType: 1, tagName: 'IMG', getAttribute: (name) => attributes[name],
    setAttribute: (name, value) => { attributes[name] = value; } };
  ctx._ecProcNode(node);
  assert.equal(attributes.alt, '我的点赞');
  attributes.alt = '후원하기';
  ctx._ecProcNode(node);
  assert.equal(attributes.alt, '赞助');
});
check('属性更新仅监听翻译所需字段', () => {
  ctx.startEndCloset();
  assert.equal(observer.attributes, true);
  assert.deepEqual(Array.from(observer.attributeFilter), ['placeholder', 'title', 'alt', 'aria-label']);
  assert.equal(observer.filter({ type: 'attributes', attributeName: 'title', target: { getAttribute: () => '검색' } }), true);
  assert.equal(observer.filter({ type: 'attributes', attributeName: 'title', target: { getAttribute: () => '搜索' } }), false);
});
check('动态结果数量翻译', () => {
  assert.equal(ctx.trEndCloset('총 739개의 투영 세트 중 20개 표시'), '共 739 套幻化，显示 20 项');
  assert.equal(ctx.trEndCloset('3개 선택됨'), '3 项已选择');
});
console.log(`${pass} passed / ${fail} failed`);
process.exitCode = fail ? 1 : 0;
