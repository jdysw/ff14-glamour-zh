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
    const nodes = element.nodes || (element.textNode ? [element.textNode] : []);
    let index = 0;
    return {
      currentNode: null,
      nextNode() {
        if (index >= nodes.length) return false;
        this.currentNode = nodes[index++];
        return true;
      },
    };
  },
};
const mockQuery = (_root, selector) => selector.startsWith('a[href') ? scope.anchors : selector === 'h1' ? scope.headings : [];
let dictRevision = 0;
const itemIndex = Object.create(null);
const api = new Function('DICT_EC', 'dictGetRevision', 'dataGetIndex', 'document', 'NodeFilter', 'localScope', 'queryIn', source.slice(start, end) +
  '\nreturn { ecGearsetDisplayName, resolveECGearsetSearch, suggestECGearsetsByZh, translateECGearsetNames, inferECGearsetsFromItems };')(
  DICT_EC, () => dictRevision, () => Object.keys(itemIndex).length ? itemIndex : null,
  doc, { SHOW_TEXT: 4 }, () => scope, mockQuery);

const tr = api.ecGearsetDisplayName;
assert.equal(tr('Phantom Vision Fending'), '幻境意象御敌套装');
// 直接使用实测 EC /gearset/ceremonial-scouting 中的国服物品英中配对，
 // 不提前把 Ceremonial 放进任何人工 Gearsets 白名单。
Object.assign(itemIndex, {
  'Ceremonial Longcap of Scouting': '仪仗游击护耳帽',
  'Ceremonial Vest of Scouting': '仪仗游击坎肩',
  'Ceremonial Armguards of Scouting': '仪仗游击护臂',
  'Ceremonial Culottes of Scouting': '仪仗游击宽松直筒裤',
  'Ceremonial Crakows of Scouting': '仪仗游击尖头靴',
  'Ceremonial Longcap of Maiming': '仪仗制敌护耳帽',
  'Ceremonial Corselet of Maiming': '仪仗制敌护甲',
  'Ceremonial Vambraces of Maiming': '仪仗制敌臂甲',
  'Ceremonial Hose of Maiming': '仪仗制敌骑兵裤',
  'Ceremonial Greaves of Maiming': '仪仗制敌胫甲',
  'Random Cap of Scouting': '无关游击头盔',
  'Random Coat of Scouting': '其他游击大衣',
  'Random Shoes of Scouting': '其它游击靴',
});
assert.equal(tr('Ceremonial Scouting'), '仪仗游击套装',
  '依 V3 物品中英对应自动生成未维护的套装标题');
assert.equal(tr('Ceremonial Maiming'), '仪仗制敌套装',
  '同系列不同职能单独从游戏物品推导');
assert.equal(tr('Ceremonial Scouting Set'), '仪仗游击套装', '兼容 EC 标题带 Set');
// A real EC gearset title may not belong to the enumerated catalogue, but an
// existing verified localized dictionary series can translate the observed title.
DICT_EC['Verified New Series'] = '核验新系列';
assert.equal(tr('Verified New Series Casting'), '核验新系列咏咒套装',
  '已出现的页面标题可按已有词典自动组词，不需要枚举每个系列');
assert.equal(api.suggestECGearsetsByZh('核验新系列').length, 0,
  '仅观测到的标题可安全兜底，但不能虚构对应站点搜索候选');
delete DICT_EC['Verified New Series'];
itemIndex['Verified Special Attire'] = '核验特殊装束';
assert.equal(tr('Verified Special'), '核验特殊装束',
  '可直接从国服套装物品名字获得译名，而无需维护人工清单');
delete itemIndex['Verified Special'];

assert.equal(tr('Hempen Viera Male'), '维埃拉族男性贴身衣套装',
  '未单独维护的种族内衣套装使用明确的描述性语法');
assert.equal(tr('Hempen Viera Male Set'), '维埃拉族男性贴身衣套装');
assert.equal(tr('Hempen Auri Male'), '敖龙族男性贴身衣套装',
  '站点使用 Auri 代替国服 Au Ra 时自动规范种族译名');
assert.equal(tr('Hempen Lalafellin Female'), '拉拉菲尔族女性贴身衣套装',
  'Lalafellin 实际 Gearset 标题应命中');

assert.equal(tr('Hempen Unknown Male'), null, '不推导不支持的种族/套装');

assert.equal(tr('Random Scouting'), null, '中文共同前缀不一致时不可自动造套装名');
assert.equal(api.resolveECGearsetSearch('仪仗游击'), 'Ceremonial Scouting',
  '自动推导的套装应进入相同的中文搜索引擎');
assert.ok(api.suggestECGearsetsByZh('仪仗制敌').some(r => r.native === 'Ceremonial Maiming'),
  '自动推导套装进入中文候选');

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
// 以下均为用户实际审计输入；映射使用已确认存在的 EC Gearsets 英文标题/关键词。
assert.equal(search('女仆'), "Loyal Housemaid's", '女仆 → EC 忠诚女仆套装');
assert.equal(search('女僕'), "Loyal Housemaid's", '繁体女仆同样命中');
assert.equal(search('兽王'), "Beastmaster's", '兽王是 Beastmaster 的搜索别名');
assert.equal(search('獸王'), "Beastmaster's", '繁体兽王同样命中');
assert.equal(search('东方'), 'Eastern', '多个东方套装使用安全的英文共同关键词');
assert.equal(search('東方'), 'Eastern', '繁体东方同样命中');
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
assert.deepEqual(api.suggestECGearsetsByZh('女仆').map(r => r.native), ["Loyal Housemaid's"]);
assert.deepEqual(api.suggestECGearsetsByZh('兽王').map(r => r.native), ["Beastmaster's"]);
assert.deepEqual(api.suggestECGearsetsByZh('东方').map(r => r.native), ['Eastern']);
assert.equal(api.suggestECGearsetsByZh('东方')[0].zh.includes('全部'), true,
  '广义关键词不得误显示为某一套装的正式名称');
assert.equal(api.suggestECGearsetsByZh('兽主').filter(r => r.native === "Beastmaster's").length, 1,
  '别名和正式译名同英文关键词应去重');
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
  // 从实际 EC 审计还原：H1 的主名称 span 中嵌套一个独立 Set span。
  // TreeWalker 会产生「名称」「Set」两个文本节点；单靠 outer span.textContent
  // 的精确判定会漏掉、被泛用 PATTERNS 翻译时还可能造成重复的“套装”。
  const splitTitle = (native, suffix = 'Set') => ({
    tagName: 'H1',
    nodes: [{ nodeValue: native }, { nodeValue: suffix }],
  });
  for (const [native, expected] of [
    ['Ceremonial Scouting', '仪仗游击'],
    ['Phantom Vision Fending', '幻境意象御敌'],
    ['Hempen Viera Male', '维埃拉族男性贴身衣'],
    ["Fallen's", '堕落'],
  ]) {
    const node = splitTitle(native);
    scope.headings = [node];
    api.translateECGearsetNames();
    assert.equal(node.nodes.map(x => x.nodeValue).join(''), expected + '套装',
      native + ' + 独立 Set 节点仅显示一次套装');
    api.translateECGearsetNames();
    assert.equal(node.nodes.map(x => x.nodeValue).join(''), expected + '套装',
      native + ' 再次扫描保持幂等');
  }
  const alreadyLocalized = splitTitle('Ceremonial Scouting', '套装');
  scope.headings = [alreadyLocalized];
  api.translateECGearsetNames();
  assert.equal(alreadyLocalized.nodes.map(x => x.nodeValue).join(''), '仪仗游击套装',
    '通用词典先把 Set 翻译为套装的场景也不能重复');
  const outfit = splitTitle('Yozakura');
  scope.headings = [outfit];
  api.translateECGearsetNames();
  assert.equal(outfit.nodes.map(x => x.nodeValue).join(''), '夜樱装束',
    '已有装束后缀的标题不应叠加一层套装');
  // EC 详情页也会出现 <b>Hempen Viera Male</b> Set (Set 为直接文本节点)。
  const directTextH1 = splitTitle('Hempen Viera Male');
  scope.headings = [directTextH1];
  api.translateECGearsetNames();
  assert.equal(directTextH1.nodes.map(x => x.nodeValue).join(''), '维埃拉族男性贴身衣套装');
  // 模拟局部 DOM 增量刷新：rootArg 是 H1 内的 span，应向上定位所属标题。
  const incremental = splitTitle('Phantom Vision Fending');
  const partial = { nodeType: 1, closest: selector => selector === 'h1' ? incremental : null };
  scope.headings = [];
  api.translateECGearsetNames(partial);
  assert.equal(incremental.nodes.map(x => x.nodeValue).join(''), '幻境意象御敌套装',
    'H1 内局部更新不会漏译标题或重复后缀');
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
    '\nreturn { isECGearsetsPage, resolveSearchNative, findSearchInput, submitECGearsetsSearch };')(
  search, q => q === '测试物品' ? 'Native Test Item' : null,
  q => q === '女仆' ? 'Maid' : q === '装束' ? 'Wrong-Item' : null,
  api.suggestECGearsetsByZh, () => []);
try {
  globalThis.location = { hostname: 'ffxiv.eorzeacollection.com', pathname: '/gearsets' };
  assert.equal(searchApi.isECGearsetsPage(), true);
  // 取自用户审计：EC 真实表单中搜索框 name/id 为空、placeholder=搜索、
  // type=text、form 存在；不能在表单提交时误选旁边的其它筛选输入框。
  const actualSearch = {
    tagName: 'INPUT', className: 'input is-background is-rounded has-background-background',
    disabled: false, readOnly: false, isConnected: true, value: '女仆',
    getAttribute(name) {
      return ({ type: 'text', name: '', id: '', placeholder: '搜索' })[name] ?? null;
    },
  };
  const adjacentFilter = {
    tagName: 'INPUT', className: 'vs__search', disabled: false, readOnly: false,
    getAttribute(name) {
      return ({ type: 'search', name: '', placeholder: 'Search for option' })[name] ?? null;
    },
  };
  const form = { querySelectorAll: () => [adjacentFilter, actualSearch] };
  assert.equal(searchApi.findSearchInput(form), actualSearch,
    '真实 EC 主搜索框在同一 form 含其它输入框时仍必须被识别');
  const destinations = [];
  globalThis.location.href = 'https://ffxiv.eorzeacollection.com/gearsets?search=%E6%97%A7&page=9&filter%5Bjob%5D=PLD';
  globalThis.location.assign = url => destinations.push(new URL(url));
  for (const [zh, native] of [['女仆', "Loyal Housemaid's"],
    ['兽王', "Beastmaster's"], ['东方', 'Eastern']]) {
    actualSearch.value = zh;
    assert.equal(searchApi.submitECGearsetsSearch(actualSearch), true, zh + ' 可以触发专用搜索提交');
    assert.equal(destinations.at(-1).searchParams.get('search'), native,
      zh + ' 应提交网站认识的英文标题/公共关键词');
    assert.equal(destinations.at(-1).searchParams.has('page'), false, '搜索重置旧分页');
    assert.equal(destinations.at(-1).searchParams.get('filter[job]'), 'PLD',
      '搜索保留原有筛选条件');
  }
  actualSearch.value = '尚未收录';
  assert.equal(searchApi.submitECGearsetsSearch(actualSearch), false, '未知中文不能臆造英文关键词');
  assert.equal(destinations.length, 3, '未知查询不得额外触发提交');
  assert.equal(searchApi.resolveSearchNative('御敌', true), 'Fending');
  assert.equal(searchApi.resolveSearchNative('幻境', true), 'Phantom Vision');
  assert.equal(searchApi.resolveSearchNative('女仆', true), "Loyal Housemaid's",
    '套装实际标题优先于单件物品的 Maid 模糊回退');
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
