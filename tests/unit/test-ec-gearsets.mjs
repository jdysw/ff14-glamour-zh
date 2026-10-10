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
let dictRevision = 0;
const api = new Function('DICT_EC', 'dictGetRevision', 'document', 'NodeFilter', 'localScope', 'queryIn', source.slice(start, end) +
  '\nreturn { ecGearsetDisplayName, resolveECGearsetSearch, suggestECGearsetsByZh, translateECGearsetNames };')(
  DICT_EC, () => dictRevision, doc, { SHOW_TEXT: 4 }, () => scope, mockQuery);

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
// 缓存须随运行时词典修订而失效，而不是永久锁死首批译名。
const oldSeries = DICT_EC['Phantom Vision'];
DICT_EC['Phantom Vision'] = '临时测试译名';
dictRevision++;
assert.equal(tr('Phantom Vision Fending'), '临时测试译名御敌套装');
DICT_EC['Phantom Vision'] = oldSeries;
dictRevision++;
assert.equal(tr('Phantom Vision Fending'), '幻境意象御敌套装');
assert.equal(tr('An Unknown Personal Gearset'), null, '不臆造未收录套装名');
assert.equal(tr('Mistwake Fending Dungeon Drop'), '雾迹御敌套装 副本掉落');
assert.equal(tr('Mistic Memory Healing Dungeon Drop'), '雾忆治愈套装 副本掉落');
assert.equal(tr("War Cloud's Maiming Raid Gear"), '沃·克劳德制敌套装 副本装备');
assert.equal(tr("Prishe's Striking"), '普利修强袭套装');
assert.equal(tr('Mayakov Scouting'), '马雅科夫游击套装');
assert.equal(tr('Orastery Casting'), '口之院咏咒套装');
assert.equal(tr('Star Tech Crafting Scrips Exchange'), '星际科技巧匠套装 票据兑换');
assert.equal(tr('Star Tech Gathering'), '星际科技大地套装');
assert.equal(tr("Fallen's Set"), '堕落套装');
assert.equal(tr('Galatea Mogstation Set'), '伽拉忒亚装备套装 商城套装');
assert.equal(tr('Fuath Battle Content Gear'), '水妖装束 战斗内容装备');
assert.equal(tr('Hope [F]'), '希望套装【女】');
assert.equal(tr('Hope [M]'), '希望套装【男】');
assert.equal(tr('Eagleclaw'), '雕爪套装');
assert.equal(tr('Legend Crafted Glamour'), null, '无国服核验译名的套装不猜译');
assert.equal(tr("Prishe's Healing"), null, '未收录的职业变体不能虚构套装');

// 独立从国服物品表核对新增的系列译名，不用维护代码中的映射反向生成预期。
const officialRows = new Map(fs.readFileSync(path.join(root, 'data/ff14-items.tsv'), 'utf8')
  .split('\n').map(line => line.split('\t')).filter(row => row.length >= 3)
  .map(row => [row[2], row[1]]));
for (const [en, zh] of [
  ['Mistwake Visor of Fending', '雾迹御敌面罩'],
  ['Mistic Memory Sallet of Fending', '雾忆御敌角盔'],
  ["War Cloud's Helm of Fending", '沃·克劳德御敌头盔'],
  ["Prishe's Tiara of Striking", '普利修强袭华冠'],
  ['Mayakov Hairpin of Aiming', '马雅科夫精准发夹'],
  ['Orastery Ribbons of Casting', '口之院咏咒缎带'],
  ['Star Tech Top of Crafting', '星际科技巧匠上装'],
  ['Star Tech Coat of Gathering', '星际科技大地外套'],
  ["Fallen's Armor", '堕落套装'],
  ['Galatea Attire', '伽拉忒亚装备套装'],
  ['Hope Attire [F]', '希望套装【女】'],
  ['Alpha Wolf Attire', '头狼套装'],
]) {
  assert.equal(officialRows.get(en), zh, '国服物品表应支持 Gearsets 译名：' + en);
}

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
assert.equal(search('幻境意象御'), 'Phantom Vision Fending', '跨系列与职能边界的部分词');
assert.equal(search('素色'), 'Plain Hooded', '多个套装可以共享原生完整词序列');
assert.equal(search('卫衣'), 'Hooded', '跨多系列的共同英文单词');
assert.equal(search('瓦纳迪尔'), "Vana'dielian", '兼容中文间隔点省略');
assert.equal(search('雾忆'), 'Mistic Memory', '历史系列名片段');
assert.equal(search('雾迹御敌'), 'Mistwake Fending');
assert.equal(search('马雅科夫精准'), 'Mayakov Aiming');
assert.equal(search('希望套装女'), 'Hope [F]', '括号符号不影响匹配');
assert.equal(search('星际科技巧匠'), 'Star Tech Crafting');
assert.equal(search('装束'), null, '不同套装无公共英文片段时不随意选一个');
assert.equal(search('普利修治愈'), null, '不能补出不存在的职能变体');
assert.equal(search('幻境意象御敌裤'), null, '不能吞掉额外无关关键词');
assert.equal(search('不存在的套装'), null, '未命中时交由现有搜索链处理');
assert.equal(search('Phantom Vision'), null, '英文输入不做转换');

const rows = api.suggestECGearsetsByZh('御敌');
assert.deepEqual(rows.map(r => r.native).slice(0, 3), [
  'Phantom Vision Fending', "Vana'dielian Fending", 'Praemagitek Fending',
]);
assert.ok(rows.some(r => r.native === 'Mistwake Fending'));
assert.ok(rows.some(r => r.native === "War Cloud's Fending"));
assert.ok(!api.suggestECGearsetsByZh('治愈').some(r => r.native === "Prishe's Healing"),
  '不展示不存在的职业变体');
assert.deepEqual(api.suggestECGearsetsByZh('希望套装').map(r => r.native), ['Hope [F]', 'Hope [M]']);
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


// 验证中文搜索实际调用套装解析器，并保证离开 /gearsets 不污染其他站点。
const searchSource = fs.readFileSync(path.join(root, 'src/core/chinese-search.js'), 'utf8');
const searchStart = searchSource.indexOf('const SEARCH_SITES = Object.freeze({');
const searchEnd = searchSource.indexOf('\nexport {', searchStart);
assert.ok(searchStart >= 0 && searchEnd > searchStart);
const searchApi = new Function('resolveECGearsetSearch', 'resolveByZh', 'resolvePartialByZh',
  'suggestECGearsetsByZh', 'suggestByZh', searchSource.slice(searchStart, searchEnd) +
    '\nreturn { isECGearsetsPage, resolveSearchNative };')(
  search, q => q === '测试物品' ? 'Native Test Item' : null,
  q => q === '女仆' ? 'Maid' : q === '装束' ? 'Wrong-Item' : null,
  api.suggestECGearsetsByZh, () => []);
try {
  globalThis.location = { hostname: 'ffxiv.eorzeacollection.com', pathname: '/gearsets' };
  assert.equal(searchApi.isECGearsetsPage(), true);
  assert.equal(searchApi.resolveSearchNative('御敌', true), 'Fending');
  assert.equal(searchApi.resolveSearchNative('幻境', true), 'Phantom Vision');
  assert.equal(searchApi.resolveSearchNative('女仆', true), 'Maid', '未知套装词才回退物品公共子串');
  assert.equal(searchApi.resolveSearchNative('装束', true), null,
    '已命中多个套装却无共同搜索词时，不回退到无关物品');
  assert.equal(searchApi.resolveSearchNative('装束', false), 'Wrong-Item',
    '其它页面继续使用原物品搜索回退');
  globalThis.location.pathname = '/glamours';
  assert.equal(searchApi.isECGearsetsPage(), false);
  assert.equal(searchApi.resolveSearchNative('测试物品', false), 'Native Test Item');
  assert.equal(searchApi.resolveSearchNative('御敌', false), null, '非套装页不套用职能搜索映射');
} finally {
  globalThis.location = originalLocation;
}

console.log('✅ EC Gearsets 套装标题、部分词检索及 DOM 安全性回归通过');
