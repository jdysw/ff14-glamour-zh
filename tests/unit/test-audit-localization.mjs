// Regression samples from the 2026-10-09 live localization coverage audit.
// Execute actual site translator source in an isolated Node environment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function dictionary(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'dict', name), 'utf8')).entries;
}
function adapter(file, names, deps) {
  const src = fs.readFileSync(path.join(root, 'src/sites', file), 'utf8')
    .split('\n').filter(line => !/^import |^export /.test(line)).join('\n');
  return new Function(...Object.keys(deps), src + '\nreturn {' + names.join(',') + '};')(...Object.values(deps));
}
function element(tag, attrs = {}, parent = null) {
  const values = { ...attrs };
  return { nodeType: 1, tagName: tag, dataset: {},
    hasAttribute: k => Object.hasOwn(values, k),
    getAttribute: k => values[k] ?? null,
    setAttribute: (k, v) => { values[k] = v; },
    closest: selector => parent === selector ? true : null,
  };
}

const fcDict = { ...dictionary('dict-common.json'), ...dictionary('dict-fc.json') };
const fc = adapter('ff14-fc.js',
  ['trFC', '_trFCSubstr', '_procFCNode', '_fcCanReplaceAt', 'trFCSegments'],
  { DICT_FC: fcDict, _tablesReady: true, lookupJp2Zh: () => null, lookupSeries: () => null,
    _getSubstrKeysAll: () => ['メール', 'ドレス', '装備', 'まとめ', '検索', '絞り込み'] });
assert.equal(fc.trFC('絞り込みをリセットする'), '重置筛选');
assert.equal(fc.trFC('基本ステータス'), '基础属性');
assert.equal(fc.trFC('メールアドレスが公開されることはありません。'), '您的电子邮箱地址不会公开。');
assert.equal(fc.trFC('メールアドレス'), 'メールアドレス',
  'do not replace ドレス inside the Japanese word メールアドレス');
assert.equal(fc.trFC('ノートゥング'), 'ノートゥング', 'unknown weapons must not be corrupted by partial dictionary matches');
assert.equal(fc.trFCSegments('未翻訳の日本語・ディフェンダー'), null,
  'unknown Japanese segment must not be emitted as a fake translated item');
const fcTitle = element('IMG', { title: 'お問い合わせ・メッセージ', alt: '未知の装備' });
fc._procFCNode(fcTitle);
assert.equal(fcTitle.getAttribute('title'), '咨询·留言');
const fcLink = element('A', { title: 'View all posts in パッチ情報', href: 'https://ff14-fc.com/' });
fc._procFCNode(fcLink);
assert.equal(fcLink.getAttribute('title'), '查看“补丁信息”分类下的全部文章');
const fcControl = element('INPUT', { type: 'reset', value: '絞り込みをリセットする' });
fc._procFCNode(fcControl);
assert.equal(fcControl.getAttribute('value'), '重置筛选');

const aclDict = { ...dictionary('dict-common.json'), ...dictionary('dict-acl.json') };
const acl = adapter('ffxiv-collection.js',
  ['trACL', '_procACLNode', '_trACLGearsetAlt', 'trimACLNode'],
  { DICT_ACL: aclDict, lookupJp2Zh: () => null, lookupSeries: () => null, DATA_TEXT: { acl: '' },
    markACLItem: () => {} });
for (const [foreign, zh] of [
  ['Previous page', '上一页'], ['Jump to page', '跳转到指定页'],
  ['Next page', '下一页'], ['ITEM Lv', '物品品级'], ['MENU', '菜单'],
  ['ページネーション', '分页导航'], ['次へ', '下一页'], ['ナイト', '骑士'],
]) assert.equal(acl.trACL(foreign), zh, foreign);
const prev = element('A', { 'aria-label': 'Previous page' });
acl._procACLNode(prev);
assert.equal(prev.getAttribute('aria-label'), '上一页');
const next = element('NAV', { 'aria-label': 'ページネーション' });
acl._procACLNode(next);
assert.equal(next.getAttribute('aria-label'), '分页导航');
const filter = element('LI', { title: 'yes' }, '#search-menu');
acl._procACLNode(filter);
assert.equal(filter.getAttribute('title'), '是');
const unrelated = element('LI', { title: 'yes' });
acl._procACLNode(unrelated);
assert.equal(unrelated.getAttribute('title'), 'yes');
const gear = element('IMG', { alt: "アークエンジェル・ディフェンダーアタイア's gearset image." });
acl._procACLNode(gear);
assert.equal(gear.getAttribute('alt'), '方舟天使御敌套装的装备展示图');
const unknownGear = element('IMG', { alt: "架空の未知アタイア's gearset image." });
acl._procACLNode(unknownGear);
assert.equal(unknownGear.getAttribute('alt'), "架空の未知アタイア's gearset image.");
const pageCount = { nodeValue: 'of', parentElement: { closest: sel => sel === '#navigation' } };
acl.trimACLNode(pageCount);
assert.equal(pageCount.nodeValue, '/');

const ronkaDict = { ...dictionary('dict-common.json'), ...dictionary('dict-ronka.json') };
const ronka = adapter('ronka.js', ['trRonka', '_procRonkaNode'],
  { DICT_RONKA: ronkaDict, ronkaItemLookup: () => null });
assert.equal(ronka.trRonka('검색:'), '搜索：');
const help = element('IMG', { alt: '도움말' });
ronka._procRonkaNode(help);
assert.equal(help.getAttribute('alt'), '帮助');
assert.equal(ronka.trRonka('이번 석판 장비 하의 넘 좋음'), '이번 석판 장비 하의 넘 좋음',
  'player-authored screenshots must retain their original Korean title');
console.log('✅ audit localization: controls, attributes, gear captions, and untranslated user content');
