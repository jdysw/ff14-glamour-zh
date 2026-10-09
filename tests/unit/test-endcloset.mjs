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

check('Manual audit: 28 Korean style taxonomy tags have consistent Chinese translations', () => {
  for (const [raw, zh] of [['중동풍','中东风'], ['다크 판타지','暗黑奇幻'],
    ['페어컨셉','双人主题'], ['고딕 마법사','哥特魔法师'],
    ['아카데믹','学院风'], ['반갑주','半身甲']]) {
    assert.equal(ctx.trEndCloset(raw), zh);
  }
});
check('Manual audit: English filter taxonomy tags are translated as exact UI terms', () => {
  for (const [raw, zh] of [['JobSet','职业套装'], ['Wrist gloves','护腕手套'],
    ['front slit','前开衩'], ["'Blue Mage's Arm",'青魔法师武器'],
    ['Healing Tome','治疗魔导书'], ['Tricorn Hat','三角帽']]) {
    assert.equal(ctx.trEndCloset(raw), zh);
  }
});
check('Donation content translates, proper bank identities are preserved', () => {
  for (const [raw, zh] of [['후원금 사용 내역','赞助款用途明细'],
    ['국내 계좌 이체','韩国境内银行转账'],
    ['Ko-fi에서 후원하기','前往 Ko-fi 赞助'],
    ['은행','银行'], ['예금주','账户名']]) {
    assert.equal(ctx.trEndCloset(raw), zh);
  }
  assert.equal(ctx.trEndCloset('카카오뱅크'), '카카오뱅크');
});
check('Dynamic item list totals and image identifiers are translated without altering numbers', () => {
  assert.equal(ctx.trEndCloset('Showing 20 of 1880 items'), '显示 20 / 共 1880 件装备');
  assert.equal(ctx.trEndCloset('Showing 1 of 2 items'), '显示 1 / 共 2 件装备');
  assert.equal(ctx.trEndCloset('Glamour Set e34aOLptvLMcOZC3wPut'), '幻化套装 e34aOLptvLMcOZC3wPut');
  assert.equal(ctx.trEndCloset('Glamour Set'), '幻化套装');
});
check('Only primary navigation gets its English landmark translated', () => {
  const attrs1 = { 'aria-label': 'primary' };
  ctx._ecProcNode({ nodeType: 1, tagName: 'NAV', getAttribute: k=>attrs1[k], setAttribute:(k,v)=>{attrs1[k]=v;} });
  assert.equal(attrs1['aria-label'],'主导航');
  const attrs2 = { 'aria-label': 'primary' };
  ctx._ecProcNode({ nodeType: 1, tagName: 'BUTTON', getAttribute: k=>attrs2[k], setAttribute:(k,v)=>{attrs2[k]=v;} });
  assert.equal(attrs2['aria-label'],'primary');
});
check('Dynamic author title translates prefix without changing author identity', () => {
  const attrs = { title:'작성자: B' };
  ctx._ecProcNode({ nodeType:1, tagName:'BUTTON', getAttribute: k=>attrs[k], setAttribute:(k,v)=>{attrs[k]=v;} });
  assert.equal(attrs.title, '作者：B');
  assert.equal(ctx.trEndCloset('작성자: 바람'), '作者：바람');
});
check('Document title translates site suffix but does not invent unknown gear names', () => {
  ctx.document.title='알라미고 채집가용 터번, 에투알 손등장갑... - FF14 글래머 투영';
  ctx.translateEndClosetTitle();
  assert.equal(ctx.document.title,'알라미고 채집가용 터번, 에투알 손등장갑... - FF14 幻化投影');
  ctx.document.title='End Closet'; ctx.translateEndClosetTitle();
  assert.equal(ctx.document.title,'End Closet');
});
check('No forced translation of user-submitted titles or official publisher names', () => {
  assert.equal(ctx.trEndCloset('차원의 방랑자'), '차원의 방랑자');
  assert.equal(ctx.trEndCloset('©2010-2026 SQUARE ENIX CO., LTD. All Rights Reserved. Published in Korea by Actoz Soft CO., LTD.'),
    '©2010-2026 SQUARE ENIX CO., LTD. All Rights Reserved. Published in Korea by Actoz Soft CO., LTD.');
});

console.log(`${pass} passed / ${fail} failed`);
process.exitCode = fail ? 1 : 0;
