import { FC_ROLE_ZH, _getItemPfx, _getSeriesMap, _getSeriesPfx, _getSubstrKeysAll } from '../../core/cache.js';
import { cacheRegister } from '../../core/cache-primitives.js';
import { _tablesReady, dataGetIndex, resolveAllByName, resolveDyeColor } from '../../core/data/data-manager.js';
import { DICT_FC, lookupDutyName } from '../../core/data/dictionary.js';
import { lookupJp2Zh } from '../../core/item-resolver.js';

export {
  FC_FULL_SET_LABEL, FC_VERIFIED_SHORT_SET_PATHS,
  _fcCanReplaceAt, _trFCDecor, _trFCExact, _trFCName, _trFCSubstr,
  fcGaroSetName, fcItemName, fcKnownName, fcScopedSetName, fcStarterOutfitName, fcUIValue, fcVerifiedSetName,
  trFC, trFCSegments,
};

// v1.12.3：「・」复合名逐段翻译（ダークマホガニー・スレイヤー → 深红木·制敌）
function trFCSegments(t) {
  if (!t?.includes('・')) return null;
  const parts = t.split('・');
  if (parts.length < 2 || parts.length > 5) return null;
  let hit = 0;
  const zh = parts.map((p) => {
    const z = FC_ROLE_ZH[p] || fcKnownName(p);
    if (z) { hit++; return z; }
    return null;
  });
  if (hit < 1) return null;
  // Unknown Japanese equipment segments must not be rendered as half-translated names.
  if (parts.some((p, i) => zh[i] == null && !/^[A-Za-z0-9 ]{1,15}$/.test(p))) return null;
  const out = parts.map((p, i) => (zh[i] != null ? zh[i] : p));
  return out.join('·');
}

let fcNormalizedNames = null;
let fcNormalizedUI = null;
cacheRegister('fcNormalizedNames', 'derived', () => { fcNormalizedNames = null; }, () => fcNormalizedNames?.size || 0);
cacheRegister('fcNormalizedUI', 'translate', () => { fcNormalizedUI = null; }, () => fcNormalizedUI?.size || 0);
const fcNameKey = name => name.normalize('NFKC').replace(/[・\s]/gu, '');
const fcUIKey = text => text.normalize('NFKC').replace(/\s+/gu, ' ').trim();
function fcCollectUnique(map, key, value) {
  if (!map.has(key)) map.set(key, value);
  else if (map.get(key) !== value) map.set(key, null);
}

function fcUIValue(key) {
  if (DICT_FC[key]) return DICT_FC[key];
  if (!fcNormalizedUI) {
    fcNormalizedUI = new Map();
    for (const [source, value] of Object.entries(DICT_FC)) fcCollectUnique(fcNormalizedUI, fcUIKey(source), value);
  }
  return fcNormalizedUI.get(fcUIKey(key)) || null;
}

function fcNormalizedItem(name) {
  if (!_tablesReady) return null;
  if (!fcNormalizedNames) {
    fcNormalizedNames = new Map();
    for (const native of Object.keys(dataGetIndex('nameMap') || {})) {
      const key = fcNameKey(native);
      for (const zh of resolveAllByName(native)) {
        fcCollectUnique(fcNormalizedNames, key, zh);
      }
    }
  }
  return fcNormalizedNames.get(fcNameKey(name)) || null;
}

function fcItemName(name) {
  return lookupJp2Zh(name) || fcNormalizedItem(name);
}

// Mirapri Life 的 GARO 整套装备标题省略「の装束」，例如「魔戒法師・陽」。
// 仅当完整名称在官方日中系列对照中存在时，才还原为「魔戒法师装束·阳」。
// 保持与单件装备独立，绝不凭「魔戒」前缀猜译未知系列。
const FC_GARO_SET_SHORT = /^(魔戒[^\s（）]{1,28})・([陰陽])$/u;
function fcGaroSetName(name) {
  const match = FC_GARO_SET_SHORT.exec(name);
  if (!match) return null;
  const official = _getSeriesMap().get(match[1] + 'の装束・' + match[2]);
  return /(?:装束|套装)·[阴阳]$/u.test(official || '') ? official : null;
}

// 7.5 原站套装标题使用简写，而国服完整套装名已有正式物品记录。
// 仅做整名对照，不加入通用子串词典，防止「套装」污染单件装备名称。
const FC_VERIFIED_SET_ALIASES = new Map([
  ['プレマジテック・ディフェンダー', '前魔导御敌套装'],
  ['プレマジテック・スレイヤー', '前魔导制敌套装'],
  ['プレマジテック・ストライカー', '前魔导强袭套装'],
  ['プレマジテック・スカウト', '前魔导游击套装'],
  ['プレマジテック・レンジャー', '前魔导精准套装'],
  ['プレマジテック・キャスター', '前魔导咏咒套装'],
  ['プレマジテック・ヒーラー', '前魔导治愈套装'],
  ['ネオシチズン・コスチュームセット', '新生国民套装'],
  ['カーウェン', '卡文套装'],
  ['ゼロルミナリー・コスチュームセット', '零点套装'],
]);
function fcVerifiedSetName(name) {
  return FC_VERIFIED_SET_ALIASES.get(name) || null;
}

function fcVerifiedSetText(text, label) {
  const full = /^(.*?)(（全身）)$/u.exec(label);
  const direct = fcVerifiedSetName(full ? full[1] : label);
  if (direct) return text.replace(label, direct + (full ? full[2] : ''));
  // 装备图库说明中，带日文引号的是整套装备名；不匹配单件的前缀。
  let result = text;
  result = result.replace(/「([^「」]{2,80})」/gu, (matched, name) => {
    const localized = fcVerifiedSetName(name);
    return localized ? '「' + localized + '」' : matched;
  });
  return result !== text ? result : null;
}

function fcKnownName(name) {
  // Accept an actual key, never an arbitrary longer series sharing its prefix.
  return fcUIValue(name) || fcItemName(name) || lookupDutyName(name) || _getSeriesMap().get(name)
    || fcVerifiedSetName(name) || fcGaroSetName(name)
    || _getSeriesPfx().get(name) || _getItemPfx().get(name) || null;
}

function fcJobEquipment(text, label) {
  const match = /^【([^】]{1,30})】(.+)$/.exec(label);
  if (!match || !_tablesReady) return null;
  const job = FC_ROLE_ZH[match[1]] || fcUIValue(match[1]);
  if (!job) return null;
  const parts = match[2].split(/[&＆]/u).map((part, index, all) => {
    const start = index === 0 ? part : part.trimStart();
    return index === all.length - 1 ? start : start.trimEnd();
  });
  if (parts.length > 2) return null;
  // Some sword/shield headings abbreviate the second name's shared prefix.
  const prefix = parts[0].slice(0, parts[0].lastIndexOf('・') + 1);
  const names = parts.map((name, index) => fcItemName(name) || fcUIValue(name)
    || (index === 1 && prefix ? fcItemName(prefix + name) : null));
  if (names.some(name => !name)) return null;
  return text.replace(label, '【' + job + '】' + names.join('＆'));
}

// 装饰性首尾符号（菜单里的 ≫ ▶ » ✨ 😊 等，不参与查表）
// v1.2.2：加 u 标志——emoji（星面字符）在无 u 的字符类里按代理对拆半匹配
// v1.2.3：TAIL 量词改有界 {1,64}——消除 S8786 潜在超线性回溯（>64 个连续装饰的输入不现实）
const FC_DECOR_HEAD = /^[\s|｜<＜≪«◀◁▷●○★☆🎉✨👗💍🛡💬]+/u;
const FC_DECOR_TAIL = /[\s|｜>＞≫»▶▽◆■□●○★☆♪！!。、…😊✨🎉]{1,64}$/u;

// 逐条替换：整串精确 → 剥离装饰 → 当日文装备名 → 子串兜底
// v1.2.8：四步链拆为子步骤（降认知复杂度）
// ① 整串精确（v1.12.11：空白归一化回退，防空格式差异）
function _trFCExact(text, t0, path = globalThis.location?.pathname || '') {
  const fullBody = FC_FULL_SET_LABEL.exec(t0)?.[0] || '';
  const alias = fcGaroSetName(fullBody ? t0.slice(0, -fullBody.length) : t0);
  const hit0 = fcUIValue('page:' + path + ':' + t0) || fcUIValue(t0)
    || (alias && alias + fullBody) || lookupDutyName(t0) || resolveDyeColor(t0);
  if (!hit0) return null;
  const i = text.indexOf(t0);
  return text.slice(0, i) + hit0 + text.slice(i + t0.length);
}

// ② 剥离装饰符号后再试
function _trFCDecor(text, t0, core) {
  if (!core || core === t0) return null;
  const hit1 = DICT_FC[core];
  if (!hit1) return null;
  const head = t0.slice(0, t0.indexOf(core));
  const tail = t0.slice(t0.indexOf(core) + core.length);
  const i = text.indexOf(t0);
  return text.slice(0, i) + head + hit1 + tail + text.slice(i + t0.length);
}

// ③ 日文装备名（剥「画像」等后缀）；失败再试系列名（v1.12.0）
// v1.12.2：含假名 OR 纯汉字串（≤20字，如 夜桜上衣）都试查
// v1.2.1：判定前剥【…】标记——「春日半頬【想】」等「纯汉字+全角标记」名此前两条件都不满足，整名不查表
function _trFCName(text, t0, core) {
  const c3 = core || t0;
  const c3p = c3.replace(/【[^【】]*】/g, '').trim() || c3;
  const isKana = /[\u3040-\u30ff]/.test(c3p);
  const isKanji = /^[\u3005\u3006\u4e00-\u9fff]+$/.test(c3p) && c3p.length >= 2 && c3p.length <= 20;
  if (!isKana && !isKanji) return null;
  const cand = c3.replace(/(の画像|画像|イメージ|の見た目)$/, '').trim();
  // v1.1.3：数据就绪前不跑逐段翻译——「系列・职业」半翻译（ファントムヴィジョン·御敌）会破坏原文，
  // 数据到后的补扫将无法再识别（整体译名依赖完整日文名）；等数据齐由补扫统一处理
  let zh = fcKnownName(cand);
  if (!zh && _tablesReady) zh = trFCSegments(cand);
  if (!zh || zh === cand) return null;
  const i2 = text.indexOf(t0);
  return text.slice(0, i2) + zh + text.slice(i2 + t0.length);
}

// ④ 子串兜底：含菜单词/装备名的片段（v1.14.5：门槛 6→2，覆盖被 <br> 等拆分的短节点如「で制作」）
// v1.1.3：数据就绪前不跑——避免对「系列・职业」复合名做部分替换破坏原文（如 ファントムヴィジョン・御敌）；补扫时统一处理
function _fcCanReplaceAt(out, at, key) {
  // Avoid translating ドレス inside メールアドレス or ノート inside ノートゥング.
  // A hiragana particle after a katakana name is a real word boundary.
  // Keep protecting katakana runs such as ドレス in メールアドレス.
  const kana = /[ァ-ヶー]/;
  const joinedBefore = kana.test(key[0]) && kana.test(out[at - 1] || '');
  const joinedAfter = kana.test(key.at(-1)) && kana.test(out[at + key.length] || '');
  return !joinedBefore && !joinedAfter;
}
function _fcReplaceSubstr(out, key, value) {
  let at = out.indexOf(key);
  let changed = false;
  while (at !== -1) {
    if (_fcCanReplaceAt(out, at, key)) {
      out = out.slice(0, at) + value + out.slice(at + key.length);
      changed = true;
      at = out.indexOf(key, at + value.length);
    } else {
      at = out.indexOf(key, at + key.length);
    }
  }
  return { out, changed };
}
function translateBracketedDuties(text) {
  const chunks = text.split('】');
  for (let index = 0; index < chunks.length - 1; index++) {
    const chunk = chunks[index];
    const opening = chunk.indexOf('【');
    if (opening < 0) continue;
    const names = chunk.slice(opening + 1);
    chunks[index] = chunk.slice(0, opening + 1)
      + names.split(/([/／])/u).map(name => lookupDutyName(name) || name).join('');
  }
  return chunks.join('】');
}

function _trFCSubstr(text, t0, core) {
  if (!_tablesReady || (core || t0).length < 2 || !/[^\x00-\x7F]/.test(t0)) return null;
  // Avoid corrupting arbitrary Japanese prose with dictionary word fragments.
  if (/[。！？]/.test(t0) && /[ぁ-ん]/.test(t0)) return null;
  let out = translateBracketedDuties(text);
  let changed = out !== text;
  // 长词优先，避免短词先替换（v1.1.6：含系列 + 物品前缀推导）
  for (const k of _getSubstrKeysAll()) {
    if (!out.includes(k)) continue;
    const v = DICT_FC[k] || DICT_FC['duty:' + k] || _getSeriesPfx().get(k) || _getItemPfx().get(k);
    if (v == null) continue;
    const replaced = _fcReplaceSubstr(out, k, v);
    out = replaced.out;
    changed ||= replaced.changed;
  }
  return changed ? out : null;
}

function trFCAcquisition(text, label) {
  const source = /^(?:特殊素材「(.+)」|(.+?) の入手方法|NPC[:：](.+)|「(.+?)×(\d{1,6})」と交換で入手)$/.exec(label);
  if (!source) return null;
  const native = source[1] || source[2] || source[3] || source[4];
  const name = fcKnownName(native);
  if (!name) return null;
  let result;
  if (source[1]) result = '特殊材料“' + name + '”';
  else if (source[2]) result = name + '的获取方式';
  else if (source[3]) result = 'NPC：' + name;
  else result = '使用' + source[5] + '个' + name + '兑换';
  return text.replace(label, result);
}

function fcArticleTitle(text, label) {
  // 站点使用【FF14】和〖FF14〗两种文章标题括号；已是套装名时不再追加“装备”。
  // 较新文章可能省略 👗，直接使用「装備各種族での見た目・入手方法」。
  const match = /^([【〖]FF14[】〗])(.{1,80}?)(装備)?(?=([👗💍✂⚔])|各種族での見た目・入手方法)/u.exec(label);
  if (!match) return null;
  const scoped = FC_VERIFIED_SHORT_SET_PATHS.get(match[2]);
  const path = globalThis.location?.pathname || '';
  // 详情页标题与 document.title 并非 DOM 套装标题，需单独恢复已核实的短称。
  const scopedName = scoped?.path === path ? scoped.zh : null;
  const name = fcVerifiedSetName(match[2]) || scopedName || fcKnownName(match[2]);
  if (!name || name === match[2]) return null;
  // 仅完整系列名且确有「装備」的文章标题加“套装”；
  // 单件物品与武器继续保留“装备”，未核实系列不猜译。
  const mappedSeries = _getSeriesMap().get(match[2]);
  const outfitArticle = match[4] === '👗' || !match[4];
  const isKnownOutfit = match[3] && outfitArticle && mappedSeries === name;
  let suffix = '';
  if (!/(?:套装|装束)(?:·[阴阳])?$/u.test(name)) {
    if (isKnownOutfit) suffix = '套装';
    else if (match[3]) suffix = '装备';
  }
  const translated = text.replace(match[0], match[1] + name + suffix);
  return _trFCSubstr(translated, translated.trim(), '') || translated;
}

function trFCRelated(text, label) {
  const match = /^(.{1,60})の(関連アイテム)?$/.exec(label);
  if (!match) return null;
  const name = fcScopedSetName(match[1]) || fcKnownName(match[1]);
  if (!name) return null;
  const suffix = match[2] ? '的相关物品' : '的';
  return text.replace(label, name + suffix);
}

// 站点「种族初始服装」是组合标题，不是物品表中的一件装备。
// 以游戏内正式种族名称翻译整个短标题，避免「猫魅族♀初期服」半中文化。
const FC_STARTER_RACES = new Set([
  'ヒューラン', 'エレゼン', 'ララフェル', 'ミコッテ',
  'ルガディン', 'アウラ', 'ヴィエラ', 'ロスガル',
]);
function fcStarterOutfitName(native) {
  const match = /^(.+?)([♂♀])初期服$/u.exec(native);
  if (!match || !FC_STARTER_RACES.has(match[1])) return null;
  const race = fcUIValue(match[1]);
  if (!race) return null;
  return race + (match[2] === '♀' ? '女性' : '男性') + '初始服装';
}

function fcStarterOutfitTitle(text, label) {
  const whole = /^(.*?)(（全身）)$/u.exec(label);
  const name = fcStarterOutfitName(whole ? whole[1] : label);
  if (name) return text.replace(label, name + (whole ? whole[2] : ''));
  const article = /^【FF14】(.+?)(男性♂|女性♀)初期服装備/u.exec(label);
  if (article) {
    const sex = article[2] === '男性♂' ? '♂' : '♀';
    const translated = fcStarterOutfitName(article[1] + sex + '初期服');
    if (translated) return text.replace(article[0], '【FF14】' + translated);
  }
  const alt = /「([^「」]{2,32}?[♂♀]初期服)」/u.exec(label);
  if (alt) {
    const localized = fcStarterOutfitName(alt[1]);
    if (localized) return text.replace(alt[0], '「' + localized + '」');
  }
  return null;
}

// Avoid a variable-length regex followed by overlapping whitespace matching.
// The separator immediately before の詳細情報 must be whitespace.
function trFCDutyDetail(text, label) {
  const suffix = 'の詳細情報';
  if (!label.endsWith(suffix)) return null;
  const marker = /^▷\s*/u.exec(label)?.[0] || '';
  const source = label.slice(marker.length, -suffix.length);
  if (!/\s$/u.test(source)) return null;
  const subject = source.trim();
  if (subject.length < 2 || subject.length > 90) return null;
  const duty = lookupDutyName(subject);
  return duty ? text.replace(label, marker + duty + '的详细信息') : null;
}

function trFCRaidDetails(text, label) {
  const raidDrop = /^アライアンスレイド「([^「」]{2,90})」の\s*宝箱\s*からランダムでドロップする。?$/u.exec(label);
  if (raidDrop) {
    const duty = lookupDutyName(raidDrop[1]);
    if (duty) return text.replace(label, '从团队任务“' + duty + '”的宝箱中随机掉落。');
  }
  const treasure = /^「([^「」]{2,80})」装備が「([^「」]{2,90})」のどの宝箱からドロップするか、ひと目でわかるツールです$/u.exec(label);
  if (treasure) {
    const set = fcScopedSetName(treasure[1]) || fcVerifiedSetName(treasure[1])
      || fcKnownName(treasure[1]);
    const duty = lookupDutyName(treasure[2]);
    if (set && duty)
      return text.replace(label, '可直观查看“' + set + '”在团队任务“' + duty + '”的哪些宝箱中掉落。');
  }
  return trFCDutyDetail(text, label);
}

function trFCControlLabel(text, source, label) {
  const level = /^レベル\s*(\d{1,3})$/.exec(label);
  if (level) return text.replace(source, level[1] + '级');
  const af = /^(戦闘|クラフター・ギャザラー)ジョブ専用装備\(AF(\d{1,2})\)$/.exec(label);
  if (af) return text.replace(source, (af[1] === '戦闘' ? '战斗职业' : '制作与采集职业') + '专属装备（AF' + af[2] + '）');
  const afIntro = /^AF(\d{1,2})とは$/.exec(label);
  if (afIntro) return text.replace(source, '什么是 AF' + afIntro[1]);
  const slide = /^Go to slide (\d+)$/.exec(source);
  if (slide) return text.replace(source, '切换到第 ' + slide[1] + ' 张');
  if (source === 'Previous slide') return text.replace(source, '上一张图片');
  if (source === 'Next slide') return text.replace(source, '下一张图片');
  const count = label.match(/^(.{1,40}?) \(([\d,]+)\)$/u);
  if (count && Object.hasOwn(DICT_FC, count[1]))
    return text.replace(source, DICT_FC[count[1]] + ' (' + count[2] + ')');
  return null;
}

function trFCDynamic(text, t0) {
  // 全角括号会在 fcUIKey 的 NFKC 规范化中变成半角；组合标题使用原文匹配。
  const starter = fcStarterOutfitTitle(text, t0);
  if (starter !== null) return starter;
  const verifiedSet = fcVerifiedSetText(text, t0);
  if (verifiedSet !== null) return verifiedSet;
  const named = FC_VERIFIED_SHORT_SET_PATHS.get(t0);
  const setName = named?.plain && fcScopedSetName(t0);
  if (setName) return text.replace(t0, setName);
  const group = fcCrystalTowerSetGroup(text, t0);
  if (group !== null) return group;
  const raid = trFCRaidDetails(text, t0);
  if (raid !== null) return raid;
  const control = trFCControlLabel(text, t0, fcUIKey(t0));
  if (control !== null) return control;
  return trFCRelated(text, t0) || trFCAcquisition(text, t0);
}

function trFC(text, path = globalThis.location?.pathname || '') {
  if (!text) return text;
  const t0 = text.trim();
  if (!t0) return text;
  const exact = _trFCExact(text, t0, path);
  if (exact !== null) return exact;
  const dynamic = trFCDynamic(text, t0);
  if (dynamic !== null) return dynamic;
  if (t0.length > 120) return text;
  const equipment = fcJobEquipment(text, t0);
  if (equipment !== null) return equipment;
  const article = fcArticleTitle(text, t0);
  if (article !== null) return article;
  const core = t0.replace(FC_DECOR_HEAD, '').replace(FC_DECOR_TAIL, '').trim();
  const s2 = _trFCDecor(text, t0, core);
  if (s2 !== null) return s2;
  const s3 = _trFCName(text, t0, core);
  if (s3 !== null) return s3;
  const s4 = _trFCSubstr(text, t0, core);
  if (s4 !== null) return s4;
  return text;
}

// 装备详情页把整套装备简写为系列词。以对应详情 URL 严格定位，
// 按国服单件装备官方词干给系列标题加展示后缀；不是新的物品官方名称。
// 特别注意水晶塔的风魔/洋葱与 PvP 威望装束、深红与同名家具不得混淆。
const FC_VERIFIED_SHORT_SET_PATHS = new Map([
  ['オブ・ライト', { path: '/equipment/of_light/', zh: '光之套装', plain: true, strictLink: true, crystal: true }],
  ['ロイヤル', { path: '/equipment/royal/', zh: '皇室套装', plain: true, strictLink: true, crystal: true }],
  ['クリムゾン', { path: '/equipment/crimson/', zh: '深红套装', plain: true, strictLink: true, crystal: true }],
  ['バラード', { path: '/equipment/ballad/', zh: '民谣套装', plain: true, strictLink: true, crystal: true }],
  ['風魔', { path: '/equipment/fuma/', zh: '风魔套装', plain: true, strictLink: true, crystal: true }],
  ['オニオン', { path: '/equipment/onion/', zh: '洋葱套装', plain: true, strictLink: true, crystal: true }],
  ['夜桜', { path: '/equipment/yozakuras/', zh: '夜樱套装' }],
  ['ビーストマスター', { path: '/equipment/beastmasters/', zh: '兽主套装' }],
  ['コスモエクスプローラー', { path: '/equipment/cosmic_explorers/', zh: '宇宙探索者套装' }],
]);

// Page context is sufficient for text callers; the DOM adapter can also verify a link.
function fcScopedSetName(name, matchesDetailLink) {
  const record = FC_VERIFIED_SHORT_SET_PATHS.get(name);
  if (!record) return null;
  const path = globalThis.location?.pathname || '';
  return path === record.path
    || (record.crystal && path === '/summary/the_labyrinth_of_the_ancients/')
    || matchesDetailLink?.(record.path) ? record.zh : null;
}

// 古代人迷宫总览的完整系列标题还包含可装备职业。
// 每个职业必须完整命中公共国服词典，否则保留原文，避免半译。
function fcCrystalTowerSetGroup(text, label) {
  if ((globalThis.location?.pathname || '') !== '/summary/the_labyrinth_of_the_ancients/') return null;
  const m = /^([【〖]FF14[】〗])?(.{2,32}?)（([^（）]{2,90})）(装備の見た目)?$/u.exec(label);
  if (!m || !FC_VERIFIED_SHORT_SET_PATHS.get(m[2])?.crystal) return null;
  const roles = m[3].split('・').map(role => fcUIValue(role.trim()));
  if (roles.some(role => !role)) return null;
  return text.replace(label, (m[1] || '') + fcScopedSetName(m[2])
    + '（' + roles.join('、') + '）' + (m[4] ? '装备外观' : ''));
}

const FC_FULL_SET_LABEL = /[（(]全身[）)]$/u;
