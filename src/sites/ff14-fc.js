import { _getItemPfx, _getSeriesMap, _getSeriesPfx } from '../core/cache.js';
import { WIKI_ITEM } from '../core/constants.js';
import { resolveByHash } from '../core/data/data-manager.js';
import { DICT_FC, lookupDutyName } from '../core/data/dictionary.js';
import { SKIP_TAGS, _markScan, localScope, queryIn } from '../core/dom.js';
import { lookupJp2Zh } from '../core/item-resolver.js';
import { createTranslationObserver } from '../core/observer.js';
import { safe } from '../core/runtime.js';
import {
  FC_FULL_SET_LABEL, FC_VERIFIED_SHORT_SET_PATHS, fcGaroSetName, fcItemName, fcKnownName,
  fcScopedSetName as fcScopedTextSetName, fcUIValue, fcVerifiedSetName, trFC,
} from './ff14-fc/translation.js';

export { FC_ROLE_ZH } from '../core/cache.js';
export {
  _fcCanReplaceAt, _trFCDecor, _trFCExact, _trFCName, _trFCSubstr, fcStarterOutfitName, trFCSegments,
} from './ff14-fc/translation.js';
export {
  _fcAcceptNode, _procFCNode, _trFCAttr, _wowFCInput, bindFCBanners, collapseFCHomeHeadings, fcGaroSetName,
  fcLinkZhName, fcSetDisplayText, fcVerifiedSetName, fixFCMenu, rewriteFCForeignLink, startFC, trFC,
  translateFCPage, translateFCTitle, trimFCNode,
};

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
  // 唯一可信的短名称上下文：同站点同详情路径的链接。
  function fcMatchingSetLink(element, targetPath) {
    const link = element?.closest?.('a[href]');
    if (!link) return false;
    try {
      const url = new URL(link.getAttribute('href'), globalThis.location?.href || 'https://ff14-fc.com/');
      return /^(?:www\.)?ff14-fc\.com$/iu.test(url.hostname) && url.pathname === targetPath;
    } catch { return false; }
  }

  function fcScopedSetName(name, element) {
    return fcScopedTextSetName(name, targetPath => fcMatchingSetLink(element, targetPath));
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
    if (!/(?:套装|装束)$/u.test(official || '')) return label;
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
      if (path !== record.path && !fcMatchingSetLink(node, record.path)) continue;
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
    const name = fcScopedSetName(native, node) || fcVerifiedSetName(native)
      || fcGaroSetName(native) || fcItemName(native);
    if (!name) return null;
    if (racePhoto) {
      const race = fcUIValue(racePhoto[2]);
      return race ? race + '「' + name + '」外观展示图 ' + racePhoto[3] : null;
    }
    return '「' + name + '」各种族外观展示图 ' + allRaces[2];
  }

  // 只在站点明确的「整套装备」标题区域附加展示后缀。
  // 不修改物品/系列词库：同一中文名仍可作为单件物品名或 Wiki 查询键。
  function fcSetTitleContext(element, source, path) {
    if (!element?.closest) return false;
    // 首页轮播和相关推荐仅认本站的整套装备详情链接，不推断站外同路径。
    const link = element.closest('a[href]');
    if (link) {
      try {
        const url = new URL(link.getAttribute('href'), globalThis.location?.href || 'https://ff14-fc.com/');
        if (!/^(?:www\.)?ff14-fc\.com$/iu.test(url.hostname)) return false;
        if (/^\/equipment\/[^/]+\/?$/u.test(url.pathname)) return true;
      } catch { return false; }
    }
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
    if (/(?:套装|装束)(?:·[阴阳])?$/u.test(officialName)) {
      return fullBody && localized === source
        ? original.replace(source, officialName + fullBody) : translated;
    }
    return translated.replace(localized, officialName + '套装' + fullBody);
  }

  function trimFCNode(node) {
    const raw = node.nodeValue;
    if (!raw?.trim()) return;
    const p = node.parentElement;
    if (p?.closest?.(FC_SKIP_SEL)) return;
    const label = raw.trim();
    const garoBare = fcGaroBareHeading(node, label);
    if (garoBare !== null) {
      if (garoBare !== label) node.nodeValue = raw.replace(label, garoBare);
      return;
    }
    // 未取得可靠系列对应时宁可保留日文，不能用同名前缀套用单件装备译名。
    const path = globalThis.location?.pathname || '';
    const fullBody = FC_FULL_SET_LABEL.exec(label)?.[0] || '';
    const name = fullBody ? label.slice(0, -fullBody.length) : label;
    if (fcSetTitleContext(p, label, path)
      && /^[\u30a0-\u30ff\u4e00-\u9fff]{2,40}$/u.test(name)
      && !(fcUIValue(name) || _getSeriesMap().get(name) || fcVerifiedSetName(name)
        || _getSeriesPfx().get(name) || fcScopedSetName(name, p)
        || (!fcItemName(name) && _getItemPfx().get(name)))) return;
    const filter = p?.closest?.('label, h4, option') && p.closest('form.searchandfilter');
    const translated = filter && fcUIValue('filter:' + label);
    const resolved = translated ? raw.replace(label, translated) : trFC(raw);
    const next = fcSetDisplayText(node, raw, resolved);
    if (next !== raw) node.nodeValue = next;
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
    const ph = n.getAttribute('placeholder');
    if (ph) { const nn = trFC(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
    // v1.2.1：合并原被 2882 分支遮蔽的 input[value] 处理（v1.12.7 起从未生效；仅 submit/button/reset 防误伤）
    const v0 = n.getAttribute('value');
    if (v0 && v0.length <= 24 && /^(submit|button|reset)$/i.test(n.getAttribute('type') || '')) {
      const tv = (n.closest('form.searchandfilter') && fcUIValue('filter:' + v0)) || trFC(v0);
      if (tv && tv !== v0) n.setAttribute('value', tv);
    }
  }

  function _trFCAttr(n, key) {
    const value = n.getAttribute(key);
    if (!value || value.length > 160) return;
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
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: _fcAcceptNode,
      });
      const batch = [];
      while (w.nextNode()) batch.push(w.currentNode);
      for (const n of batch) _procFCNode(n);
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
