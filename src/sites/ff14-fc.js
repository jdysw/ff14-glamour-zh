import { FC_ROLE_ZH, _getItemPfx, _getSeriesMap, _getSeriesPfx, _getSubstrKeysAll } from '../core/cache.js';
import { WIKI_ITEM } from '../core/constants.js';
import { _tablesReady, dataGetIndex, resolveAllByName, resolveByHash, resolveDyeColor } from '../core/data/data-manager.js';
import { cacheRegister } from '../core/cache-primitives.js';
import { DICT_FC, lookupDutyName } from '../core/data/dictionary.js';
import { SKIP_TAGS, _markScan, localScope, queryIn, snapshotTranslationNodes } from '../core/dom.js';
import { lookupJp2Zh, lookupShopCostumeSet } from '../core/item-resolver.js';
import { createTranslationObserver } from '../core/observer.js';
import { safe } from '../core/runtime.js';
export { fcVerifiedSetName, fcStarterOutfitName, fcGaroSetName, collapseFCHomeHeadings, fcSetDisplayText, FC_ROLE_ZH, _fcAcceptNode, _fcCanReplaceAt, _procFCNode, _trFCDecor, _trFCExact, _trFCName, _trFCSubstr, _wowFCInput, _trFCAttr, bindFCBanners, fcLinkZhName, fixFCMenu, rewriteFCForeignLink, startFC, trFC, trFCSegments, translateFCPage, translateFCTitle, trimFCNode };


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
    // The shop title differs from the in-game attire name. These pairs
    // are confirmed by the Chinese store and Item 50721/50722/45522.
    ['バトルフィールドローズ・コスチュームセット', '战场玫瑰套装'],
    ['ハンブル・コスチュームセット', '平民套装'],
    ['セイニャー・コスチュームセット', '领主装备套装'],
    // The official outfit combination name (Item 45109) already expresses a set.
    ['ブルーサマーセット（女性用）', '蔚蓝女式夏装组合'],
    // Full set labels observed in the live recommendation cards. Game item
    // records 50585, 8111, 14855, 28606, 15481 and 32332–32333 establish
    // the set identity or the localized shop/gear family name.
    ['アイディアル・スースセイヤー', '理想化的预占套装'],
    ['スウィートドリームアタイア', '美梦套装'],
    ['東方殿方衣装セット', '东方公子套装'],
    ['東方美玉衣装セット', '东方美玉套装'],
    ['風雅衣装セット', '风雅装束'],
    ['エデンモーン・キャスター', '伊甸之晨咏咒套装'],
    // JP store titles differ from CN store / item names; use whole-label matches.
    // Gear stems verified against Item 46032 and Item 11338/11352.
    ['クワイヤーセット', '唱诗班套装'],
    ['アイメリク・コスチュームセット', '总骑士长套装'],
    ['クルル・コスチュームセット', '血盟聆听者套装'],
    ['スターライトセット', '星芒套装'],
    ['セレモニアル・ディフェンダー', '仪仗御敌套装'],
    ['シャーレアン・パンクラティアスト', '萨雷安混斗者套装'],
  ]);
  function fcVerifiedSetName(name) {
    if (typeof name !== 'string') return null;
    const verified = FC_VERIFIED_SET_ALIASES.get(name);
    if (verified) return verified;
    // Seasonal shop bundles use gendered titles, while the actual item
    // record names the corresponding top + bottom combination.
    const summer = /^(レッド|グリーン|ブルー|ソーラー|ルナ|パールブラック|パールホワイト|ストライプ)サマーセット[（(]([男女])性用[）)]$/u.exec(name);
    if (summer) {
      const prefix = summer[1].startsWith('パール') ? summer[1] + '・' : summer[1];
      const part = summer[2] === '女' ? 'ホルター' : 'トップ';
      const values = resolveAllByName(prefix + 'サマー' + part + '・セット');
      return values.length === 1 && values[0].endsWith('夏装组合') ? values[0] : null;
    }
    return lookupShopCostumeSet(name);
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
    // Both title variants occur on the native equipment catalogue, including
    // the source badges appended to titles and thumbnail alt labels.
    return text.replace(/【([^【】]{1,160})】|〖([^〖〗]{1,160})〗/gu,
      (whole, black, white) => {
        const names = black ?? white;
        const localized = names.split(/([/／])/u).map(name => lookupDutyName(name) || name).join('');
        return whole[0] + localized + whole.at(-1);
      });
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

  // 逐条替换：整串精确 → 剥离装饰 → 当日文装备名 → 子串兜底
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

  // The native AF article starts with a job/AF generation, not the outfit.
  // Resolve its trailing set label in the same equipment-page context as cards.
  function fcAFArticleSetName(native, path, element) {
    const record = FC_VERIFIED_SHORT_SET_PATHS.get(native);
    const linked = fcLinkedPath(element);
    if (record && (linked === record.path || (linked === undefined && path === record.path))) return record.zh;
    if (record?.strictLink) return null;
    const suffix = /(?:套装|装束|组合)(?:·[阴阳])?(?:〖[^〖〗]+〗|（[^（）]+）)?$/u;
    const direct = fcKnownName(native);
    const series = (suffix.test(direct || '') ? direct : null)
      || _getSeriesMap().get(native) || fcVerifiedSetName(native)
      || _getSeriesPfx().get(native) || (!fcItemName(native) && _getItemPfx().get(native));
    if (!series || series === native) return null;
    return suffix.test(series) ? series : series + '套装';
  }

  function fcAFArticleTitle(text, label, path, element) {
    const match = /^([【〖]FF14[】〗])(.{1,24}?)AF(\d{1,2})?(?:[（(](アネモス|PvP)[）)])?装備(?:[（(]Lv(\d{1,3})[）)])?(👗?)各種族での見た目・入手方法([【〖])(.{1,80})([】〗])(?=$|\s*[|｜])/u.exec(label);
    if (!match || (!match[3] && match[4] !== 'PvP')) return null;
    const [, marker, nativeJob, generation = '', variant, level, icon, open, native, close] = match;
    const job = fcUIValue(nativeJob === '赤魔導士' ? '赤魔道士' : nativeJob);
    const name = fcAFArticleSetName(native, path, element);
    const frame = fcUIValue('各種族での見た目・入手方法');
    const variantZh = variant === 'アネモス' ? fcUIValue(variant) : variant;
    // Keep unresolved native labels intact for the data-ready rescan.
    if (!job || !name || !frame || (variant && !variantZh)) return text;
    const qualifier = variantZh ? '（' + variantZh + '）' : '';
    const levelZh = level ? '（' + level + '级）' : '';
    return text.replace(match[0], marker + job + ' AF' + generation + qualifier
      + '装备' + levelZh + icon + frame + open + name + close);
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
    if (!/(?:套装|装束|组合)(?:·[阴阳])?(?:〖[^〖〗]+〗|（[^（）]+）)?$/u.test(name)) {
      if (isKnownOutfit) suffix = '套装';
      else if (match[3]) suffix = '装备';
    }
    let translated = text.replace(match[0], match[1] + name + suffix);
    // The article frame is known UI, even before the item tables are ready.
    // Preserve unknown source labels rather than guessing their game names.
    const template = '各種族での見た目・入手方法';
    const frame = fcUIValue(template);
    if (frame) translated = translated.replace(template, frame);
    translated = translateBracketedDuties(translated);
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
    const unlock = /^「([^「」]{2,90})」の開放条件$/u.exec(label);
    if (unlock) {
      const duty = lookupDutyName(unlock[1]);
      if (duty) return text.replace(label, '“' + duty + '”的开放条件');
    }
    const introduction = /^(.{2,90})とは$/u.exec(label);
    if (introduction) {
      const duty = lookupDutyName(introduction[1]);
      if (duty) return text.replace(label, duty + '介绍');
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

  function trFC(text, path = globalThis.location?.pathname || '', element = null) {
    if (!text) return text;
    const t0 = text.trim();
    if (!t0) return text;
    const exact = _trFCExact(text, t0, path);
    if (exact !== null) return exact;
    const afArticle = fcAFArticleTitle(text, t0, path, element);
    if (afArticle !== null) return afArticle;
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

  // #zhx-chinese-suggest-list：中文搜索候选（native span 有意保留日文原名，不参与汉化）
  const FC_SKIP_SEL = 'script, style, noscript, textarea, pre, code, [contenteditable]:not([contenteditable="false"]), .zhx-skip, .sns, .twitter, .twitter-tweet, .line, .comment-body, .comment-content, .message-box p, .answer-box p, #zhx-chinese-suggest-list';

  const FC_INLINE_TAGS = new Set(['A', 'SPAN', 'STRONG', 'EM', 'B', 'I', 'BR', 'SMALL', 'MARK']);
  function fcParagraphModel(element) {
    const children = [];
    let key = '';
    for (const node of element.childNodes) {
      if (node.nodeType === 3) key += node.nodeValue;
      else if (node.nodeType === 1 && FC_INLINE_TAGS.has(node.tagName)) {
        key += '{' + children.length + '}';
        children.push(node);
      } else if (node.nodeType !== 8) return null;
    }
    return { key: key.replace(/\s+/gu, ' ').trim(), children };
  }

  // The native acquisition paragraph sometimes wraps the duty and/or “宝箱”
  // in links/emphasis. Translate its grammar while keeping those nodes intact.
  function fcRaidRichDrop(model) {
    const parts = model.children;
    if (parts.length === 1 && parts[0].textContent.trim() === '宝箱') {
      const match = /^アライアンスレイド「([^{}「」]{2,90})」の\s*\{0\}\s*からランダムでドロップする。?$/u.exec(model.key);
      const duty = match && lookupDutyName(match[1]);
      return duty ? '从团队任务“' + duty + '”的{0}中随机掉落。' : null;
    }
    if (parts.length === 1 && lookupDutyName(parts[0].textContent.trim())
      && /^アライアンスレイド「\{0\}」の\s*宝箱\s*からランダムでドロップする。?$/u.test(model.key))
      return '从团队任务“{0}”的宝箱中随机掉落。';
    if (parts.length === 2 && parts[1].textContent.trim() === '宝箱'
      && lookupDutyName(parts[0].textContent.trim())
      && /^アライアンスレイド「\{0\}」の\s*\{1\}\s*からランダムでドロップする。?$/u.test(model.key))
      return '从团队任务“{0}”的{1}中随机掉落。';
    return null;
  }

  function translateFCParagraph(element) {
    if (element.closest(FC_SKIP_SEL)) return;
    const model = fcParagraphModel(element);
    if (!model?.children.length) return;
    const key = 'rich:' + model.key;
    const translated = fcUIValue('page:' + location.pathname + ':' + key)
      || fcUIValue(key) || fcRaidRichDrop(model);
    if (!translated) return;
    const indices = [...translated.matchAll(/\{(\d{1,3})\}/g)].map(match => Number(match[1]));
    // Refuse malformed entries rather than dropping or duplicating native links.
    if (indices.length !== model.children.length || new Set(indices).size !== indices.length
      || indices.some(index => index >= model.children.length)) return;
    const fragment = document.createDocumentFragment();
    for (const part of translated.split(/(\{\d{1,3}\})/g)) {
      const match = /^\{(\d{1,3})\}$/.exec(part);
      fragment.append(match ? model.children[Number(match[1])] : document.createTextNode(part));
    }
    element.replaceChildren(fragment);
  }

  function translateFCParagraphs(rootArg) {
    const scope = localScope(rootArg);
    if (rootArg && !scope && rootArg.nodeType !== 9) return;
    const paragraphs = new Set(queryIn(scope, 'p'));
    const parent = scope?.closest?.('p');
    if (parent) paragraphs.add(parent);
    for (const paragraph of paragraphs) translateFCParagraph(paragraph);
  }

  // 首页每个区块原本以英文大字 + 日文 H2 呈现同一标题。
  // 中文化后两者会并排重复；保留原先较醒目的大字，只隐藏核实配对的副标题。
  const FC_HOME_SECTION_TITLES = Object.freeze([
    ['New Equipment', '新着装備', '新装备'],
    ['Feature', '特集', '特辑'],
    ['Parts', '部位ごと', '按部位'],
    ['New Fashion Accessories', 'ファッションアクセ', '新时尚配饰'],
    ['Category', 'カテゴリ', '分类'],
    ['Package', 'パッケージ', '资料片'],
    ['New Modern Aesthetics', 'ヘアカタログ', '最新发型'],
    ['New Weapon', '新着武器', '最新武器'],
    ['Pick Up!', 'オススメ', '推荐'],
  ]);

  function fcHomeExactTextNode(node, accepted) {
    if (node.nodeType === 3) return accepted.has(node.nodeValue.trim()) ? node : null;
    for (const child of node.childNodes || []) {
      const found = fcHomeExactTextNode(child, accepted);
      if (found) return found;
    }
    return null;
  }

  function fcFindPreviousTitle(branch, accepted) {
    let previous = branch.previousSibling;
    for (let step = 0; previous && step < 6; step++, previous = previous.previousSibling) {
      if (!accepted.has((previous.textContent || '').trim())) continue;
      const node = fcHomeExactTextNode(previous, accepted);
      if (node) return node;
    }
    return null;
  }

  function fcHomePrimaryTitle(heading, english, chinese) {
    const accepted = new Set([english, fcUIValue(english) || english, chinese]);
    let branch = heading;
    // 兼容主标题和副标题同级、或各自嵌套在一层容器的 WordPress 模板。
    for (let depth = 0; branch && depth < 3; depth++, branch = branch.parentElement) {
      const title = fcFindPreviousTitle(branch, accepted);
      if (title) return title;
      if (branch.parentElement?.tagName === 'BODY') break;
    }
    return null;
  }

  function fcCollapseMatchedHeading(heading, english, japanese, chinese) {
    const label = heading.textContent.trim();
    if (label !== japanese && label !== (fcUIValue(japanese) || japanese)) return false;
    const primary = fcHomePrimaryTitle(heading, english, chinese);
    if (!primary) return false;
    const value = primary.nodeValue.trim();
    if (value !== chinese) primary.nodeValue = primary.nodeValue.replace(value, chinese);
    if (heading.style.display !== 'none') {
      heading.style.display = 'none';
      heading.setAttribute('aria-hidden', 'true');
    }
    // 隐藏 H2 后，给仍可见的大标题保留标题的可访问性语义。
    const element = primary.parentElement;
    if (element && !/^H[1-6]$/.test(element.tagName) && !element.hasAttribute('role')) {
      element.setAttribute('role', 'heading');
      element.setAttribute('aria-level', '2');
    }
    return true;
  }

  function collapseFCHomeHeadings() {
    const path = globalThis.location?.pathname || '';
    // 装备详情页也有「Point / まとめ」这样的同义双标题。
    const isHome = path === '/';
    if (!isHome && !/^\/equipment\/[^/]+\/?$/u.test(path)) return;
    const sections = isHome ? FC_HOME_SECTION_TITLES : [['Point', 'まとめ', '汇总']];
    for (const heading of document.querySelectorAll('h2')) {
      for (const [english, japanese, chinese] of sections) {
        if (fcCollapseMatchedHeading(heading, english, japanese, chinese)) break;
      }
    }
  }

  // GARO 非阴阳装束的独立卡片使用「金狼」「漆黒」等简称。
  // 这几条必须精确对应站点的装备详情 URL，否则「漆黒」会与资料片名冲突；
  // 「風魔」更是另一个迷宫装备系列，不能拿威望风魔装束来覆盖。
  const FC_GARO_BARE_SET_PATHS = new Map([
    ['金狼', '/equipment/the_golden_wolf/'],
    ['漆黒', '/equipment/undying_twilight/'],
    ['暗黒', '/equipment/pressing_darkness/'],
    ['白夜', '/equipment/the_white_night/'],
    ['銀狼', '/equipment/the_silver_wolf/'],
  ]);
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
    ['夜桜', { path: '/equipment/yozakuras/', zh: '夜樱装束' }], // Item 52597
    ['ビーストマスター', { path: '/equipment/beastmasters/', zh: '兽主套装' }],
    ['コスモエクスプローラー', { path: '/equipment/cosmic_explorers/', zh: '宇宙探索者套装' }],
    // Full native catalogue audit (1,580 distinct equipment URLs). These are
    // site display names derived from verified localized item families, not
    // global item aliases; ambiguous short names must retain their URL scope.
    ['キングダムブラス・レンジャー', { path: '/equipment/bygone_brass_jerkin_of_aiming/', zh: '王国黄铜精准套装', strictLink: true }],
    ['ガラテア', { path: '/equipment/galatea/', zh: '伽拉忒亚装备套装', strictLink: true }], // Item 47715
    ['ピーコック・クラフター', { path: '/equipment/crested_of_crafting/', zh: '雀翎巧匠套装', strictLink: true }],
    ['ピーコック・ギャザラー', { path: '/equipment/crested_of_gathering/', zh: '雀翎大地套装', strictLink: true }],
    ['プリッシュ・ストライカー', { path: '/equipment/prishes_of_striking/', zh: '普利修强袭套装', strictLink: true }],
    ['バウンサー', { path: '/equipment/bouncers/', zh: '保镖套装', strictLink: true }],
    ['セレモニアル・スレイヤー', { path: '/equipment/ceremonial_of_maiming/', zh: '仪仗制敌套装', strictLink: true }],
    ['アークエンジェル・レンジャー', { path: '/equipment/ark_angels_of_aiming/', zh: '方舟天使精准套装', strictLink: true }],
    ['オールドキングダム・ディフェンダー', { path: '/equipment/archeo_kingdom_of_fending/', zh: '旧日王国御敌套装', strictLink: true }],
    ['オールドキングダム・スレイヤー', { path: '/equipment/archeo_kingdom_of_maiming/', zh: '旧日王国制敌套装', strictLink: true }],
    ['カザナル・スカウト', { path: '/equipment/rakaznar_of_scouting/', zh: '卡扎纳尔游击套装', strictLink: true }],
    ['カザナル・レンジャー', { path: '/equipment/rakaznar_of_aiming/', zh: '卡扎纳尔精准套装', strictLink: true }],
    ['クァールレギナ', { path: '/equipment/spotted/', zh: '女王豹纹套装', strictLink: true }],
    ['インダガトル・クラフター', { path: '/equipment/indagators_of_crafting/', zh: '研究者巧匠套装', strictLink: true }],
    ['ルナエンヴォイ・レンジャー', { path: '/equipment/augmented_lunar_envoys_of_aiming/', zh: '月使精准套装', strictLink: true }],
    ['ルナエンヴォイ・キャスター', { path: '/equipment/augmented_lunar_envoys_of_casting/', zh: '月使咏咒套装', strictLink: true }],
    ['ルナエンヴォイ・ヒーラー', { path: '/equipment/augmented_lunar_envoys_of_healing/', zh: '月使治愈套装', strictLink: true }],
    ['ボズヤン・スカウト', { path: '/equipment/bozjan_of_scouting/', zh: '博兹雅游击套装', strictLink: true }],
    ['リナシータ・ディフェンダー', { path: '/equipment/rinascita_of_fending/', zh: '复兴御敌套装', strictLink: true }],
    ['リナシータ・スレイヤー', { path: '/equipment/rinascita_of_maiming/', zh: '复兴制敌套装', strictLink: true }],
    ['イヴァリース・ミスティック', { path: '/equipment/ivalician_mystics/', zh: '伊瓦利斯神秘人套装', strictLink: true }],
    ['イシュガルディアン・モナスティック', { path: '/equipment/ishgardian_monastics/', zh: '伊修加德僧侣套装', strictLink: true }],
    ['イシュガルディアン・アウトライダー', { path: '/equipment/ishgardian_outriders/', zh: '伊修加德先驱套装', strictLink: true }],
    ['イシュガルディアン・ヒストリアン', { path: '/equipment/ishgardian_historians/', zh: '伊修加德史学家套装', strictLink: true }],
    ['フライヤー', { path: '/equipment/halonic_friars/', zh: '战女神修士套装', strictLink: true }],
    ['エクソシスト', { path: '/equipment/halonic_exorcists/', zh: '战女神驱魔套装', strictLink: true }],
    ['プリースト', { path: '/equipment/halonic_priests/', zh: '战女神祭司套装', strictLink: true }],
    ['シャーレアン・エージェント', { path: '/equipment/sharlayan_emissarys/', zh: '萨雷安出使者套装', strictLink: true }],
    ['ディファイアント', { path: '/equipment/the_defiant_duelist/', zh: '狂妄套装', strictLink: true }],
    ['バーサーカー', { path: '/equipment/berserkers/', zh: '狂战套装', strictLink: true }],
    ['バイキング', { path: '/equipment/viking/', zh: '维京套装', strictLink: true }],
    ['サブジュゲーター', { path: '/equipment/subjugators/', zh: '克服套装', strictLink: true }],
    ['パネジリスト', { path: '/equipment/panegyrists/', zh: '颂赞套装', strictLink: true }],
    ['プロフェット', { path: '/equipment/prophets/', zh: '预言套装', strictLink: true }],
    ['ワーデン', { path: '/equipment/wardens/', zh: '狱卒套装', strictLink: true }],
    ['アセティック', { path: '/equipment/ascetics/', zh: '苦行者套装', strictLink: true }],
    ['シパーヒ', { path: '/equipment/sipahi/', zh: '西帕希套装', strictLink: true }],
    ['マーシナリー', { path: '/equipment/mercenarys/', zh: '佣兵套装', strictLink: true }],
    ['ホプリタイ', { path: '/equipment/hoplite/', zh: '重步兵套装', strictLink: true }],
    ['ロード', { path: '/equipment/lords/', zh: '领主套装', strictLink: true }],
    ['シック', { path: '/equipment/thick/', zh: '厚重套装', strictLink: true }],
    ['ヘタイロス', { path: '/equipment/hetairos/', zh: '伙友骑兵套装', strictLink: true }],
    ['ペルタスト', { path: '/equipment/peltast/', zh: '轻步兵套装', strictLink: true }],
    ['トクソテス', { path: '/equipment/toxotes/', zh: '射兵套装', strictLink: true }],
    ['ストラテゴス', { path: '/equipment/strategos/', zh: '将领套装', strictLink: true }],
    ['デマゴーグ', { path: '/equipment/demagogue/', zh: '煽动者套装', strictLink: true }],
    ['ユサール', { path: '/equipment/hussars/', zh: '轻骑兵套装', strictLink: true }],
    ['ダークライト・ストライカー', { path: '/equipment/darklight_of_striking/', zh: '暗耀强袭套装', strictLink: true }],
    ['ダークライト・レンジャー', { path: '/equipment/darklight_of_aiming/', zh: '暗耀精准套装', strictLink: true }],
    ['ダークライト・キャスター', { path: '/equipment/darklight_of_casting/', zh: '暗耀咏咒套装', strictLink: true }],
    ['アレス', { path: '/equipment/divine_war/', zh: '阿瑞斯套装', strictLink: true }],
    ['アポロン', { path: '/equipment/divine_light/', zh: '阿波罗套装', strictLink: true }],
    ['ハデス', { path: '/equipment/divine_death/', zh: '哈德斯套装', strictLink: true }],
    ['デメテル', { path: '/equipment/divine_harvest/', zh: '德墨忒尔套装', strictLink: true }],
    ['ヴァリット', { path: '/equipment/varlets/', zh: '恶棍套装', strictLink: true }],
    ['エデンコーラス・ストライカー', { path: '/equipment/edenchoir_of_striking/', zh: '伊甸之律强袭套装', strictLink: true }],
    ['エデンコーラス・スカウト', { path: '/equipment/edenchoir_of_scouting/', zh: '伊甸之律游击套装', strictLink: true }],
    ['エデンコーラス・レンジャー', { path: '/equipment/edenchoir_of_aiming/', zh: '伊甸之律精准套装', strictLink: true }],
    ['エデンモーン・ヒーラー', { path: '/equipment/edenmorn_of_healing/', zh: '伊甸之晨治愈套装', strictLink: true }],
    ['ゴルディオン・ディフェンダー', { path: '/equipment/gordian_of_fending/', zh: '戈耳狄御敌套装', strictLink: true }],
    ['ゴルディオン・キャスター', { path: '/equipment/gordian_of_casting/', zh: '戈耳狄咏咒套装', strictLink: true }],
    ['ゴルディオン・ヒーラー', { path: '/equipment/gordian_of_healing/', zh: '戈耳狄治愈套装', strictLink: true }],
    ['アイディアル・ボディガード', { path: '/equipment/idealized_bodyguards/', zh: '理想化的护卫套装', strictLink: true }],
    ['アイディアル・プテロスレイバー', { path: '/equipment/idealized_pteroslaver/', zh: '理想化的驭龙套装', strictLink: true }],
    ['アイディアル・フィリ', { path: '/equipment/idealized_fili/', zh: '理想化的诗彩套装', strictLink: true }],
    ['アイディアル・ガンスリンガー', { path: '/equipment/idealized_gunslingers/', zh: '理想化的枪徒套装', strictLink: true }],
    ['アイディアル・ダンサー', { path: '/equipment/idealized_dancers/', zh: '理想化的起舞套装', strictLink: true }],
    ['アイディアル・エーベル', { path: '/equipment/idealized_ebers/', zh: '理想化的旧医套装', strictLink: true }],
    ['アイディアル・アルバテル', { path: '/equipment/idealized_arbatel/', zh: '理想化的古术套装', strictLink: true }],
    ['ヴァートゥ・アエド', { path: '/equipment/virtu_aoidos/', zh: '美德叙诗套装', strictLink: true }],
    ['ヴァートゥ・マシーナリー', { path: '/equipment/virtu_machinists/', zh: '美德机工套装', strictLink: true }],
    ['ヴァートゥ・オリゾン', { path: '/equipment/virtu_orison/', zh: '美德白祈套装', strictLink: true }],
    ['ヴァートゥ・ウェルキン', { path: '/equipment/virtu_welkin/', zh: '美德司天套装', strictLink: true }],
    ['フォレスト', { path: '/equipment/glade/', zh: '丛林套装', strictLink: true }],
    ['バニー', { path: '/equipment/bunny/', zh: '兔女郎套装', strictLink: true }],
    ['カジュアル', { path: '/equipment/casual/', zh: '休闲套装', strictLink: true }],
    ['クポクポ', { path: '/equipment/kupo/', zh: '库啵套装', strictLink: true }],
    ['アーバン', { path: '/equipment/urban/', zh: '都市套装', strictLink: true }],
    ['サバイバー', { path: '/equipment/survival/', zh: '幸存者套装', strictLink: true }],
    ['アスフォデロース・キャスター', { path: '/equipment/asphodelos_of_casting/', zh: '日影兰咏咒套装', strictLink: true }],
    ['アスフォデロース・ヒーラー', { path: '/equipment/asphodelos_of_healing/', zh: '日影兰治愈套装', strictLink: true }],
    ['イディル・パスファインダーRE', { path: '/equipment/augmented_shire_pathfinders/', zh: '改良型田园探索者套装', strictLink: true }],
    ['イディル・パンクラティアストRE', { path: '/equipment/augmented_shire_pankratiasts/', zh: '改良型田园混斗者套装', strictLink: true }],
    ['イディル・エージェントRE', { path: '/equipment/augmented_shire_emissarys/', zh: '改良型田园出使者套装', strictLink: true }],
    ['カエアンビロード・クラフター', { path: '/equipment/ar-caean_velvet_of_crafting/', zh: '迷彩绒巧匠套装', strictLink: true }],
    ['ルシス王子', { path: '/equipment/lucian_princes/', zh: '路西斯王子装束', strictLink: true }], // Item 45336
    ['ヴァイパー', { path: '/equipment/vipers/', zh: '蝰蛇套装', strictLink: true }],
    ['ブラックサマー（女性用）', { path: '/equipment/womens_black_summer/', zh: '纯黑女式夏装组合', strictLink: true }],
    ['ブラックサマー（男性用）', { path: '/equipment/mens_black_summer/', zh: '纯黑男式夏装组合', strictLink: true }],
    // Full catalogue audit round 2: official bundle IDs or member/coffer IDs
    // identify these display labels. Mixed-role/material groups are editorial
    // labels composed from the corresponding official localized terminology.
    ['ベルトレザー・コスチュームセット（トラウザータイプ）', { path: '/equipment/belt-leather/', zh: '皮带软甲裤套装', strictLink: true }], // Item 45571
    ['ベルトレザー・コスチュームセット（クロップドパンツタイプ）', { path: '/equipment/cropped_belt-leather/', zh: '皮带七分裤套装', strictLink: true }], // Item 45572
    ['東方旅芸人衣装セット', { path: '/equipment/far_eastern_performers_attire/', zh: '东方旅行艺人装束', strictLink: true }], // Item 45528
    ['ゼロ・コスチュームセット', { path: '/equipment/zeros_attire/', zh: '零风套装', strictLink: true }], // Item 45574
    ['グ・ラハ・ティア・コスチュームセット', { path: '/equipment/graha_tias_attire/', zh: '血盟公爵套装', strictLink: true }], // Item 45573
    ['マシュリー・コスチュームセット', { path: '/equipment/queen_of_hourne_attire/', zh: '霍伦女王套装', strictLink: true }], // Item 45576
    ['マイカ・ザ・ムー', { path: '/equipment/mica/', zh: '亩鼠米卡套装', strictLink: true }], // Item 45559
    ['エデュカント・コスチュームセット（スカートタイプ）', { path: '/equipment/educands_attire_skirt/', zh: '就学短裙装备套装', strictLink: true }], // Item 45504
    ['エデュカント・コスチュームセット（スラックスタイプ）', { path: '/equipment/educands_attire_slacks/', zh: '就学长裤装备套装', strictLink: true }], // Item 45503
    ['ビギナー(タンク)', { path: '/equipment/brand-new_tank/', zh: '初学者守护套装', strictLink: true }], // Item 51383
    ['ビギナー(ファイター)', { path: '/equipment/brand-new_dow/', zh: '初学者进攻套装', strictLink: true }], // Item 51384
    ['ビギナー(ソーサラー)', { path: '/equipment/brand-new_dom/', zh: '初学者魔法套装', strictLink: true }], // Item 51385
    ['シヴァルラス・アネモス', { path: '/equipment/anemos_chivalrous/', zh: '常风侠义套装', strictLink: true }], // Item 50558
    ['パシフィスト・アネモス', { path: '/equipment/anemos_pacifists/', zh: '常风和平套装', strictLink: true }], // Item 50559
    ['トゥルーブラッド・アネモス', { path: '/equipment/anemos_trueblood/', zh: '常风真血套装', strictLink: true }], // Item 50561
    ['ストーリーテラー・アネモス', { path: '/equipment/anemos_storytellers/', zh: '常风述事套装', strictLink: true }], // Item 50562
    ['セブンスヘブン・アネモス', { path: '/equipment/anemos_seventh_heaven/', zh: '常风七天套装', strictLink: true }], // Item 50563
    ['セブンスヘル・アネモス', { path: '/equipment/anemos_seventh_hell/', zh: '常风七狱套装', strictLink: true }], // Item 50564
    ['チャンネリング・アネモス', { path: '/equipment/anemos_channelers/', zh: '常风通灵套装', strictLink: true }], // Item 50565
    ['オラター・アネモス', { path: '/equipment/anemos_orators/', zh: '常风雄辩套装', strictLink: true }], // Item 50566
    ['アビス・アネモス', { path: '/equipment/anemos_abyss/', zh: '常风深渊套装', strictLink: true }], // Item 50568
    ['ガンナー・アネモス', { path: '/equipment/anemos_gunners/', zh: '常风炮手套装', strictLink: true }], // Item 50569
    ['コンステレーション・アネモス', { path: '/equipment/anemos_constellation/', zh: '常风星座套装', strictLink: true }], // Item 50570
    ['デュエル・アネモス', { path: '/equipment/anemos_duelists/', zh: '常风斗剑套装', strictLink: true }], // Item 50572
    ['サザンシー・タリスマン', { path: '/equipment/south_seas_talisman/', zh: '南海护身符组合', strictLink: true, itemConflict: true }], // Item 45131
    ['ティ・リーフ・レイ', { path: '/equipment/ti_leaf_lei/', zh: '花草环组合', strictLink: true, itemConflict: true }], // Item 45130
    ['アオザイ', { path: '/equipment/ao_dai/', zh: '奥黛套装', strictLink: true, itemConflict: true }], // Item 45282
    ['サザンシーワンピース', { path: '/equipment/southern_seas_swimsuit/', zh: '南海女式连衣裙组合', strictLink: true, itemConflict: true }], // Item 45160
    ['サザンシーベスト', { path: '/equipment/southern_seas_vest/', zh: '南海男式坎肩组合', strictLink: true, itemConflict: true }], // Item 45159
    ['ファースト・ヤ・シュトラ・コスチュームセット', { path: '/equipment/brave_new_yshtola_attire/', zh: '血盟魔女套装', strictLink: true }], // Item 45399
    ['リーン・コスチュームセット', { path: '/equipment/oracle/', zh: '巫女套装', strictLink: true }], // Item 45430
    ['烈士衣装セット', { path: '/equipment/resshi/', zh: '志士装束', strictLink: true }], // Item 45428
    ['東方粋人衣装セット', { path: '/equipment/eastern_lord_errants_attire/', zh: '东方雅士装束', strictLink: true }], // Item 45376
    ['東方武官衣装セット', { path: '/equipment/far_eastern_officers_uniform/', zh: '东方武官装束', strictLink: true }], // Item 45327
    ['東方美姫衣装セット', { path: '/equipment/far_eastern_maidens_attire/', zh: '东方美姬装束', strictLink: true }], // Item 45328
    ['門客衣装セット', { path: '/equipment/mungaek_attire/', zh: '门客装束', strictLink: true }], // Item 45316
    ['辨天衣装セット', { path: '/equipment/eastern_socialites_attire/', zh: '辨天装束', strictLink: true }], // Item 45317
    ['東方書生衣装セット', { path: '/equipment/far_eastern_schoolboys_uniform/', zh: '东方书生装束', strictLink: true }], // Item 45333
    ['東方女学生衣装セット', { path: '/equipment/far_eastern_schoolgirls_uniform/', zh: '东方女生装束', strictLink: true }], // Item 45334
    ['孔雀・コスチュームセット', { path: '/equipment/peacock_attire/', zh: '孔雀装束', strictLink: true }], // Item 45375
    ['ニュー・ミンフィリア・コスチュームセット', { path: '/equipment/minfilias_modish_attir/', zh: '纯白礼服套装', strictLink: true }], // Item 45337
    ['ティーダ・コスチュームセット', { path: '/equipment/abes_attire/', zh: '艾普装备套装', strictLink: true }], // Item 45239
    ['ユウナ・コスチュームセット', { path: '/equipment/high_summoners_attire/', zh: '大召唤士套装', strictLink: true }], // Item 45240
    ['ナタ殿方衣装セット', { path: '/equipment/nezha_lords_attire/', zh: '哪吒赤莲装备装束', strictLink: true }], // Item 45283
    ['ナタ姫君衣装セット', { path: '/equipment/nezha_ladys_attire/', zh: '哪吒白莲装备装束', strictLink: true }], // Item 45284
    ['カーバンクル・エメラルド・コスチュームセット', { path: '/equipment/emerald_carbuncle_attire/', zh: '绿宝石兽装备套装', strictLink: true }], // Item 45293
    ['カーバンクル・トパーズ・コスチュームセット', { path: '/equipment/topaz_carbuncle_attire/', zh: '黄宝石兽装备套装', strictLink: true }], // Item 45294
    ['カーバンクル・ルビー・コスチュームセット', { path: '/equipment/ruby_carbuncle_attire/', zh: '红宝石兽装备套装', strictLink: true }], // Item 45400
    ['メイドアタイアEX', { path: '/equipment/loyal_housemaids/', zh: '特制女仆装备套装', strictLink: true }], // Item 45285
    ['バトラーアタイアEX', { path: '/equipment/loyal_butlers_uniform/', zh: '特制管家装备套装', strictLink: true }], // Item 45286
    ['東方雅人衣装セット', { path: '/equipment/far_eastern_gentlemans_attire/', zh: '东方雅人装束', strictLink: true }], // Item 45243
    ['東方麗人衣装セット', { path: '/equipment/far_eastern_beautys_attire/', zh: '东方丽人装束', strictLink: true }], // Item 45244
    ['東方貴人衣装セット', { path: '/equipment/far_eastern_nobles_attire/', zh: '东方贵人装束', strictLink: true }], // Item 45232
    ['エッダ・コスチュームセット', { path: '/equipment/blackbosom_attire/', zh: '漆黑的礼服套装', strictLink: true }], // Item 45288
    ['東方姫君衣装セット', { path: '/equipment/far_eastern_garb_for_women/', zh: '东方秀女装束', strictLink: true }], // Item 50507
    ['蒼天騎士団ファイター・コスチュームセット', { path: '/equipment/ward_knights_attire/', zh: '苍穹骑士装备套装', strictLink: true }], // Item 45271
    ['蒼天騎士団ソーサラー・コスチュームセット', { path: '/equipment/ward_mages_attire/', zh: '苍穹法师装备套装', strictLink: true }], // Item 45272
    ['東方警邏衣装セット', { path: '/equipment/far_eastern_patriarchs_attire/', zh: '东方警卫装束', strictLink: true }], // Item 50508
    ['東方女官衣装セット', { path: '/equipment/far_eastern_matriarchs_attire/', zh: '东方女官装束', strictLink: true }], // Item 50509
    ['ゴウセツ・コスチュームセット', { path: '/equipment/gosetsus_attire/', zh: '豪雪装束', strictLink: true }], // Item 45329
    ['ヒエン・コスチュームセット', { path: '/equipment/lord_hiens_attire/', zh: '飞燕装束', strictLink: true }], // Item 45318
    ['リセ・コスチュームセット', { path: '/equipment/scion_liberators_attire/', zh: '血盟解放者套装', strictLink: true }], // Item 45297
    ['ニュー・ヤ・シュトラ・コスチュームセット', { path: '/equipment/yshtolas_modish_attire/', zh: '血盟治疗师套装', strictLink: true }], // Item 45238
    ['ニュー・サンクレッド・コスチュームセット', { path: '/equipment/thancreds_modish_attire/', zh: '血盟双剑师套装', strictLink: true }], // Item 45237
    ['シド・コスチュームセット', { path: '/equipment/cids_attire/', zh: '首席机械师装备套装', strictLink: true }], // Item 45192
    ['ヤ・シュトラ・コスチュームセット', { path: '/equipment/yshtolas_attire/', zh: '血盟幻术师套装', strictLink: true }], // Item 45175
    ['サンクレッド・コスチュームセット', { path: '/equipment/thancreds_attire/', zh: '血盟盗贼套装', strictLink: true }], // Item 45176
    ['イダ・コスチュームセット', { path: '/equipment/ydas_attire/', zh: '血盟拳手装备套装', strictLink: true }], // Item 45177
    ['パパリモ・コスチュームセット', { path: '/equipment/papalymos_attire/', zh: '血盟咒术师套装', strictLink: true }], // Item 45178
    ['ウリエンジェ・コスチュームセット', { path: '/equipment/uriangers_attire/', zh: '血盟记录者套装', strictLink: true }], // Item 45179
    ['ライトニング・コスチュームセット', { path: '/equipment/lightnings_attire/', zh: '圣府军装束', strictLink: true }], // Item 50486
    ['スノウ・コスチュームセット', { path: '/equipment/snows_attire/', zh: '诺拉套装', strictLink: true }], // Item 50487
    ['ミュオソティス・ヴァレンティオン・コスチュームセット（男性用）', { path: '/equipment/mens_valentione_forget-me-not_attire/', zh: '勿忘草恋人坎肩套装', strictLink: true }], // Item 45366
    ['アカシア・ヴァレンティオン・コスチュームセット（男性用）', { path: '/equipment/mens_valentione_acacia_attire/', zh: '相思树恋人坎肩套装', strictLink: true }], // Item 45367
    ['ローズ・ヴァレンティオン・コスチュームセット（男性用）', { path: '/equipment/mens_valentione_rose_attire/', zh: '玫瑰花恋人坎肩套装', strictLink: true }], // Item 45365
    ['ミュオソティス・ヴァレンティオン・コスチュームセット（女性用）', { path: '/equipment/womens_valentione_forget-me-not_attire/', zh: '勿忘草恋人礼服套装', strictLink: true }], // Item 45369
    ['アカシア・ヴァレンティオン・コスチュームセット（女性用）', { path: '/equipment/womens_valentione_acacia_attire/', zh: '相思树恋人礼服套装', strictLink: true }], // Item 45370
    ['ローズ・ヴァレンティオン・コスチュームセット（女性用）', { path: '/equipment/womens_valentione_rose_attire/', zh: '玫瑰花恋人礼服套装', strictLink: true }], // Item 45368
    ['ヴァレンティオンエプロンドレスアタイア', { path: '/equipment/valentione_apron_dress_attire/', zh: '恋人围裙装套装', strictLink: true }], // Item 45122
    ['殿方水干衣装セット', { path: '/equipment/lords_suikan_set/', zh: '君子水干装束', strictLink: true }], // Item 45174
    ['姫君水干衣装セット', { path: '/equipment/ladys_suikan_set/', zh: '淑女水干装束', strictLink: true }], // Item 45181
    ['紅蓮祭・コスチュームセット', { path: '/equipment/eastern_faire-goers_attire/', zh: '红莲节装束', strictLink: true }], // Item 45287
    ['レインディアセット', { path: '/equipment/reindeer_attire/', zh: '2016驯鹿套装', strictLink: true }], // CN store; items 13290–13292, not the older Item 45095 outfit
    ['ウッドランドウォーデン・コスチュームセット', { path: '/equipment/woodland_wardens/', zh: '林地守护者套装', strictLink: true }], // Item 45539, 45540
    ['ファットキャット・コスチュームセット', { path: '/equipment/fat_cat_attire/', zh: '猫小胖套装', strictLink: true }], // Item 45486, 45487
    ['ヒップストリート・コスチュームセット', { path: '/equipment/hip_street_attire/', zh: '街头套装', strictLink: true }], // Item 45438, 45439
    ['ウェアウルフ・コスチュームセット（女性用）', { path: '/equipment/werewolf_for_women/', zh: '人狼脚爪套装', strictLink: true }], // Item 45292
    ['ハウリングスピリット・ウェイリングスピリット', { path: '/equipment/the_howling_wailing_spirit/', zh: '尖啸幽灵套装、哭泣幽灵套装', strictLink: true }], // Item 6107, 6108
    ['ウォー', { path: '/equipment/war/', zh: '战争套装', strictLink: true }], // Item 6706, 6711, 6717, 6723, 6729
    ['レッド', { path: '/equipment/red/', zh: '赤红套装', strictLink: true }], // Item 20465, 20466, 20467, 20468, 20469
    ['カシミヤ', { path: '/equipment/cashmere/', zh: '羊绒斗篷套装', strictLink: true }], // Item 45246
    ['サマーフォーマル・ドレス', { path: '/equipment/summertide_formal_dress/', zh: '夏令礼裙套装', strictLink: true, itemConflict: true }], // Item 47261
    ['スプリングドレス', { path: '/equipment/spring_dress/', zh: '春意礼服套装', strictLink: true, itemConflict: true }], // Item 7540
    ['アカシア・ディフェンダー', { path: '/equipment/acacia_chromite_of_fending/', zh: '相思木御敌套装', strictLink: true }], // Item 44022
    ['アカシア・スレイヤー', { path: '/equipment/acacia_chromite_of_maiming/', zh: '相思木制敌套装', strictLink: true }], // Item 44022
    ['アカシア・ストライカー', { path: '/equipment/acacia_chromite_of_striking/', zh: '相思木强袭套装', strictLink: true }], // Item 44022
    ['アカシア・スカウト', { path: '/equipment/acacia_chromite_of_scouting/', zh: '相思木游击套装', strictLink: true }], // Item 44022
    ['アカシア・レンジャー', { path: '/equipment/acacia_chromite_of_aiming/', zh: '相思木精准套装', strictLink: true }], // Item 44022
    ['アカシア・キャスター', { path: '/equipment/acacia_chromite_of_casting/', zh: '相思木咏咒套装', strictLink: true }], // Item 44022
    ['アカシア・ヒーラー', { path: '/equipment/acacia_chromite_of_healing/', zh: '相思木治愈套装', strictLink: true }], // Item 44022
    ['ダークマホガニー・ディフェンダー', { path: '/equipment/dark_mahogany_chromite_of_fending/', zh: '深红木御敌套装', strictLink: true }], // Item 43497, 43498
    ['ダークマホガニー・スレイヤー', { path: '/equipment/dark_mahogany_chromite_of_maiming/', zh: '深红木制敌套装', strictLink: true }], // Item 43497, 43498
    ['ダークマホガニー・ストライカー', { path: '/equipment/dark_mahogany_chromite_of_striking/', zh: '深红木强袭套装', strictLink: true }], // Item 43497, 43498
    ['ダークマホガニー・スカウト', { path: '/equipment/dark_mahogany_chromite_of_scouting/', zh: '深红木游击套装', strictLink: true }], // Item 43497, 43498
    ['ダークマホガニー・レンジャー', { path: '/equipment/dark_mahogany_chromite_of_aiming/', zh: '深红木精准套装', strictLink: true }], // Item 43497, 43498
    ['ダークマホガニー・キャスター', { path: '/equipment/dark_mahogany_chromite_of_casting/', zh: '深红木咏咒套装', strictLink: true }], // Item 43497, 43498
    ['ダークマホガニー・ヒーラー', { path: '/equipment/dark_mahogany_chromite_of_healing/', zh: '深红木治愈套装', strictLink: true }], // Item 43497, 43498
    ['ルテニウム・ストライカー', { path: '/equipment/ruthenium_chromite_of_striking/', zh: '钌金强袭套装', strictLink: true }], // Item 43487, 43488
    ['ルテニウム・スカウト', { path: '/equipment/ruthenium_chromite_of_scouting/', zh: '钌金游击套装', strictLink: true }], // Item 43487, 43488
    ['ルテニウム・レンジャー', { path: '/equipment/ruthenium_chromite_of_aiming/', zh: '钌金精准套装', strictLink: true }], // Item 43487, 43488
    ['ルテニウム・キャスター', { path: '/equipment/ruthenium_chromite_of_casting/', zh: '钌金咏咒套装', strictLink: true }], // Item 43487, 43488
    ['ルテニウム・ヒーラー', { path: '/equipment/ruthenium_chromite_of_healing/', zh: '钌金治愈套装', strictLink: true }], // Item 43487, 43488
    ['オルコクロマイト・ディフェンダー', { path: '/equipment/mountain_chromite_of_fending/', zh: '奥阔铬铁御敌套装', strictLink: true }], // Item 43203
    ['オルコクロマイト・スレイヤー', { path: '/equipment/mountain_chromite_of_maiming/', zh: '奥阔铬铁制敌套装', strictLink: true }], // Item 43203
    ['オルコクロマイト・ストライカー', { path: '/equipment/mountain_chromite_of_striking/', zh: '奥阔铬铁强袭套装', strictLink: true }], // Item 43203
    ['オルコクロマイト・スカウト', { path: '/equipment/mountain_chromite_of_scouting/', zh: '奥阔铬铁游击套装', strictLink: true }], // Item 43203
    ['オルコクロマイト・レンジャー', { path: '/equipment/mountain_chromite_of_aiming/', zh: '奥阔铬铁精准套装', strictLink: true }], // Item 43203
    ['オルコクロマイト・キャスター', { path: '/equipment/mountain_chromite_of_casting/', zh: '奥阔铬铁咏咒套装', strictLink: true }], // Item 43203
    ['オルコクロマイト・ヒーラー', { path: '/equipment/mountain_chromite_of_healing/', zh: '奥阔铬铁治愈套装', strictLink: true }], // Item 43203
    ['カザナル・キャスター', { path: '/equipment/rakaznar_of_casting/', zh: '卡扎纳尔咏咒套装', strictLink: true }], // Item 44001
    ['カザナル・ヒーラー', { path: '/equipment/rakaznar_of_healing/', zh: '卡扎纳尔治愈套装', strictLink: true }], // Item 44001
    ['グリダニアンエリート(タンク)', { path: '/equipment/serpent_elites_tank/', zh: '牙蛇精英套装（防护）', strictLink: true }],
    ['グリダニアンエリート(ファイター)', { path: '/equipment/serpent_elites_dow/', zh: '牙蛇精英套装（战斗精英）', strictLink: true }],
    ['グリダニアンエリート(ソーサラー)', { path: '/equipment/serpent_elites_dom/', zh: '牙蛇精英套装（魔法导师）', strictLink: true }],
    ['ロミンサンエリート(タンク)', { path: '/equipment/storm_elites_tank/', zh: '漩涡精英套装（防护）', strictLink: true }],
    ['ロミンサンエリート(ファイター)', { path: '/equipment/storm_elites_dow/', zh: '漩涡精英套装（战斗精英）', strictLink: true }],
    ['ロミンサンエリート(ソーサラー)', { path: '/equipment/storm_elites_dom/', zh: '漩涡精英套装（魔法导师）', strictLink: true }],
    ['ウルダハンエリート(タンク)', { path: '/equipment/flame_elites_tank/', zh: '耀辉精英套装（防护）', strictLink: true }],
    ['ウルダハンエリート(ファイター)', { path: '/equipment/flame_elites_dow/', zh: '耀辉精英套装（战斗精英）', strictLink: true }],
    ['ウルダハンエリート(ソーサラー)', { path: '/equipment/flame_elites_dom/', zh: '耀辉精英套装（魔法导师）', strictLink: true }],
    ['プランダード(タンク)', { path: '/equipment/plundered_tank/', zh: '掠夺套装（防护）', strictLink: true }], // Item 3030, 3031, 3032, 3033
    ['プランダード(ファイター)', { path: '/equipment/plundered_dow/', zh: '掠夺套装（战斗精英）', strictLink: true }], // Item 3030, 3031, 3032, 3033
    ['プランダード(ソーサラー)', { path: '/equipment/plundered_dom/', zh: '掠夺套装（魔法导师）', strictLink: true }], // Item 3030, 3031, 3032, 3033
    ['ドクトル(タンク・スレイヤー)', { path: '/equipment/doctores_tank/', zh: '教练套装（防护、制敌）', strictLink: true }], // Item 3054, 3055, 3056
    ['ドクトル(ファイター)', { path: '/equipment/doctores_dow/', zh: '教练套装（战斗精英）', strictLink: true }], // Item 3054, 3055, 3056
    ['ドクトル(ソーサラー)', { path: '/equipment/doctores_dom/', zh: '教练套装（魔法导师）', strictLink: true }], // Item 3054, 3055, 3056
    ['マナー(タンク・スレイヤー)', { path: '/equipment/manor_tank/', zh: '庄园套装（防护、制敌）', strictLink: true }], // Item 31450, 31456, 31462
    ['マナー(ファイター)', { path: '/equipment/manor_dow/', zh: '庄园套装（战斗精英）', strictLink: true }], // Item 31450, 31456, 31462
    ['マナー(ソーサラー)', { path: '/equipment/manor_dom/', zh: '庄园套装（魔法导师）', strictLink: true }], // Item 31450, 31456, 31462
    ['カルン(タンク・スレイヤー)', { path: '/equipment/qarn_tank/', zh: '喀恩套装（防护、制敌）', strictLink: true }], // Item 31481, 31487
    ['カルン(ファイター)', { path: '/equipment/qarn_dow/', zh: '喀恩套装（战斗精英）', strictLink: true }], // Item 31481, 31487
    ['カルン(ソーサラー)', { path: '/equipment/qarn_dom/', zh: '喀恩套装（魔法导师）', strictLink: true }], // Item 31481, 31487
    ['カッターズクライ(タンク・スレイヤー)', { path: '/equipment/cutters_cry_tank/', zh: '流沙迷宫樵鸣洞套装（防护、制敌）', strictLink: true }],
    ['カッターズクライ(ファイター)', { path: '/equipment/cutters_cry_dow/', zh: '流沙迷宫樵鸣洞套装（战斗精英）', strictLink: true }],
    ['カッターズクライ(ソーサラー)', { path: '/equipment/cutters_cry_dom/', zh: '流沙迷宫樵鸣洞套装（魔法导师）', strictLink: true }],
    ['ヴィジル(タンク・スレイヤー)', { path: '/equipment/vigil_tank/', zh: '城塞套装（防护、制敌）', strictLink: true }], // Item 31518, 31524
    ['ヴィジル(ファイター)', { path: '/equipment/vigil_dow/', zh: '城塞套装（战斗精英）', strictLink: true }], // Item 31518, 31524
    ['ヴィジル(ソーサラー)', { path: '/equipment/vigil_dom/', zh: '城塞套装（魔法导师）', strictLink: true }], // Item 31518, 31524
    ['コロセウム(ファイター)', { path: '/equipment/coliseum_dow/', zh: '斗技场套装（战斗精英）', strictLink: true }], // Item 3189, 3190
    ['コロセウム(ソーサラー)', { path: '/equipment/coliseum_dom/', zh: '斗技场套装（魔法导师）', strictLink: true }], // Item 3189, 3190
    ['オーラム(タンク・スレイヤー)', { path: '/equipment/aurum_tank/', zh: '皇金套装（防护、制敌）', strictLink: true }], // Item 31555, 31561, 31567
    ['オーラム(ファイター)', { path: '/equipment/aurum_dow/', zh: '皇金套装（战斗精英）', strictLink: true }], // Item 31555, 31561, 31567
    ['オーラム(ソーサラー)', { path: '/equipment/aurum_dom/', zh: '皇金套装（魔法导师）', strictLink: true }], // Item 31555, 31561, 31567
    // Replica gear retains the official Chinese item-name qualifier in every set title.
    ['レプリカ・バハムート・ディフェンダー', { path: '/equipment/replica_dreadwyrm_of_fending/', zh: '龙神御敌套装（复制品）', strictLink: true }], // Item 13892–13896
    ['レプリカ・バハムート・スレイヤー', { path: '/equipment/replica_dreadwyrm_of_maiming/', zh: '龙神制敌套装（复制品）', strictLink: true }], // Item 13897–13901
    ['レプリカ・バハムート・ストライカー', { path: '/equipment/replica_dreadwyrm_of_striking/', zh: '龙神强袭套装（复制品）', strictLink: true }], // Item 13902–13906
    ['レプリカ・バハムート・スカウト', { path: '/equipment/replica_dreadwyrm_of_scouting/', zh: '龙神游击套装（复制品）', strictLink: true }], // Item 13922–13926
    ['レプリカ・バハムート・レンジャー', { path: '/equipment/replica_dreadwyrm_of_aiming/', zh: '龙神精准套装（复制品）', strictLink: true }], // Item 13907–13911
    ['レプリカ・バハムート・キャスター', { path: '/equipment/replica_dreadwyrm_of_casting/', zh: '龙神咏咒套装（复制品）', strictLink: true }], // Item 13917–13921
    ['レプリカ・バハムート・ヒーラー', { path: '/equipment/replica_dreadwyrm_of_healing/', zh: '龙神治愈套装（复制品）', strictLink: true }], // Item 13912–13916
    ['レプリカ・ハイアラガン・ディフェンダー', { path: '/equipment/replica_high_allagan_of_fending/', zh: '亚拉戈高位御敌套装（复制品）', strictLink: true }], // Item 13848–13852
    ['レプリカ・ハイアラガン・スレイヤー', { path: '/equipment/replica_high_allagan_of_maiming/', zh: '亚拉戈高位制敌套装（复制品）', strictLink: true }], // Item 13853–13857
    ['レプリカ・ハイアラガン・ストライカー', { path: '/equipment/replica_high_allagan_of_striking/', zh: '亚拉戈高位强袭套装（复制品）', strictLink: true }], // Item 13858–13862
    ['レプリカ・ハイアラガン・レンジャー', { path: '/equipment/replica_high_allagan_of_aiming/', zh: '亚拉戈高位精准套装（复制品）', strictLink: true }], // Item 13863–13867
    ['レプリカ・ハイアラガン・キャスター', { path: '/equipment/replica_high_allagan_of_casting/', zh: '亚拉戈高位咏咒套装（复制品）', strictLink: true }], // Item 13873–13877
    ['レプリカ・ハイアラガン・ヒーラー', { path: '/equipment/replica_high_allagan_of_healing/', zh: '亚拉戈高位治愈套装（复制品）', strictLink: true }], // Item 13868–13872
    ['レプリカ・ヘヴィアラガン', { path: '/equipment/replica_allagan_of_fending/', zh: '亚拉戈重套装（复制品）', strictLink: true }], // Item 13805–13808
    ['レプリカ・アラガンスレイヤー', { path: '/equipment/replica_allagan_of_maiming/', zh: '亚拉戈制敌套装（复制品）', strictLink: true }], // Item 13809, 13810, 13811, 13812, 13813
    ['レプリカ・アラガンストライカー', { path: '/equipment/replica_allagan_of_striking/', zh: '亚拉戈强袭套装（复制品）', strictLink: true }], // Item 13814, 13815, 13816, 13817, 13818
    ['レプリカ・アラガンレンジャー', { path: '/equipment/replica_allagan_of_aiming/', zh: '亚拉戈精准套装（复制品）', strictLink: true }], // Item 13819, 13820, 13821, 13822, 13823
    ['レプリカ・アラガンキャスター', { path: '/equipment/replica_allagan_of_casting/', zh: '亚拉戈咏咒套装（复制品）', strictLink: true }], // Item 13797, 13829, 13830, 13831, 13832, 13833
    ['レプリカ・アラガンヒーラー', { path: '/equipment/replica_allagan_of_healing/', zh: '亚拉戈治愈套装（复制品）', strictLink: true }], // Item 13798, 13824, 13825, 13826, 13827, 13828
    // Full catalogue semantic review: page identity beats generic UI/job names.
    // Use official item stems for display groups; preserve historical role and gender terms.
    ['コートリーラヴァー・キャスター', { path: '/equipment/courtly_lovers_of_casting/', zh: '宫廷爱人咏咒套装', strictLink: true }], // Item 49301–49305
    ['カーペンター', { path: '/equipment/carpenters/', zh: '木匠套装', strictLink: true }], // Item 2920, 3229, 3481
    ['ゴールドスミス', { path: '/equipment/goldsmiths/', zh: '金匠套装', strictLink: true }], // Item 2923, 3232, 3484
    ['ディガー', { path: '/equipment/diggers/', zh: '矿工套装', strictLink: true }], // Item 2928, 3237, 3489
    ['カッター', { path: '/equipment/cutters/', zh: '樵夫套装', strictLink: true }], // Item 2929, 3238, 3490
    ['フィッシャー', { path: '/equipment/pullers/', zh: '渔人套装', strictLink: true }], // Item 2930, 3239, 3491
    ['グリフ', { path: '/equipment/glyphic/', zh: '塑形套装', strictLink: true }], // Item 42630
    ['ヴィカー', { path: '/equipment/halonic_vicars/', zh: '战女神牧师套装', strictLink: true }], // Item 11270, 11277
    ['インクイジター', { path: '/equipment/halonic_inquisitors/', zh: '战女神判官套装', strictLink: true }], // Item 11266, 11273, 51355
    ['ストライカー', { path: '/equipment/foestrikers/', zh: '强打套装', strictLink: true }], // Item 3034, 3329, 3554, 3786
    ['オステア', { path: '/equipment/austere/', zh: '苦行套装', strictLink: true }], // Item 6713, 6719, 6725
    ['スカリー', { path: '/equipment/shikarees/', zh: '狩猎者套装', strictLink: true }], // Item 7462–7464
    ['アテナ', { path: '/equipment/divine_wisdom/', zh: '雅典娜套装', strictLink: true }], // Item 8230–8232
    ['アモン', { path: '/equipment/amons/', zh: '亚蒙套装', strictLink: true }], // Item 8322–8324
    ['ウェザード・ボイイ', { path: '/equipment/weathered_boii/', zh: '旧化的波伊套装', strictLink: true }], // Item 25246–25248
    ['ウェザード・フィリ', { path: '/equipment/weathered_fili/', zh: '旧化的诗彩套装', strictLink: true }], // Item 25256–25258
    ['ウェザード・ガンスリンガー', { path: '/equipment/weathered_gunslingers/', zh: '旧化的枪徒套装', strictLink: true }], // Item 25291–25293
    ['ウェザード・アルバテル', { path: '/equipment/weathered_arbatel/', zh: '旧化的古术套装', strictLink: true }], // Item 25276–25278
    ['ウェザード・シヴァルラス', { path: '/equipment/antiquated_chivalrous/', zh: '旧化的侠义套装', strictLink: true }], // Item 17742–17744
    ['ウェザード・セブンスヘブン', { path: '/equipment/antiquated_seventh_heaven/', zh: '旧化的七天套装', strictLink: true }], // Item 17767–17769
    ['ウェザード・オラター', { path: '/equipment/antiquated_orators/', zh: '旧化的雄辩套装', strictLink: true }], // Item 17782–17784
    ['クリード', { path: '/equipment/creed/', zh: '忠骑套装', strictLink: true }], // Item 11779–11781
    ['ラベジャー', { path: '/equipment/ravagers/', zh: '凶战套装', strictLink: true }], // Item 11789–11791
    ['カオス', { path: '/equipment/chaos/', zh: '混沌套装', strictLink: true }], // Item 11809–11811
    ['タントラ', { path: '/equipment/tantra/', zh: '秘武套装', strictLink: true }], // Item 11784–11786
    ['アエド', { path: '/equipment/aoidos/', zh: '叙诗套装', strictLink: true }], // Item 11799–11801
    ['マシーナリー', { path: '/equipment/machinists/', zh: '机工套装', strictLink: true }], // Item 11814–11816
    ['コーラー', { path: '/equipment/callers/', zh: '唤魂套装', strictLink: true }], // Item 11829–11831
    ['オリゾン', { path: '/equipment/orison/', zh: '白祈套装', strictLink: true }], // Item 11819–11821
    ['サバント', { path: '/equipment/savants/', zh: '学术套装', strictLink: true }], // Item 11834–11836
    ['ウェルキン', { path: '/equipment/welkin/', zh: '司天套装', strictLink: true }], // Item 11839–11841
    ['フレースヴェルグ', { path: '/equipment/hraesvelgr/', zh: '圣龙套装', strictLink: true }], // Item 30762–30764
    ['レベル', { path: '/equipment/rebel/', zh: '叛逆套装', strictLink: true }], // Item 28590, 28591
    ['クレセント', { path: '/equipment/crescent/', zh: '弦月套装', strictLink: true }], // Item 8557–8561
    ['セーラー', { path: '/equipment/sailor/', zh: '水手套装', strictLink: true }], // Item 7535, 7537, 7538
    ['イディル・ガーディアンRE', { path: '/equipment/augmented_shire_custodians/', zh: '改良型田园管理者套装', strictLink: true }], // Item 16341–16343
    ['イディル・ハンターRE', { path: '/equipment/augmented_shire_conservators/', zh: '改良型田园监督者套装', strictLink: true }], // Item 16359–16361
    ['イディル・フィロソファーRE', { path: '/equipment/augmented_shire_philosophers/', zh: '改良型田园哲学者套装', strictLink: true }], // Item 16377–16379
    ['イディル・プロフェッサーRE', { path: '/equipment/augmented_shire_preceptors/', zh: '改良型田园训导者套装', strictLink: true }], // Item 16371–16373
    ['クラウン', { path: '/equipment/clowns/', zh: '小丑套装', strictLink: true }], // Item 35863–35867
    ['パメラー', { path: '/equipment/pummelers/', zh: '殴击套装', strictLink: true }], // Item 33957–33959
    ['アレジアンス', { path: '/equipment/allegiance/', zh: '忠卫套装', strictLink: true }], // Item 34022–34024
    ['ティアマット', { path: '/equipment/tiamat/', zh: '暗龙套装', strictLink: true }], // Item 33962–33964
    ['リーパー', { path: '/equipment/reapers/', zh: '丰获套装', strictLink: true }], // Item 34037–34041
    ['ブリオソ', { path: '/equipment/brioso/', zh: '蓬勃套装', strictLink: true }], // Item 33967–33969
    ['スピコナ', { path: '/equipment/spaekonas/', zh: '命巫套装', strictLink: true }], // Item 33977–33979
    ['シアファニー', { path: '/equipment/theophany/', zh: '显灵套装', strictLink: true }], // Item 33972–33974
    ['アストロノミア', { path: '/equipment/astronomia/', zh: '天文套装', strictLink: true }], // Item 34007–34009
    ['ホープ【M】', { path: '/equipment/hope_m/', zh: '希望套装〖男〗', strictLink: true }], // gender-specific Hope gear
    ['ホープ【F】', { path: '/equipment/hope_f/', zh: '希望套装〖女〗', strictLink: true }], // gender-specific Hope gear
    ['リオレウスRE【M】', { path: '/equipment/augmented_rathalos_m/', zh: '改良型火龙套装〖男〗', strictLink: true }], // Augmented Rathalos gear
    ['リオレウスRE【F】', { path: '/equipment/augmented_rathalos_f/', zh: '改良型火龙套装〖女〗', strictLink: true }], // Augmented Rathalos gear
    ['夜鶴', { path: '/equipment/yakaku/', zh: '夜鹤套装', strictLink: true }], // Item 45509, 45510; combined site group
    ['ミルキングRE', { path: '/equipment/augmented_millkings/', zh: '改良型仙木套装', strictLink: true }], // Item 21219
    ['ミルキープRE', { path: '/equipment/augmented_millkeeps/', zh: '改良型珍木套装', strictLink: true }], // Item 15665
    ['フォージキングRE', { path: '/equipment/augmented_forgekings/', zh: '改良型圣铁套装', strictLink: true }], // Item 21224
    ['フォージキープRE', { path: '/equipment/augmented_forgekeeps/', zh: '改良型镔铁套装', strictLink: true }], // Item 15670
    ['ハンマーキングRE', { path: '/equipment/augmented_hammerkings/', zh: '改良型玄甲套装', strictLink: true }], // Item 21229
    ['ハンマーキープRE', { path: '/equipment/augmented_hammerkeeps/', zh: '改良型戎甲套装', strictLink: true }], // Item 15675
    ['ジェムキングRE', { path: '/equipment/augmented_gemkings/', zh: '改良型鎏金套装', strictLink: true }], // Item 21234
    ['ジェムキープRE', { path: '/equipment/augmented_gemkeeps/', zh: '改良型镂金套装', strictLink: true }], // Item 15680
    ['ハイドキングRE', { path: '/equipment/augmented_hidekings/', zh: '改良型韦革套装', strictLink: true }], // Item 21239
    ['ハイドキープRE', { path: '/equipment/augmented_hidekeeps/', zh: '改良型精革套装', strictLink: true }], // Item 15685
    ['ボルトキングRE', { path: '/equipment/augmented_boltkings/', zh: '改良型绮衣套装', strictLink: true }], // Item 21244
    ['ボルトキープRE', { path: '/equipment/augmented_boltkeeps/', zh: '改良型锦衣套装', strictLink: true }], // Item 15690
    ['コルドロンキングRE', { path: '/equipment/augmented_cauldronkings/', zh: '改良型炼师套装', strictLink: true }], // Item 21249
    ['コルドロンキープRE', { path: '/equipment/augmented_cauldronkeeps/', zh: '改良型炼真套装', strictLink: true }], // Item 15695
    ['ガリーキングRE', { path: '/equipment/augmented_galleykings/', zh: '改良型烹炙套装', strictLink: true }], // Item 21254
    ['ガリーキープRE', { path: '/equipment/augmented_galleykeeps/', zh: '改良型烹饪套装', strictLink: true }], // Item 15700
    ['マインキングRE', { path: '/equipment/augmented_minekings/', zh: '改良型精矿套装', strictLink: true }], // Item 21259
    ['マインキープRE', { path: '/equipment/augmented_minekeeps/', zh: '改良型富矿套装', strictLink: true }], // Item 15705
    ['フィールドキングRE', { path: '/equipment/augmented_fieldkings/', zh: '改良型百草套装', strictLink: true }], // Item 21264
    ['フィールドキープRE', { path: '/equipment/augmented_fieldkeeps/', zh: '改良型园野套装', strictLink: true }], // Item 15710
    ['タックルキングRE', { path: '/equipment/augmented_tacklekings/', zh: '改良型渔采套装', strictLink: true }], // Item 21269
    ['タックルキープRE', { path: '/equipment/augmented_tacklekeeps/', zh: '改良型渔灯套装', strictLink: true }], // Item 15715
    ['羅刹【武士】', { path: '/equipment/rakshasa_of_fending/', zh: '罗刹豪士套装', strictLink: true }], // member-name stem
    ['羅刹【槍士】', { path: '/equipment/rakshasa_of_maiming/', zh: '罗刹枪士套装', strictLink: true }], // member-name stem
    ['羅刹【拳士】', { path: '/equipment/rakshasa_of_striking/', zh: '罗刹拳士套装', strictLink: true }], // member-name stem
    ['羅刹【間士】', { path: '/equipment/rakshasa_of_scouting/', zh: '罗刹间士套装', strictLink: true }], // member-name stem
    ['羅刹【弓士】', { path: '/equipment/rakshasa_of_aiming/', zh: '罗刹弓士套装', strictLink: true }], // member-name stem
    ['羅刹【術士】', { path: '/equipment/rakshasa_of_casting/', zh: '罗刹术士套装', strictLink: true }], // member-name stem
    ['羅刹【学士】', { path: '/equipment/rakshasa_of_healing/', zh: '罗刹学士套装', strictLink: true }], // member-name stem
    ['紫水【武士】', { path: '/equipment/shisui_of_fending/', zh: '紫水豪士装束', strictLink: true }], // member-name stem
    ['紫水【槍士】', { path: '/equipment/shisui_of_maiming/', zh: '紫水枪士装束', strictLink: true }], // member-name stem
    ['紫水【拳士】', { path: '/equipment/shisui_of_striking/', zh: '紫水拳士装束', strictLink: true }], // member-name stem
    ['紫水【間士】', { path: '/equipment/shisui_of_scouting/', zh: '紫水间士装束', strictLink: true }], // member-name stem
    ['紫水【弓士】', { path: '/equipment/shisui_of_aiming/', zh: '紫水弓士装束', strictLink: true }], // member-name stem
    ['紫水【術士】', { path: '/equipment/shisui_of_casting/', zh: '紫水术士装束', strictLink: true }], // member-name stem
    ['紫水【学士】', { path: '/equipment/shisui_of_healing/', zh: '紫水学士装束', strictLink: true }], // member-name stem
    ['延夏【武士】', { path: '/equipment/yanxian_of_fending/', zh: '延夏豪士装束', strictLink: true }], // member-name stem
    ['延夏【槍士】', { path: '/equipment/yanxian_of_maiming/', zh: '延夏枪士装束', strictLink: true }], // member-name stem
    ['延夏【拳士】', { path: '/equipment/yanxian_of_striking/', zh: '延夏拳士装束', strictLink: true }], // member-name stem
    ['延夏【間士】', { path: '/equipment/yanxian_of_scouting/', zh: '延夏间士装束', strictLink: true }], // member-name stem
    ['延夏【弓士】', { path: '/equipment/yanxian_of_aiming/', zh: '延夏弓士装束', strictLink: true }], // member-name stem
    ['延夏【術士】', { path: '/equipment/yanxian_of_casting/', zh: '延夏术士装束', strictLink: true }], // member-name stem
    ['延夏【学士】', { path: '/equipment/yanxian_of_healing/', zh: '延夏学士装束', strictLink: true }], // member-name stem
    ['羅漢【武士】', { path: '/equipment/arhat_of_fending/', zh: '罗汉豪士装束', strictLink: true }], // Item 51449
    ['羅漢【槍士】', { path: '/equipment/arhat_of_maiming/', zh: '罗汉枪士装束', strictLink: true }], // Item 51450
    ['羅漢【拳士】', { path: '/equipment/arhat_of_striking/', zh: '罗汉拳士装束', strictLink: true }], // Item 51451
    ['羅漢【間士】', { path: '/equipment/arhat_of_scouting/', zh: '罗汉间士装束', strictLink: true }], // Item 51453
    ['羅漢【弓士】', { path: '/equipment/arhat_of_aiming/', zh: '罗汉弓士装束', strictLink: true }], // Item 51452
    ['羅漢【術士】', { path: '/equipment/arhat_of_casting/', zh: '罗汉术士装束', strictLink: true }], // Item 51455
    ['羅漢【学士】', { path: '/equipment/arhat_of_healing/', zh: '罗汉学士装束', strictLink: true }], // Item 51454
    ['源氏【武士】', { path: '/equipment/genji_of_fending/', zh: '源氏之豪士套装', strictLink: true }], // member-name stem
    ['源氏【槍士】', { path: '/equipment/genji_of_maiming/', zh: '源氏之枪士套装', strictLink: true }], // member-name stem
    ['源氏【拳士】', { path: '/equipment/genji_of_striking/', zh: '源氏之拳士套装', strictLink: true }], // member-name stem
    ['源氏【間士】', { path: '/equipment/genji_of_scouting/', zh: '源氏之间士套装', strictLink: true }], // member-name stem
    ['源氏【弓士】', { path: '/equipment/genji_of_aiming/', zh: '源氏之弓士套装', strictLink: true }], // member-name stem
    ['源氏【術士】', { path: '/equipment/genji_of_casting/', zh: '源氏之术士套装', strictLink: true }], // member-name stem
    ['源氏【学士】', { path: '/equipment/genji_of_healing/', zh: '源氏之学士套装', strictLink: true }], // member-name stem
    ['ヨルハ五一式:重', { path: '/equipment/yorha_type-51_of_fending/', zh: '寄叶五一式御敌套装', strictLink: true }], // member-name stem
    ['ヨルハ五一式:攻', { path: '/equipment/yorha_type-51_of_maiming/', zh: '寄叶五一式制敌套装', strictLink: true }], // member-name stem
    ['ヨルハ五一式:格', { path: '/equipment/yorha_type-51_of_striking/', zh: '寄叶五一式强袭套装', strictLink: true }], // member-name stem
    ['ヨルハ五一式:軽', { path: '/equipment/yorha_type-51_of_scouting/', zh: '寄叶五一式游击套装', strictLink: true }], // member-name stem
    ['ヨルハ五一式:射', { path: '/equipment/yorha_type-51_of_aiming/', zh: '寄叶五一式精准套装', strictLink: true }], // member-name stem
    ['ヨルハ五一式:術', { path: '/equipment/yorha_type-51_of_casting/', zh: '寄叶五一式咏咒套装', strictLink: true }], // member-name stem
    ['ヨルハ五一式:医', { path: '/equipment/yorha_type-51_of_healing/', zh: '寄叶五一式治愈套装', strictLink: true }], // member-name stem
    ['ヨルハ五三式:重', { path: '/equipment/yorha_type-53_of_fending/', zh: '寄叶五三式御敌套装', strictLink: true }], // member-name stem
    ['ヨルハ五三式:攻', { path: '/equipment/yorha_type-53_of_maiming/', zh: '寄叶五三式制敌套装', strictLink: true }], // member-name stem
    ['ヨルハ五三式:格', { path: '/equipment/yorha_type-53_of_striking/', zh: '寄叶五三式强袭套装', strictLink: true }], // member-name stem
    ['ヨルハ五三式:軽', { path: '/equipment/yorha_type-53_of_scouting/', zh: '寄叶五三式游击套装', strictLink: true }], // member-name stem
    ['ヨルハ五三式:射', { path: '/equipment/yorha_type-53_of_aiming/', zh: '寄叶五三式精准套装', strictLink: true }], // member-name stem
    ['ヨルハ五三式:術', { path: '/equipment/yorha_type-53_of_casting/', zh: '寄叶五三式咏咒套装', strictLink: true }], // member-name stem
    ['ヨルハ五三式:医', { path: '/equipment/yorha_type-53_of_healing/', zh: '寄叶五三式治愈套装', strictLink: true }], // member-name stem
    ['ヨルハ五五式:重', { path: '/equipment/yorha_type-55_of_fending/', zh: '寄叶五五式御敌套装', strictLink: true }], // member-name stem
    ['ヨルハ五五式:攻', { path: '/equipment/yorha_type-55_of_maiming/', zh: '寄叶五五式制敌套装', strictLink: true }], // member-name stem
    ['アンドロイド旧式:格', { path: '/equipment/obsolete_androids_of_striking/', zh: '人造人旧式强袭套装', strictLink: true }], // member-name stem
    ['アンドロイド旧式:軽', { path: '/equipment/obsolete_androids_of_scouting/', zh: '人造人旧式游击套装', strictLink: true }], // member-name stem
    ['アンドロイド旧式:射', { path: '/equipment/obsolete_androids_of_aiming/', zh: '人造人旧式精准套装', strictLink: true }], // member-name stem
    ['アンドロイド旧式:術', { path: '/equipment/obsolete_androids_of_casting/', zh: '人造人旧式咏咒套装', strictLink: true }], // member-name stem
    ['アンドロイド旧式:医', { path: '/equipment/obsolete_androids_of_healing/', zh: '人造人旧式治愈套装', strictLink: true }], // member-name stem
    // Semantic review: exact bundle names and localized member-name display groups.
    ['コスモスーツ', { path: '/equipment/cosmosuit/', zh: '宇航服套装', strictLink: true }], // Item 48744
    ['モント・コスチュームセット', { path: '/equipment/king_of_leonis_attire/', zh: '雷欧尼斯国王套装', strictLink: true }], // Item 45575
    ['左近士', { path: '/equipment/sakonji/', zh: '左近士装束', strictLink: true }], // Item 50622
    ['百地', { path: '/equipment/momochi/', zh: '百地装束', strictLink: true }], // Item 50618
    ['紫洲武人', { path: '/equipment/shishu_bujin/', zh: '紫州武人装束', strictLink: true }], // Item 45525
    ['紫洲御前', { path: '/equipment/shishu_gozen/', zh: '紫州御前装束', strictLink: true }], // Item 45526
    ['春日【劣】', { path: '/equipment/weathered_kasuga/', zh: '旧化的春日装束', strictLink: true }], // localized member-name stem; display group
    ['服部【劣】', { path: '/equipment/weathered_hattori/', zh: '旧化的服部装束', strictLink: true }], // localized member-name stem; display group
    ['春日【想】', { path: '/equipment/idealized_kasuga/', zh: '理想化的春日装束', strictLink: true }], // localized member-name stem; display group
    ['服部【想】', { path: '/equipment/idealized_hattori/', zh: '理想化的服部装束', strictLink: true }], // localized member-name stem; display group
    ['明珍【劣】', { path: '/equipment/antiquated_myochin/', zh: '旧化的明珍装束', strictLink: true }], // localized member-name stem; display group
    ['影隠【劣】', { path: '/equipment/antiquated_kage-kakushi/', zh: '旧化的影隐装束', strictLink: true }], // localized member-name stem; display group
    ['明珍【風】', { path: '/equipment/anemos_myochin/', zh: '常风明珍装束', strictLink: true }], // localized member-name stem; display group
    ['影隠【風】', { path: '/equipment/anemos_kage-kakushi/', zh: '常风影隐装束', strictLink: true }], // Item 50567
    ['明珍【徳】', { path: '/equipment/virtu_myochin/', zh: '美德明珍装束', strictLink: true }], // Item 45457
    ['伊賀【徳】', { path: '/equipment/virtu_iga/', zh: '美德伊贺装束', strictLink: true }], // localized set name
    ['伊賀', { path: '/equipment/iga/', zh: '伊贺装束', strictLink: true }], // Item 50539
    ['早乙女', { path: '/equipment/saotome/', zh: '早乙女装束', strictLink: true }], // Item 50603
    ['蜂屋', { path: '/equipment/hachiya/', zh: '蜂屋装束', strictLink: true }], // Item 50599
    ['無銘', { path: '/equipment/nameless/', zh: '无名套装', strictLink: true }], // localized coffer name; display group
    ['紅蓮祭法被', { path: '/equipment/moonfire_happi/', zh: '红莲节法被套装', strictLink: true }], // localized member-name stem; combined color group
    // Remaining catalogue labels: exact bundle identities or native multi-piece group names.
    // Native whole-outfit headings may share their source label with an individual item.
    ['グリムグリズリー・スーツ', { path: '/equipment/grisly_bear_suit/', zh: '狰狞熊套装', strictLink: true, itemConflict: true }], // Item 52402, 52403; in-game combination name
    ['ガジャスーツ', { path: '/equipment/gaja_suit/', zh: '小象套装', strictLink: true, itemConflict: true }], // Item 45436
    ['トードスーツ', { path: '/equipment/toad_suit/', zh: '蟾蜍套装', strictLink: true, itemConflict: true }], // Item 27937 and matching head; in-game set
    ['ポーキースーツ', { path: '/equipment/swine_body/', zh: '波奇套装', strictLink: true, itemConflict: true }], // Item 45230
    ['チキンスーツ', { path: '/equipment/chicken_suit/', zh: '小鸡套装', strictLink: true, itemConflict: true }], // Item 45425
    ['ラビットスーツ', { path: '/equipment/rabbit_suit/', zh: '兔子套装', strictLink: true, itemConflict: true }], // Item 30045 and matching head; in-game combination name
    ['レインコート', { path: '/equipment/raincoat/', zh: '雨衣套装', strictLink: true, itemConflict: true }], // Item 24592; hood, coat and boots
    ['コンカラー', { path: '/equipment/conquerors/', zh: '征服套装', strictLink: true, itemConflict: true }], // Item 51395; same bare JP label can name a weapon (Item 7353)
    ['アウトサイダー', { path: '/equipment/outsiders/', zh: '外来者套装', strictLink: true, itemConflict: true }], // Item 27256–27260, 27266; five armor pieces, not a gunblade
    ['フランネル', { path: '/equipment/flannel/', zh: '法兰绒背带衬衫套装', strictLink: true, itemConflict: true }], // Item 45263; distinguish from crafting material
    ['ヴァーシティ・ジャケット', { path: '/equipment/varsity_jacket/', zh: '校园外套套装', strictLink: true, itemConflict: true }], // Item 45441
    ['ボタンド・ヴァーシティジャケット', { path: '/equipment/buttoned_varsity_jacket/', zh: '系扣校园外套套装', strictLink: true, itemConflict: true }], // Item 45442
    ['ウラエウスボディアーマー', { path: '/equipment/uraeus_body_armor/', zh: '圣蜥蜴革组合', strictLink: true, itemConflict: true }], // Item 45190
    ['クァールビーチホルター', { path: '/equipment/coeurl_beach_halter/', zh: '豹纹夏衣套装', strictLink: true, itemConflict: true }], // display group; both skirt and shorts variants, see Item 45136 and the corresponding coffer
    ['クァールタリスマン', { path: '/equipment/coeurl_talisman/', zh: '豹纹护身符套装', strictLink: true, itemConflict: true }], // display group; Item 36120 contains both bottom variants
    ['LV式', { path: '/equipment/lv55/', zh: '河畔堡驻军装束', strictLink: true }], // Item 50483
    ['碧甲羅之', { path: '/equipment/the_blue/', zh: '碧甲装束', strictLink: true }], // Item 45290
    ['アルマ・コスチュームセット', { path: '/equipment/almas_attire/', zh: '威风凛凛套装', strictLink: true }], // Item 45364
    ['コロナルサマー', { path: '/equipment/coronal_summer/', zh: '盛花夏衣套装', strictLink: true }], // Display group; items 8549, 45133
    ['サザンシー', { path: '/equipment/southern_seas/', zh: '南洋海滨套装', strictLink: true }], // Display group; items 30755, 30756, 30757, 30758, 45402, 45403
    ['ガーディアン・オブ・スレイ', { path: '/equipment/the_guardians_of_maiming/', zh: '制敌守护者套装', strictLink: true }], // Display group; items 8310, 8311, 8312, 8313, 8314
    ['ガーディアン・オブ・ストライク', { path: '/equipment/the_guardians_of_striking/', zh: '强袭守护者套装', strictLink: true }], // Display group; items 8316, 8317, 8318, 8319, 8320
  ]);

  // The catalogue uses 【】 while native article headings also use 〖〗.
  // Register only whole-label variants of existing scoped entries.
  for (const [native, record] of [...FC_VERIFIED_SHORT_SET_PATHS]) {
    const alternate = native.replaceAll('【', '〖').replaceAll('】', '〗');
    const catalogue = native.replaceAll('〖', '【').replaceAll('〗', '】');
    for (const variant of [alternate, catalogue]) {
      if (!FC_VERIFIED_SHORT_SET_PATHS.has(variant)) FC_VERIFIED_SHORT_SET_PATHS.set(variant, record);
    }
  }

  function fcAnchorPath(link) {
    try {
      const url = new URL(link.getAttribute('href'), globalThis.location?.href || 'https://ff14-fc.com/');
      return /^(?:www\.)?ff14-fc\.com$/iu.test(url.hostname) ? url.pathname : null;
    } catch { return null; }
  }

  // Native catalogue cards have dd/h4 labels outside the image/article
  // anchor. Only a single distinct equipment URL within the actual card
  // can establish the identity; never use a neighbour or a foreign link.
  function fcCatalogueCardPath(element) {
    const heading = element?.closest?.('h4,h3,img');
    const card = heading?.closest('#search-filter-results-8722 .equipment-search-results-content > dl');
    if (!card) return undefined;
    const paths = new Set([...card.querySelectorAll('a[href]')]
      .map(fcAnchorPath).filter(path => /^\/equipment\/[^/]+\/?$/u.test(path || ''))
      .map(path => path.replace(/\/?$/u, '/')));
    return paths.size === 1 ? [...paths][0] : null;
  }

  // 无链接时可按页面判断；站外或无法解析的链接不得借用页面上下文。
  function fcLinkedPath(element) {
    const link = element?.closest?.('a[href]');
    return link ? fcAnchorPath(link) : fcCatalogueCardPath(element);
  }

  function fcMatchingSetLink(element, targetPath) {
    return fcLinkedPath(element) === targetPath;
  }

  function fcScopedSetName(name, node = null) {
    const record = FC_VERIFIED_SHORT_SET_PATHS.get(name);
    if (!record) return null;
    const path = globalThis.location?.pathname || '';
    return path === record.path
      || (record.crystal && path === '/summary/the_labyrinth_of_the_ancients/')
      || (node && fcMatchingSetLink(node, record.path)) ? record.zh : null;
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

  function fcGaroBareHeading(node, label) {
    const parent = node.parentElement;
    if (!parent) return null;
    const path = globalThis.location?.pathname || '';
    const fullBody = FC_FULL_SET_LABEL.exec(label)?.[0] || '';
    const core = fullBody ? label.slice(0, -fullBody.length) : label;
    // 列表卡片的 H3 与详情页的 H1 使用同一文章标题格式。
    const isArticle = /^[【〖]FF14[】〗]/u.test(core)
      && !!parent.closest('h1,h3,a[href]');
    // 大标题兼容【FF14】和〖FF14〗，仅对已确认的整套装备简称处理。
    const short = isArticle
      ? [...FC_GARO_BARE_SET_PATHS.keys(), ...FC_VERIFIED_SHORT_SET_PATHS.keys()]
        .find(k => ['【FF14】', '〖FF14〗'].some(prefix =>
          core.startsWith(prefix + k + '(') || core.startsWith(prefix + k + '（')
          || core.startsWith(prefix + k + '装備')))
      : core;
    const verified = FC_VERIFIED_SHORT_SET_PATHS.get(short);
    const detailPath = FC_GARO_BARE_SET_PATHS.get(short) || verified?.path;
    if (!detailPath) return null;
    const mainTitle = path === detailPath
      && (parent.closest('h5') || (fullBody && parent.closest('h3')) || parent.closest('h1'));
    const isSeriesPage = /^\/equipment_series_search\/?$/u.test(path);
    // H3 文章标题若附有链接则严格核验目标地址；没有链接才使用系列页上下文。
    const matchingLink = fcMatchingSetLink(parent, detailPath);
    const seriesTitle = isSeriesPage && (!verified?.strictLink || matchingLink)
      && (parent.closest('h4')
        || (isArticle && parent.closest('h3') && !parent.closest('a[href]')));
    if (!mainTitle && !seriesTitle && !matchingLink) return null;
    // 必须有正式系列对照；数据尚未就绪时保持原文，避免「漆黒」
    // 被通用 UI 词典先替换成资料片名而无法在数据加载后纠正。
    const official = verified?.zh || _getSeriesMap().get(short + 'の装束');
    if (!verified && !/(?:套装|装束)$/u.test(official || '')) return label;
    if (isArticle) {
      const replaced = label.replace(short, official);
      // “夜樱套装装备”不是自然中文标题；保留后续说明与原链接。
      return trFC(replaced.replace(official + '装備', official));
    }
    return official + fullBody;
  }

  function fcVerifiedShortAttribute(value, node) {
    const path = globalThis.location?.pathname || '';
    let result = value;
    for (const [native, record] of FC_VERIFIED_SHORT_SET_PATHS) {
      const linked = fcMatchingSetLink(node, record.path);
      if (!linked && (path !== record.path || record.itemConflict)) continue;
      // A related-image alt can be a bare series label rather than a sentence.
      if (result === native) return record.zh;
      result = result.replaceAll('「' + native + '」', '「' + record.zh + '」');
      for (const prefix of ['【FF14】', '〖FF14〗']) {
        const lead = prefix + native + '装備';
        if (result.startsWith(lead)) result = prefix + record.zh + result.slice(lead.length);
      }
    }
    return result;
  }

  function fcGaroShortAttribute(value, node) {
    const path = globalThis.location?.pathname || '';
    let result = value;
    for (const [native, targetPath] of FC_GARO_BARE_SET_PATHS) {
      const quoted = '「' + native + '」';
      const articlePrefix = ['【FF14】', '〖FF14〗'].find(prefix =>
        result.startsWith(prefix + native + '(') || result.startsWith(prefix + native + '（'));
      if (!result.includes(quoted) && !articlePrefix) continue;
      if (path !== targetPath && !fcMatchingSetLink(node, targetPath)) continue;
      const official = _getSeriesMap().get(native + 'の装束');
      // Wait for official set data; otherwise 漆黒 may become the expansion title.
      if (!/(?:套装|装束)$/u.test(official || '')) return null;
      result = result.replaceAll(quoted, '「' + official + '」');
      if (articlePrefix) result = result.replace(articlePrefix + native, articlePrefix + official);
    }
    return result;
  }

  function fcShortSetQuotedAttribute(value, node) {
    return fcGaroShortAttribute(fcVerifiedShortAttribute(value, node), node);
  }

  // The FC gallery alt has a stable structure that cannot be translated by word
  // substitution without leaving Japanese particles or corrupting item names.
  function fcGalleryAlt(value, node) {
    const racePhoto = /^ミラプリ「([^「」]{1,80})」装備(.{1,30})での見た目紹介(\d{1,3})$/u.exec(value);
    const allRaces = /^ミラプリ「([^「」]{1,80})」装備の見た目を各種族で紹介(\d{1,3})$/u.exec(value);
    const native = racePhoto?.[1] || allRaces?.[1];
    if (!native) return null;
    const record = FC_VERIFIED_SHORT_SET_PATHS.get(native);
    // Both gallery formats can depict an individual piece, not just the
    // whole outfit. A shared native label must retain its individual item name.
    const scoped = !record?.itemConflict ? fcScopedSetName(native, node) : null;
    const name = scoped || fcVerifiedSetName(native) || fcGaroSetName(native) || fcItemName(native);
    if (!name) return null;
    if (racePhoto) {
      const race = fcUIValue(racePhoto[2]);
      return race ? race + '「' + name + '」外观展示图 ' + racePhoto[3] : null;
    }
    return '「' + name + '」各种族外观展示图 ' + allRaces[2];
  }

  // 只在站点明确的「整套装备」标题区域附加展示后缀。
  // 不修改物品/系列词库：同一中文名仍可作为单件物品名或 Wiki 查询键。
  const FC_FULL_SET_LABEL = /[（(]全身[）)]$/u;
  function fcSetTitleContext(element, source, path) {
    if (!element?.closest) return false;
    // 首页轮播和相关推荐仅认本站的整套装备详情链接，不推断站外同路径。
    const linkedPath = fcLinkedPath(element);
    if (linkedPath === null) return false;
    if (linkedPath && /^\/equipment\/[^/]+\/?$/u.test(linkedPath)) return true;
    // 系列检索结果的 H4 是卡片套装名，不能扩大到部位检索页。
    if (/^\/equipment_series_search\/?$/u.test(path)) return !!element.closest('h4');
    if (!/^\/equipment\/[^/]+\/?$/u.test(path)) return false;
    // 详情页 H5 是系列标题；H3 中只有「（全身）」才是整套预览。
    return !!element.closest('h5') || (FC_FULL_SET_LABEL.test(source) && !!element.closest('h3'));
  }

  function fcSetDisplayText(node, original, translated) {
    const source = original.trim();
    const path = globalThis.location?.pathname || '';
    if (!fcSetTitleContext(node.parentElement, source, path)) return translated;
    const fullBody = FC_FULL_SET_LABEL.exec(source)?.[0] || '';
    const base = fullBody ? source.slice(0, -fullBody.length) : source;
    // 不把「整套装备详情中的单件物品链接」误判为套装卡片。
    // 套装与同名单件物品冲突时禁止前缀猜译；否则仍允许真实系列词干，
    // 例如「コスモパワード」和职业套装 RE 标题。
    const prefix = !fcItemName(base) && _getItemPfx().get(base);
    const officialName = _getSeriesMap().get(base) || fcVerifiedSetName(base)
      || _getSeriesPfx().get(base) || prefix;
    if (!officialName || officialName === base) return translated;
    // 仅处理已能完整对照的独立系列名；不能给句子、部件名或半译词添后缀。
    const localized = translated.trim();
    if (localized !== officialName + fullBody && !(fullBody && localized === source)) return translated;
    if (/(?:套装|装束|组合)(?:·[阴阳])?(?:〖[^〖〗]+〗|（[^（）]+）)?$/u.test(officialName)) {
      return fullBody && localized === source
        ? original.replace(source, officialName + fullBody) : translated;
    }
    return translated.replace(localized, officialName + '套装' + fullBody);
  }

  function fcRecommendationText(node, raw, label) {
    const exact = fcVerifiedSetName(label) || fcGaroSetName(label) || _getSeriesMap().get(label);
    if (exact) return fcSetDisplayText(node, raw, raw.replace(label, () => exact));
    const group = /^(.{1,60}?)[（(]([^（）()]{1,60})[）)]$/u.exec(label);
    if (!group) return null;
    const base = group[1].trim();
    const family = _getSeriesMap().get(base) || fcVerifiedSetName(base)
      || _getItemPfx().get(base) || _getSeriesPfx().get(base) || lookupDutyName(base);
    const roles = group[2].split('・').map(role => fcUIValue(role.trim()));
    if (family && roles.every(Boolean)) {
      return raw.replace(label, () => family + '（' + roles.join('、') + '）');
    }
    // A complete item identity still takes precedence over an unknown group.
    const candidates = resolveAllByName(label);
    return candidates.length === 1 ? raw.replace(label, () => candidates[0]) : raw;
  }

  // Native dungeon drop lists append the equipment slot to the exact item
  // name. Resolve the complete game identity before translating the suffix.
  // Unknown/ambiguous names must remain intact for the next data-ready pass.
  function fcDropItemText(raw, label) {
    const match = /^(.{1,100}?)[（(](頭防具|胴防具|手防具|脚防具|足防具)[）)]$/u.exec(label);
    if (!match) return null;
    const names = resolveAllByName(match[1].trim());
    const slot = fcUIValue(match[2]);
    return names.length === 1 && slot
      ? raw.replace(label, () => names[0] + '（' + slot + '）') : raw;
  }

  function fcContextText(node, raw, label) {
    const p = node.parentElement;
    if (p?.closest?.('#info-drop .eorzeadb_link')) {
      const drop = fcDropItemText(raw, label);
      if (drop !== null) return drop;
    }
    // A verified page identity wins over generic recommendation/group
    // parsing (which may otherwise hide a URL-specific name).
    const garoBare = fcGaroBareHeading(node, label);
    if (garoBare !== null) return raw.replace(label, () => garoBare);
    if (p?.closest?.('#scrollad h5,.related_post__equipment .article_list__ttl')) {
      const next = fcRecommendationText(node, raw, label);
      if (next !== null) return next;
    }
    return fcCardText(node, raw, label);
  }

  function trimFCNode(node) {
    const raw = node.nodeValue;
    const label = raw?.trim();
    if (!label || node.parentElement?.closest?.(FC_SKIP_SEL)) return;
    const next = fcContextText(node, raw, label);
    if (next !== raw) node.nodeValue = next;
  }

  function fcCardText(node, raw, label) {
    const p = node.parentElement;
    const path = globalThis.location?.pathname || '';
    if (fcSetTitleContext(p, label, path)) {
      const next = fcSetCardOverride(p, raw, label);
      if (next !== null) return next;
    }
    const filter = p?.closest?.('label, h4, option') && p.closest('form.searchandfilter');
    const translated = filter && fcUIValue('filter:' + label);
    const resolved = translated ? raw.replace(label, translated) : trFC(raw, path, p);
    return fcSetDisplayText(node, raw, resolved);
  }

  function fcSetCardOverride(element, raw, label) {
    const fullBody = FC_FULL_SET_LABEL.exec(label)?.[0] || '';
    const name = fullBody ? label.slice(0, -fullBody.length) : label;
    const series = _getSeriesMap().get(name) || fcVerifiedSetName(name)
      || fcGaroSetName(name) || fcScopedSetName(name, element) || _getSeriesPfx().get(name);
    // Sidebar cards also contain individual clothing and accessories.
    const candidates = resolveAllByName(name);
    if (!series && !fullBody && candidates.length === 1 && candidates[0] !== name) {
      return raw.replace(label, () => candidates[0]);
    }
    const prefix = !candidates.length && _getItemPfx().get(name);
    if (/^[\u30a0-\u30ff\u4e00-\u9fff]{2,40}$/u.test(name)
        && !(fcUIValue(name) || series || prefix)) return raw;
    if (!series && !prefix && candidates.length > 1) return raw;
    return null;
  }

  // v1.2.8：节点分派拆为子步骤（降认知复杂度）
  function _fcAcceptNode(n) {
    if (n.nodeType === 1) {
      if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
      if (n.closest?.(FC_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
  }

  function _wowFCInput(n) {
    // Search & Filter stores its accessible field name in title, even
    // when the visible placeholder was already localized.
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      const label = n.getAttribute(attr);
      if (label) {
        const zh = trFC(label);
        if (zh !== label) n.setAttribute(attr, zh);
      }
    }
    // v1.2.1：合并原被 2882 分支遮蔽的 input[value] 处理（v1.12.7 起从未生效；仅 submit/button/reset 防误伤）
    const v0 = n.getAttribute('value');
    if (v0 && v0.length <= 24 && /^(submit|button|reset)$/i.test(n.getAttribute('type') || '')) {
      const tv = (n.closest('form.searchandfilter') && fcUIValue('filter:' + v0)) || trFC(v0);
      if (tv && tv !== v0) n.setAttribute('value', tv);
    }
  }

  // Recommendation thumbnails often repeat the visible title. Use the same
  // context-sensitive resolver for both, but leave distinct captions alone.
  function fcRecommendationAlt(image, value) {
    const heading = image.closest?.('#scrollad dl')?.querySelector('h5');
    if (!heading) return null;
    const label = value.trim();
    const next = fcContextText({ parentElement: heading }, value, label);
    const title = heading.textContent.trim();
    return title === label || title === next.trim() ? next : null;
  }

  function _trFCAttr(n, key) {
    const value = n.getAttribute(key);
    if (!value || value.length > 160) return;
    if (key === 'alt') {
      const card = fcRecommendationAlt(n, value);
      if (card !== null) {
        if (card !== value) n.setAttribute(key, card);
        return;
      }
    }
    const match = key === 'title' && value.match(/^View all posts in (.+)$/);
    const group = match && DICT_FC[match[1]];
    const scoped = fcShortSetQuotedAttribute(value, n);
    if (scoped === null) return;
    const translated = group ? '查看“' + group + '”分类下的全部文章'
      : (key === 'alt' && fcGalleryAlt(value, n)) || trFC(scoped);
    if (translated !== value) n.setAttribute(key, translated);
  }
  function _procFCImg(n) {
    const alt = n.getAttribute('alt');
    if (alt && alt.length >= 2 && alt.length <= 90) _trFCAttr(n, 'alt');
    if (n.hasAttribute('title')) _trFCAttr(n, 'title');
    if (n.hasAttribute('aria-label')) _trFCAttr(n, 'aria-label');
  }

  function _procFCNode(n) {
    if (n.nodeType === 3) { trimFCNode(n); return; }
    if (n.tagName === 'INPUT') { _wowFCInput(n); return; }
    if (n.tagName === 'A' && /lodestone|finalfantasyxiv|garland|eriones|ffxivdb|gamerescape/i.test(n.getAttribute('href') || '')) {
      // v1.12.1：外服链接 → 直接改写为灰机 wiki（文字查表；已中文则直接用）
      rewriteFCForeignLink(n);
      return;
    }
    if (n.tagName === 'IMG' || n.hasAttribute('alt')) _procFCImg(n);
    else {
      if (n.hasAttribute('title')) _trFCAttr(n, 'title');
      if (n.hasAttribute('aria-label')) _trFCAttr(n, 'aria-label');
    }
  }

  function translateFCPage(rootArg) {
    const isFull = !rootArg;
    if (isFull) {
      if (window.__zhixiaFcBusy) return;
      window.__zhixiaFcBusy = true;
    }
    try {
      translateFCParagraphs(rootArg);
      if (rootArg?.nodeType === 3) { trimFCNode(rootArg); collapseFCHomeHeadings(); return; }
      const root = rootArg || document.body || document.documentElement;
      if (!root) return;
      if (root.nodeType === 1 && _fcAcceptNode(root) !== NodeFilter.FILTER_REJECT) _procFCNode(root);
      _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
      for (const n of snapshotTranslationNodes(root, _fcAcceptNode)) _procFCNode(n);
      collapseFCHomeHeadings();
    } finally {
      if (isFull) window.__zhixiaFcBusy = false;
    }
  }

  // <title> 汉化（子页标题：装备一覧＆検索 | ミラプリライフ 等）
  function translateFCTitle() {
    const t = document.title;
    const path = globalThis.location?.pathname || '';
    // GARO 详情标签使用「〖FF14〗漆黒(戦士)…」等简称，没有一般的「装備👗」模式。
    // 等系列数据就绪后还原为装束名；在此之前避免“漆黒”误译成资料片。
    for (const [native, detailPath] of FC_GARO_BARE_SET_PATHS) {
      if (path !== detailPath) continue;
      const prefix = ['【FF14】', '〖FF14〗'].find(marker =>
        t.startsWith(marker + native + '(') || t.startsWith(marker + native + '（'));
      if (!prefix) break;
      const official = _getSeriesMap().get(native + 'の装束');
      if (!/(?:套装|装束)$/u.test(official || '')) return;
      document.title = trFC(t.replace(prefix + native, prefix + official));
      return;
    }
    const whole = trFC(t || '');
    if (whole && whole !== t) { document.title = whole; return; }
    if (!t || !/[\u3040-\u30ff]/.test(t)) return;
    let out = t;
    const parts = out.split(/[|｜\-–—]/).map((x) => x.trim()).filter(Boolean);
    const mapped = parts.map((pp) => {
      const hit = DICT_FC[pp];
      if (hit) return hit;
      const zh = lookupJp2Zh(pp.replace(/(の一覧|一覧|まとめ)$/, ''));
      return zh || trFC(pp);
    });
    out = mapped.join(' | ');
    if (out !== t && out.length <= 80) document.title = out;
  }

  // v1.12.1：外服装备链接（Lodestone 等）→ 改写为灰机 wiki 链接
  function fcLinkZhName(a) {
    const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 2 || t.length > 60) return null;
    // v1.2.1：① Lodestone hash 直查（hash→物品表中文名，不受文本侧子串替换污染，如「春日护手【想】」）
    const hm = (a.getAttribute('href') || '').match(/lodestone\/playguide\/db\/item\/([0-9a-f]+)/i);
    if (hm) {
      const z = resolveByHash(hm[1]);
      if (z && z !== t) return z;
    }
    // v1.2.1：② 判定前剥【…】标记（「春日半頬【想】」等「纯汉字+全角标记」名此前不查表）
    const tp = t.replace(/【[^【】]*】/g, '').trim() || t;
    if (/[\u3040-\u30ff]/.test(tp) || (/^[\u3005\u3006\u4e00-\u9fff]+$/.test(tp) && tp.length <= 20)) {
      const z = fcKnownName(t);
      if (z && z !== t) return z;
    }
    // 已是中文（或中日共用汉字）→ 去掉空格直接用
    if (/^[\u4e00-\u9fff·\u3040-\u30ffA-Za-z0-9'\- ]+$/.test(t) && /[\u4e00-\u9fff]/.test(t)) {
      return t;
    }
    return null;
  }
  function rewriteFCForeignLink(a) {
    if (a.dataset.zhixiaFcHref) return;
    const zh = fcLinkZhName(a);
    if (!zh) return;
    a.dataset.zhixiaFcHref = '1';
    a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
    a.removeAttribute('target');
  }

  // 导航应描述目标子页，而非将站点原文逐字直译。
  // 仅对「匹配链接 + 匹配原标签」的短导航项生效，不改词库中的通用术语。
  // 采用统一的导航短标签；与对应页面的正式文章标题相互独立。
  const FC_MENU_LABELS = new Map([
    ['/equipment_series_search/', { names: ['シリーズ', '系列'], zh: '装备套装' }],
    ['/summary_equipment_id/', { names: ['ID', 'id'], zh: '副本装备' }],
    ['/summary_equipment/', { names: ['カテゴリ別', '按分类'], zh: '按来源汇总' }],
    ['/capture_top/', { names: ['お役立ち', '实用'], zh: '攻略' }],
    ['/item_intro_top/', { names: ['アイテム', '物品'], zh: '物品介绍' }],
  ]);

  function fcMenuTextNode(element, label) {
    for (const child of element.childNodes || []) {
      if (child.nodeType === 3 && child.nodeValue.trim() === label) return child;
      if (child.nodeType === 1) {
        const found = fcMenuTextNode(child, label);
        if (found) return found;
      }
    }
    return null;
  }

  function fixFCMenu(rootArg) {
    const scope = localScope(rootArg);
    const links = new Set(queryIn(scope, 'a[href]'));
    const ancestor = scope?.closest?.('a[href]');
    if (ancestor) links.add(ancestor);
    let changed = false;
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      // 不处理站外链接；相同路径不代表外站页面具有相同语义。
      if (/^https?:\/\//iu.test(href) && !/^https?:\/\/(?:www\.)?ff14-fc\.com(?:\/|$)/iu.test(href)) continue;
      let path;
      try { path = new URL(href, globalThis.location?.href || 'https://ff14-fc.com/').pathname; }
      catch { continue; }
      const rule = FC_MENU_LABELS.get(path.endsWith('/') ? path : path + '/');
      if (!rule) continue;
      const label = a.textContent.trim();
      if (!rule.names.includes(label) || label === rule.zh) continue;
      const node = fcMenuTextNode(a, label);
      if (!node) continue;
      // 保留原空白、嵌套 span、图标和链接属性。
      node.nodeValue = node.nodeValue.replace(label, rule.zh);
      changed = true;
    }
    return changed;
  }

  // 装备名点击 → 灰机 wiki（fc 站装备名多为纯文本/链接，统一兜底）
  // v1.2.8：click 回调拆为子步骤（降认知复杂度）
  function _fcJumpName(probe, t, isForeign) {
    // v1.2.1：① Lodestone hash 直查（不受文本污染）
    if (probe.tagName === 'A') {
      const hm = (probe.getAttribute('href') || '').match(/lodestone\/playguide\/db\/item\/([0-9a-f]+)/i);
      if (hm) { const z = resolveByHash(hm[1]); if (z) return z; }
    }
    // v1.2.1：② 判定前剥【…】标记（同 fcLinkZhName）
    const tp = t.replace(/【[^【】]*】/g, '').trim() || t;
    if (/[\u3040-\u30ff]/.test(tp) || (/^[\u3005\u3006\u4e00-\u9fff]+$/.test(tp) && tp.length <= 20)) {
      const z = fcKnownName(t);
      if (z) return z;
    }
    if (isForeign && /^[\u4e00-\u9fff·・A-Za-z0-9'\- ]+$/.test(t) && /[\u4e00-\u9fff]/.test(t)) return t;
    return null;
  }

  function _fcJumpResolve(el0, isForeign) {
    // 向上探测 5 层找可译名
    let probe = el0;
    let guard = 0;
    while (probe && guard < 5) {
      const t = (probe.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t.length >= 2 && t.length <= 60) {
        const z = _fcJumpName(probe, t, isForeign);
        if (z && z !== t) return z;
      }
      probe = probe.parentElement;
      guard++;
    }
    return null;
  }

  function _fcJumpClick(e) {
    const el0 = e.target;
    if (!el0?.closest) return;
    // ① 站内导航/卡片链接放行（非外服）
    if (el0.closest('a[href*="/equipment/"], a[href*="/equipment_"], a[href*="/summary/"], a[href*="/fashion_accessories/"], a[href*="/modern_aesthetics/"]')) return;
    // ② 已是灰机的链接放行
    const a = el0.closest('a');
    if (a && /huijiwiki\.com/i.test(a.getAttribute('href') || '')) return;
    // ③ 外服链接（Lodestone 等）→ 拦截改跳灰机
    const aHref = a ? (a.getAttribute('href') || '') : '';
    const isForeign = /lodestone|finalfantasyxiv\.com|garland|eriones|ffxivdb|gamerescape/i.test(aHref);
    const zh = _fcJumpResolve(el0, isForeign);
    if (!zh || !isForeign) return;
    e.preventDefault();
    e.stopPropagation();
    window.open(WIKI_ITEM + encodeURIComponent(zh), '_blank', 'noopener');
  }

  // 装备名点击 → 灰机 wiki（fc 站装备名多为纯文本/链接，统一兜底）
  function bindFCWikiJump() {
    if (window.__zhixiaFcJump) return;
    window.__zhixiaFcJump = true;
    document.addEventListener('click', _fcJumpClick, true);
  }

  // v1.12.6：横幅汉化 —— 左侧图区不遮，右侧文字区：原日文模糊(亚克力) + 中文双行
  // v1.12.8：武器页职业卡中文（slug → 职业·武器）
  const FC_WEAPON_CARDS = {
    gladiators_arm: '骑士·单手剑', shield: '骑士·盾',
    marauders_arm: '战士·大斧', dark_knights_arm: '暗黑骑士·双手剑',
    gunbreakers_arm: '绝枪战士·枪盾', skyltborg: '特殊职业',
    lancers_arm: '龙骑士·长枪', reapers_arm: '钐镰客·双手镰刀',
    pugilists_arm: '武僧·格斗武器', samurais_arm: '武士·刀',
    rogues_arm: '忍者·双剑', vipers_arm: '蝰蛇剑士·蝰蛇对剑',
    one_handed_axe: '单手斧',
    archers_arm: '吟游诗人·弓', machinists_arm: '机工士·火枪',
    dancers_arm: '舞者·投掷武器', evercoldranges_arm: '远敏职业',
    thaumaturges_arm: '黑魔法师·咒杖', arcanists_grimoire: '召唤师·魔导书',
    red_mages_arm: '赤魔法师·刺剑', pictomancers_arm: '绘灵法师·画笔',
    blue_mages_arm: '青魔法师·青魔法', conjurers_arm: '白魔法师·幻杖',
    scholars_arm: '学者·魔导书', astrologians_arm: '占星术士·天球仪',
    sages_arm: '贤者·咒杖',
  };

  const FC_BANNER_RULES = [
    { match: /banner_001|equipment_search_parts|部位ごと/i, zh: '部位分类' },
    { match: /banner_002|equipment_series_search|装備シリーズ/i, zh: '装备套装' },
    { match: /banner_003|fashion_accessories|ファッションアクセ/i, zh: '时尚配饰' },
    { match: /banner_004|hair_catalog|ヘアカタログ/i, zh: '发型图鉴' },
    { match: /banner_005|weapon_search|武器シリーズ/i, zh: '武器系列' },
    { match: /ff14_antenna\.gif/i, zh: 'FF14 资讯聚合' },
    { match: /br_c_1412_1\.gif/i, zh: 'FF14 博客榜' },
    { match: /message_button\.svg/i, zh: '联系与留言' },
  ];
  function fcBannerMatch(a, img) {
    const probe = ((img && (img.dataset.src || img.getAttribute('src') || img.getAttribute('title') || img.getAttribute('alt'))) || '') + ' ' + (a.getAttribute('href') || '');
    for (const r of FC_BANNER_RULES) if (r.match.test(probe)) return r;
    return null;
  }

  const FC_SECTION_BUTTONS = {
    main: '页首', slider: '幻想试穿', information: '基本信息', get: '获取方式',
    description: '装备介绍', detail: '部位详解', all: '相关物品', point: '总结',
    head: '头部', body: '身体', hand: '手部', leg: '腿部', foot: '脚部',
  };

  function translateFCSectionButton(link) {
    if (link.dataset.zhxFcSection) return;
    const img = link.querySelector('img.not-hover');
    const kind = /\/button_([a-z]+)\.svg(?:[?#]|$)/.exec(img?.dataset.src || img?.getAttribute('src') || '')?.[1];
    const label = kind && Object.hasOwn(FC_SECTION_BUTTONS, kind) && FC_SECTION_BUTTONS[kind];
    if (!label) return;
    if (!document.getElementById('zhx-fc-section-style')) {
      const style = document.createElement('style');
      style.id = 'zhx-fc-section-style';
      style.textContent = `
        .link-button a[data-zhx-fc-section] { position: relative; display: block; line-height: 0; }
        .link-button a[data-zhx-fc-section] > img { vertical-align: top; }
        [data-zhx-fc-section] > .zhx-fc-section-label {
          position: absolute; inset: auto 0 0; height: 30%; display: grid; place-items: center;
          background: #a7cbea; color: #173752; font-size: clamp(10px, 1.12vw, 17px);
          font-weight: 700; line-height: 1; white-space: nowrap; pointer-events: none;
        }
        [data-zhx-fc-section]:is(:hover, :focus-visible) > .zhx-fc-section-label {
          background: #6691b7; color: #fff;
        }`;
      (document.head || document.documentElement).appendChild(style);
    }
    link.dataset.zhxFcSection = '1';
    link.setAttribute('aria-label', label);
    const caption = document.createElement('span');
    caption.className = 'zhx-fc-section-label';
    caption.textContent = label;
    link.appendChild(caption);
  }

  function bindFCBanners(rootArg) {
    let changed = false;
    const scope = localScope(rootArg);
    queryIn(scope, '.link-button a[href^="#sub-toc-"]').forEach(translateFCSectionButton);
    queryIn(scope, 'div.banner-wrap a, #side a.ff14rank, #side a:has(img.other-site-link)').forEach((a) => {
      if (a.dataset.zhixiaBanner) return;
      const img = a.querySelector('img');
      if (!img) return;
      const rule = fcBannerMatch(a, img);
      if (!rule) return;
      a.dataset.zhixiaBanner = '1';
      changed = true;
      a.style.position = a.style.position || 'relative';
      a.style.display = a.style.display || 'block';
      a.style.overflow = 'hidden';
      const big = !!a.closest('.banner-wrap');
      const span = document.createElement('span');
      span.dataset.zhixiaBannerSpan = '1';
      if (big) {
        // 右侧文字区：亚克力（模糊日文）+ 中文双行
        span.style.cssText = 'position:absolute;top:0;bottom:0;right:0;width:42%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:linear-gradient(160deg,rgba(255,255,255,.34),rgba(255,255,255,.12));backdrop-filter:blur(7px) saturate(1.4);-webkit-backdrop-filter:blur(7px) saturate(1.4);border-left:1px solid rgba(255,255,255,.45);pointer-events:none;z-index:2;';
        const l1 = document.createElement('strong');
        l1.textContent = rule.zh;
        l1.style.cssText = 'font-size:20px;font-weight:900;letter-spacing:1px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.65),0 0 14px rgba(0,0,0,.4);line-height:1.15;';
        const l2 = document.createElement('em');
        l2.textContent = '一览与搜索';
        l2.style.cssText = 'font-style:normal;font-size:12px;font-weight:700;letter-spacing:.5px;color:rgba(255,255,255,.95);text-shadow:0 1px 4px rgba(0,0,0,.6);';
        span.appendChild(l1); span.appendChild(l2);
      } else {
        // 小按钮：整块亚克力 + 中文
        span.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.14);backdrop-filter:blur(6px) saturate(1.3);-webkit-backdrop-filter:blur(6px) saturate(1.3);font-weight:800;font-size:12px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.75);pointer-events:none;z-index:2;';
        span.textContent = rule.zh;
      }
      a.appendChild(span);
    });
    // v1.12.8：武器页职业卡（26 张 SVG，文字为矢量路径无法改）→ 右侧叠中文
    queryIn(scope, 'li.weapon-banner-item a').forEach((a) => {
      if (a.dataset.zhixiaWeapon) return;
      const img = a.querySelector('img');
      if (!img) return;
      const href = a.getAttribute('href') || '';
      const mm = /weapon_search\/([a-z_0-9]+)\//.exec(href);
      if (!mm) return;
      const zh = FC_WEAPON_CARDS[mm[1]];
      if (!zh) return;
      a.dataset.zhixiaWeapon = '1';
      changed = true;
      a.style.position = 'relative';
      a.style.display = a.style.display || 'block';
      a.style.overflow = 'hidden';
      const sp = document.createElement('span');
      const parts = zh.split('·');
      sp.style.cssText = 'position:absolute;top:0;bottom:0;right:0;width:54%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:linear-gradient(160deg,rgba(255,255,255,.32),rgba(255,255,255,.1));backdrop-filter:blur(6px) saturate(1.4);-webkit-backdrop-filter:blur(6px) saturate(1.4);border-left:1px solid rgba(255,255,255,.4);pointer-events:none;z-index:2;';
      const b1 = document.createElement('strong');
      b1.textContent = parts[0];
      b1.style.cssText = 'font-size:13px;font-weight:900;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.75),0 0 10px rgba(0,0,0,.45);line-height:1.15;letter-spacing:.5px;';
      sp.appendChild(b1);
      if (parts[1]) {
        const b2 = document.createElement('em');
        b2.textContent = parts[1];
        b2.style.cssText = 'font-style:normal;font-size:10px;font-weight:700;color:rgba(255,255,255,.95);text-shadow:0 1px 3px rgba(0,0,0,.65);';
        sp.appendChild(b2);
      }
      a.appendChild(sp);
    });
    return changed;
  }

  function startFC() {
    safe(translateFCPage, 'FC 全扫')();
    safe(translateFCTitle, 'FC 标题')();
    bindFCWikiJump();
    safe(fixFCMenu, 'FC 菜单')();
    safe(bindFCBanners, 'FC 横幅')();
    createTranslationObserver({ debounce: 300, characterData: true, attributes: true,
      attributeFilter: ['alt', 'title', 'aria-label', 'placeholder'], handler(nodes, texts) {
      for (const n of [...nodes, ...texts]) {
        safe(translateFCPage, 'FC 局部')(n);
        safe(fixFCMenu, 'FC 菜单')(n);
        safe(bindFCBanners, 'FC 横幅')(n);
      }
    } });
    // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
  }
