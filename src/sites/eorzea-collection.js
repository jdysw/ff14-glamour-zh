import { DICT_EC } from '../core/data/dictionary.js';
import { SKIP_TAGS, _markScan, _zhixiaTitleKeep, localScope, queryIn, snapshotTranslationNodes } from '../core/dom.js';
import { tryEnToZh } from '../core/item-resolver.js';
import { resolveDyeColor } from '../core/data/data-manager.js';
import { isECAuthoredContent, isECAuthoredPath } from '../core/content-scope.js';
import { createTranslationObserver } from '../core/observer.js';
import { safe } from '../core/runtime.js';
import { EC_ITEM_SKIP_SEL } from '../core/targets.js';
import { ecAccessoryDisplayName, ecGearsetDisplayName, ecTitleRoots, translateECGearsetNames } from './eorzea-collection/catalog.js';

export { resolveECGearsetSearch, suggestECGearsetsByZh } from './eorzea-collection/catalog.js';
export { EC_SKIP_SEL, PATTERNS_EC, bindECPieceTiles, bindECResetFilters, startEC, translateECAttrs, translateECPage, translateECTitle, trimECNode,
  ecGearsetDisplayName, translateECGearsetNames, translateECNavigation, translateECHomeEditorial };


  // EC 上会变动的文本（数量、时间、页数…）
  // EC 专用界面翻译只在 EC 站点模块声明，不再由通用物品解析层反向导入站点。
  // A preview palette shows colors rather than inventory dye items. Since
  // patch 7.5 the original individual dyes may be retired, but their
  // official color names remain useful. Handle the site's attached NEW
  // badge and inconsistent capitalization without guessing unknown colors.
  function ecIsDyePreview() {
    const path = globalThis.location?.pathname;
    return path === '/dyes' || path === '/dyes/';
  }

  function ecDyePreviewText(label) {
    if (!ecIsDyePreview()) return null;
    const isNew = label.endsWith(' NEW');
    const name = isNew ? label.slice(0, -4).trimEnd() : label;
    if (!/^[A-Za-z][A-Za-z -]{1,45}$/u.test(name)) return null;
    const normalized = name.toLowerCase().replace(/(?:^| )[a-z]/g, first => first.toUpperCase());
    const color = resolveDyeColor(name) || resolveDyeColor(normalized);
    if (!color) return null;
    return color + (isNew ? ' 新增' : '');
  }

  // Pin official terminology even when the deployed runtime dictionary
  // still contains the older EC abbreviations.
  const EC_UI_LABELS = new Map([
    ['Facewear', '面部配饰'], ['FACE', '面部配饰'], ['Face', '面部配饰'],
    ['Any facewear', '任意面部配饰'],
    ['Exclude promotional facewear', '排除促销面部配饰'],
    ['Exclude seasonal facewear', '排除季节活动面部配饰'],
    ['Pair Of Wings', '双翼'], ['Creature Designs', '生物造型'],
  ]);
  function ecUiLabel(label) {
    return EC_UI_LABELS.get(label) || DICT_EC[label];
  }

  function trEC(text) {
    if (!text) return text;
    const t = text.trim();
    if (!t) return text;
    if (!/[a-zA-Z]/.test(t)) return text;    // 快速跳过：DICT_EC/PATTERNS_EC 全部含拉丁字母（v1.11.1）
    // Editorial paragraphs contain source indentation/newlines between words.
    // Match their normalized text while retaining the surrounding inline markup.
    const hit = ecUiLabel(t) || ecUiLabel(t.replace(/\s+/g, ' ')) || ecDyePreviewText(t);
    if (hit) {
      const i = text.indexOf(t);
      return text.slice(0, i) + hit + text.slice(i + t.length);
    }
    if (t.length > 90) return text;          // 长句只接受已收录的完整译文
    // 纯英文短串（字母开头，含有限符号）→ 查主表/染剂表拿国服中文名
    if (/^[A-Za-z]/.test(t) && /^[A-Za-z0-9'\-.,:&!? ()（）]+$/.test(t)) {
      const zhName = tryEnToZh(t);
      if (zhName && zhName !== t) {
        const i2 = text.indexOf(t);
        return text.slice(0, i2) + zhName + text.slice(i2 + t.length);
      }
    }
    let out = text;
    for (const [re, to] of PATTERNS_EC) out = out.replace(re, to);
    return out;
  }

  const PATTERNS_EC = [
    [/^(\s*)Last updated:\s*/i, '$1最后更新：'],
    [/^(\s*)in The Firmament (\(X:\s*\d+(?:\.\d+)?\s+Y:\s*\d+(?:\.\d+)?\))(\s*)$/i, '$1位于天穹街 $2$3'],
    // 面饰页动态文案
    [/^—\s{0,8}Previous\s{1,8}(.{1,200}?)\s{0,8}—$/, (m0, x) => '— 上一个' + (ecUiLabel(x) || x) + ' —'],
    [/^—\s{0,8}Next\s{1,8}(.{1,200}?)\s{0,8}—$/, (m0, x) => '— 下一个' + (ecUiLabel(x) || x) + ' —'],
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


  // 用户产出的内容：绝不翻译
  const EC_SKIP_SEL = [
    '[data-zhx-chinese-suggest]',
    '.zhx-skip',
    // Preserve the native name committed by the component; the suggestion
    // panel already exposes the localized name.
    '.vs__selected',
    '.c-glamour-grid-item-content-title',
    '.c-glamour-grid-item-content-author',
    '[class*="s-glamour-description"]',
    '[class*="s-glamour-title"]',
    '[class*="c-comment"]',
    '[class*="s-comment"]',
    '[contenteditable="true"]',
  ].join(',');

  // Server names follow https://ff14.huijiwiki.com/wiki/服务器. Keep this
  // namespace separate from ordinary item/UI translations (e.g. Anima).
  function ecServerDisplayName(name) {
    return DICT_EC['server:' + name.trim().toLowerCase()] || name;
  }

  function ecServerText(text) {
    const quoted = text.replace(/«([^«»]*)»/g, (match, name) => '«' + ecServerDisplayName(name) + '»');
    const index = quoted.lastIndexOf('⧫');
    if (index < 0) return quoted;
    const tail = quoted.slice(index + 1);
    if (/[«»⧫\r\n]/.test(tail)) return quoted;
    const name = tail.trim();
    const translated = ecServerDisplayName(name);
    return translated === name ? quoted : quoted.slice(0, index + 1) + ' ' + translated;
  }

  const EC_SERVER_TEXT_SEL = '.c-glamour-grid-item-content-author, ' +
    'a[href^="/creator/"] .subtitle, .tooltip-content';

  function translateECServerElement(el) {
      if (el.tagName === 'OPTGROUP') {
        const label = ecServerDisplayName(el.label);
        if (label !== el.label) el.label = label;
        return;
      }
      if (el.tagName === 'OPTION') {
        const server = ecServerDisplayName(el.value);
        const name = server !== el.value ? server : DICT_EC[el.textContent.trim()];
        if (name && name !== el.textContent) el.textContent = name;
        return;
      }
        // Preserve the player's nested markup, links and event handlers.
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const translated = ecServerText(node.nodeValue);
          if (translated !== node.nodeValue) node.nodeValue = translated;
        }
  }

  function translateECServerImage(img) {
      for (const attr of ['alt', 'title']) {
        const old = img.getAttribute(attr);
        if (!old?.includes(' from ')) continue;
        const translated = ecServerText(old);
        if (translated !== old) img.setAttribute(attr, translated);
      }
  }

  function translateECServers(rootArg) {
    const selector = '#filter_server option, #filter_server optgroup, ' + EC_SERVER_TEXT_SEL;
    const scope = localScope(rootArg);
    const elements = new Set(queryIn(scope, selector));
    const ancestor = scope?.closest?.(selector);
    if (ancestor) elements.add(ancestor);
    for (const element of elements) translateECServerElement(element);
    for (const img of queryIn(scope, 'img[alt], img[title]')) translateECServerImage(img);
  }

  function trimECNode(node) {
    const raw = node.nodeValue;
    if (!raw?.trim()) return;
    const p = node.parentElement;
    if (p?.closest?.('#filter_server option')) return;
    if (p?.closest?.(EC_SKIP_SEL) || isECAuthoredContent(p) || isECInterviewByline(p)) return;
    // 装备名 / 卡片文本归物品链（zhApply*）处理：文本链避让，否则文本被抢先翻成
    // 中文后物品链会因「原文不再匹配」跳过，导致链接改写 / 包装 / 标记不生效
    if (p?.closest?.(EC_ITEM_SKIP_SEL)) return;
    if (ecWearableKind(globalThis.location?.pathname) && p?.closest?.(EC_WEARABLE_DETAIL_TITLE)) return;
    // Do not consume the native title with the generic dictionary before
    // the official Item data becomes available and the ready scan runs.
    if (p?.closest?.(EC_WEARABLE_LINK_TITLE) && p.closest(EC_WEARABLE_LINKS)) return;
    // Gearset H1 has split name/Set nodes: generic trEC would append 套装 to
    // known series BEFORE the dedicated structure-aware pass can inspect it.
    // Only the Gearsets title translator is allowed to touch this H1.
    if (/^\/(?:gearset|accessories)\/[^/]+\/?$/.test(globalThis.location?.pathname || '')
        && p?.closest?.('h1:not(.is-mega-menu-title)')) return;
    const next = trEC(raw);
    if (next !== raw) {
      // Keep the original for diagnostics, not as an untranslated English hover tooltip.
      if (p?.dataset && !p.hasAttribute?.('title')) p.dataset.zhixiaSourceText = raw.trim();
      node.nodeValue = next;
    }
  }

  let ecBusy = false; // NOSONAR — 页面扫描期间的重入保护状态


  const EC_WEARABLE_LINKS = 'a[href^="/facewear/"], a[href^="/fashion-accessory/"]';
  const EC_WEARABLE_DETAIL_TITLE = 'h1.title.has-negative-letter-spacing > span.has-text-primary';
  const EC_WEARABLE_LINK_TITLE = 'p.title.has-text-text, .media-content span.subtitle';

  function ecWearableKind(path) {
    return /^\/(facewear|fashion-accessory)\/[a-z\d-]+\/?$/u.exec(path || '')?.[1];
  }

  function ecWearableName(name, kind) {
    if (kind === 'facewear') {
      // Facewear names can exist only as official unlock manuals in V3 Item.
      const manualName = name === 'Monocle' ? 'Monocles' : name;
      const manual = tryEnToZh('The Faces We Wear - ' + manualName);
      if (manual?.startsWith('面部配饰：')) return manual.slice('面部配饰：'.length);
      return tryEnToZh(name);
    }
    return tryEnToZh(name) || DICT_EC[name];
  }

  function localizeECWearableTitle(title, kind) {
    const translation = ecWearableName(title.textContent.trim(), kind);
    if (translation) ecSetVisibleText(title, translation);
  }

  function translateECWearableNames(rootArg) {
    const scope = localScope(rootArg);
    for (const link of ecTitleRoots(scope, EC_WEARABLE_LINKS)) {
      const kind = ecWearableKind(link.getAttribute('href'));
      if (!kind) continue;
      for (const title of link.querySelectorAll(EC_WEARABLE_LINK_TITLE)) {
        localizeECWearableTitle(title, kind);
      }
    }

    const kind = ecWearableKind(globalThis.location?.pathname);
    if (!kind) return;
    for (const title of ecHomeCandidates(rootArg, EC_WEARABLE_DETAIL_TITLE)) localizeECWearableTitle(title, kind);
  }

  function ecWearableImageLabel(label, kind) {
    if (!label.endsWith(' Icon')) return ecWearableName(label, kind);
    const name = ecWearableName(label.slice(0, -5), kind);
    return name ? name + '图标' : null;
  }

  const EC_FACEWEAR_SWATCH = '.box.is-fake > .tag > span';
  const EC_FACEWEAR_SWATCH_IMAGE = '.box.is-fake > img.image[alt]';
  // Standalone EC swatch labels, not the names of FFXIV's color-specific
  // items (for example, the brass swatch is 铜色, not 铜框现代鼻眼镜).
  const EC_FACEWEAR_COLORS = new Map([
    ['Base', '默认色'], ['Black', '黑色'], ['Blue', '蓝色'], ['Brass', '铜色'],
    ['Brown', '棕色'], ['Gold', '金色'], ['Green', '绿色'], ['Grey', '灰色'],
    ['Purple', '紫色'], ['Red', '红色'], ['Silver', '银色'], ['White', '白色'],
  ]);
  const EC_WEARABLE_TOOLTIP_CONTENT = '.b-tooltip .tooltip-content';
  const EC_LOGIN_TO_LIKE = '登录后可点赞';
  const EC_WEARABLE_TOOLTIP_LABELS = new Map([
    ['Please login to love accessories', EC_LOGIN_TO_LIKE],
    ['Please login to bookmark accessories', '登录后可收藏'],
    ['Please login to mark accessories as owned', '登录后可标记为已拥有'],
  ]);

  const EC_GLAMOUR_LOGIN_LABELS = new Map([
    ['Please login to love glamours', EC_LOGIN_TO_LIKE],
    ['Please login to bookmark glamours', '登录后可收藏幻化'],
    ['You need to be logged in send love', EC_LOGIN_TO_LIKE],
    ['You need to be logged in to bookmark', '登录后可收藏幻化'],
  ]);
  // These look like item names in EC, but the default saddles are unlock
  // appearances, not inventory items. Their IDs and names come from BuddyEquip.
  const EC_STARTER_SADDLES = new Map([
    ['0', ['leather saddle', '皮革陆行鸟鞍']],
    ['1', ['lominsan saddle', '碧海陆行鸟鞍']],
    ['5', ['gridanian saddle', '密林陆行鸟鞍']],
    ['9', ["ul'dahn saddle", '黄沙陆行鸟鞍']],
  ]);

  function ecIsGlamourUIPage() {
    const path = globalThis.location?.pathname || '';
    return /^\/(?:glamours|companion-glamours)(?:\/|$)/u.test(path)
      || /^\/(?:glamour|companion-glamour)\/\d+(?:\/|$)/u.test(path);
  }

  function ecIsWearableUIPage() {
    const path = (globalThis.location?.pathname || '').replace(/\/$/u, '');
    return path === '/facewear' || path === '/fashion-accessories' || !!ecWearableKind(path);
  }

  function translateECFacewearSwatches(rootArg) {
    if (ecWearableKind(globalThis.location?.pathname) !== 'facewear') return;
    for (const swatch of ecHomeCandidates(rootArg, EC_FACEWEAR_SWATCH)) {
      const localized = EC_FACEWEAR_COLORS.get(swatch.textContent.trim());
      if (localized) ecSetVisibleText(swatch, localized);
    }
    for (const image of ecHomeCandidates(rootArg, EC_FACEWEAR_SWATCH_IMAGE)) {
      const label = image.getAttribute('alt');
      if (!label.endsWith(' Color Image')) continue;
      const localized = EC_FACEWEAR_COLORS.get(label.slice(0, -' Color Image'.length));
      if (localized) image.setAttribute('alt', localized + '预览');
    }
  }

  function ecLoginTooltipLabels() {
    if (ecIsWearableUIPage()) return EC_WEARABLE_TOOLTIP_LABELS;
    if (ecIsGlamourUIPage()) return EC_GLAMOUR_LOGIN_LABELS;
    return null;
  }

  function translateECLoginTooltips(rootArg) {
    const labels = ecLoginTooltipLabels();
    if (!labels) return;
    // Buefy renders the label prop as a text node in .tooltip-content.
    // Translate both the native custom element and its hydrated replacement.
    for (const tooltip of ecHomeCandidates(rootArg, 'b-tooltip[label]')) {
      const localized = labels.get(tooltip.getAttribute('label'));
      if (localized && !isECAuthoredContent(tooltip)) tooltip.setAttribute('label', localized);
    }
    for (const content of ecHomeCandidates(rootArg, EC_WEARABLE_TOOLTIP_CONTENT)) {
      const localized = labels.get(content.textContent.trim());
      if (localized && !isECAuthoredContent(content)) ecSetVisibleText(content, localized);
    }
  }

  function translateECGlamourDataTooltips(rootArg) {
    if (!ecIsGlamourUIPage()) return;
    const companion = globalThis.location?.pathname?.startsWith('/companion-glamour');
    for (const node of ecHomeCandidates(rootArg, '[data-tooltip]')) {
      if (isECAuthoredContent(node)) continue;
      const old = node.dataset.tooltip;
      let localized = EC_GLAMOUR_LOGIN_LABELS.get(old);
      // Only the color chip is built-in UI. The nearby creator tooltip is
      // authored identity, even when its contents resemble a color name.
      if (!localized && companion && node.querySelector('span[class*="has-text-dye-"]')) {
        localized = resolveDyeColor(old);
      }
      if (localized && localized !== old) node.dataset.tooltip = localized;
    }
  }

  function translateECStarterSaddle(row, href) {
    const id = /[?&](?:headPiece|bodyPiece|legsPiece)=(\d+)(?:&|$)/u.exec(href)?.[1];
    const saddle = EC_STARTER_SADDLES.get(id);
    if (!saddle) return;
    const [native, localized] = saddle;
    const title = row.querySelector('.list-item-content .list-item-title');
    if (title?.textContent.trim().toLowerCase() === native) ecSetVisibleText(title, localized);
    const image = row.querySelector('img.gear-icon-image[alt]');
    if (image?.getAttribute('alt').trim().toLowerCase() === native) image.setAttribute('alt', localized);
  }

  function translateECCompanionGear(rootArg) {
    if (!/^\/companion-glamour\/\d+(?:\/|$)/u.test(globalThis.location?.pathname || '')) return;
    for (const row of ecHomeCandidates(rootArg, '.list-item')) {
      const link = row.querySelector('.list-item-controls a[href^="/companion-glamours?"]');
      if (!link) continue;
      for (const label of link.querySelectorAll('span')) {
        if (label.textContent.trim() === 'Others using this piece') {
          ecSetVisibleText(label, '使用这件装甲的其他陆行鸟幻化');
        }
      }
      translateECStarterSaddle(row, link.getAttribute('href'));
    }
  }

  const EC_CREATOR_STATS = new Map([
    ['Albums', '相册'], ['Followers', '关注者'], ['Following', '正在关注'],
  ]);

  function translateECCreatorUI(rootArg) {
    const path = globalThis.location?.pathname || '';
    const page = /^\/creator\/\d+(?:\/(followers|following))?\/?$/u.exec(path);
    if (!page) return;
    for (const stat of ecHomeCandidates(rootArg, 'aside nav.level p.heading')) {
      const label = EC_CREATOR_STATS.get(stat.textContent.trim());
      if (label) ecSetVisibleText(stat, label);
    }
    if (!page[1]) return;
    const name = document.querySelector('aside h1.title.has-negative-letter-spacing')?.textContent.trim();
    if (!name) return;
    const followers = page[1] === 'followers';
    const source = followers ? 'Creators Following ' + name : 'Creators ' + name + ' Follows';
    const localized = followers ? name + '的关注者' : name + '关注的创作者';
    for (const heading of ecHomeCandidates(rootArg, '.column > h1.title.has-negative-letter-spacing')) {
      if (heading.textContent.trim() === source) ecSetVisibleText(heading, localized);
    }
  }

  // The homepage navigation is split across nodes; derive the label from its
  // *destination*, not a stale English menu caption. In particular, 7.0 is
  // 金曦之遗辉, not the previous 6.0 expansion 晓月之终途.
  const EC_EXPANSION_BY_PATCH = Object.freeze({
    '2.0': '重生之境', '3.0': '苍穹之禁城', '4.0': '红莲之狂潮',
    '5.0': '暗影之逆焰', '6.0': '晓月之终途', '7.0': '金曦之遗辉',
  });
  const EC_CONTENT_BY_ROUTE = Object.freeze({
    glamour: ['Crafted Glamour', '制作幻化'],
    raid: ['Raid Gear', '副本装备'],
    tomes: ['Tomestones Exchange', '神典石兑换'],
    pvp: ['PvP Gear', 'PvP 装备'],
    seasonal: ['Seasonal Event Gear', '季节活动装备', '商城套装'],
    mogstation: ['Mogstation Set', '商城套装'],
    job: ['Job Artifact Armor', '职业校服', '职业校服护甲'],
  });

  function ecContentNavLabel(content, label) {
    const entry = EC_CONTENT_BY_ROUTE[content];
    if (!Array.isArray(entry)) return null;
    const [native, zh, legacy] = entry;
    const compact = text => text.replace(/\s+/gu, '').toLowerCase();
    const key = compact(label);
    // Older builds could display the seasonal icon as 商城套装 or append 护甲
    // to the job label; only accept these known captions on the matching URL.
    return [native, zh, legacy].some(value => value && key === compact(value)) ? zh : null;
  }

  // Rewrite only visible text nodes: keep images, links and native handlers.
  function ecSetVisibleText(element, text) {
    if ((element.textContent || '').replace(/\s+/gu, ' ').trim() === text) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue?.trim()) nodes.push(walker.currentNode);
    }
    if (!nodes.length) return;
    const leading = nodes[0].nodeValue;
    nodes[0].nodeValue = leading.slice(0, leading.length - leading.trimStart().length) + text;
    for (const node of nodes.slice(1)) node.nodeValue = '';
  }

  function ecHomeCandidates(rootArg, selector) {
    const scope = localScope(rootArg);
    const nodes = new Set(queryIn(scope, selector));
    const ancestor = scope?.closest?.(selector);
    if (ancestor) nodes.add(ancestor);
    return nodes;
  }

  function translateECSplitHeading(rootArg, suffix, localizedSuffix, translateLead) {
    for (const bold of ecHomeCandidates(rootArg, 'h1.b-title-text > b.b-title-text-bold')) {
      const tail = bold.nextSibling;
      if (tail?.nodeType !== Node.TEXT_NODE || tail.nodeValue.trim() !== suffix) continue;
      const localizedLead = translateLead(bold.textContent.trim());
      if (!localizedLead) continue;
      // Keep the native distinction between the styled and unstyled parts.
      bold.textContent = localizedLead;
      tail.nodeValue = localizedSuffix;
    }
  }

  function translateECDyePreviewHeading(rootArg) {
    if (ecIsDyePreview()) {
      translateECSplitHeading(rootArg, 'Preview', '预览', lead => lead === 'Dyes' ? '染色' : null);
    }
  }

  function ecHomeGearsetNavLabel(a) {
    const href = a.getAttribute('href');
    if (!href) return null;
    let target;
    try {
      target = new URL(href, globalThis.location?.href || 'https://ffxiv.eorzeacollection.com/');
    } catch { return null; }
    if (target.hostname !== 'ffxiv.eorzeacollection.com' || target.pathname !== '/gearsets') return null;
    // The same query parameter also occurs in pagination and filter-result
    // URLs. Only recognize a single navigation parameter and its caption.
    if (target.searchParams.size !== 1) return null;
    const old = (a.textContent || '').replace(/\s+/gu, ' ').trim();
    const content = target.searchParams.get('content');
    if (content) return ecContentNavLabel(content, old);
    const patchName = EC_EXPANSION_BY_PATCH[target.searchParams.get('patch')];
    if (typeof patchName !== 'string') return null;
    // Preserve the separate "Current Expansion" browse link on the same URL.
    return /^(?:From [A-Za-z ]{3,45}|自[\u3400-\u9fff·]{2,20}起)$/u.test(old)
      ? '自' + patchName + '起' : null;
  }

  function translateECNavigation(rootArg) {
    // Header gearset links repeat on every EC page; only the editorial copy
    // translator below is homepage-specific.
    for (const anchor of ecHomeCandidates(rootArg, 'a[href*="/gearsets?"]')) {
      const localized = ecHomeGearsetNavLabel(anchor);
      if (!localized) continue;
      ecSetVisibleText(anchor, localized);
      // Menu image captions must describe their destination, not a reused
      // model icon caption (the Tomestones icon previously said Midlander).
      if (Object.values(EC_CONTENT_BY_ROUTE).some(([, zh]) => zh === localized)) {
        const image = anchor.querySelector('img[alt]');
        if (image?.getAttribute('alt') && image.getAttribute('alt') !== localized)
          image.setAttribute('alt', localized);
      }
    }
  }

  const EC_HOME_HEADINGS = new Set([
    'News and Articles', '— News and Articles —',
    'Latest Lodestone News', '— Latest Lodestone News —',
    'Latest Updates', '— Latest Updates —',
  ]);
  const EC_EDITORIAL_CHALLENGES = new Set([
    'Spooky Season', 'Verycold', 'Living Canvas',
    'Into the Void', 'Master of Beasts',
  ]);

  function ecChallengeTitle(text) {
    const match = /^([^\p{L}\p{N}]{0,12})([A-Za-z][A-Za-z '’-]{2,40})$/u.exec(text);
    if (!match || !EC_EDITORIAL_CHALLENGES.has(match[2])) return null;
    return match[1] + DICT_EC[match[2]];
  }

  const EC_CHALLENGE_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const EC_EDITORIAL_CARD = 'a:is([href^="/challenges/"],[href^="/interview/"],[href^="/year-in-review/"]) .card';
  const EC_INTERVIEW_TITLES = [
    ['We interviewed ', '专访：'],
    ['Community Interview - ', '社区访谈：'],
    ['Interview with the Creator - ', '创作者访谈：'],
  ];
  const EC_CENSUS_HEADINGS = new Map([
    ['GLAMOURS', '幻化投稿'], ['Number of glamours by', '幻化投稿数统计'],
    ['RACE', '种族'], ['GENDER', '性别'], ['ROLE', '职能'], ['DISCIPLE', '职业门类'],
    ['SERVER', '服务器'], ['CREATOR', '创作者'],
    ['Most used', '使用最多的'], ['COLORS', '染色'],
    ['HEAD PIECE', '头部装备'], ['CHEST PIECE', '身体装备'], ['HAND PIECE', '手部装备'],
    ['LEG PIECE', '腿部装备'], ['FEET PIECE', '脚部装备'], ['WEAPON', '武器'],
    ['FASHION ACCESSORY', '时尚配饰'], ['Most popular', '最受欢迎的'],
    ['GEARSETS', '装备套装'], ['CHOCOBO GLAMOURS', '陆行鸟幻化'],
    ['FASHION ASSISTANT', '时尚助手'], ['TAGS', '标签'],
    ['PROFILE COLORS', '个人主页配色'], ['PROFILE BACKGROUNDS', '个人主页背景'],
    ['NEW LINES OF CODE', '新增代码行数'], ['CHANGED FILES', '修改文件数'],
    ['NEW USERS REGISTERED', '新注册用户'], ['USERS BECAME PATRONS', '新增赞助用户'],
  ]);

  function ecIsNewsListing() {
    const path = globalThis.location?.pathname || '';
    return path === '/news' || path.startsWith('/news/');
  }

  function ecIsChallengeDetail() {
    return /^\/challenges\/[a-z0-9-]+\/?$/u.test(globalThis.location?.pathname || '');
  }

  function ecIsInterviewDetail() {
    return /^\/interview\/[a-z0-9-]+\/?$/u.test(globalThis.location?.pathname || '');
  }

  function isECInterviewByline(element) {
    return ecIsInterviewDetail() && !!element?.closest?.('.c-author-name, .c-author-image');
  }

  function ecCensusYear(path) {
    return /^\/year-in-review\/(\d{4})\/?$/u.exec(path || '')?.[1];
  }

  function ecInterviewTitle(label) {
    for (const [source, localized] of EC_INTERVIEW_TITLES) {
      if (label.startsWith(source) && label.length > source.length) return localized + label.slice(source.length);
    }
    return null;
  }

  function ecEditorialCardTitle(element, label) {
    if (!element.closest(EC_EDITORIAL_CARD)) return null;
    const href = element.closest('a[href]')?.getAttribute('href') || '';
    if (href.startsWith('/challenges/')) return ecChallengeTitle(label);
    if (href.startsWith('/interview/')) return ecInterviewTitle(label);
    const year = ecCensusYear(href);
    return year && label === year + ' in Review' ? year + ' 年度回顾' : null;
  }

  function ecChallengeMonthLabel(label) {
    const match = /^([A-Z][a-z]+)['’]s Glamour (Theme|Challenge)$/u.exec(label);
    if (!match) return null;
    const month = EC_CHALLENGE_MONTHS.indexOf(match[1]) + 1;
    if (!month) return null;
    return month + ' 月幻化' + (match[2] === 'Theme' ? '主题' : '挑战');
  }

  function ecChallengeTabTitle(part) {
    if (!ecIsChallengeDetail()) return null;
    const split = part.lastIndexOf(' - ');
    if (split < 0) return null;
    const title = ecChallengeTitle(part.slice(0, split));
    const monthLabel = ecChallengeMonthLabel(part.slice(split + 3));
    return title && monthLabel ? title + '：' + monthLabel : null;
  }

  function ecEditorialImageLabel(element, label) {
    if (globalThis.location?.pathname === '/') return ecChallengeTitle(label);
    if (ecIsNewsListing()) return ecEditorialCardTitle(element, label);
    const suffix = ' Glamour Challenge';
    if (ecIsChallengeDetail() && element.closest('.b-article-content') && label.endsWith(suffix)) {
      const title = ecChallengeTitle(label.slice(0, -suffix.length));
      if (title) return title + '幻化挑战';
    }
    return null;
  }

  function translateECEditorialCards(rootArg) {
    if (!ecIsNewsListing()) return;
    // Match only published editorial cards, never entries in a glamour grid.
    for (const title of ecHomeCandidates(rootArg, EC_EDITORIAL_CARD + ' .card-content .title')) {
      const localized = ecEditorialCardTitle(title, (title.textContent || '').trim());
      if (localized) ecSetVisibleText(title, localized);
    }
    for (const ribbon of ecHomeCandidates(rootArg, 'a[href^="/interview/"] .card .ribbon')) {
      if (ribbon.textContent.trim() === 'Interview') ecSetVisibleText(ribbon, '社区访谈');
    }
    for (const teaser of ecHomeCandidates(rootArg, 'a[href^="/year-in-review/"] .card-content .content')) {
      const year = ecCensusYear(teaser.closest('a[href]')?.getAttribute('href'));
      if (!year) continue;
      const original = 'Check out the ' + year + ' census to find out what were the hottest gear pieces, the most used colors and which server was the most glamourous, among other things!';
      if (teaser.textContent.replace(/\s+/gu, ' ').trim() === original) {
        ecSetVisibleText(teaser, '查看 ' + year + ' 年度统计，了解最热门的装备、最常用的染色，以及最爱幻化的服务器等。');
      }
    }
  }

  function translateECChallengeEditorial(rootArg) {
    if (!ecIsChallengeDetail()) return;
    translateECSplitHeading(rootArg, 'Challenge', '挑战', ecChallengeTitle);
    for (const subtitle of ecHomeCandidates(rootArg, 'h2.b-title-sub')) {
      const localized = ecChallengeMonthLabel((subtitle.textContent || '').trim());
      if (localized) ecSetVisibleText(subtitle, localized);
    }
  }

  function translateECInterviewHeading(rootArg) {
    if (!ecIsInterviewDetail()) return;
    for (const bold of ecHomeCandidates(rootArg, 'h1.b-title-text > b.b-title-text-bold')) {
      const lead = bold.previousSibling;
      if (lead?.nodeType !== Node.TEXT_NODE) continue;
      const source = lead.nodeValue.trim() + ' ' + bold.textContent.trim();
      if (source === 'Community Interview') {
        lead.nodeValue = '社区';
        bold.textContent = '访谈';
      } else if (source === 'Interview with the Creator') {
        lead.nodeValue = '';
        bold.textContent = '创作者访谈';
      }
    }
    for (const role of ecHomeCandidates(rootArg, '.c-author-label')) {
      if (role.textContent.trim() === '- The Creator -') ecSetVisibleText(role, '— 创作者 —');
    }
  }

  function ecCensusTitle(year) {
    return 'Eorzea Collection ' + year + ' 年度回顾';
  }

  function translateECCensusHeadings(rootArg) {
    const year = ecCensusYear(globalThis.location?.pathname);
    if (!year) return;
    // The brand already occupies a styled native span. Change only its suffix.
    for (const brand of ecHomeCandidates(rootArg, 'h1.title.has-negative-letter-spacing > span > span')) {
      const tail = brand.nextSibling;
      if (brand.textContent.trim() === 'Eorzea Collection'
          && tail?.nodeType === Node.TEXT_NODE && tail.nodeValue.trim() === 'in ' + year) {
        tail.nodeValue = ' ' + year + ' 年度回顾';
      }
    }
    for (const heading of ecHomeCandidates(rootArg, 'section h3.title, section h4.subtitle')) {
      const localized = EC_CENSUS_HEADINGS.get(heading.textContent.trim());
      if (localized) ecSetVisibleText(heading, localized);
    }
  }

  function ecHomeEditorialZh(source, tagName) {
    if (/^H[2-4]$/u.test(tagName)) {
      if (EC_HOME_HEADINGS.has(source)) {
        const exact = DICT_EC[source];
        if (exact) return exact;
        // The two latest-news section headings are generated as split
        // em-dash fragments and have only their undashed text in DICT_EC.
        const inner = source.slice(1, -1).trim();
        return DICT_EC[inner] ? '— ' + DICT_EC[inner] + ' —' : null;
      }
      return ecChallengeTitle(source);
    }
    if (tagName !== 'P') return null;
    // Only the site's official news/challenge/merchandise copy.
    if (!/^(?:Every month, our Patrons vote|The Eorzea Collection |Each design is available|products, including|Some are even based)/u.test(source)) return null;
    return DICT_EC[source] || null;
  }

  function translateECHomeEditorial(rootArg) {
    if ((globalThis.location?.pathname || '') !== '/') return;
    for (const element of ecHomeCandidates(rootArg, 'h2, h3, h4, p')) {
      if (element.closest?.(EC_SKIP_SEL) || isECAuthoredContent(element)) continue;
      if (element.querySelector?.('a, button, input, textarea')) continue;
      const source = (element.textContent || '').replace(/\s+/gu, ' ').trim();
      const zh = ecHomeEditorialZh(source, element.tagName);
      if (zh) ecSetVisibleText(element, zh);
    }
  }

  function ecGenericAltLabel(el, old) {
    if (old === 'male') return '男性';
    if (old === 'female') return '女性';
    const translated = ecEditorialImageLabel(el, old) || trEC(old);
    if (!old.endsWith(' image')) return translated;
    const name = old.slice(0, -6);
    const localized = ecGearsetDisplayName(name) || ecAccessoryDisplayName(name);
    return localized ? localized + '图片' : translated;
  }

  // Site hydration updates tooltips and accessibility labels after the initial scan.
  // Translate each current attribute value: sticky 'done' flags hide later updates.
  function _translateECAttr(el, attr) {
    if (el.closest?.(EC_SKIP_SEL) || isECAuthoredContent(el) || isECInterviewByline(el)) return;
    if (attr === 'title' && _zhixiaTitleKeep.has(el)) return;
    const old = el.getAttribute(attr);
    if (!old || old.length > 90) return;
    const kind = el.tagName === 'IMG' ? ecWearableKind(el.closest('a[href]')?.getAttribute('href')) : null;
    if (kind && (attr === 'alt' || attr === 'title')) {
      const label = ecWearableImageLabel(old, kind);
      if (label) el.setAttribute(attr, label);
      return;
    }
    const translated = attr === 'alt' ? ecGenericAltLabel(el, old) : trEC(old);
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
    if (isECAuthoredPath(globalThis.location?.pathname)) return;
    const old = document.title;
    const year = ecCensusYear(globalThis.location?.pathname);
    if (year && old === year + ' with EC') {
      document.title = ecCensusTitle(year);
      return;
    }
    if (!old?.includes(' | Eorzea Collection')) return;
    const parts = old.split(' | ');
    const kind = ecWearableKind(globalThis.location?.pathname);
    if (kind) {
      const localized = ecWearableName(parts[0], kind);
      if (localized) document.title = localized + ' | Eorzea Collection';
      return;
    }
    const isInterview = ecIsInterviewDetail();
    const translated = parts.map((part) => EC_UI_LABELS.get(part)
      || (isInterview && ecInterviewTitle(part)) || ecChallengeTabTitle(part)
      || ecAccessoryDisplayName(part) || ecGearsetDisplayName(part)
      || DICT_EC[part] || (part.startsWith('Latest Patch') ? trEC(part) : part)).join(' | ');
    if (translated !== old) document.title = translated;
  }

  function translateECPage(rootArg) {
    if (ecBusy) return;
    ecBusy = true;
    try {
      // A character-data / child-list mutation can supply a text node.
      // TreeWalker.nextNode() skips its root, so start at its parent instead.
      const root = localScope(rootArg) || document.body || document.documentElement;
      if (!root) return;
      translateECServers(rootArg);
      // Resolve full editorial sentences before individual text fragments.
      translateECHomeEditorial(rootArg);
      translateECEditorialCards(rootArg);
      translateECChallengeEditorial(rootArg);
      translateECInterviewHeading(rootArg);
      translateECCensusHeadings(rootArg);
      translateECWearableNames(rootArg);
      translateECFacewearSwatches(rootArg);
      translateECLoginTooltips(rootArg);
      translateECGlamourDataTooltips(rootArg);
      translateECCompanionGear(rootArg);
      translateECCreatorUI(rootArg);
      // Match complete navigation captions before translating their fragments.
      translateECNavigation(rootArg);
      translateECDyePreviewHeading(rootArg);
      _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
      const batch = snapshotTranslationNodes(root, (n) => {
        if (n.nodeType === 1) {
          if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
          // 选择器级剪枝：忽略区域整棵子树不再进入（v1.11.1，借 github-chinese FILTER_REJECT）
          if (n.closest?.(EC_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
          // 同 trimECNode：物品链管辖的子树（装备名 / 卡片）不在文本链处理
          if (n.closest?.(EC_ITEM_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      });
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

  // EC's Reset filters action should always return to an unfiltered view.
  // Some live-page layouts retain reactive filter state even when the native
  // handler receives the click. Allow the handler to run first, then fall
  // back to a clean reload only if it did not navigate itself.
  const EC_RESET_FILTER_LABEL = /^(?:reset filters|重置筛选|清空筛选)$/iu;
  const EC_RESET_SHORT_LABEL = /^(?:reset|重置)$/iu;
  // /glamours/head/27832 is itself a gear filter, not a permanent
  // category. Removing only ?query (or reloading this URL) re-applies
  // the same selected item. Canonical reset must leave the item route.
  const EC_GLAMOUR_ITEM_FILTER_PATH =
    /^\/glamours\/(?:weapon|head|body|hands|legs|feet|ear|ears|neck|wrist|ring)\/\d+\/?$/iu;

  function ecResetFiltersUrl(href) {
    const url = new URL(href);
    if (EC_GLAMOUR_ITEM_FILTER_PATH.test(url.pathname)) url.pathname = '/glamours';
    url.search = '';
    url.hash = '';
    return url.href;
  }

  function bindECResetFilters() {
    if (globalThis.__zhxECResetBound || !document?.addEventListener) return;
    globalThis.__zhxECResetBound = true;
    document.addEventListener('click', (event) => {
      // This existing test hook permits the offline EC fixture to exercise
      // the *same* reset path without accessing a live website.
      const path = globalThis.__zhxTestSite === 'ec'
        ? (globalThis.__zhxTestECResetPath || globalThis.location?.pathname || '')
        : (globalThis.location?.pathname || '');
      if (!/^\/(?:glamours|gearsets|accessories)(?:\/|$)/iu.test(path)) return;
      // Gearsets/Accessories display Reset as a plain text control in some
      // layouts, not necessarily a semantic <button> or an <a href>.
      const button = event.target?.closest?.('button, a, [role="button"]') || event.target;
      if (!button || button.disabled) return;
      const label = String(button.textContent || '').replace(/\s+/gu, ' ').trim();
      const shortReset = /^\/(?:gearsets|accessories)(?:\/|$)/iu.test(path)
        && EC_RESET_SHORT_LABEL.test(label);
      if (!EC_RESET_FILTER_LABEL.test(label) && !shortReset) return;

      const before = globalThis.location?.href;
      if (!before) return;
      const cleanUrl = ecResetFiltersUrl(before);
      // The site's own click handler still runs. If it does not navigate,
      // follow the canonical clean route; reloading an item-filter URL would
      // simply apply the unwanted filter all over again.
      setTimeout(() => {
        if (globalThis.location?.href !== before) return;
        if (cleanUrl !== before) globalThis.location.assign(cleanUrl);
        else globalThis.location.reload?.();
      }, 250);
    }, true);
  }

  function ecAcceptTranslationMutation(mutation) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-tooltip') return ecIsGlamourUIPage();
    if (mutation.type !== 'characterData' || ecIsDyePreview()) return true;
    const parent = mutation.target.parentElement;
    if (parent?.closest(EC_SERVER_TEXT_SEL + ', #filter_server option')) return true;
    return !!ecLoginTooltipLabels() && !!parent?.closest(EC_FACEWEAR_SWATCH + ', ' + EC_WEARABLE_TOOLTIP_CONTENT);
  }

  function startEC() {
    safe(bindECResetFilters, 'EC 重置筛选')();
    safe(translateECPage, 'EC 全扫')();
    safe(translateECTitle, 'EC 页面标题')();
    safe(bindECPieceTiles, 'EC 部位图')();
    createTranslationObserver({
      root: document.documentElement,
      debounce: 300,
      attributes: true,
      attributeFilter: ['title', 'alt', 'aria-label', 'placeholder', 'label', 'data-tooltip'],
      characterData: true,
      filter: ecAcceptTranslationMutation,
      handler: (nodes, textNodes) => {
        for (const n of [...nodes, ...textNodes]) {
          safe(translateECPage, 'EC 局部')(n);
          safe(bindECPieceTiles, 'EC 部位图')(n);
        }
        safe(translateECTitle, 'EC 页面标题')();
      },
    });
    // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
  }
