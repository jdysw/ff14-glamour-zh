// EC Gearsets 回归：仅翻译已知官方套装系列；中文部分词可转换为站内搜索关键词。
// 独立执行：node tests/unit/test-ec-gearsets.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const loadEntries = name => JSON.parse(fs.readFileSync(path.join(root, 'dict', name), 'utf8')).entries;
const DICT_EC = { ...loadEntries('dict-common.json'), ...loadEntries('dict-ec.json') };

const source = fs.readFileSync(path.join(root, 'src/sites/eorzea-collection.js'), 'utf8');
const start = source.indexOf('  const EC_GEARSET_ROLES =');
const end = source.indexOf('  // 用户产出的内容：绝不翻译', start);
assert.ok(start >= 0 && end > start, 'EC Gearsets 源区段必须存在');

const scope = { anchors: [], headings: [] };
const doc = {
  createTreeWalker(element) {
    let moved = false;
    return {
      currentNode: null,
      nextNode() {
        if (moved) return false;
        moved = true;
        this.currentNode = element.textNode;
        return !!this.currentNode;
      },
    };
  },
};
const mockQuery = (_root, selector) => selector.startsWith('a[href') ? scope.anchors : selector === 'h1' ? scope.headings : [];
const api = new Function('DICT_EC', 'document', 'NodeFilter', 'localScope', 'queryIn', source.slice(start, end) +
  '\nreturn { ecGearsetDisplayName, resolveECGearsetSearch, suggestECGearsetsByZh, translateECGearsetNames };')(
  DICT_EC, doc, { SHOW_TEXT: 4 }, () => scope, mockQuery);

const tr = api.ecGearsetDisplayName;
assert.equal(tr('Phantom Vision Fending'), '幻境意象御敌套装');
assert.equal(tr('Phantom Vision Fending Set'), '幻境意象御敌套装');
assert.equal(tr('Vana\u0027dielian Casting'), '瓦纳·迪尔咏咒套装');
assert.equal(tr('Praemagitek Healing'), '前魔导治愈套装');
assert.equal(tr('Beastmaster\u0027s'), '兽主套装');
assert.equal(tr('Yozakura'), '夜樱装束');
assert.equal(tr('Graffiti Neotunic'), '涂鸦新式上衣套装');
assert.equal(tr('Plain Hooded'), '素色卫衣套装');
assert.equal(tr('Phantom Vision Fending Battle Content Gear'), '幻境意象御敌套装 战斗内容装备');
assert.equal(tr('An Unknown Personal Gearset'), null, '不臆造未收录套装名');

const search = api.resolveECGearsetSearch;
assert.equal(search('幻境意象御敌套装'), 'Phantom Vision Fending');
assert.equal(search('幻境意象御敌'), 'Phantom Vision Fending');
assert.equal(search('幻境意象'), 'Phantom Vision');
assert.equal(search('幻境'), 'Phantom Vision', '中文部分词命中系列');
assert.equal(search('御敌'), 'Fending', '中文职能词能够跨系列检索');
assert.equal(search('治愈'), 'Healing');
assert.equal(search('瓦纳·迪尔咏咒'), "Vana'dielian Casting");
assert.equal(search('兽主套装'), "Beastmaster's");
assert.equal(search('涂鸦'), 'Graffiti Neotunic');
assert.equal(search('幻境意象御敌裤'), null, '不能吞掉额外无关关键词');
assert.equal(search('不存在的套装'), null, '未命中时交由现有搜索链处理');
assert.equal(search('Phantom Vision'), null, '英文输入不做转换');

const rows = api.suggestECGearsetsByZh('御敌');
assert.deepEqual(rows.map(r => r.native), [
  'Phantom Vision Fending', "Vana'dielian Fending", 'Praemagitek Fending',
]);
assert.ok(api.suggestECGearsetsByZh('夜樱').some(r => r.native === 'Yozakura'));
assert.equal(api.suggestECGearsetsByZh('不存在的').length, 0);

const makeNode = text => ({ textNode: { nodeValue: text } });
const link = Object.assign(makeNode('Phantom Vision Fending'), { href: '/gearset/phantom-vision-fending' });
const unrelated = Object.assign(makeNode('A player glamour'), { href: '/glamour/23456' });
const h1 = makeNode('Praemagitek Healing Set');
scope.anchors = [link];
scope.headings = [h1];
const originalLocation = globalThis.location;
try {
  globalThis.location = { pathname: '/gearsets', hostname: 'ffxiv.eorzeacollection.com' };
  api.translateECGearsetNames();
  assert.equal(link.textNode.nodeValue, '幻境意象御敌套装');
  assert.equal(link.href, '/gearset/phantom-vision-fending', '保留原始套装链接');
  assert.equal(unrelated.textNode.nodeValue, 'A player glamour', '用户投稿绝不参与翻译');
  api.translateECGearsetNames();
  assert.equal(link.textNode.nodeValue, '幻境意象御敌套装', '重复扫描幂等');
  globalThis.location.pathname = '/gearset/praemagitek-healing';
  api.translateECGearsetNames();
  assert.equal(h1.textNode.nodeValue, '前魔导治愈套装', '详情标题也翻译');
} finally {
  globalThis.location = originalLocation;
}

console.log('✅ EC Gearsets 套装标题、部分词检索及 DOM 安全性回归通过');
