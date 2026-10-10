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

const scope = { anchors: [], accessoryAnchors: [], headings: [] };
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
const mockQuery = (_root, selector) => selector.includes('/accessories/') ? scope.accessoryAnchors
  : selector.startsWith('a[href') ? scope.anchors : selector === 'h1' ? scope.headings : [];
let dictRevision = 0;
let itemIndex = Object.create(null);
const api = new Function('DICT_EC', 'dictGetRevision', 'dataGetIndex', 'document', 'NodeFilter', 'localScope', 'queryIn', source.slice(start, end) +
  '\nreturn { ecGearsetDisplayName, ecAccessoryDisplayName, ecAccessoryDeepStatSeriesZh, inferECAccessorySeriesFromItems, resolveECGearsetSearch, suggestECGearsetsByZh, translateECGearsetNames, inferECGearsetsFromItems, ecGearsetOfficialOutfitRows };')(
  DICT_EC, () => dictRevision, () => Object.keys(itemIndex).length ? itemIndex : null,
  doc, { SHOW_TEXT: 4 }, node => node || scope, mockQuery);

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
// Runtime V3 `build/make-runtime-data.py` preserves the FIRST valid English
// entry, not Map(last-write-wins). Mirror production precisely: duplicate
// names in the canonical TSV can have different Chinese aliases later on.
const officialRows = new Map();
for (const line of fs.readFileSync(path.join(root, 'data/ff14-items.tsv'), 'utf8').split('\n')) {
  const row = line.split('\t');
  if (row.length < 3) continue;
  const [zh, en] = [row[1], row[2]];
  if (en && zh && !officialRows.has(en)) officialRows.set(en, zh);
}
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

// Full-source category audit: do not validate a tiny handpicked set while
// omitting the hundreds of official outfit packages. The English-to-Chinese
// fixtures below are copied from the actual 50k-row game dataset at runtime.
const allOutfits = [...officialRows.entries()].filter(([native, zh]) =>
  /^.+? (?:Attire|Armor)(?: (?:\([^()]{1,60}\)|\[[^\]]{1,40}\]))?$/.test(native)
  && /(?:套装|装束)$/u.test(zh));
assert.ok(allOutfits.length > 450,
  '国服物品表至少应有 450 个可作为套装搜索候选的英文衣装/防具包');
for (const [native, zh] of allOutfits) itemIndex[native] = zh;
dictRevision++;
const officialOutfitRows = api.ecGearsetOfficialOutfitRows(itemIndex);
assert.ok(officialOutfitRows.length >= allOutfits.length,
  '通用分类算法覆盖所有与国服官方数据匹配的 Attire/Armor 物品');
for (const [name, zh] of [
  ["Antecedent's Attire", '血盟女士套装'],
  ["Head Engineer's Attire", '首席机械师套装'],
  ["Scion Striker's Attire", '血盟拳手套装'],
  ["Gaia's Attire", '盖娅服装套装'],
  ['Uraeus Attire (Coat)', '圣蜥蜴革外套套装'],
  ['Wool Attire (Suspenders)', '呢绒背带衬衫套装'],
]) {
  assert.equal(officialRows.get(name), zh, '国服原始记录必须支持例证：' + name);
  const native = name.replace(/ (?:Attire|Armor)(?= |$)/, '');
  assert.ok(officialOutfitRows.some(row => row.native === native && row.zh === zh
    && row.provisional === true), '单款／单套衣装可以提供标明待确认的候选：' + native);
  assert.equal(tr(native), zh, '实际 EC 标题如果与官方包名一致应正确汉化：' + native);
}
assert.ok(!officialOutfitRows.some(row => row.native === 'Sake'),
  'Sake Set 等家具物品不能假冒可穿戴 Gearset 候选');
assert.ok(!officialOutfitRows.some(row => row.native === 'Toy Cooking'),
  '非服装类 Set 必须被排除');
assert.ok(!officialOutfitRows.some(row => row.native === 'Heavy Iron'),
  '无套装／装束中文后缀的普通防具不能进入搜索');
assert.equal(api.resolveECGearsetSearch('首席机械师'), "Head Engineer's",
  '单款国服套装名输入后可直接转换为英文系列搜索');
assert.ok(api.suggestECGearsetsByZh('血盟女士').some(row => row.native === "Antecedent's"
  && row.provisional), '宽泛官方目录标识未核验 EC 页面');
assert.equal(tr("Royal Seneschal's"), '总管套装',
  '已核验的 EC 词典译名优先于泛化的官方物品别名');
itemIndex['Uncatalogued Steward Attire'] = '测试侍从套装';
itemIndex["Far Eastern Uncatalogued Socialite's Attire"] = '测试东方式社交服套装';
assert.equal(tr("Uncatalogued Steward's"), '测试侍从套装',
  '仅已出现的 EC 标题可安全尝试官方游戏物品不含所有格的英文别名');
assert.equal(tr("Eastern Uncatalogued Socialite's"), '测试东方式社交服套装',
  'EC 标题省略 Far 时可使用官方完整 Far Eastern 物品名');
assert.equal(api.resolveECGearsetSearch('女仆'), "Loyal Housemaid's",
  '广义官方包候选不能挤掉已在 EC 实测的女仆专用别名');

// EC often elides "Attire" / "Set" before parenthesized variants.
// Audit all official Chinese outfit packages from the real TSV, not hardcoded
// one-off translations. These are runtime data fixtures, not new manual entries.
const variants = [...officialRows.entries()]
  .map(([native, zh]) => ({
    native, zh,
    hit: /^(.+?) (Attire|Armor|Set|Outfit) (\([^)]{1,60}\)|\[[^\]]{1,40}\])$/.exec(native),
  }))
  .filter(row => row.hit && /(?:套装|装束)$/u.test(row.zh));
assert.ok(variants.length >= 50, '国服 TSV 必须包含足够多的括号变体套装测试样本');
for (const { native, zh, hit } of variants) {
  itemIndex[native] = zh;
  const ec = hit[1] + ' ' + hit[3];
  assert.equal(tr(ec), zh, 'EC 省略套装物品类型后也要使用国服准确名称：' + ec);
  assert.equal(tr(ec + ' Set'), zh, '括号变体附带 Set 后缀：' + ec);
}
for (const [ec, native, expected] of [
  ['Wintertide (Culottes)', 'Wintertide Attire (Culottes)', '冬季宽松直筒裤套装'],
  ['Wintertide (Sheath Skirt)', 'Wintertide Attire (Sheath Skirt)', '冬季紧身短裙套装'],
  ['Collegiate (Slacks)', 'Collegiate Attire (Slacks)', '学院长裤套装'],
  ['Yakaku (Koshita)', 'Yakaku Attire (Koshita)', '夜鹤装束'],
  ['Rainbow (Justaucorps)', 'Rainbow Set (Justaucorps)', '虹布紧身上衣套装'],
  ['Valentione Rose (Dress)', 'Valentione Rose Attire (Dress)', '玫瑰花恋人礼服套装'],
]) {
  assert.equal(officialRows.get(native), expected, '独立官方数据检查：' + native);
  assert.equal(tr(ec), expected, '必须命中官方译名而不是机械拼接：' + ec);
  assert.equal(tr(ec + ' Crafted Glamour'), expected + ' 制作幻化',
    '套装目录卡片附带来源文本：' + ec);
}
assert.equal(tr('Wintertide (Unknown Variant)'), null,
  '没有国服套装物品的变体不应凭空生成');
assert.equal(tr('Completely New (Culottes)'), null, '不能按括号关键词猜造不存在的套装');
// Runtime V3 nameMap is replaced as one ready dataset; the test injects the
// same records in-place, so explicitly invalidate the cached test catalogue.
dictRevision++;
// Both Wintertide variants are independently verified to exist on the EC site.
// The search catalogue derives these from the two official Attire item rows;
// no manual per-series translated alias is added.
const winterRows = api.suggestECGearsetsByZh('冬季');
for (const [native, zh] of [
  ['Wintertide (Culottes)', '冬季宽松直筒裤套装'],
  ['Wintertide (Sheath Skirt)', '冬季紧身短裙套装'],
]) {
  assert.ok(winterRows.some(row => row.native === native && row.zh === zh),
    '「冬季」应包含 EC 上实际存在的 ' + native);
}
assert.equal(winterRows.filter(row => row.native.startsWith('Wintertide (')).length, 2,
  '两种冬季裙装变体应各显示一次');
assert.equal(api.resolveECGearsetSearch('冬季'), 'Wintertide',
  '两个变体的中文公共词必须解析成站点能检索两套的英文系列 Wintertide');
assert.equal(api.resolveECGearsetSearch('冬季宽松直筒裤'), 'Wintertide (Culottes)');
assert.equal(api.resolveECGearsetSearch('冬季紧身短裙'), 'Wintertide (Sheath Skirt)');
assert.equal(api.suggestECGearsetsByZh('不存在的冬季款式').length, 0,
  '不可猜测或生成国服物品库没有的冬季变体');

const variantH1 = {
  tagName: 'H1', nodes: [
    { nodeValue: 'Wintertide (Culottes)' }, { nodeValue: '套装' },
  ],
};
const variantLink = { nodes: [{ nodeValue: 'Wintertide (Sheath Skirt)' }] };
const variantOldLocation = globalThis.location;
try {
  globalThis.location = { pathname: '/gearset/wintertide', hostname: 'ffxiv.eorzeacollection.com' };
  scope.anchors = [variantLink];
  scope.headings = [variantH1];
  api.translateECGearsetNames();
  assert.equal(variantH1.nodes.map(n => n.nodeValue).join(''), '冬季宽松直筒裤套装',
    '套装详情页独立 Set 标记不重复');
  assert.equal(variantLink.nodes[0].nodeValue, '冬季紧身短裙套装',
    'Related Sets 卡片翻译不能遗漏另一种括号变体');
  api.translateECGearsetNames();
  assert.equal(variantH1.nodes.map(n => n.nodeValue).join(''), '冬季宽松直筒裤套装',
    '反复 DOM 更新保持幂等');
} finally {
  scope.anchors = [];
  scope.headings = [];
  globalThis.location = variantOldLocation;
}

// The EC /accessories catalogue is separate from Gearsets. The English
// series name appears with or without "Accessories" on cards and detail H1.
// Use multiple distinct localized jewelry item parts as automatic evidence.
Object.assign(itemIndex, {
  'Earrings of the Sea-folk': '海族耳坠',
  'Collar of the Sea-folk': '海族假领',
  'Bracelets of the Sea-folk': '海族手环',
  'Ring of the Sea-folk': '海族戒指',
  'Occult Earrings of Blood': '力之新月魔耳饰',
  'Occult Necklace of Blood': '力之新月魔项链',
  'Occult Bracelet of Blood': '力之新月魔手镯',
  'Occult Ring of Blood': '力之新月魔戒指',
  'Occult Earrings of Magic': '魔之新月魔耳饰',
  'Occult Necklace of Magic': '魔之新月魔项链',
  'Occult Bracelet of Magic': '魔之新月魔手镯',
  'Occult Ring of Magic': '魔之新月魔戒指',
  'Occult Ring of Deep Blood': '超力之新月魔戒指',
  'Occult Ring of Deep Magic': '超魔之新月魔戒指',
  "Courtly Lover's Earrings of Fending": '华美恋人御敌耳坠',
  "Courtly Lover's Choker of Fending": '华美恋人御敌项环',
  "Courtly Lover's Wristlet of Fending": '华美恋人御敌腕饰',
  "Courtly Lover's Ring of Fending": '华美恋人御敌戒指',
  'Other Earrings of Fending': '不同主题御敌耳环',
  'Other Necklace of Fending': '无关款式御敌项链',
  'Other Bracelet of Fending': '不一致御敌手镯',
  'Other Ring of Fending': '杂项御敌戒指',
  'Arena Earring of Slaying': '斗技强攻耳坠',
  'Arena Necklace of Slaying': '斗技强攻项链',
  'Arena Bracelet of Slaying': '斗技强攻手镯',
  'Arena Ring of Slaying': '斗技强攻戒指',
  'Clip-only Earring of Slaying': '孤立强攻耳坠',
  'Clip-only Ear Cuff of Slaying': '孤立强攻耳夹',
  'Clip-only Ear Clip of Slaying': '孤立强攻耳饰',
  'Unrecognized Ear Cuff of Mystery': '假想战斗耳夹',
  'Unrecognized Necklace of Mystery': '假想战斗项链',
  'Unrecognized Ring of Mystery': '假想战斗戒指',
});
dictRevision++;
const accessories = api.ecAccessoryDisplayName;
assert.equal(accessories('Praemagitek Accessories'), '前魔导饰品',
  '已确认系列通过现有词典为 /accessories 详情标题汉化');
assert.equal(accessories('Alpha Wolf Accessories'), '头狼饰品',
  '已有 Gearsets 专用「头狼套装」译名需改用饰品后缀');
assert.equal(accessories('Sea-folk Accessories'), '海族饰品',
  '新饰品系列自动由多件官方饰品中文前缀推导');
assert.equal(accessories("Courtly Lover's Accessories"), '华美恋人饰品',
  '单个职能的四类饰品可剥离职能结尾，不误当作「御敌饰品」');
assert.equal(accessories("Courtly Lover's Crafted Sets"), '华美恋人饰品 制作套装',
  '系列卡片名称与获取方式同节点也能译');
assert.equal(accessories('Other Accessories'), null,
  '不同系列装备没有中文共同前缀时不应猜造译名');
assert.equal(accessories('Arena Accessories'), '斗技饰品',
  'Slaying 强攻饰品应推导中文系列名');
assert.equal(accessories('Clip-only Accessories'), null,
  '三种耳饰形态不能冒充两个独立的饰品部位');
assert.equal(accessories('Unrecognized Accessories'), null,
  '不属于游戏装备角色的英文 of 后缀不得进入自动饰品系列推导');
assert.equal(accessories('Occult Accessories'), '新月魔饰品',
  'Blood/Magic 属性型饰品应按验证过的国服前缀推导共用系列');
assert.equal(accessories('Occult Deep Accessories'), '超新月魔饰品',
  '已观测的 Deep 变体只在两种官方属性译名的共同中文系列严格一致时标注描述性名称');
assert.equal(api.ecAccessoryDeepStatSeriesZh('Occult Deep', {
  'Occult Ring of Deep Blood': '超力之新月魔戒指',
  'Occult Ring of Deep Magic': '超魔之不同系列戒指',
}), null, '两个官方属性变体不一致时不得推导 Deep 名称');
assert.equal(accessories('Accessories'), null,
  '网站导航的 Accessories 词不能识别为套装系列');
const inferredAccessories = api.inferECAccessorySeriesFromItems(itemIndex);
assert.ok(inferredAccessories.some(x => x.native === 'Sea-folk' && x.zh === '海族'),
  '多件不同饰品支持系列中文提取');
assert.ok(!inferredAccessories.some(x => x.native === 'Other'),
  '四件互不相关的中文前缀必须拒绝');

const oldAccLocation = globalThis.location;
try {
  globalThis.location = { pathname: '/accessories/praemagitek', hostname: 'ffxiv.eorzeacollection.com' };
  const accessoryH1 = {
    tagName: 'H1',
    nodes: [{ nodeValue: 'Praemagitek' }, { nodeValue: 'Accessories' }],
  };
  const accessoryLink = {
    href: '/accessories/sea-folk',
    nodes: [{ nodeValue: 'Sea-folk Dungeon Drop' }],
  };
  scope.headings = [accessoryH1];
  scope.accessoryAnchors = [accessoryLink];
  api.translateECGearsetNames();
  assert.equal(accessoryH1.nodes.map(n => n.nodeValue).join(''), '前魔导饰品',
    'H1 分离的 Accessories 不能重复叠加「饰品饰品」');
  assert.equal(accessoryLink.nodes[0].nodeValue, '海族饰品 ' + DICT_EC['Dungeon Drop'],
    '饰品列表及相关套装卡片的链接正文汉化，不改动 href');
  assert.equal(accessoryLink.href, '/accessories/sea-folk');
  api.translateECGearsetNames();
  assert.equal(accessoryH1.nodes.map(n => n.nodeValue).join(''), '前魔导饰品',
    '饰品 H1 多次 DOM 扫描后保持幂等');
  const duplicatedSuffix = { tagName: 'H1', nodes: [
    { nodeValue: 'Mistic Memory Accessories' }, { nodeValue: 'Accessories' },
  ] };
  scope.headings = [duplicatedSuffix];
  api.translateECGearsetNames();
  assert.equal(duplicatedSuffix.nodes.map(n => n.nodeValue).join(''), '雾忆饰品',
    '内联和独立 Accessories 同时存在时不能重复后缀');
  const withSource = { tagName: 'H1', nodes: [
    { nodeValue: 'Mistic Memory Dungeon Drop' }, { nodeValue: 'Accessories' },
  ] };
  scope.headings = [withSource];
  api.translateECGearsetNames();
  assert.equal(withSource.nodes.map(n => n.nodeValue).join(''), '雾忆饰品 ' + DICT_EC['Dungeon Drop'],
    '套装来源与系列同节点时不应重复饰品后缀');
  scope.headings = [accessoryH1];
  const nested = {
    nodeType: 1,
    closest: selector => selector === 'h1' ? accessoryH1 : null,
  };
  scope.headings = [];
  api.translateECGearsetNames(nested);
  assert.equal(accessoryH1.nodes.map(n => n.nodeValue).join(''), '前魔导饰品',
    '饰品 H1 局部更新可回溯标题祖先');

  globalThis.location.pathname = '/accessories';
  const list = { href: '/accessories/courtly-lovers', nodes: [{ nodeValue: "Courtly Lover's Crafted Sets" }] };
  scope.accessoryAnchors = [list];
  api.translateECGearsetNames();
  assert.equal(list.nodes[0].nodeValue, '华美恋人饰品 制作套装',
    '饰品首页卡片自动显示国服系列中文');
  globalThis.location.pathname = '/gearsets';
  const unrelated = { nodes: [{ nodeValue: "Courtly Lover's Crafted Sets" }] };
  scope.accessoryAnchors = [];
  scope.anchors = [unrelated];
  api.translateECGearsetNames();
  assert.equal(unrelated.nodes[0].nodeValue, "Courtly Lover's Crafted Sets",
    '不可把饰品系列错译成 Gearsets 装备套装');
} finally {
  scope.anchors = [];
  scope.accessoryAnchors = [];
  scope.headings = [];
  globalThis.location = oldAccLocation;
}

// Check inference against the actual official dataset, not just synthetic rows.
// Page existence still requires a matching EC /accessories link.
const officialAccessories = Object.fromEntries(officialRows);
const realAccessories = api.inferECAccessorySeriesFromItems(officialAccessories);
for (const [native, zh] of [
  ['Sea-folk', '海族'], ['Occult', '新月魔'],
  ['Bygone Brass', '王国黄铜'], ['Heavyweight', '重量级'],
]) {
  assert.equal(realAccessories.find(row => row.native === native)?.zh, zh,
    native + ' 必须基于仓库真实国服物品表推导，不得仅用虚构数据通过测试');
}
assert.ok(realAccessories.length >= 20,
  '国服真实物品库必须支持至少二十个独立饰品系列的高置信推导');
assert.equal(api.ecAccessoryDeepStatSeriesZh('Occult Deep', officialAccessories), '超新月魔',
  'Deep 描述性名称必须由真实国服物品表中的两个属性版本共同支持');
// 2026-10 EC 饰品首页实页系列名：用完整国服数据模拟 V3 数据就绪。
// 先前的轻量 itemIndex 仅包含精心构造的单测夹具，不能用它冒充正式数据。
const accessoryFixtureIndex = itemIndex;
itemIndex = officialAccessories;
dictRevision++;
try {
  for (const [en, zh] of [
    ["Beastmaster's", '兽主'], ['Praemagitek', '前魔导'],
    ['Sea-folk', '海族'], ['Bygone Brass', '王国黄铜'],
    ["Courtly Lover's", '宫廷爱人'], ['Heavyweight', '重量级'],
    ['Mistwake', '雾迹'], ['Star Tech', '星际科技'],
    ['Occult', '新月魔'], ['Occult Deep', '超新月魔'],
    ['Alpha Wolf', '头狼'], ["En Fortune-teller's", '恩城预言师'],
    ["Realm-roamer's", '维度漫游者'], ['Mistic Memory', '雾忆'],
  ]) {
    assert.equal(api.ecAccessoryDisplayName(en + ' Accessories'), zh + '饰品',
      'EC 饰品首页已出现系列必须能在完整国服物品表加载后汉化：' + en);
  }
} finally {
  itemIndex = accessoryFixtureIndex;
  dictRevision++;
}
for (const series of realAccessories.slice(0, 100)) {
  assert.ok(series.zh.length >= 2 && !/(?:套装|装束)$/u.test(series.zh),
    '真实饰品系列使用中文基础系列名，而非既有 Gearsets 套装名');
}

// 2026-10 用户实测的生产／采集漏译。数据直接取仓库真实国服 TSV，
// 不在测试里伪造国服译名，也不手动登记套装目录来绕开自动推导。
for (const [title, names, prefix, expected] of [
  ["Everseeker's Crafting", [
    "Everseeker's Headgear of Crafting", "Everseeker's Top of Crafting",
    "Everseeker's Armguards of Crafting", "Everseeker's Slops of Crafting",
    "Everseeker's Workboots of Crafting",
  ], '探求永恒巧匠', '探求永恒巧匠套装'],
  ["Everseeker's Gathering", [
    "Everseeker's Goggles of Gathering", "Everseeker's Coat of Gathering",
    "Everseeker's Work Gloves of Gathering", "Everseeker's Kecks of Gathering",
    "Everseeker's Shoes of Gathering",
  ], '探求永恒大地', '探求永恒大地套装'],
]) {
  for (const native of names) {
    const zh = officialRows.get(native);
    assert.ok(zh?.startsWith(prefix), native + ' 必须使用已有的国服装备译名');
    itemIndex[native] = zh;
  }
  // 先建立 V3 倒排再验证新增标题：有单件装备不等于硬编码了套装。
  dictRevision++;
  assert.equal(tr(title), expected, title + ' 可以完全自动推导');
  assert.equal(tr(title + ' Set'), expected, title + ' 含 Set 后缀仍正确');
  const suggested = api.suggestECGearsetsByZh(prefix);
  assert.ok(suggested.some(r => r.native === title && r.zh === expected),
    title + ' 进入中文套装搜索候选');
  assert.equal(api.resolveECGearsetSearch(prefix), title,
    title + ' 中文检索转换为真实 EC 英文标题');
}
assert.equal(DICT_EC['Crafting'], '制作', '全站 UI「Crafting」含义不能为装备套装更改');
assert.equal(tr("Everseeker's Crafting Crafted Sets"),
  '探求永恒巧匠套装 制作套装', '目录卡片同时出现来源标签时准确转换');
const everseekerH1 = {
  tagName: 'H1',
  nodes: [{ nodeValue: "Everseeker's Crafting" }, { nodeValue: '套装' }],
};
const beforeLocation = globalThis.location;
try {
  globalThis.location = { pathname: '/gearset/everseekers-crafting', hostname: 'ffxiv.eorzeacollection.com' };
  scope.headings = [everseekerH1];
  api.translateECGearsetNames();
  assert.equal(everseekerH1.nodes.map(n => n.nodeValue).join(''), '探求永恒巧匠套装',
    '已汉化的独立 Set 标签不能导致「套装套装」');
  api.translateECGearsetNames();
  assert.equal(everseekerH1.nodes.map(n => n.nodeValue).join(''), '探求永恒巧匠套装',
    '重复 DOM 翻译必须幂等');
  const duplicatedSet = { tagName: 'H1', nodes: [
    { nodeValue: "Everseeker's Crafting Set" }, { nodeValue: 'Set' },
  ] };
  scope.headings = [duplicatedSet];
  api.translateECGearsetNames();
  assert.equal(duplicatedSet.nodes.map(n => n.nodeValue).join(''), '探求永恒巧匠套装',
    '内联和独立 Set 同时存在时不能重复后缀');
} finally {
  globalThis.location = beforeLocation;
  scope.headings = [];
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
    ['兽王', "Beastmaster's"], ['东方', 'Eastern'],
    ['冬季', 'Wintertide'], ['冬季宽松直筒裤', 'Wintertide (Culottes)'],
    ['冬季紧身短裙', 'Wintertide (Sheath Skirt)']]) {
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
  assert.equal(destinations.length, 6, '未知查询不得额外触发提交');
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
