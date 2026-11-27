import { DICT_EC, dictGetRevision } from '../../core/data/dictionary.js';
import { dataGetIndex } from '../../core/data/data-manager.js';
import { isECSeriesLink } from '../../core/content-scope.js';
import { localScope, queryIn } from '../../core/dom.js';

export {
  ecAccessoryDisplayName, ecGearsetDisplayName, ecTitleRoots,
  resolveECGearsetSearch, suggestECGearsetsByZh, translateECGearsetNames,
};

// EC /gearsets 标题不是单件物品：按系列 + 职能合成，不能交给 resolveByName
// 的装备卡片链（否则找不到译名，还可能将套装链接改写到灰机物品页）。
// 系列译名取自 dict-ec.json，只有经确认的系列参与转换，未知名称保留英文。
// Gearsets 的英文标题不是单件物品名。只收录在 EC Gearsets 页面确认存在、
// 且译名可由国服物品表核验的系列；未知套装仍保留英文，避免猜译。
// 为避免把不存在的角色套装列为搜索候选，每个系列单独声明实际职能。
const EC_GEARSET_ROLES = ['Fending', 'Maiming', 'Striking', 'Scouting', 'Aiming', 'Casting', 'Healing'];
const EC_GEARSET_ROLE_SERIES = new Map([
  ['Phantom Vision', EC_GEARSET_ROLES],
  ["Vana'dielian", EC_GEARSET_ROLES],
  ['Praemagitek', EC_GEARSET_ROLES],
  ['Mistwake', EC_GEARSET_ROLES],
  ['Mistic Memory', EC_GEARSET_ROLES],
  ["War Cloud's", ['Fending', 'Maiming']],
  ["Prishe's", ['Striking']],
  ['Mayakov', ['Scouting', 'Aiming']],
  ['Orastery', ['Casting', 'Healing']],
]);
const EC_GEARSET_SINGLE_SERIES = new Set([
  "Beastmaster's", "Beast Herder's", "Successor's", 'Yozakura', "Zero's Luminary",
  "Avalanche Leader's", "Avalanche Brawler's",
  'Tule', 'Torna', 'Carwen', 'Tradewinds', "Neo Citizen's",
  'Plain Hooded', 'Festival Hooded', 'Succubus Hooded', 'Oversized Plain Hooded',
  'Graffiti Neotunic', 'Festival Neotunic', "Aunt Tii's Neotunic",
  "Fallen's", "En Fortune-teller's", "Realm-roamer's", "Vibran Princess's",
  'Galatea', 'Fuath', 'Hope [F]', 'Hope [M]', "Gaffgarion's", "Ovelia's",
  "Ramza's", 'Star Captain', 'Star Pilot', 'Alternative', 'Maritime',
  'Alpha Wolf', 'Eagleclaw', 'Star Tech Crafting', 'Star Tech Gathering',
]);
// Only verified EC Hoodie variants; never combine unknown set names or fits.
const EC_GEARSET_HOODED_BASES = ['Plain Hooded', 'Festival Hooded', 'Succubus Hooded'];
const EC_GEARSET_HOODED_FITS = Object.freeze({
  'Form-fitting': '修身',
  'Oversized': '大码',
});
// 这些译名核对自 data/source/ff14-items.tsv（装备前缀或对应的 Attire/Armor 套装物品）。
// 仅用于 EC Gearsets 标题，不混入单件装备译名与通用 UI 词典。
const EC_GEARSET_NAME_EXTRAS = Object.freeze({
  // EC live Gearsets catalogue, distinct from the same-named earring pages.
  "Avalanche Leader's": '雪崩领导者套装', // Item 52590
  "Avalanche Brawler's": '雪崩斗手套装', // Item 52589
  'Graffiti Neotunic': '涂鸦新式文化衫套装', // Items 52433–52435
  'Festival Neotunic': '欢庆新式文化衫套装',
  "Aunt Tii's Neotunic": '缇姨塔可饼新式文化衫套装',
  'Mistwake': '雾迹',
  'Mistic Memory': '雾忆',
  "War Cloud's": '沃·克劳德',
  "Prishe's": '普利修',
  'Mayakov': '马雅科夫',
  'Orastery': '口之院',
  "Fallen's": '堕落套装',
  "En Fortune-teller's": '恩城预言师套装',
  "Realm-roamer's": '维度漫游者套装',
  "Vibran Princess's": '威布拉公主套装',
  'Galatea': '伽拉忒亚装备套装',
  'Fuath': '水妖装束',
  'Hope [F]': '希望套装【女】',
  'Hope [M]': '希望套装【男】',
  "Gaffgarion's": '加夫加利昂装备套装',
  "Ovelia's": '奥薇莉亚装备套装',
  "Ramza's": '拉姆萨装备套装',
  'Star Captain': '宇宙舰长套装',
  'Star Pilot': '宇宙驾驶员套装',
  'Alternative': '另类装备套装',
  'Maritime': '滨海套装',
  'Alpha Wolf': '头狼套装',
  'Eagleclaw': '雕爪套装',
  'Star Tech Crafting': '星际科技巧匠套装',
  'Star Tech Gathering': '星际科技大地套装',
});
// EC labels every /gearset page "Set", but these verified pages each
// link to just one official item (FFXIV item IDs 50285–50290 and 50849).
// Use the item's official name even when EC drops its fit from the title.
const EC_SINGLE_ITEM_GEARSETS = new Map([
  ['Blooming Eyeglasses', '彩花装饰眼镜'],
  ['Chicken Eyeglasses', '彩蛋小鸡眼镜'],
  ['Painted Eggy Eyeglasses', '装饰彩蛋眼镜'],
  ['Party Eggy Eyeglasses', '四颗彩蛋眼镜'],
  ['Slim Frame Eggy Eyeglasses', '窄框彩蛋眼镜'],
  ['Spriggan Eyeglasses', '魔石精眼镜'],
  ['Masha Neotunic', '大码马夏文化衫'],
]);
// 分类后缀仅用于解析卡片同节点文本；不允许把来源名误识别为套装名。
const EC_GEARSET_SOURCES = [
  'Battle Content Gear', 'Other Content Gear', 'Grand Company Gear',
  'Seasonal Event Gear', 'Job Artifact Armor', 'Tomestones Exchange',
  'Scrips Exchange', 'Achievement Reward', 'Gold Saucer Prize',
  'Crafted Glamour', 'Crafted Sets', 'Dungeon Drop', 'Trial Drop',
  'Raid Gear', 'Token Exchange', 'Quest Reward', 'Mogstation Set',
  'Promotional Set', 'PVP Gear', 'Bought in Shop',
];

function ecGearsetSeriesZh(en) {
  return EC_GEARSET_NAME_EXTRAS[en] || DICT_EC[en] || null;
}

// EC Gearsets uses "Crafting/Gathering" as equipment roles; ordinary UI
// translation "Crafting → 制作" is not an official equipment-name suffix.
const EC_GEARSET_ITEM_ROLES = /^(.*?) of (Fending|Maiming|Striking|Scouting|Aiming|Casting|Healing|Crafting|Gathering)$/;
const EC_GEARSET_TITLE_ROLES = /^(.*?) (Fending|Maiming|Striking|Scouting|Aiming|Casting|Healing|Crafting|Gathering)$/;
const EC_GEARSET_NONCOMBAT_ROLE_ZH = Object.freeze({ Crafting: '巧匠', Gathering: '大地' });
function ecGearsetRoleZh(role) {
  return EC_GEARSET_NONCOMBAT_ROLE_ZH[role] || DICT_EC[role] || null;
}

// 自动推导仅使用 V3 已有的官方英中装备映射，不维护逐套名单：
// 如 3 件 Ceremonial ... of Scouting 同时映射至「仪仗游击...」，
// 则推断 Ceremonial Scouting → 仪仗游击套装。
// 依赖“多件独立装备 + 共同中文前缀 + 与英文职能一致”三重校验；
// 达不到阈值时保留原英文，防止猜造非官方的套装名称。
function ecGearsetCommonZhPrefix(names) {
  if (names.length < 3) return '';
  let prefix = names[0];
  for (const name of names.slice(1)) {
    while (prefix && !name.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) break;
  }
  return prefix;
}

function ecGearsetAddInferredGroups(grouped, native, zh, englishPart, role) {
  const words = englishPart.split(' ');
  for (let n = 1; n < words.length && n <= 4; n++) {
    const title = words.slice(0, n).join(' ') + ' ' + role;
    if (!grouped.has(title)) grouped.set(title, new Map());
    grouped.get(title).set(native, zh);
  }
}

function ecGearsetInferredRow(native, items) {
  if (items.size < 3) return null;
  const names = [...new Set(items.values())];
  if (names.length < 3) return null;
  const prefix = ecGearsetCommonZhPrefix(names);
  const role = native.slice(native.lastIndexOf(' ') + 1);
  const roleZh = ecGearsetRoleZh(role);
  if (!roleZh || prefix.length < roleZh.length + 2 || !prefix.endsWith(roleZh)
      || prefix.length > 22) return null;
  return { native, zh: prefix + '套装' };
}

function inferECGearsetsFromItems(nameIndex) {
  const grouped = new Map();
  for (const [native, zh] of Object.entries(nameIndex || {})) {
    const hit = EC_GEARSET_ITEM_ROLES.exec(native);
    if (!hit || !/^[\u3400-\u9fff]/u.test(zh)) continue;
    const roleZh = ecGearsetRoleZh(hit[2]);
    if (!roleZh || !zh.includes(roleZh)) continue;
    ecGearsetAddInferredGroups(grouped, native, zh, hit[1], hit[2]);
  }
  const derived = [];
  for (const [native, items] of grouped) {
    const row = ecGearsetInferredRow(native, items);
    if (row) derived.push(row);
  }
  return derived;
}

// Game outfit packages use "Attire (Variant)" while EC shows "(Variant)"
// with the package type removed. Two distinct officially named variants of
// the same series give strong evidence for a shared native series search.
// Suggestions are site searches, never invented direct /gearset links.
function ecGearsetOfficialVariantRows(nameIndex) {
  const grouped = new Map();
  const pattern = /^(.+?) (?:Attire|Armor|Set|Outfit) (\([^()]{1,60}\)|\[[^\]]{1,40}\])$/;
  for (const [item, zh] of Object.entries(nameIndex || {})) {
    const match = pattern.exec(item);
    if (!match || !/[\u3400-\u9fff]/u.test(zh)
        || !/(?:套装|装束)$/u.test(zh)) continue;
    const native = match[1] + ' ' + match[2];
    if (!grouped.has(match[1])) grouped.set(match[1], new Map());
    grouped.get(match[1]).set(native, zh);
  }
  const rows = [];
  for (const variants of grouped.values()) {
    if (variants.size < 2) continue;
    for (const [native, zh] of variants) rows.push({ native, zh });
  }
  return rows;
}

// Official game outfit packages also cover standalone and single-variant
// sets. They do NOT prove the corresponding EC Gearset page exists, so rows
// from this broad catalogue are provisional search suggestions only.
// Never invent or navigate to a /gearset/<slug> link from these entries.
function ecGearsetOfficialOutfitRows(nameIndex) {
  const rows = [];
  const pattern = /^(.+?) (?:Attire|Armor)(?: (\([^()]{1,60}\)|\[[^\]]{1,40}\]))?$/;
  for (const [item, zh] of Object.entries(nameIndex || {})) {
    const match = pattern.exec(item);
    if (!match || !/[\u3400-\u9fff]/u.test(zh)
        || !/(?:套装|装束)$/u.test(zh)) continue;
    const native = match[1] + (match[2] ? ' ' + match[2] : '');
    rows.push({ native, zh, provisional: true });
  }
  return rows;
}

// Existing localized base + observed fit = descriptive label, not an
// invented official CN item name. Official outfit package always wins.
function ecGearsetHoodedVariantRows(nameIndex) {
  const rows = [];
  for (const base of EC_GEARSET_HOODED_BASES) {
    if (!EC_GEARSET_SINGLE_SERIES.has(base)) continue;
    const baseZh = ecGearsetSeriesZh(base);
    if (!baseZh?.endsWith('套装')) continue;
    for (const [fit, zhFit] of Object.entries(EC_GEARSET_HOODED_FITS)) {
      const native = fit + ' ' + base;
      const official = ecGearsetOfficialPackageZh(native, nameIndex);
      rows.push({
        native, zh: official || zhFit + baseZh,
        ...(official ? {} : { descriptive: true }),
      });
    }
  }
  return rows;
}

function ecGearsetKnownRows(nameIndex) {
  const rows = [];
  for (const [series, roles] of EC_GEARSET_ROLE_SERIES) {
    const zhSeries = ecGearsetSeriesZh(series);
    if (!zhSeries) continue;
    for (const role of roles) {
      const zhRole = DICT_EC[role];
      if (zhRole) rows.push({ native: series + ' ' + role, zh: zhSeries + zhRole + '套装' });
    }
  }
  for (const native of EC_GEARSET_SINGLE_SERIES) {
    const zh = ecGearsetSeriesZh(native);
    if (zh) rows.push({ native, zh });
  }
  const seen = new Set(rows.map(row => row.native));
  for (const row of ecGearsetHoodedVariantRows(nameIndex)) {
    if (!seen.has(row.native)) rows.push(row);
  }
  return rows;
}

function ecGearsetAppendInferredRows(rows, nameIndex) {
  if (!nameIndex) return;
  const seen = new Set(rows.map(row => row.native));
  // Truncating an item prefix can infer a second native title for a set we
  // already know (Phantom Fending vs. Phantom Vision Fending).
  const knownZh = new Set(rows.map(row => row.zh));
  const derived = [
    ...inferECGearsetsFromItems(nameIndex).filter(row => !knownZh.has(row.zh)),
    ...ecGearsetOfficialVariantRows(nameIndex),
    ...ecGearsetOfficialOutfitRows(nameIndex),
  ];
  for (const row of derived) {
    if (seen.has(row.native)) continue;
    rows.push(row);
    seen.add(row.native);
  }
}

// DOM 观察器可能频繁重扫，按词典修订号缓存，不在每次处理卡片时重建目录。
let _ecGearsetRows = null;
let _ecGearsetHadItemIndex = false;
let _ecGearsetRevision = -1;
function ecGearsetCatalog() {
  const revision = dictGetRevision();
  const nameIndex = dataGetIndex('nameMap');
  const hasItems = !!nameIndex;
  if (_ecGearsetRows && _ecGearsetRevision === revision && _ecGearsetHadItemIndex === hasItems) {
    return _ecGearsetRows;
  }
  const rows = ecGearsetKnownRows(nameIndex);
  ecGearsetAppendInferredRows(rows, nameIndex);
  _ecGearsetRows = rows;
  _ecGearsetRevision = revision;
  _ecGearsetHadItemIndex = hasItems;
  return rows;
}

function ecGearsetDescriptiveName(native) {
  // 站点的 Hempen <种族> <性别> 是服装搭配组合而非单条官方物品名。
  // 仅当页面确实出现该英文标题时，用固定语法生成【描述性】译名；
  // 不为未见过的种族变体创建搜索候选，也不宣称它是国服官方套装名。
  const match = /^Hempen (Au Ra|Hyur|Elezen|Miqo'te|Lalafell|Roegadyn|Viera|Hrothgar|Auri|Midlander|Highlander|Lalafellin) (Male|Female)$/.exec(native);
  if (!match) return null;
  const raceAliases = { Auri: 'Au Ra', Lalafellin: 'Lalafell' };
  const race = DICT_EC[raceAliases[match[1]] || match[1]];
  const gender = DICT_EC[match[2]];
  return race && gender ? race + gender + '贴身衣套装' : null;
}

// EC drops the item-type word from many official outfit items:
// "Wintertide Attire (Culottes)" -> displayed "Wintertide (Culottes)".
// Keep the parenthesized / bracketed variant exactly; the variant distinguishes
// genuinely different official sets such as Culottes vs Sheath Skirt.
// Only a real official item with an outfit-style Chinese name is accepted.
function ecGearsetOfficialPackageZh(native, nameIndex) {
  if (!nameIndex) return null;
  const match = /^(.+?) (\([^)]{1,60}\)|\[[^\]]{1,40}\])$/.exec(native);
  const base = match ? match[1] : native;
  const variant = match ? ' ' + match[2] : '';
  for (const type of [' Attire', ' Armor', ' Set', ' Outfit']) {
    const official = nameIndex[base + type + variant];
    if (official && /(?:套装|装束)$/u.test(official)) return official;
  }
  return null;
}

// A visible EC title is evidence that the set exists; official package
// lookups can translate it without adding speculative search suggestions.
function ecGearsetObservedTitleZh(native) {
  const singleItem = EC_SINGLE_ITEM_GEARSETS.get(native);
  if (singleItem) return singleItem;
  const exact = DICT_EC[native];
  if (exact && /[\u3400-\u9fff]/u.test(exact)) return exact;
  const parts = EC_GEARSET_TITLE_ROLES.exec(native);
  if (parts) {
    const series = DICT_EC[parts[1]];
    const role = ecGearsetRoleZh(parts[2]);
    if (series && role && /[\u3400-\u9fff]/u.test(series)
        && !/(?:套装|装束)$/u.test(series)) return series + role + '套装';
  }
  const nameIndex = dataGetIndex('nameMap');
  const official = ecGearsetOfficialPackageZh(native, nameIndex);
  if (official) return official;
  // Some EC titles add possessive 's (Royal Seneschal's) while the
  // official game package omits it (Royal Seneschal Attire).
  if (native.endsWith("'s")) {
    const withoutPossessive = ecGearsetOfficialPackageZh(native.slice(0, -2), nameIndex);
    if (withoutPossessive) return withoutPossessive;
  }
  // The site may elide "Far" (Eastern Socialite's vs Far Eastern
  // Socialite's); only apply this to an already observed Gearsets title.
  if (native.startsWith('Eastern ')) {
    return ecGearsetOfficialPackageZh('Far ' + native, nameIndex);
  }
  return null;
}

function ecGearsetDisplayName(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length > 110) return null;
  const source = EC_GEARSET_SOURCES.find(s => text.endsWith(' ' + s));
  const title = source ? text.slice(0, -(source.length + 1)) : text;
  const bare = title.endsWith(' Set') ? title.slice(0, -4) : title;
  const row = ecGearsetCatalog().find(r => r.native === bare);
  const zh = row?.zh || ecGearsetDescriptiveName(bare) || ecGearsetObservedTitleZh(bare);
  if (!zh) return null;
  const suffix = source ? ' ' + (DICT_EC[source] || source) : '';
  return zh + suffix;
}

// EC /accessories is a *series* catalogue, separate from /gearsets.
// Its titles omit the slot and often omit "Accessories" on the cards.
// Infer a shared game-localized series prefix from independent earrings,
// neckpieces, bracelets and rings rather than hardcoding every new release.
// Parse native names using strict slot classification rather than a single
// highly complex alternation regex (Sonar S5843). Unsupported roles are
// rejected before item names can contribute to a translated series.
const EC_ACCESSORY_ROLE_SUFFIXES = new Set([
  'Fending', 'Maiming', 'Striking', 'Scouting', 'Aiming', 'Casting',
  'Healing', 'Slaying', 'Crafting', 'Gathering', 'Blood', 'Magic',
]);
// Only strip prefixes confirmed by the game's localized stat-specific names.
const EC_ACCESSORY_STAT_PREFIX = Object.freeze({ Blood: '力之', Magic: '魔之' });
// These series have only one earring each; the inference threshold correctly
// rejects them. Use the confirmed localized item stems, not the attire names.
const EC_ACCESSORY_NAME_EXTRAS = new Map([
  ["Avalanche Leader's", '雪崩领导者'],
  ["Avalanche Brawler's", '雪崩斗手'],
]);

// Multiple earring forms count as ONE real slot, not separate accessories.
function ecAccessoryItemSlot(part) {
  if (/^(?:Earrings?|Ear Cuffs?|Ear Clips?)$/.test(part)) return 'ears';
  if (/^(?:Necklaces?|Chokers?|Collars?|Neckbands?|Necklets?)$/.test(part)) return 'neck';
  if (/^(?:Bracelets?|Wristlets?|Wristbands?|Armillae|Bangles?)$/.test(part)) return 'wrists';
  if (/^Rings?$/.test(part)) return 'rings';
  return null;
}

// EC sometimes reverses the order: "Ring of the Sea-folk".
function ecAccessoryItemDescriptor(native) {
  const pivot = native.indexOf(' of the ');
  if (pivot >= 0) {
    const slot = ecAccessoryItemSlot(native.slice(0, pivot));
    const series = native.slice(pivot + ' of the '.length);
    return slot && series.length >= 2 && series.length <= 80 ? { series, slot } : null;
  }
  const role = / of ([A-Za-z]+)$/.exec(native);
  if (role && !EC_ACCESSORY_ROLE_SUFFIXES.has(role[1])) return null;
  const bare = role ? native.slice(0, -role[0].length) : native;
  const words = bare.split(' ');
  const twoWordPart = words.slice(-2).join(' ');
  const part = ecAccessoryItemSlot(twoWordPart) ? twoWordPart : words.at(-1);
  const slot = ecAccessoryItemSlot(part);
  const series = bare.slice(0, -(part.length + 1));
  if (!slot || !series) return null;
  return { series, slot, stat: role?.[1] };
}

function ecAccessoryGroupEntry(groups, native, zh) {
  if (!/^[\u3400-\u9fff]/u.test(zh)) return;
  const item = ecAccessoryItemDescriptor(native);
  if (!item) return;
  const statPrefix = EC_ACCESSORY_STAT_PREFIX[item.stat];
  // "Occult Earrings of Blood" -> "力之新月魔耳饰":
  // only remove the stat label after it matches the official Chinese name.
  if (statPrefix && !zh.startsWith(statPrefix)) return;
  const localized = statPrefix ? zh.slice(statPrefix.length) : zh;
  let entries = groups.get(item.series);
  if (!entries) { entries = new Map(); groups.set(item.series, entries); }
  entries.set(native, { zh: localized, slot: item.slot });
}

function ecAccessoryGroupRow(native, entries) {
  if (entries.size < 3 || new Set([...entries.values()].map(x => x.slot)).size < 2) return null;
  const names = [...new Set([...entries.values()].map(x => x.zh))];
  const prefix = ecGearsetCommonZhPrefix(names);
  const roleEndings = ['御敌', '制敌', '强袭', '强攻', '游击', '精准', '咏咒', '治愈', '巧匠', '大地'];
  const role = roleEndings.find(x => prefix.endsWith(x));
  const base = role ? prefix.slice(0, -role.length) : prefix;
  if (base.length < 2 || base.length > 18 || /(?:套装|装束)$/u.test(base)) return null;
  return { native, zh: base };
}

function inferECAccessorySeriesFromItems(nameIndex) {
  const groups = new Map();
  for (const [native, zh] of Object.entries(nameIndex || {})) {
    ecAccessoryGroupEntry(groups, native, zh);
  }
  return [...groups].map(([native, entries]) => ecAccessoryGroupRow(native, entries))
    .filter(Boolean);
}

// Rare EC variant catalogues have only one physical slot but two independent
// officially translated stat versions. Translate an OBSERVED title only when
// both names demonstrate the same localized series stem. This produces a
// descriptive display label, never a new speculative accessory link.
function ecAccessoryDeepStatSeriesZh(native, nameIndex) {
  if (!nameIndex || !native.endsWith(' Deep')) return null;
  const base = native.slice(0, -5);
  const blood = /^超力之([\u3400-\u9fff]{2,18})戒指$/u.exec(nameIndex[base + ' Ring of Deep Blood'] || '');
  const magic = /^超魔之([\u3400-\u9fff]{2,18})戒指$/u.exec(nameIndex[base + ' Ring of Deep Magic'] || '');
  return blood?.[1] && blood[1] === magic?.[1] ? '超' + blood[1] : null;
}

let _ecAccessoryRows = null;
let _ecAccessoryRevision = -1;
let _ecAccessoryHasData = false;
function ecAccessorySeriesZh(native) {
  const confirmed = EC_ACCESSORY_NAME_EXTRAS.get(native);
  if (confirmed) return confirmed;
  // DICT_EC also contains UI labels like "Other" and "Browse All"; they
  // must never be mistaken for verified accessory series names.
  const verified = EC_GEARSET_SINGLE_SERIES.has(native) || EC_GEARSET_ROLE_SERIES.has(native);
  const known = verified ? ecGearsetSeriesZh(native) : null;
  if (known && /[\u3400-\u9fff]/u.test(known)) {
    return known.replace(/(?:装备)?(?:套装|装束)$/u, '') || known;
  }
  const revision = dictGetRevision();
  const nameIndex = dataGetIndex('nameMap');
  const hasData = !!nameIndex;
  if (!_ecAccessoryRows || revision !== _ecAccessoryRevision || hasData !== _ecAccessoryHasData) {
    _ecAccessoryRows = new Map(inferECAccessorySeriesFromItems(nameIndex)
      .map(row => [row.native, row.zh]));
    _ecAccessoryRevision = revision;
    _ecAccessoryHasData = hasData;
  }
  return _ecAccessoryRows.get(native) || ecAccessoryDeepStatSeriesZh(native, nameIndex);
}

function ecAccessoryDisplayName(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length > 110) return null;
  const source = EC_GEARSET_SOURCES.find(value => text.endsWith(' ' + value));
  const title = source ? text.slice(0, -source.length - 1) : text;
  const native = title.endsWith(' Accessories') ? title.slice(0, -12) : title;
  const series = ecAccessorySeriesZh(native);
  if (!series) return null;
  return series + '饰品' + (source ? ' ' + (DICT_EC[source] || source) : '');
}

// 经 EC Gearsets 页面/套装详情页核验的搜索别名，不把单件装备译名
// 冒充套装标题。特别是「东方」对应多个套装，用英文公共关键词
// Eastern 搜索，不能随机选择一套或把它当成单一套装的正式译名。
const EC_GEARSET_SEARCH_ALIASES = Object.freeze([
  { native: "Loyal Housemaid's", zh: '女仆套装', terms: ['女仆', '女僕', '女佣', '女傭'] },
  { native: "Beastmaster's", zh: '兽王（兽主）套装', terms: ['兽王', '獸王'] },
  { native: 'Eastern', zh: '东方系列套装（全部）', terms: ['东方', '東方'] },
]);

function ecGearsetNormalizedZh(raw) {
  return String(raw || '').normalize('NFKC')
    .replace(/[\s·・.,，、'’"（）()[\]【】_-]/gu, '').toLowerCase();
}

function ecGearsetMatchesZh(query, multiword = false) {
  const key = ecGearsetNormalizedZh(query);
  if (key.length < 2 || !/[\u3400-\u9fff]/u.test(key)) return [];
  const terms = multiword ? String(query ?? '').normalize('NFKC').trim().split(/\s+/u)
    .map(ecGearsetNormalizedZh).filter(Boolean) : [key];
  const matchesName = name => {
    const text = ecGearsetNormalizedZh(name);
    return terms.every(term => text.includes(term));
  };
  const matching = ecGearsetCatalog().filter(row => matchesName(row.zh));
  // Stronger evidence always wins over provisional official game packages;
  // include alias matches before choosing the fallback candidate tier.
  const rows = matching.filter(row => !row.provisional);
  // 已核实的 EC 英文套装名/公共关键词，兼容用户实际输入的俗称与简繁体。
  // 去重使用英文原生名，避免常见别名与现有国服译名重复展示。
  for (const alias of EC_GEARSET_SEARCH_ALIASES) {
    const matches = [alias.zh, ...alias.terms].some(matchesName);
    if (matches && !rows.some(row => row.native === alias.native)) {
      rows.push({ native: alias.native, zh: alias.zh });
    }
  }
  return rows.length ? rows : matching.filter(row => row.provisional);
}

// 搜索实际发送的是英文子串：一个中文词若对应多个套装，应寻找所有
// 英文标题共同的「完整词序列」，而不是随机选一个套装或拼接单词碎片。
function ecGearsetCommonNative(rows) {
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0].native;
  const tokens = rows[0].native.split(' ');
  let best = '';
  for (let len = tokens.length; len >= 1; len--) {
    for (let i = 0; i + len <= tokens.length; i++) {
      const candidate = tokens.slice(i, i + len).join(' ');
      const isCommon = rows.every(row => (' ' + row.native + ' ').includes(' ' + candidate + ' '));
      if (isCommon && candidate.length > best.length) best = candidate;
    }
  }
  return best || null;
}

function resolveECGearsetSearch(query) {
  if (/\s/u.test(String(query ?? '').trim())) {
    const names = new Set(suggestECGearsetsByZh(query).map(row => row.native));
    return names.size === 1 ? names.values().next().value : null;
  }
  return ecGearsetCommonNative(ecGearsetMatchesZh(query));
}

function suggestECGearsetsByZh(query) {
  const direct = ecGearsetMatchesZh(query);
  if (!/\s/u.test(String(query ?? '').trim())) return direct;
  const seen = new Set(direct.map(row => row.native));
  return direct.concat(ecGearsetMatchesZh(query, true).filter(row => {
    if (seen.has(row.native)) return false;
    seen.add(row.native);
    return true;
  }));
}

function ecGearsetApplyTitleSuffix(node, raw, title, zh, suffix, hasInlineSuffix, suffixNodes) {
  const splitSuffix = zh.endsWith(suffix) && !hasInlineSuffix;
  const bareTitle = title.endsWith(' Set') ? title.slice(0, -4) : title;
  const singleItem = suffix === '套装' && EC_SINGLE_ITEM_GEARSETS.has(bareTitle);
  const next = raw.replace(title, splitSuffix ? zh.slice(0, -suffix.length) : zh);
  node.nodeValue = splitSuffix || singleItem ? next.trimEnd() : next;
  // Split H1 labels must contribute the suffix exactly once, including when
  // the title also contains an acquisition source (e.g. Dungeon Drop).
  // 官方套装名的性别变体可在「套装」后带【男】／【女】；
  // H1 的独立 Set 标记不能再次附加后缀。
  const hasVariantSuffix = suffix === '套装'
    && /(?:套装|装束)(?:【[^】]{1,16}】|（[^）]{1,16}）)(?:\s|$)/u.test(zh);
  const redundant = hasInlineSuffix || zh.endsWith('装束') || zh.includes(suffix + ' ')
    || hasVariantSuffix || singleItem;
  if (redundant) for (const trailing of suffixNodes) trailing.nodeValue = '';
}

function ecGearsetTranslateTitleNode(node, suffixNodes, type) {
  const raw = node.nodeValue || '';
  const zh = type === 'accessories' ? ecAccessoryDisplayName(raw) : ecGearsetDisplayName(raw);
  if (!zh) return;
  const title = raw.trim();
  const suffix = type === 'accessories' ? '饰品' : '套装';
  const hasInlineSuffix = type === 'accessories'
    ? title.endsWith(' Accessories') : title.endsWith(' Set');
  if (suffixNodes.length) {
    ecGearsetApplyTitleSuffix(node, raw, title, zh, suffix, hasInlineSuffix, suffixNodes);
  } else {
    node.nodeValue = raw.replace(title, zh);
  }
}

function ecGearsetTranslateTitleRoot(root, type = 'gearset') {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const suffixPattern = type === 'accessories' ? /^(?:Accessories|饰品)$/iu : /^(?:Set|套装)$/iu;
  const suffixNodes = nodes.filter(n => suffixPattern.test((n.nodeValue || '').trim()));
  for (const node of nodes) {
    if (!suffixNodes.includes(node)) ecGearsetTranslateTitleNode(node, suffixNodes, type);
  }
  // Preserve separate nested suffix styling and idempotence on repeated scans.
  if (root.tagName === 'H1') {
    const en = type === 'accessories' ? 'Accessories' : 'Set';
    const zh = type === 'accessories' ? '饰品' : '套装';
    for (const trailing of suffixNodes) {
      if (trailing.nodeValue?.trim() === en) trailing.nodeValue = trailing.nodeValue.replace(en, zh);
    }
  }
}

function ecTitleRoots(scope, selector) {
  const found = queryIn(scope, selector);
  // MutationObserver may provide only a nested span, not its containing h1/a.
  const parent = scope?.closest?.(selector);
  if (parent && !found.includes(parent)) found.unshift(parent);
  return found;
}

// Gearset link href is never touched; only the verified title text is changed.
function translateECGearsetNames(rootArg) {
  const scope = localScope(rootArg);
  for (const a of ecTitleRoots(scope, 'a[href*="/gearset/"]')) {
    if (isECSeriesLink(a)) ecGearsetTranslateTitleRoot(a);
  }
  for (const a of ecTitleRoots(scope, 'a[href*="/accessories/"]')) {
    if (isECSeriesLink(a)) ecGearsetTranslateTitleRoot(a, 'accessories');
  }
  const path = globalThis.location?.pathname || '';
  if (/^\/gearset\/[^/]+\/?$/.test(path)) {
    for (const h1 of ecTitleRoots(scope, 'h1')) ecGearsetTranslateTitleRoot(h1);
  } else if (/^\/accessories\/[^/]+\/?$/.test(path)) {
    for (const h1 of ecTitleRoots(scope, 'h1')) ecGearsetTranslateTitleRoot(h1, 'accessories');
  }
}
