/* @phase15-module-order:sites/eorzea-collection */
/* @phase15-order-link:sites/eorzea-collection<-core/dictionary */
import { DICT_EC, dictGetRevision } from '../core/dictionary.js';
import { _markScan, _zhixiaTitleKeep, localScope, queryIn } from '../core/dom.js';
import { trEC } from '../core/item-resolver.js';
import { dataGetIndex } from '../core/data-manager.js';
import { createObserver } from '../core/observer.js';
import { safe } from '../core/runtime.js';
import { EC_ITEM_SKIP_SEL } from '../core/targets.js';
import { SKIP_TAGS } from './mirapri.js';
export { EC_PIECE_TILES, EC_SKIP_SEL, PATTERNS_EC, bindECPieceTiles, ecBusy, startEC, translateECAttrs, translateECPage, translateECTitle, trimECNode, ecGearsetDisplayName, resolveECGearsetSearch, suggestECGearsetsByZh, translateECGearsetNames };


  // EC 上会变动的文本（数量、时间、页数…）
  const PATTERNS_EC = [
    // 面饰页动态文案
    [/^—\s{0,8}Previous\s{1,8}(.{1,200}?)\s{0,8}—$/, (m0, x) => '— 上一个' + (DICT_EC[x] || x) + ' —'],
    [/^—\s{0,8}Next\s{1,8}(.{1,200}?)\s{0,8}—$/, (m0, x) => '— 下一个' + (DICT_EC[x] || x) + ' —'],
    // 分类标题 em-dash 包裹（— Weapon — 等）+ Shader 前缀（v1.14.2）
    [/^[—–-]\s{0,8}(.{1,200}?)\s{0,8}[—–-]$/, (m0, x) => '— ' + (DICT_EC[x] || x) + ' —'],
    [/^Shader:\s{0,8}(.{1,200})$/i, (m0, x) => '滤镜：' + (DICT_EC[x] || x)],
    // 首页统计 + 版本页动态句 + Patron 挑战名（v1.14.7）
    [/^([\d,]+) glamours have already been submitted by the community!?$/, (m0, n) => '社区已提交 ' + n + ' 套幻化！'],
    [/^PvP Series (\d+) has begun$/, (m0, n) => 'PvP 第 ' + n + ' 赛季已开始'],
    [/^(.*?)Verycold$/, (m0, p) => p + '凛冬'],
    [/^(.*?)Living Canvas$/, (m0, p) => p + '活画布'],
    [/^(.*?)Into the Void$/, (m0, p) => p + '入虚空'],
    [/^(.*?)Master of Beasts$/, (m0, p) => p + '万兽之王'],
    [/^(.*?)The Glamourer's Tale$/, (m0, p) => p + '幻化师传说'],
    // gearset 套装名：系列+职能（Phantom Vision Fending → 幻境意象御敌套装）（v1.14.5）
    [/^(Phantom Vision|Vana'dielian|Praemagitek)\s+(Fending|Maiming|Striking|Scouting|Aiming|Casting|Healing)$/, (m0, a, b) => (DICT_EC[a] || a) + (DICT_EC[b] || b) + '套装'],
    // Latest Patch - 7.5 版本选项（v1.14.5）
    [/^Latest Patch(\s*-\s*[\d.]+)?$/, (m0, v) => '最新版本' + (v || '')],
    [/^MORE\s{1,8}(.{1,200})$/, (m0, x) => '更多' + (DICT_EC[x] || x)],
    [/^GLAMOURS USING THIS\s{1,8}(.{1,200})$/, (m0, x) => '使用此' + (DICT_EC[x] || x) + '的幻化'],
    [/^PvP Series (\d+) - awarded at Level (\d+)$/, 'PvP 第 $1 赛季 - 等级 $2 奖励'],
    // 版本号标题：Patch 7.5 - Into the Mist -> 版本 7.5 - Into the Mist
    [/^Patch\s{1,8}([\d.]{1,20})(.{0,200})$/i, '版本 $1$2'],
    // 日期中文化：Oct 2nd, 2026 -> 2026年10月2日；Oct 2, 2026 -> 2026年10月2日
    [/\b([A-Z][a-z]{2})[a-z]{0,20}\.?\s{1,8}(\d{1,2})(?:st|nd|rd|th)?,\s{0,8}(\d{4})\b/g,
      (m0, mo, d, y) => { const n = ({ Jan: '1', Feb: '2', Mar: '3', Apr: '4', May: '5', Jun: '6', Jul: '7', Aug: '8', Sep: '9', Oct: '10', Nov: '11', Dec: '12' })[mo]; return n ? y + '年' + n + '月' + String(d) + '日' : m0; }],
    // 时间中文化：3:00 PM -> 15:00；12:30 AM -> 00:30
    [/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi,
      (m0, h, mi, ap) => {
        let hh = Number.parseInt(h, 10) % 12;
        if (/pm/i.test(ap)) hh += 12;
        return (hh < 10 ? '0' + hh : String(hh)) + ':' + mi;
      }],
    [/^([\d,]+) glamours? have already been submitted by the community\.?$/i, '社区已提交 $1 个幻化'],
    [/^([\d,]+) chocobos? have already been glamoured by the community!?$/i, '社区已幻化 $1 只陆行鸟！'],
    [/^Patch ([\d.]+) Update$/i, '版本 $1 更新'],
    [/^— Latest Lodestone News —$/, '— 最新 Lodestone 新闻 —'],
    [/^— Latest Updates —$/, '— 最新更新 —'],
    [/Showing\s+([\d,]+)\s*-\s*([\d,]+)\s+of\s+([\d,]+)/g, '显示 $1–$2 / 共 $3 条'],
    [/^([\d,]+)\s+glamours?\s+found$/i, '找到 $1 套幻化'],
    [/^([\d,]+)\s+results?$/i, '共 $1 条结果'],
    [/^(\d+)\s+Loves?$/i, '$1 点赞'],
    [/^(\d+)\s+Comments?$/i, '$1 评论'],
    [/^(\d+)\s+Views?$/i, '$1 浏览'],
    [/^Page\s+(\d+)\s+of\s+([\d,]+)$/i, '第 $1 页 / 共 $2 页'],
    [/^Go to Page\s+(\d+)$/i, '前往第 $1 页'],
    [/^Go to slide\s+(\d+)$/i, '切换到第 $1 张'],
    [/^Browse All\s+(.{1,80})$/i, (m, name) => DICT_EC[name] ? '浏览全部' + DICT_EC[name] : m],
    [/^Page\s+(\d+)$/i, '第 $1 页'],
    [/^Submitted\s+(\d+)\s+years?\s+ago$/i, '$1 年前投稿'],
    [/^Submitted\s+(\d+)\s+months?\s+ago$/i, '$1 个月前投稿'],
    [/^Submitted\s+(\d+)\s+days?\s+ago$/i, '$1 天前投稿'],
    [/^(\d+)\s+years?\s+ago$/i, '$1 年前'],
    [/^(\d+)\s+months?\s+ago$/i, '$1 个月前'],
    [/^(\d+)\s+days?\s+ago$/i, '$1 天前'],
    [/^(\d+)\s+hours?\s+ago$/i, '$1 小时前'],
    [/^Up to\s{1,8}(.{1,200})$/i, '$1 以下'],
    [/^Loading\s*\.\.\.$/i, '加载中…'],
    [/^MORE GLAMOURS BY\s{1,8}(.{1,200})$/i, '该作者的更多幻化'],
    [/^All from\s{1,8}(.{1,200})$/i, '来自 $1 的全部'],
    [/^([\d,]+)\s+glamours?$/i, '$1 套幻化'],
    [/^Showing\s+([\d,]+)\s+of\s+([\d,]+)$/i, '显示 $1 / 共 $2 条'],
    [/^(Au Ra|Hyur|Elezen|Miqo'te|Lalafell|Roegadyn|Viera|Hrothgar)\s+Female$/i,
      (m, r) => (DICT_EC[r] || r) + '女性'],
    [/^(Au Ra|Hyur|Elezen|Miqo'te|Lalafell|Roegadyn|Viera|Hrothgar)\s+Male$/i,
      (m, r) => (DICT_EC[r] || r) + '男性'],
  ];


  // EC /gearsets 标题不是单件物品：按系列 + 职能合成，不能交给 resolveByName
  // 的装备卡片链（否则找不到译名，还可能将套装链接改写到灰机物品页）。
  // 系列译名取自 dict-ec.json，只有经确认的系列参与转换，未知名称保留英文。
  // Gearsets 的英文标题不是单件物品名。只收录在 EC Gearsets 页面确认存在、
  // 且译名可由国服物品表核验的系列；未知套装仍保留英文，避免猜译。
  // 为避免把不存在的角色套装列为搜索候选，每个系列单独声明实际职能。
  const EC_GEARSET_ROLES = ['Fending', 'Maiming', 'Striking', 'Scouting', 'Aiming', 'Casting', 'Healing'];
  const EC_GEARSET_ROLE_SERIES = [
    ['Phantom Vision', EC_GEARSET_ROLES],
    ["Vana'dielian", EC_GEARSET_ROLES],
    ['Praemagitek', EC_GEARSET_ROLES],
    ['Mistwake', EC_GEARSET_ROLES],
    ['Mistic Memory', EC_GEARSET_ROLES],
    ["War Cloud's", ['Fending', 'Maiming']],
    ["Prishe's", ['Striking']],
    ['Mayakov', ['Scouting', 'Aiming']],
    ['Orastery', ['Casting', 'Healing']],
  ];
  const EC_GEARSET_SINGLE_SERIES = new Set([
    "Beastmaster's", "Beast Herder's", "Successor's", 'Yozakura', "Zero's Luminary",
    'Tule', 'Torna', 'Carwen', 'Tradewinds', "Neo Citizen's",
    'Plain Hooded', 'Festival Hooded', 'Succubus Hooded', 'Oversized Plain Hooded',
    'Graffiti Neotunic',
    "Fallen's", "En Fortune-teller's", "Realm-roamer's", "Vibran Princess's",
    'Galatea', 'Fuath', 'Hope [F]', 'Hope [M]', "Gaffgarion's", "Ovelia's",
    "Ramza's", 'Star Captain', 'Star Pilot', 'Alternative', 'Maritime',
    'Alpha Wolf', 'Eagleclaw', 'Star Tech Crafting', 'Star Tech Gathering',
  ]);
  // 这些译名核对自 data/ff14-items.tsv（装备前缀或对应的 Attire/Armor 套装物品）。
  // 仅用于 EC Gearsets 标题，不混入单件装备译名与通用 UI 词典。
  const EC_GEARSET_NAME_EXTRAS = Object.freeze({
    'Graffiti Neotunic': '涂鸦新式上衣套装',
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

  function ecGearsetKnownRows() {
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
    return rows;
  }

  function ecGearsetAppendInferredRows(rows, nameIndex) {
    if (!nameIndex) return;
    const seen = new Set(rows.map(row => row.native));
    const derived = [
      ...inferECGearsetsFromItems(nameIndex),
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
    const rows = ecGearsetKnownRows();
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
  const EC_ACCESSORY_ITEM_NAME =
    /^(.+?) (Earrings?|Ear Cuffs?|Ear Clips?|Necklaces?|Chokers?|Neckbands?|Necklets?|Bracelets?|Wristlets?|Wristbands?|Armillae|Bangles?|Rings?)(?: of (?:Fending|Maiming|Striking|Scouting|Aiming|Casting|Healing|Slaying|Crafting|Gathering|Blood|Magic))?$/;
  // Sea-folk and similar sets put the series after the piece: "Ring of the Sea-folk".
  const EC_ACCESSORY_INVERTED_NAME =
    /^(Earrings?|Ear Cuffs?|Ear Clips?|Necklaces?|Chokers?|Collars?|Neckbands?|Necklets?|Bracelets?|Wristlets?|Wristbands?|Armillae|Bangles?|Rings?) of the (.{2,80})$/;
  // Only strip prefixes confirmed by the game's localized stat-specific names.
  const EC_ACCESSORY_STAT_PREFIX = Object.freeze({ Blood: '力之', Magic: '魔之' });

  // Multiple earring forms count as ONE real slot, not separate accessories.
  function ecAccessoryItemSlot(part) {
    if (/^(?:Earrings?|Ear Cuffs?|Ear Clips?)$/.test(part)) return 'ears';
    if (/^(?:Necklaces?|Chokers?|Collars?|Neckbands?|Necklets?)$/.test(part)) return 'neck';
    if (/^(?:Bracelets?|Wristlets?|Wristbands?|Armillae|Bangles?)$/.test(part)) return 'wrists';
    if (/^Rings?$/.test(part)) return 'rings';
    return null;
  }

  function inferECAccessorySeriesFromItems(nameIndex) {
    const groups = new Map();
    for (const [native, zh] of Object.entries(nameIndex || {})) {
      const match = EC_ACCESSORY_ITEM_NAME.exec(native);
      const inverted = match ? null : EC_ACCESSORY_INVERTED_NAME.exec(native);
      if ((!match && !inverted) || !/^[\u3400-\u9fff]/u.test(zh)) continue;
      const series = match ? match[1] : inverted[2];
      const slot = ecAccessoryItemSlot(match ? match[2] : inverted[1]);
      if (!slot) continue;
      const stat = match && / of (Blood|Magic)$/.exec(native);
      const prefix = stat && EC_ACCESSORY_STAT_PREFIX[stat[1]];
      // "Occult Earrings of Blood" -> "力之新月魔耳饰":
      // after verifying the stat prefix, compare "新月魔..." across slots.
      if (stat && !zh.startsWith(prefix)) continue;
      const localized = stat ? zh.slice(prefix.length) : zh;
      let entries = groups.get(series);
      if (!entries) { entries = new Map(); groups.set(series, entries); }
      entries.set(native, { zh: localized, slot });
    }
    const roleEndings = ['御敌', '制敌', '强袭', '强攻', '游击', '精准', '咏咒', '治愈', '巧匠', '大地'];
    const rows = [];
    for (const [native, entries] of groups) {
      if (entries.size < 3 || new Set([...entries.values()].map(x => x.slot)).size < 2) continue;
      const names = [...new Set([...entries.values()].map(x => x.zh))];
      const prefix = ecGearsetCommonZhPrefix(names);
      const role = roleEndings.find(x => prefix.endsWith(x));
      const base = role ? prefix.slice(0, -role.length) : prefix;
      if (base.length < 2 || base.length > 18 || /(?:套装|装束)$/u.test(base)) continue;
      rows.push({ native, zh: base });
    }
    return rows;
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
    return blood && magic && blood[1] === magic[1] ? '超' + blood[1] : null;
  }

  let _ecAccessoryRows = null;
  let _ecAccessoryRevision = -1;
  let _ecAccessoryHasData = false;
  function ecAccessorySeriesZh(native) {
    // DICT_EC also contains UI labels like "Other" and "Browse All"; they
    // must never be mistaken for verified accessory series names.
    const verified = EC_GEARSET_SINGLE_SERIES.has(native)
      || EC_GEARSET_ROLE_SERIES.some(([series]) => series === native);
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

  function ecGearsetMatchesZh(query) {
    const key = ecGearsetNormalizedZh(query);
    if (key.length < 2 || !/[\u3400-\u9fff]/u.test(key)) return [];
    const matching = ecGearsetCatalog().filter(row => ecGearsetNormalizedZh(row.zh).includes(key));
    // Stronger evidence always wins over provisional official game packages;
    // include alias matches before choosing the fallback candidate tier.
    const rows = matching.filter(row => !row.provisional);
    // 已核实的 EC 英文套装名/公共关键词，兼容用户实际输入的俗称与简繁体。
    // 去重使用英文原生名，避免常见别名与现有国服译名重复展示。
    for (const alias of EC_GEARSET_SEARCH_ALIASES) {
      const matches = [alias.zh, ...alias.terms]
        .some(term => ecGearsetNormalizedZh(term).includes(key));
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
    return ecGearsetCommonNative(ecGearsetMatchesZh(query));
  }

  function suggestECGearsetsByZh(query) {
    return ecGearsetMatchesZh(query);
  }

  function ecGearsetTranslateTitleNode(node, suffixNodes, type) {
    const raw = node.nodeValue || '';
    const zh = type === 'accessories' ? ecAccessoryDisplayName(raw) : ecGearsetDisplayName(raw);
    if (!zh) return;
    const title = raw.trim();
    const suffix = type === 'accessories' ? '饰品' : '套装';
    const hasInlineSuffix = type === 'accessories'
      ? title.endsWith(' Accessories') : title.endsWith(' Set');
    if (suffixNodes.length && zh.endsWith(suffix)) {
      // The suffix may already be inline and separately rendered in the H1.
      if (hasInlineSuffix) {
        node.nodeValue = raw.replace(title, zh);
        for (const trailing of suffixNodes) trailing.nodeValue = '';
      } else {
        node.nodeValue = raw.replace(title, zh.slice(0, -suffix.length));
      }
      return;
    }
    node.nodeValue = raw.replace(title, zh);
    // E.g. "Mistic Memory Dungeon Drop" followed by a separate "Accessories":
    // the series suffix is already before the translated source description.
    if (suffixNodes.length && (zh.endsWith('装束') || zh.includes(suffix + ' '))) {
      for (const trailing of suffixNodes) trailing.nodeValue = '';
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

  function ecGearsetTitleRoots(scope, selector) {
    const found = queryIn(scope, selector);
    // MutationObserver may provide only a nested span, not its containing h1/a.
    const parent = scope?.closest?.(selector);
    if (parent && !found.includes(parent)) found.unshift(parent);
    return found;
  }

  // Gearset link href is never touched; only the verified title text is changed.
  function translateECGearsetNames(rootArg) {
    const scope = localScope(rootArg);
    for (const a of ecGearsetTitleRoots(scope, 'a[href*="/gearset/"]')) ecGearsetTranslateTitleRoot(a);
    for (const a of ecGearsetTitleRoots(scope, 'a[href*="/accessories/"]')) {
      ecGearsetTranslateTitleRoot(a, 'accessories');
    }
    const path = globalThis.location?.pathname || '';
    if (/^\/gearset\/[^/]+\/?$/.test(path)) {
      for (const h1 of ecGearsetTitleRoots(scope, 'h1')) ecGearsetTranslateTitleRoot(h1);
    } else if (/^\/accessories\/[^/]+\/?$/.test(path)) {
      for (const h1 of ecGearsetTitleRoots(scope, 'h1')) ecGearsetTranslateTitleRoot(h1, 'accessories');
    }
  }

  // 用户产出的内容：绝不翻译
  const EC_SKIP_SEL = [
    '.c-glamour-grid-item-content-title',
    '.c-glamour-grid-item-content-author',
    '[class*="s-glamour-description"]',
    '[class*="s-glamour-title"]',
    '[class*="c-comment"]',
    '[class*="s-comment"]',
    '[contenteditable="true"]',
  ].join(',');

  function trimECNode(node) {
    const raw = node.nodeValue;
    if (!raw?.trim()) return;
    const p = node.parentElement;
    if (p?.closest?.(EC_SKIP_SEL)) return;
    // 装备名 / 卡片文本归物品链（zhApply*）处理：文本链避让，否则文本被抢先翻成
    // 中文后物品链会因「原文不再匹配」跳过，导致链接改写 / 包装 / 标记不生效
    if (p?.closest?.(EC_ITEM_SKIP_SEL)) return;
    // Gearset H1 has split name/Set nodes: generic trEC would append 套装 to
    // known series BEFORE the dedicated structure-aware pass can inspect it.
    // Only the Gearsets title translator is allowed to touch this H1.
    if (/^\/(?:gearset|accessories)\/[^/]+\/?$/.test(globalThis.location?.pathname || '')
        && p?.closest?.('h1')) return;
    const next = trEC(raw);
    if (next !== raw) {
      // Keep the original for diagnostics, not as an untranslated English hover tooltip.
      if (p?.dataset && !p.hasAttribute?.('title')) p.dataset.zhixiaSourceText = raw.trim();
      node.nodeValue = next;
    }
  }

  let ecBusy = false; // NOSONAR — 页面扫描期间的重入保护状态

  // Site hydration updates tooltips and accessibility labels after the initial scan.
  // Translate each current attribute value: sticky 'done' flags hide later updates.
  function _translateECAttr(el, attr) {
    if (el.closest?.(EC_SKIP_SEL)) return;
    if (attr === 'title' && _zhixiaTitleKeep.has(el)) return;
    const old = el.getAttribute(attr);
    if (!old || old.length > 90) return;
    const translated = trEC(old);
    if (translated !== old) el.setAttribute(attr, translated);
  }

  function translateECAttrs(rootArg) {
    const scope = localScope(rootArg);
    for (const attr of ['title', 'alt', 'aria-label', 'placeholder']) {
      for (const el of queryIn(scope, '[' + attr + ']')) _translateECAttr(el, attr);
    }
  }

  // Translate only recognized UI title segments. Preserve creator names and site branding.
  function translateECTitle() {
    const old = document.title;
    if (!old?.includes(' | Eorzea Collection')) return;
    const parts = old.split(' | ');
    const translated = parts.map((part) => ecAccessoryDisplayName(part) || ecGearsetDisplayName(part)
      || DICT_EC[part] || (part.startsWith('Latest Patch') ? trEC(part) : part)).join(' | ');
    if (translated !== old) document.title = translated;
  }

  function translateECPage(rootArg) {
    if (ecBusy) return;
    ecBusy = true;
    try {
      const root = rootArg || document.body || document.documentElement;
      if (!root) return;
      _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: (n) => {
          if (n.nodeType === 1) {
            if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
            // 选择器级剪枝：忽略区域整棵子树不再进入（v1.11.1，借 github-chinese FILTER_REJECT）
            if (n.closest?.(EC_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
            // 同 trimECNode：物品链管辖的子树（装备名 / 卡片）不在文本链处理
            if (n.closest?.(EC_ITEM_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const batch = [];
      while (w.nextNode()) batch.push(w.currentNode);
      translateECGearsetNames(rootArg);
      for (const n of batch) {
        if (n.nodeType === 3) trimECNode(n);
      }
      translateECAttrs(rootArg);
    } finally {
      ecBusy = false;
    }
  }

  // v1.14.7：Gearsets 下拉部位导航图（PNG 文字烧录）→ 图上叠中文
  const EC_PIECE_TILES = {
    'banner-entire-set.png': '整套',
    'banner-head-piece.png': '头部',
    'banner-body-piece.png': '身体',
    'banner-hands-piece.png': '手部',
    'banner-legs-piece.png': '腿部',
    'banner-feet-piece.png': '脚部',
    'banner-accessories.png': '饰品',
    'banner-ear-piece.png': '耳部',
    'banner-neck-piece.png': '颈部',
    'banner-wrist-piece.png': '腕部',
    'banner-ring-piece.png': '手指',
  };
  function bindECPieceTiles(rootArg) {
    let changed = false;
    queryIn(localScope(rootArg), 'a > img[src*="/pages/header/banner-"]').forEach((img) => {
      const a = img.parentElement;
      if (!a || a.dataset.zhixiaPiece) return;
      const m = /banner-[\w-]+\.png/.exec(img.getAttribute('src') || '');
      const zh = m && EC_PIECE_TILES[m[0]];
      if (!zh) return;
      a.dataset.zhixiaPiece = '1';
      changed = true;
      a.style.position = a.style.position || 'relative';
      a.style.display = a.style.display || 'block';
      a.style.overflow = 'hidden';
      const sp = document.createElement('span');
      sp.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:inline-flex;align-items:center;justify-content:center;padding:4px 14px;background:rgba(18,10,12,.62);backdrop-filter:blur(5px) saturate(1.2);-webkit-backdrop-filter:blur(5px) saturate(1.2);border:1px solid rgba(255,255,255,.28);border-radius:8px;font-weight:900;font-size:15px;letter-spacing:3px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8),0 0 10px rgba(0,0,0,.5);pointer-events:none;z-index:2;white-space:nowrap;';
      sp.textContent = zh;
      a.appendChild(sp);
    });
    return changed;
  }

  function startEC() {
    safe(translateECPage, 'EC 全扫')();
    safe(translateECTitle, 'EC 页面标题')();
    safe(bindECPieceTiles, 'EC 部位图')();
    createObserver({
      root: document.documentElement,
      debounce: 300,
      attributes: true,
      attributeFilter: ['title', 'alt', 'aria-label', 'placeholder'],
      handler: (nodes) => {
        for (const n of nodes) {
          safe(translateECPage, 'EC 局部')(n);
          safe(bindECPieceTiles, 'EC 部位图')(n);
        }
        safe(translateECTitle, 'EC 页面标题')();
      },
    });
    // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
  }
