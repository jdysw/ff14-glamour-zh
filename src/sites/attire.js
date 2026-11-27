import { WIKI_ITEM } from '../core/constants.js';
import { resolveAllByName, resolveByHash, resolveDyeColor } from '../core/data/data-manager.js';
import { createTranslationObserver } from '../core/observer.js';
import { DICT, DICT_COMMON, lookupDutyName } from '../core/data/dictionary.js';

export { startAttire, translateAttirePage };

const UI = 'nav a,#globalMenuList a,#hamburgerMenuList a,#footerMenuList a,.a--spmenu-item-label,'
  + '#breadCrumb a,#jinrPostMeta .a--post-cat a,a[rel~="tag"],a[href^="/tag/"],a[href^="https://attire.jp/tag/"],.a--post-category,'
  + '#postContent :is(.a--richmenu-text,.a--h2rich-maincopy,.a--h2rich-subcopy,.c--tab-title,.rtoc-item a),'
  + '#postContent .c--tab-contents :is(h2,h3),#postContent .c--accordion-contents strong,#postContent .c--accordion-title,'
  + '#postContent #ws h5,body.home #postContent .has-text-align-center a,body:is(.page,.archive.tag,.archive.category) #jinrPostTitle,'
  + '#postContent .wp-block-heading,#postContent .wp-block-button__link,#postContent .a--post-category,'
  + '.widget-title,.widgettitle,.widget_nav_menu .menu a,.tag-cloud-link,.wp-block-tag-cloud a,.wp-block-categories a,.wp-block-archives a,'
  + '.jinr-widget-area .wp-block-heading,#snsShareLabel,#snsShareBottomInner .a--sns-label,#postContent .a--sns-label,.rtoc_open_close,.d--archive-subtitle,#postContent .a--accordion-title';
const ITEM_LINK = 'a[href*="/lodestone/playguide/db/item/"],a[data-zhx-attire-item]';
const ITEM = '#postContent :is(' + ITEM_LINK + ')';
const CARD = 'a.c--post-link[rel~="bookmark"],.o--postlist-item > a.c--post-link[href]';
const RECENT = '.widget_recent_entries a,.wp-block-latest-posts__post-title';
const LODESTONE_ITEM = /^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com\/lodestone\/playguide\/db\/item\/([0-9a-f]{11})\/?(?:\?patch=latest)?$/i;
const EXCLUDED = 'form textarea,input,[contenteditable],#comments,.comment-list';
const JOBS = new Set('ナイト 戦士 暗黒騎士 ガンブレイカー 竜騎士 リーパー モンク 侍 忍者 ヴァイパー 吟遊詩人 機工士 踊り子 黒魔道士 召喚士 赤魔道士 青魔道士 ピクトマンサー 魔獣使い 白魔道士 学者 占星術師 賢者 採掘師 園芸師 漁師 木工師 鍛冶師 甲冑師 彫金師 革細工師 裁縫師 錬金術師 調理師'.split(' '));
// Explicit catalogue routes from the site's weapon navigation. The title must
// also match the native job and weapon type; never infer an article's identity.
const WEAPON_PAGES = new Map([
  ['gladiator_s_arm', ['ナイト', '片手剣']],
  ['shield', ['ナイト', '盾']],
  ['marauder_s_arm', ['戦士', '両手斧']],
  ['dark_knight_s_arm', ['暗黒騎士', '両手剣']],
  ['gunbreaker_s_arm', ['ガンブレイカー', 'ガンブレード']],
  ['lancer_s_arm', ['竜騎士', '両手槍']],
  ['reaper_s_arm', ['リーパー', '両手鎌']],
  ['pugilist_s_arm', ['モンク', '格闘武器']],
  ['samurai_s_arm', ['侍', '刀']],
  ['rogue_s_arm', ['忍者', '双剣']],
  ['vpr', ['ヴァイパー', '二刀流武器']],
  ['archer_s_arm', ['吟遊詩人', '弓']],
  ['machinist_s_arm', ['機工士', '銃']],
  ['dancer_s_arm', ['踊り子', '投擲武器']],
  ['thaumaturge_s_arm', ['黒魔道士', '呪具']],
  ['arcanist_s_grimoire', ['召喚士', '魔道書']],
  ['rdm', ['赤魔道士', '細剣']],
  ['blue_mage_s_arm', ['青魔道士', '青魔器']],
  ['pictomancers-arm', ['ピクトマンサー', '筆']],
  ['conjurer_s_arm', ['白魔道士', '幻具']],
  ['scholar_s_arm', ['学者', '戦術魔道書']],
  ['astrologian_s_arm', ['占星術師', '天球儀']],
  ['sage_s_arm', ['賢者', '賢具']],
]);
const SITE_TITLE = '〖FF14 装備手帳〗｜ミラプリ用装備見た目まとめ';
const SITE_TITLES = [SITE_TITLE, SITE_TITLE.replace('〖', '【').replace('〗', '】')];
const breadcrumbTitles = new WeakMap();
const itemLinks = new WeakMap();
const itemTitles = new WeakMap();

function uniqueItemName(source) {
  const names = resolveAllByName(source);
  return names.length === 1 ? names[0] : null;
}

function replaceLabel(element, source, translation) {
  if (!element || !translation || source === translation || element.closest(EXCLUDED)) return false;
  const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    // Do not flatten icons, nested links, or split bilingual marketing copy.
    if (node.data.trim() !== source || node.parentElement?.closest(EXCLUDED + ',script,style')) continue;
    node.data = node.data.replace(source, () => translation);
    return true;
  }
  return false;
}

// Use the same exact currency aliases in cards, navigation and exchange
// sections. The historical guide dictionary also covers retired currencies.
function tomestoneName(source) {
  if (!/^アラガントームストーン[:：]\S+$/u.test(source)) return null;
  const native = source.replace('：', ':');
  return DICT['attire:' + native] || DICT_COMMON[native] || DICT['attire:tomestone-guide:' + native] || null;
}

function exactUiName(source) {
  return DICT['attire:' + source]
    || DICT['attire:event:' + source]
    || DICT['attire:pvp-group:' + source]
    || (Object.hasOwn(DICT_COMMON, source) ? DICT_COMMON[source] : null)
    || tomestoneName(source)
    || lookupDutyName(source);
}

function expansionRewardName(source) {
  const reward = /^(新生|蒼天|紅蓮|漆黒|暁月|黄金)クエスト[＆&]FATE等報酬品$/u.exec(source);
  if (reward) return exactUiName(reward[1] + '編') + '任务及危命任务等奖励';
  const artifact = /^(新生|蒼天|紅蓮|漆黒|暁月|黄金)アーティファクト$/u.exec(source);
  if (artifact) return exactUiName(artifact[1] + '編') + ' 职业专属装备';
  const craft = /^(新生|蒼天|紅蓮|漆黒|暁月|黄金)(ギャザラー|クラフター)AF$/u.exec(source);
  return craft ? exactUiName(craft[1] + '編') + ' ' + exactUiName(craft[2] + 'AF') : null;
}

function jobArtifactName(source) {
  // An AF heading must identify a job in the official job-name dictionary.
  if (source?.endsWith('AF')) {
    const native = source.slice(0, -2).trimEnd();
    const job = JOBS.has(native) && exactUiName(native);
    return job ? job + '职业专属装备' : null;
  }
  const parts = /(?<!\s)\s+artefact$/iu.exec(source);
  if (!parts) return null;
  const job = exactUiName(source.slice(0, parts.index));
  return job && [...JOBS].some(native => exactUiName(native) === job) ? job + '职业专属装备' : null;
}

function countedUiName(source) {
  const count = /\([\d,]+\)$/u.exec(source);
  if (!count) return null;
  const prefix = source.slice(0, count.index);
  const native = prefix.trimEnd();
  const name = exactUiName(native);
  return name ? name + prefix.slice(native.length) + count[0] : null;
}

function marketCatalogueName(source) {
  const market = /^マーケット購入可能[:：]\s*Lv\s*(\d{1,3})\s*[～〜~]\s*(?:Lv\s*)?(\d{1,3})\s*ギャザラー[＆&]クラフター装備$/iu.exec(source);
  if (!market || Number(market[1]) > Number(market[2])) return null;
  return '可在市场购买：' + market[1] + '～' + market[2] + '级采集与制作职业装备';
}

function levelCatalogueName(source) {
  const duty = /^Lv\s*(\d{1,3})\s*ID\s+(\S.*)$/iu.exec(source);
  const name = duty && (DICT['attire:' + duty[2]] || lookupDutyName(duty[2]));
  if (name) return duty[1] + '级副本 ' + name;
  // Every family stem must be verified before translating a category.
  const gear = /^Lv\s*(\d{1,3})\s+IL\s*(\d{1,4})\s+(\S.*)$/iu.exec(source);
  if (gear) {
    const families = gear[3].split('・').map(part => DICT['attire:gear-family:' + part.trim()]);
    if (families.every(Boolean)) return gear[1] + '级（品级' + gear[2] + '）' + families.join('、') + '装备';
  }
  const level = /^Lv\s*(\d{1,3})\s*[～〜~]$/iu.exec(source);
  return level ? level[1] + '级及以上' : null;
}

function uiName(source) {
  if (!source) return null;
  return exactUiName(source) || expansionRewardName(source) || jobArtifactName(source)
    || countedUiName(source) || marketCatalogueName(source) || levelCatalogueName(source);
}

// Derive a colour-neutral flower title only when two exact native item
// names independently yield the same Chinese base after removing the colour.
function flowerArticleName(source) {
  const red = uniqueItemName(source + ':レッド');
  const blue = uniqueItemName(source + ':ブルー');
  if (!red?.startsWith('红色') || !blue?.startsWith('蓝色')) return null;
  const base = red.slice(2);
  return base && base === blue.slice(2) ? base : null;
}

// Match only complete, verified weapon collection labels. Some cards and
// article headers differ only in whitespace before the collection suffix.
function weaponSeriesArticleName(source) {
  const stem = source.slice(0, -'武器一覧'.length).trimEnd().replace(/\s+/gu, ' ');
  return DICT['attire:' + source] || DICT['attire:' + stem + '武器一覧']
    || DICT['attire:' + stem + ' 武器一覧'] || null;
}

// These display titles are not individual item identities. Never use them for
// Wiki redirects or search conversion.
function groupArticleName(source) {
  if (!source || resolveAllByName(source).length) return null;
  const flower = flowerArticleName(source);
  if (flower) return flower;
  if (source.endsWith('武器一覧')) return weaponSeriesArticleName(source);
  if (source === 'トリテレイアイヤリング') return DICT['attire:' + source] || null;
  const matches = new Set();
  for (let i = source.indexOf('・'); i !== -1; i = source.indexOf('・', i + 1)) {
    const left = uniqueItemName(source.slice(0, i));
    const right = uniqueItemName(source.slice(i + 1));
    if (left && right) matches.add(left + '、' + right);
  }
  if (matches.size === 1) return [...matches][0];
  if (!matches.size && source === 'カシミヤポンチョ・ラミーポンチョ') return DICT['attire:' + source];
  return null;
}

function afSummaryName(source) {
  const match = /(?<!\s)\s+歴代AF\s+男女着用SSまとめ$/u.exec(source || '');
  if (!match?.index) return null;
  const native = source.slice(0, match.index);
  const job = jobName(native === '踊り子士' ? '踊り子' : native);
  return job ? job + '历代职业专属装备试穿图汇总' : null;
}

function eventName(source) {
  if (!source) return null;
  const text = source.replace(/[’']/gu, '').trim();
  const lookup = value => DICT['attire:event:' + value];
  const exact = lookup(text);
  if (exact) return exact;
  // The event catalogue has English + Japanese, and individual pages
  // use Japanese / English. Require both labels to identify the same event.
  for (let i = 1; i < text.length; i++) {
    const first = lookup(text.slice(0, i).trim().replace(/\/$/u, '').trim());
    if (first && first === lookup(text.slice(i).replace(/^\s*\/\s*/u, '').trim())) return first;
  }
  return null;
}

// Facewear articles append a display category to the actual item name.
// Keep it separate from canonical item identity (including Wiki redirects).
function facewearItemSource(source) {
  const suffix = /[（(]フェイスアクセサリー[）)]$/u.exec(source || '');
  return suffix ? source.slice(0, suffix.index).trimEnd() || null : null;
}

function facewearArticleName(source) {
  const native = facewearItemSource(source);
  const zh = native && uniqueItemName(native);
  return zh ? zh + '（' + uiName('フェイスアクセサリー') + '）' : null;
}

function tomestoneTitleName(source) {
  if (!source) return null;
  return DICT['attire:tomestone-title:' + source]
    || DICT['attire:tomestone-title:' + source.replaceAll('【', '〖').replaceAll('】', '〗')];
}

function articleName(source) {
  return tomestoneTitleName(source) || afSummaryName(source) || eventName(source) || uniqueItemName(source) || facewearArticleName(source) || groupArticleName(source);
}

function localizeCard(card) {
  if (card.closest(EXCLUDED) || card.origin !== location.origin) return;
  const category = card.querySelector('.a--post-category');
  const heading = card.querySelector('.a--post-title');
  const source = heading?.textContent.trim();
  // Some JIN:R list templates omit the category slug class and bookmark
  // relation. The explicit glamour category/title still protects creator text.
  const categoryLabel = category?.textContent.trim();
  if (!categoryLabel || category.classList.contains('category-glamour')
    || ['ミラプリ', '幻化'].includes(categoryLabel) || !source
    || /^(?:ミラプリ|幻化)\s*[:：]/u.test(source)) return;
  const exact = articleName(source);
  if (exact) replaceLabel(heading, source, exact);
  // Card images often repeat their heading in alt. Only replace that
  // verified label, including on a later pass after the heading was localized.
  const current = heading.textContent.trim();
  for (const image of card.querySelectorAll('img[alt]')) {
    const alt = image.getAttribute('alt').trim();
    // An independently verified exact item name is also safe when the
    // thumbnail depicts a different piece from the article heading.
    const zh = uniqueItemName(alt) || ((alt === source || articleName(alt) === current) && articleName(alt));
    if (zh && alt !== zh) image.setAttribute('alt', zh);
  }
}

function translateRecentPosts() {
  for (const link of document.querySelectorAll(RECENT)) {
    if (link.closest(EXCLUDED) || link.origin !== location.origin) continue;
    const source = link.textContent.trim();
    // The native recent-post list has no category badge. Keep player titles
    // (including their site's glamour prefix) rather than guessing by name.
    if (/^ミラプリ\s*[:：]/u.test(source)) continue;
    replaceLabel(link, source, articleName(source));
  }
}

function hasCategory(name) {
  return [...document.querySelectorAll('#jinrPostMeta .a--post-cat a')]
    .some(link => link.origin === location.origin && link.pathname.split('/').includes(name)
      && link.pathname.startsWith('/category/'));
}

function jobName(source) {
  return JOBS.has(source) ? uiName(source) : null;
}

function dyeName(source) {
  const label = ['染色不可', '無染色', '染色◯', '染色○', '染色×', '染色✕'].includes(source) && uiName(source);
  if (label) return label;
  const single = resolveDyeColor(source);
  if (single) return single;
  const colors = source.split(/[・／/]/u).map(part => resolveDyeColor(part.trim()));
  return colors.length > 1 && colors.every(Boolean) ? colors.join('／') : null;
}

// The native rich cards can concatenate job/dye and item labels with no spaces.
// Require both the prefix and complete item suffix to resolve; never guess by substring.
function compositeName(source, prefixName) {
  if (source.length > 180) return null;
  const matches = new Set();
  for (let i = 1; i < source.length; i++) {
    const prefix = prefixName(source.slice(0, i).trim());
    if (!prefix) continue;
    const item = uniqueItemName(source.slice(i).trim());
    if (item) matches.add(prefix + ' ' + item);
  }
  return matches.size === 1 ? [...matches][0] : null;
}

function localizeCompositeLink(link, prefixName) {
  const source = link.textContent.trim();
  const localized = compositeName(source, prefixName);
  if (!localized) return;
  if (replaceLabel(link, source, localized)) return;
  const walk = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
  const replacements = [];
  let node;
  while ((node = walk.nextNode())) {
    const part = node.data.trim();
    if (!part) continue;
    if (node.parentElement?.closest(EXCLUDED + ',script,style')) return;
    if (/^[・／/]+$/u.test(part)) continue;
    const zh = prefixName(part) || uniqueItemName(part) || compositeName(part, prefixName);
    if (!zh) return;
    replacements.push([node, part, zh]);
  }
  for (const [text, part, zh] of replacements) {
    if (part !== zh) text.data = text.data.replace(part, () => zh);
  }
}

function weaponPageAt(pathname) {
  return WEAPON_PAGES.get(pathname.replace(/^\/|\/$/gu, ''));
}

function weaponCatalogueName(source, page) {
  if (!source || !page) return null;
  const [job, type] = page;
  const normalized = source.replace(/\s+/gu, '').replaceAll('【', '〖').replaceAll('】', '〗');
  const native = '〖' + job + '〗' + type;
  if (![native + '一覧', native, type + '一覧', type].includes(normalized)) return null;
  const jobZh = jobName(job);
  const typeZh = DICT['attire:weapon-type:' + type];
  return jobZh && typeZh ? '【' + jobZh + '】' + typeZh + '一览' : null;
}

function translateWeaponCatalogue(title, page) {
  if (!page) return;
  const source = title?.textContent.trim();
  replaceLabel(title, source, weaponCatalogueName(source, page));
  for (const heading of document.querySelectorAll('#postContent :is(h1,h2,h3,h4,h5,h6)')) {
    const text = heading.textContent.trim();
    const levels = /^Lv\s*(\d{1,3})(?:\s*[～〜~]\s*Lv\s*(\d{1,3}))?$/u.exec(text);
    if (!levels) continue;
    const first = Number(levels[1]);
    const last = Number(levels[2] ?? levels[1]);
    const label = first === last ? String(first) : Math.min(first, last) + '～' + Math.max(first, last);
    replaceLabel(heading, text, label + '级');
  }
  // A few weapon entries have an image and caption but no item text link.
  for (const caption of document.querySelectorAll('#postContent figcaption')) {
    if (caption.closest(ITEM_LINK) || caption.querySelector(ITEM_LINK)) continue;
    const text = caption.textContent.trim();
    replaceLabel(caption, text, uniqueItemName(text));
  }
}

function afSetName(source) {
  // Some AF links omit the English label after '/', and newer jobs
  // have a separate starting-equipment entry rather than an expansion.
  const match = /^(?:(新生|蒼天|紅蓮|漆黒|暁月|黄金)AF|ジョブ取得時にもらえる装備品)([^/]+)\/.*$/u.exec(source);
  if (!match) return null;
  const set = catalogueSetName(match[2].trim());
  const label = exactUiName(match[1] ? match[1] + '編' : 'ジョブ取得時にもらえる装備品');
  return set && label ? label + ' ' + set : null;
}

function catalogueSetName(source) {
  const known = DICT['attire:set:' + source];
  if (known) return known;
  // Exact outfit-glamour items also use アーマー and 装束 for combat AF.
  // Keep official names ending in 装束; do not append another suffix.
  const suffixes = ['・アタイア', 'アタイア', '・アーマー', 'アーマー', '装束'];
  const names = new Set(suffixes.flatMap(suffix => resolveAllByName(source + suffix)));
  if (names.size !== 1) return null;
  const name = [...names][0];
  return /(?:套装|装束)$/u.test(name) ? name : null;
}

const MOG_REWARDS = new Set([
  '鯰尾耳飾','豆柴耳飾','鯰尾前掛','豆柴首巻','サーペントリング','イフリートジャンパー',
  'デモンズブロックイヤリング','ポークシーイヤリング','ファットキャットパラソル',
  'カーバンクル・エメラルドイヤリング','ドーナツピアス','パイッサイヤリング',
  'コーヒーカップピアス','ボーズピアス',
]);

function mogRewardName(source) {
  return MOG_REWARDS.has(source) ? uniqueItemName(source) || DICT['attire:mog:' + source] : null;
}

function mogLabel(source) {
  const exact = DICT['attire:mog:' + source];
  if (exact) return exact;
  const reward = mogRewardName(source);
  if (reward) return reward;
  const pair = /^(\S+)\s+(\S.*)$/u.exec(source);
  if (!pair) return null;
  const currency = DICT['attire:mog:' + pair[1]];
  const item = mogRewardName(pair[2]);
  return currency && item ? currency + ' ' + item : null;
}

function translateMogLabels() {
  const content = document.querySelector('#postContent');
  if (!content) return;
  const walk = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    if (node.parentElement?.closest(EXCLUDED + ',script,style,' + ITEM_LINK)) continue;
    const source = node.data.trim();
    const zh = mogLabel(source) || DICT['attire:seasonal-note:' + source];
    if (zh && source !== zh) node.data = node.data.replace(source, () => zh);
  }
}

function sourceCatalogueName(source, kind) {
  if (kind === 'af') return afSetName(source) || uiName(source);
  if (kind === 'seasonal') return eventName(source) || uiName(source);
  return (kind === 'hand-land' ? catalogueSetName(source) : DICT['attire:set:' + source]) || uiName(source);
}

// Historical tomestone guides use exact headings and structured exchange
// labels, not arbitrary prose. Preserve quantities, markup and all links.
function huntVendorName(source) {
  if (['ジャ・ラクシャイ','ウィルメッタ','サイル','イルフロイ','ユールモア'].includes(source)) {
    return DICT['attire:exchange:' + source];
  }
  if (['クリスタリウム','モーエン商会の商人'].includes(source)) return DICT['attire:weapon-meta:' + source];
  if (['オールド・シャーレアン','ラザハン'].includes(source)) return DICT['attire:tomestone-guide:' + source];
  return null;
}

function tomestoneGuideLabel(source) {
  const lookup = value => DICT['attire:tomestone-guide:' + value];
  const exact = lookup(source) || huntVendorName(source);
  if (exact) return exact;
  const quoted = /^「([^」]+)」$/u.exec(source);
  const vendor = quoted && huntVendorName(quoted[1]);
  if (vendor) return '「' + vendor + '」';
  // The historical headings vary only in optional whitespace before the
  // version parenthesis; the underlying date and patch must remain intact.
  const hunt = /^(同盟記章|セントリオ記章|モブハントの戦利品)入手方法\s*（2024年パッチ6\.x現在）$/u.exec(source);
  if (hunt) return lookup(hunt[1] + '入手方法　（2024年パッチ6.x現在）');
  return null;
}

function translateTomestoneGuide(title, nativeTitle) {
  if (hasCategory('glamour') || !hasCategory('tomestone')) return;
  replaceLabel(title, nativeTitle, tomestoneTitleName(nativeTitle));
  const content = document.querySelector('#postContent');
  if (!content) return;
  const selector = 'h1,h2,h3,h4,h5,h6,th,td,dt,dd,strong,li,.wp-block-columns p,.rtoc-item a,.a--h2rich-maincopy,.a--h2rich-subcopy';
  const walk = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest(EXCLUDED + ',script,style,svg,' + ITEM_LINK)) continue;
    const source = node.data.trim();
    if (!source) continue;
    if (!isTomestoneGuideNode(parent, selector, source)) continue;
    const zh = tomestoneGuideLabel(source);
    if (zh && zh !== source) node.data = node.data.replace(source, () => zh);
  }
}

function isTomestoneGuideNode(parent, selector, source) {
  const link = parent.closest('a[href]');
  if (link && link.origin !== location.origin) return false;
  // Ordinary paragraphs only contain a handful of standalone guide labels.
  return parent.closest(selector) || (parent.closest('p') && isTomestoneGuideLabel(source));
}

function isTomestoneGuideLabel(source) {
  return /^(?:Sモブ|Aモブ|リスキーモブ手配書|モブ手配書|指定された対象Bモブ100（週1回 毎週更新）|対象モンスター8\/対象FATE20（毎日更新）|強化方法|強化したいアイテム＋対応する強化用アイテム|ラールガーズリーチ|クガネ|イシュガルド下層 エーテライト付近|Allagan tomestone of [A-Za-z]+)$/u.test(source)
    || !!huntVendorName(source) || (source.startsWith('「') && !!tomestoneGuideLabel(source));
}

// The six expansion catalogues share the same rich headings, with English
// secondary labels. Keep these route-specific to avoid touching author prose.
const EXPANSION_CATALOGUES = new Set(['/a-realm-reborn','/heavensward','/stormblood','/shadowbringers','/endwalker','/dawntrail']);

function expansionSectionName(source, path) {
  const exact = DICT['attire:expansion:' + source];
  if (exact) return exact;
  const level = /^(?:レベル(50|60|70|80|90|100)ID装備|Lv\s*(50|60|70|80|90|100)\s+Dungeons)$/iu.exec(source);
  if (level) return (level[1] || level[2]) + '级副本装备';
  if (/^F\.A\.T\.E\.?\s*[&＆]\s*(?:Quest|クエスト報酬(?:など|等))$/iu.test(source)) return '危命任务及任务等奖励';
  if (source === 'Trials') return DICT['attire:expansion:討伐・討滅戦武器' + (path === '/a-realm-reborn' ? '＆装備' : '')];
  return uiName(source);
}

function translateExpansionCatalogue() {
  const path = location.pathname.replace(/\/$/u, '');
  if (!EXPANSION_CATALOGUES.has(path) || hasCategory('glamour')) return;
  for (const heading of document.querySelectorAll('#postContent :is(h2,h3,h4,h5,h6,.a--h2rich-maincopy,.a--h2rich-subcopy,.c--tab-title,.rtoc-item a)')) {
    if (heading.closest(EXCLUDED + ',' + CARD + ',' + ITEM_LINK) || heading.querySelector(ITEM_LINK)) continue;
    const source = heading.textContent.trim();
    replaceLabel(heading, source, expansionSectionName(source, path));
  }
}

// Translate only exact catalogue captions and verified item names, not
// arbitrary editor-written image descriptions or player glamour artwork.
function equipmentImageName(img, source, weaponDetail, expansion) {
  const blogcard = img.closest('a.o--blogcard-link');
  if (blogcard?.origin === location.origin) return articleName(source);
  if (!img.closest('figure') || !(weaponDetail || expansion)) return null;
  const exact = uniqueItemName(source);
  if (exact || !expansion) return exact;
  const duty = /(?<!\s)\s+武器一覧$/u.exec(source);
  const native = duty?.index ? source.slice(0, duty.index) : null;
  const name = native && (DICT['attire:weapon-meta:' + native] || lookupDutyName(native));
  return articleName(source) || (name && name + ' 武器一览') || exactUiName(source);
}

function translateEquipmentImageLabels(weaponDetail) {
  if (hasCategory('glamour')) return;
  const path = location.pathname.replace(/\/$/u, '');
  const expansion = EXPANSION_CATALOGUES.has(path);
  for (const img of document.querySelectorAll('#postContent img[alt]')) {
    if (img.closest(EXCLUDED + ',' + CARD + ',' + ITEM_LINK)) continue;
    const source = img.getAttribute('alt').trim();
    if (!source) continue;
    const zh = equipmentImageName(img, source, weaponDetail, expansion);
    if (zh && zh !== source) img.setAttribute('alt', zh);
  }
}

const SOURCE_CATALOGUES = new Map([
  ['/hand-land', 'hand-land'], ['/pvp', 'pvp'], ['/s-g', 'seasonal'], ['/gc', 'gc'],
]);

function translateSourceCatalogue(title, nativeTitle) {
  const path = location.pathname.replace(/\/$/u, '');
  const afTitle = afSummaryName(nativeTitle);
  const kind = SOURCE_CATALOGUES.get(path) || (afTitle || hasCategory('af-nyuusyu') ? 'af' : null);
  // Event names and AF index titles are display labels, not item identities.
  const titleZh = afTitle || eventName(nativeTitle);
  if (!hasCategory('glamour')) replaceLabel(title, nativeTitle, titleZh);
  if (!kind) return;
  if (kind === 'seasonal') translateMogLabels();
  const current = title?.textContent.trim();
  replaceLabel(title, current, uiName(current));
  const selector = '#postContent :is(h2,h3,h4,h5,h6,.c--tab-title,.a--richmenu-text,.a--h2rich-maincopy,.a--h2rich-subcopy,.rtoc-item a,a[href])';
  for (const element of document.querySelectorAll(selector)) {
    if (element.closest(EXCLUDED + ',' + ITEM_LINK + ',' + CARD) || element.querySelector(ITEM_LINK)) continue;
    if (element.matches('a[href]') && element.origin !== location.origin && kind !== 'gc') continue;
    const source = element.textContent.trim();
    const zh = sourceCatalogueName(source, kind);
    if (replaceLabel(element, source, zh) || kind !== 'seasonal' || !eventName(source)) continue;
    // Keep the two nested DOM nodes and their links/icons, removing only
    // the repeated translated event label.
    dedupeSeasonalEvent(element, zh);
  }
}

function labelTextNodes(element, excluded) {
  const nodes = [];
  const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    if (node.data.trim() && !(excluded && node.parentElement?.closest(excluded))) nodes.push(node);
  }
  return nodes;
}

function dedupeSeasonalEvent(element, zh) {
  const nodes = labelTextNodes(element);
  if (nodes.length !== 2 || !nodes.every(node => eventName(node.data.trim()) === zh)) return;
  nodes[0].data = nodes[0].data.replace(nodes[0].data.trim(), () => zh);
  nodes[1].data = '';
}

// Historical seasonal reward links contain a year, event copy and an item
// name. Keep the year, copy, DOM and destination; translate only the exact
// final item name. A single text node may contain all three parts.
function translateSeasonalRewardLinks() {
  if (!hasCategory('seasonal-event-all') || hasCategory('glamour')) return;
  for (const link of document.querySelectorAll('#postContent a[href]')) {
    if (link.closest(EXCLUDED + ',' + ITEM_LINK + ',' + CARD) || link.origin !== location.origin) continue;
    if (!/^\d{4}年/u.test(link.textContent.trim())) continue;
    const last = labelTextNodes(link, EXCLUDED + ',script,style,svg').at(-1);
    const text = last?.data.trim();
    if (!text || text.length > 300) continue;
    const zh = seasonalRewardName(text);
    if (zh) last.data = last.data.replace(text, () => zh);
  }
}

function seasonalRewardName(text) {
  const exact = uniqueItemName(text);
  if (exact) return exact;
  const matches = new Map();
  for (const space of text.matchAll(/\s+/gu)) {
    const suffix = text.slice(space.index + space[0].length);
    const zh = uniqueItemName(suffix);
    if (zh) matches.set(suffix, zh);
  }
  if (matches.size !== 1) return null;
  const [suffix, zh] = [...matches][0];
  return text.slice(0, -suffix.length) + zh;
}

// Only translate verified treasure-map/area combinations. The site sometimes
// uses quotes, a full-width colon or no separator in front of the area name.
function treasureSourceName(source) {
  const coffer = 'ドリーム・オブ・ウェポンチェスト';
  if (source === coffer) {
    const zh = DICT['attire:source:' + coffer];
    const names = resolveAllByName(source);
    return !names.length || names.includes(zh) ? zh : null;
  }
  const mapOnly = /^宝の地図\s*G(17|18)$/u.exec(source);
  if (mapOnly) return 'G' + mapOnly[1] + '藏宝图';
  const match = /^(?:宝の地図\s*G(17|18)\s*)?「?宝物庫\s*(?:[:：]\s*)?(セノーテ・ジャジャグラル|ボルト・オネイロン)」?$/u.exec(source);
  if (!match) return null;
  const grade = match[2] === 'セノーテ・ジャジャグラル' ? '17' : '18';
  if (match[1] && match[1] !== grade) return null;
  const zh = DICT['attire:source:' + match[2]];
  return zh && (match[1] ? 'G' + grade + '藏宝图：' : '') + zh;
}

function weaponDetailName(source) {
  const level = /^Lv\s*(\d{1,3})\s+ILv?\s*(\d{1,4})$/iu.exec(source);
  if (level) return '等级 ' + level[1] + '／品级 ' + level[2];
  // Exact acquisition labels and known official terminology only.
  const known = DICT['attire:weapon-meta:' + source] || treasureSourceName(source);
  if (known) return known;
  if (source === 'マーケット取引可能' || source === 'その他') return uiName(source);
  if (['入手方法', '取引に必要なアイテム', '販売ショップNPC', '染色', 'Eorzea Database'].includes(source)) {
    return uiName(source);
  }
  // Reuse canonical item names for other coffer and token variants. Never
  // infer a translated name from a weapon prefix or change link identity.
  if (/(?:ウェポンチェスト〖ILv\d{1,4}〗|のトーテム像(?:〖[^〗]+〗)?)$/u.test(source)) {
    return uniqueItemName(source);
  }
  return null;
}

function translateWeaponDetailMetadata() {
  // Only the native weapon-detail route uses these short, otherwise ambiguous
  // labels. Never translate arbitrary prose or change an official item anchor.
  const selector = '#postContent :is(h2,h3,h4,p,span,strong,dt,dd,th,td,a[href],.rtoc-item a,.a--h2rich-maincopy,.a--h2rich-subcopy)';
  for (const element of document.querySelectorAll(selector)) {
    if (element.closest(EXCLUDED + ',' + ITEM_LINK) || element.querySelector(ITEM_LINK)) continue;
    const link = element.closest('a[href]');
    if (link && link.origin !== location.origin
        && !/^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com$/i.test(link.origin)) continue;
    const source = element.textContent.trim();
    if (replaceLabel(element, source, weaponDetailName(source))) continue;
    // Effects and NPC/location pairs are often separated by a line break.
    // Only translate a block when every nonblank line is independently known
    // (or a numeric quantity); preserve the existing markup and line breaks.
    if (element.querySelector('br')) translateWeaponDetailLines(element);
  }
}

function translateWeaponDetailLines(element) {
  const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const replacements = [];
  let node;
  while ((node = walk.nextNode())) {
    const part = node.data.trim();
    if (!part) continue;
    if (node.parentElement?.closest(EXCLUDED + ',script,style,svg,' + ITEM_LINK)) return;
    const zh = weaponDetailName(part);
    if (!zh && !/^\d+$/u.test(part)) return;
    if (zh && zh !== part) replacements.push([node, part, zh]);
  }
  for (const [text, part, zh] of replacements) text.data = text.data.replace(part, () => zh);
}

function translateStructuredItems(weaponPage, weaponDetail) {
  const glamour = hasCategory('glamour');
  const weapons = hasCategory('seriesb') || /weapon-coffer/i.test(location.pathname);
  const catalogue = document.body.matches('.page') || weapons || !!weaponPage;
  const title = document.querySelector('#jinrPostTitle');
  const detail = !glamour && !!(title?.dataset.zhxAttireNative || articleName(title?.textContent.trim()));
  for (const link of document.querySelectorAll('#postContent a[href]')) {
    if (link.closest(EXCLUDED + ',' + CARD) || link.origin !== location.origin) continue;
    if (glamour) {
      localizeCompositeLink(link, dyeName);
      continue;
    }
    if (!catalogue && !detail && !weaponDetail) continue;
    const source = link.textContent.trim();
    const zh = weaponCatalogueName(source, weaponPageAt(link.pathname)) || articleName(source);
    if (zh) replaceLabel(link, source, zh);
    else if (weapons) localizeCompositeLink(link, jobName);
  }
  translateOfficialDutyLinks();
  // Keep Lodestone item links untouched until the identity-aware pass below.
  if (glamour) translateGlamourTable();
}

function translateOfficialDutyLinks() {
  for (const link of document.querySelectorAll('#postContent a[href*="/lodestone/playguide/db/duty/"]')) {
    if (link.closest(EXCLUDED) || !/^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com$/i.test(link.origin)) continue;
    const source = link.textContent.trim();
    replaceLabel(link, source, lookupDutyName(source));
  }
}

function translateGlamourTable() {
  for (const cell of document.querySelectorAll('#postContent .wp-block-table :is(td,th)')) {
    if (cell.closest(EXCLUDED)) continue;
    const walk = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      if (node.parentElement?.closest(EXCLUDED + ',script,style,a[href]')) continue;
      const source = node.data.trim();
      const zh = uiName(source) || uniqueItemName(source) || dyeName(source);
      if (zh && zh !== source) node.data = node.data.replace(source, () => zh);
    }
  }
}

// The same native exchange block is used on weapon and armor pages.
const GC_SOURCES = ['黒渦団', '双蛇党', '不滅隊'];

function exchangeText(region) {
  const nodes = [];
  const labels = new Set();
  const walk = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest(EXCLUDED + ',script,style,svg,' + ITEM_LINK + ',' + CARD)) continue;
    if (!isExchangeLink(parent.closest('a[href]'))) continue;
    const lines = node.data.split(/(\r?\n)/u);
    for (const line of lines) {
      const label = line.trim();
      if (label) labels.add(label);
    }
    nodes.push([node, lines]);
  }
  return { nodes, labels };
}

function isExchangeLink(link) {
  return !link || link.origin === location.origin
    || (/^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com$/i.test(link.origin)
      && /^\/lodestone\/playguide\/db\/shop\/[0-9a-f]{11}\/?$/i.test(link.pathname));
}

function translateGrandCompanyMetadata() {
  const content = document.querySelector('#postContent');
  if (!content) return;
  const lookup = key => DICT['attire:gc:' + key];
  const heading = '交換に必要な軍票・階級';
  const { nodes, labels: sources } = exchangeText(content);
  // Require both the exchange heading and a single identified faction.
  // A currency amount or a rank in an unrelated article is not sufficient.
  if (!sources.has(heading) && !sources.has(lookup(heading))) return;
  const matches = GC_SOURCES.filter(faction =>
    sources.has(faction + '軍票') || sources.has(lookup(faction + ':currency')));
  if (matches.length !== 1) return;
  const faction = matches[0];
  for (const [text, lines] of nodes) {
    const translated = lines.map(line => {
      const source = line.trim();
      if (!source) return line;
      let zh;
      if (source === heading) zh = lookup(heading);
      else if (source === faction + '軍票') zh = lookup(faction + ':currency');
      else if (source === '補給担当官') zh = lookup(faction + ':vendor');
      else zh = lookup(faction + ':' + source);
      return zh && source !== zh ? line.replace(source, () => zh) : line;
    }).join('');
    if (translated !== text.data) text.data = translated;
  }
}

function equipmentMetadata(source) {
  const blocked = /^([頭胴手脚足])装備不可$/u.exec(source);
  if (blocked) {
    const slots = { 頭: '头部', 胴: '身体', 手: '手部', 脚: '腿部', 足: '脚部' };
    return '不可装备' + slots[blocked[1]] + '防具';
  }
  const market = /^マーケット取引\s*[:：]\s*([◯○×✕])$/u.exec(source);
  if (market) return /[◯○]/u.test(market[1]) ? '可在市场交易' : '不可在市场交易';
  if (/^染色[◯○]\s*[（(]条件あり[）)]$/u.test(source)) return uiName('染色◯（条件あり）');
  if (/^染色(?:不可|[◯○×✕])?$/u.test(source) || source === 'マーケット取引可能'
      || /^(?:ギャザラー|クラフター)スクリップ:[白紫橙]貨$/u.test(source)
      || ['女性専用装備','男性専用装備','Fall Guys コラボレーションイベント',
        '現在は終了しているイベントのため入手できません'].includes(source)) return uiName(source);
  const match = /^Lv\s*(\d{1,3})(?:\s*[～〜~]\s*(?:Lv\s*)?(\d{1,3}))?\s*(\S.*)$/iu.exec(source);
  if (!match || (match[2] && Number(match[1]) > Number(match[2]))) return null;
  const jobs = /^(?:All Jobs?|AllJobs)$/i.test(match[3])
    ? ['全职业'] : match[3].split(/\s+/u).map(jobName);
  if (!jobs.length || !jobs.every(Boolean)) return null;
  const levels = match[2] ? match[1] + '～' + match[2] : match[1];
  return levels + '级 ' + jobs.join('／');
}

function translateAcquisitionLinks() {
  for (const link of document.querySelectorAll('#postContent a[href*="/lodestone/special/"],#postContent a[href*="/ffxivstore/"]')) {
    if (link.closest(EXCLUDED)) continue;
    const source = link.textContent.trim();
    if (link.origin === 'https://store.finalfantasyxiv.com' && /^\/ffxivstore\/[^/]+\/product\/\d+\/?$/u.test(link.pathname)) {
      replaceLabel(link, source, uniqueItemName(source));
    } else if (/^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com$/i.test(link.origin)
        && link.pathname.startsWith('/lodestone/special/')) {
      const zh = eventName(source) || (source.startsWith('モグモグ★コレクション') && uiName(source));
      replaceLabel(link, source, zh);
    }
  }
}

// Each quest hash is checked against its native title before translation.
const AF_QUESTS = new Map([
  ['34a689b3630', '輝きは不滅なりて'],
  ['beb4c0a8e49', 'いつか君が言った言葉'],
  ['8a95243a602', '誇り高き追放者'],
  ['3a48c43814f', '不滅なる名コンビ'],
  ['5fec56883e2', 'やっと、また会えたね'],
  ['02aed005346', '燃えよゴージ！'],
  ['a1074a175f6', '召喚士の使命'],
  ['d522a7e2ce9', '紅の竜騎士'],
  ['4c5e96e09d0', '想い込められし歌'],
  ['07e9b7dbdb8', '我は銃士、友は騎士'],
]);
const AF_ROLE_LABELS = new Set([
  'TANKロールクエスト', 'HEALERロールクエスト',
  'ファイター系DPSロールクエスト', 'ソーサラー系DPSロールクエスト',
]);
const AF_MAIN_QUEST_LABEL = 'メインクエスト Lv79';
const AF_GUIDE_TITLE = '〖暁月版〗禁書：新生古典装備の入手方法〖過去トークン装備〗';

function afDetailLabel(source) {
  return DICT['attire:af-detail:' + source];
}

function translateAfAcquisitionLinks(content) {
  const questLinks = new Set();
  for (const link of content.querySelectorAll('a[href]')) {
    if (link.closest(EXCLUDED + ',' + ITEM_LINK)) continue;
    const native = link.textContent.trim();
    if (link.origin === location.origin && link.pathname === '/al06/') {
      replaceLabel(link, AF_GUIDE_TITLE, afDetailLabel(AF_GUIDE_TITLE));
      continue;
    }
    if (!/^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com$/i.test(link.origin)) continue;
    const zh = afQuestLinkName(link.pathname, native);
    if (!zh) {
      translateAfRoleQuestLink(link, native);
      continue;
    }
    replaceLabel(link, native, zh);
    if (link.textContent.trim() === zh) questLinks.add(link);
  }
  return questLinks;
}

function afQuestLinkName(path, native) {
  const hash = /^\/lodestone\/playguide\/db\/quest\/([0-9a-f]{11})\/?$/iu.exec(path)?.[1].toLowerCase();
  const quest = hash && AF_QUESTS.get(hash);
  const zh = quest && DICT['attire:af-quest:' + quest];
  return native === quest || native === zh ? zh : null;
}

// Role quest category links do not identify an individual quest.
function translateAfRoleQuestLink(link, native) {
  if (AF_ROLE_LABELS.has(native) && link.pathname === '/lodestone/playguide/db/quest/'
      && new URLSearchParams(link.search).get('category2') === '6'
      && link.nextSibling?.textContent.trim().startsWith('『')) {
    replaceLabel(link, native, '完成' + afDetailLabel(native));
  }
}

function isAfQuestLabel(source) {
  return source === AF_MAIN_QUEST_LABEL || AF_ROLE_LABELS.has(source);
}

function afShadowbringersCondition(source, node, questLinks) {
  const intro = /^漆黒のヴィランズ(.*?)のアーティファクト\(AF\)です。?$/u.exec(source);
  if (intro) {
    const native = intro[1].trimStart();
    const job = native && jobName(native);
    return !native || job ? '暗影之逆焰的' + (job || '') + '职业专属装备（AF）。' : null;
  }
  // Preserve the original numbering, if present. Match whole known lines
  // or a prefix/suffix adjacent to a verified quest anchor.
  const step = /^([123])[:：]\s*/u.exec(source);
  const number = step ? step[1] + '. ' : '';
  const line = step ? source.slice(step[0].length) : source;
  if (line === 'Lv80に到達') return number + afDetailLabel(line);
  const complete = afCompletedQuest(line);
  if (complete) return number + complete;
  return afAdjacentQuest(line, number, node, questLinks);
}

function afCompletedQuest(line) {
  const separator = line.indexOf('『');
  const complete = separator > 0 && /^『([^』]+)』をクリア$/u.exec(line.slice(separator));
  const label = line.slice(0, separator);
  if (complete && isAfQuestLabel(label)) {
    const quest = DICT['attire:af-quest:' + complete[1]];
    if (quest) return '完成' + afDetailLabel(label) + '《' + quest + '》';
  }
  return null;
}

function afAdjacentQuest(line, number, node, questLinks) {
  if (questLinks.has(node.nextSibling)) {
    if (line.endsWith('『') && isAfQuestLabel(line.slice(0, -1))) {
      return number + '完成' + afDetailLabel(line.slice(0, -1)) + '《';
    }
    if (line === '『') return number + '《';
  }
  if (line === '』をクリア' && questLinks.has(node.previousSibling)) return '》';
  return null;
}

// AF entries repeat fixed acquisition, augmentation and dye-unlock
// instructions. Limit exact templates to the verified AF detail categories.
function translateAfAugmentationVendor(content) {
  for (const link of content.querySelectorAll('a[href*="/lodestone/playguide/db/shop/124bcb85185"]')) {
    if (!/^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com$/i.test(link.origin)
        || !/^\/lodestone\/playguide\/db\/shop\/124bcb85185\/?$/u.test(link.pathname)) continue;
    replaceLabel(link, 'カカラン', DICT['attire:af-detail:カカラン']);
  }
}

function translateAfDetailMetadata() {
  const augmented = hasCategory('afre');
  const shadowbringers = hasCategory('artefact4');
  const stormblood = hasCategory('artefact3');
  const heavensward = hasCategory('artefact2');
  if (!augmented && !shadowbringers && !stormblood && !heavensward
      && !hasCategory('artefact') && !hasCategory('artefact5') && !hasCategory('artefact6')) return;
  const content = document.querySelector('#postContent');
  if (!content) return;
  const questLinks = shadowbringers || stormblood || heavensward
    ? translateAfAcquisitionLinks(content) : new Set();
  if (augmented) translateAfAugmentationVendor(content);
  const walk = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    if (node.parentElement?.closest(EXCLUDED + ',script,style,svg,a[href]')) continue;
    // WordPress may use a <br> or a literal newline between fixed sentences.
    const translated = node.data.split(/(\r?\n)/u).map(line => {
      const source = line.trim();
      const dye = source.endsWith('染色') && resolveDyeColor(source.slice(0, -2));
      const questJob = stormblood && /^(.+?)クエスト$/u.exec(source);
      const job = questJob && jobName(questJob[1]);
      const zh = afDetailLabel(source)
        || (shadowbringers && afShadowbringersCondition(source, node, questLinks))
        || (job && job + '职业任务')
        || (source === '染色可能にする方法' && uiName(source))
        || (augmented && source === 'モードゥナ' && DICT['attire:weapon-meta:モードゥナ'])
        || (source === '無染色' && uiName(source))
        || (dye && dye + '染色');
      return zh && zh !== source ? line.replace(source, () => zh) : line;
    }).join('');
    if (translated !== node.data) node.data = translated;
  }
}

function seriesRewardLabel(source) {
  const combined = /^シリーズ(?:\s*(\d+))?\s+シリーズレベル\s*(\d+)報酬$/u.exec(source);
  if (combined) return (combined[1] ? '第' + combined[1] + '轮系列赛 ' : '系列赛 ') + '等级' + combined[2] + '报酬';
  const round = /^シリーズ\s*(\d+)$/u.exec(source);
  if (round) return '第' + round[1] + '轮系列赛';
  const level = /^シリーズレベル\s*(\d+)報酬$/u.exec(source);
  if (level) return '系列赛等级' + level[1] + '报酬';
  return source === 'シリーズ' ? '系列赛' : null;
}

function linkedCofferNote(node, source) {
  if (!/^を開けることで装備一式入手できます。?$/u.test(source)) return null;
  // The native coffer anchor remains intact (including confirmed Wiki
  // redirects). Translate its adjacent sentence without guessing its name.
  let previous = node.previousSibling;
  while (previous?.nodeType === 3 && !previous.textContent.trim()) previous = previous.previousSibling;
  if (previous?.nodeType !== 1) return null;
  const link = previous.matches(ITEM_LINK) ? previous : previous.querySelector('a[href]');
  if (previous.textContent.trim() !== link?.textContent.trim()) return null;
  const item = originalItem(link);
  return item?.native.endsWith('チェスト') ? '开启后即可获得整套装备。' : null;
}

function translateOtherQuestLinks(content) {
  for (const link of content.querySelectorAll('a[href*="/lodestone/playguide/db/quest/"]')) {
    if (link.closest(EXCLUDED) || !/^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com$/i.test(link.origin)) continue;
    const source = link.textContent.trim();
    if (/^\/lodestone\/playguide\/db\/quest\/b10022ed563\/?$/u.test(link.pathname)
        && source === '集うは我ら、信頼の絆') {
      replaceLabel(link, source, DICT['attire:source:' + source]);
    } else if (link.pathname === '/lodestone/playguide/db/quest/' && source === '友好部族エクストラストーリー') {
      const params = new URLSearchParams(link.search);
      if (params.get('category2') === '4' && params.get('category3') === '45' && params.get('category4') === '62') {
        replaceLabel(link, source, DICT['attire:source:' + source]);
      }
    }
  }
}

function translateOtherAcquisitionMetadata() {
  const content = document.querySelector('#postContent');
  if (!content) return;
  translateOtherQuestLinks(content);
  const series = hasCategory('series-malmstones');
  // Acquisition details may be a plain text node inside a WordPress accordion
  // or a separate line in a paragraph. Never translate substrings of prose.
  const walk = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest(EXCLUDED + ',script,style,svg,a[href]')) continue;
    if (!parent.closest('.c--accordion-contents,p,span,strong,td,dd')) continue;
    const translated = node.data.split(/(\r?\n)/u).map(line => {
      const source = line.trim();
      const zh = otherAcquisitionName(source, node, parent, series);
      return zh && zh !== source ? line.replace(source, () => zh) : line;
    }).join('');
    if (translated !== node.data) node.data = translated;
  }
}

function otherAcquisitionName(source, node, parent, series) {
  const treasure = treasureSourceName(source);
  if (treasure || !parent.closest('.c--accordion-contents')) return treasure;
  const known = DICT['attire:acquisition-note:' + source] || linkedCofferNote(node, source)
    || (series && seriesRewardLabel(source)) || DICT['attire:exchange:' + source];
  const coffer = /^(.+チェスト)を開けることで装備一式入手できます。?$/u.exec(source);
  const name = coffer && uniqueItemName(coffer[1]);
  return name ? '打开' + name + '即可获得整套装备。' : known;
}

// Native weapon details and armor acquisition accordions share these labels.
// Restrict replacements to an exchange region with both native section markers.
const EXCHANGE_HEADINGS = ['取引に必要なアイテム', '販売ショップNPC'];
const EXCHANGE_VENDOR_LABELS = ['販売ショップNPC', '取引NPC'];

function exchangeDetailName(source) {
  if (source === '入手方法' || EXCHANGE_HEADINGS.includes(source)
      || ['クレセントアイル：南征編', 'クレセントアイル：北征編'].includes(source)) {
    return uiName(source);
  }
  const exact = DICT['attire:exchange:' + source];
  if (exact) return exact;
  if (['トロフィークリスタル', 'ゴールドソーサー'].includes(source)) return uiName(source);
  const perPart = /^一部位\s*([\d,]+)$/u.exec(source);
  if (perPart) return '每个部位 ' + perPart[1];
  // Match the complete native label, never an arbitrary substring of prose.
  const swordShield = swordShieldSetName(source);
  if (swordShield) return swordShield;
  // Counts belong to the acquisition description, not the item names.
  const parts = /^(頭手足|胴脚)…(\d+)$/u.exec(source);
  if (parts) return DICT['attire:tomestone-guide:' + parts[1]] + '：' + parts[2];
  const duty = lookupDutyName(source);
  if (duty) return duty;
  // Resolve complete native token/coffer/material names through the official
  // item data rather than guessing a localized name from their suffix.
  if (/(?:のトーテム像|データログ[1-4]\.0|(?:武器櫃|騎士装具|ナイトギア|ウェポンチェスト)〖ILv\d{1,4}〗)$/u.test(source)
      || ['打ち捨てられた遺物', 'トーテム・オブ・ライト', '天之魔器柄'].includes(source)) {
    return uniqueItemName(source);
  }
  if (['同盟記章', 'セントリオ記章', 'モブハントの戦利品', 'ラザハン', 'オールド・シャーレアン', 'ラールガーズリーチ', 'クガネ'].includes(source)) {
    return DICT['attire:tomestone-guide:' + source];
  }
  if (['ロウェナ商会の商人', 'モードゥナ', 'イディルシャイア', 'イシュガルド：下層', 'クリスタリウム'].includes(source)) {
    return DICT['attire:weapon-meta:' + source];
  }
  const faction = GC_EXCHANGE_LOCATIONS.get(source);
  return faction ? DICT['attire:gc:' + faction + ':' + source] : exchangeCurrencyName(source);
}

const GC_EXCHANGE_LOCATIONS = new Map([
  ['リムサ・ロミンサ：上甲板層', '黒渦団'],
  ['グリダニア：新市街', '双蛇党'],
  ['ウルダハ：ナル回廊', '不滅隊'],
]);

function swordShieldSetName(source) {
  const match = /^(※|[（(])?片手剣[&＆]盾セット([）)])?$/u.exec(source);
  if (!match) return null;
  const open = match[1];
  if ((open === '（' || open === '(') !== Boolean(match[2])) return null;
  if (open === '※') return '※单手剑与盾牌套装';
  return open ? '（单手剑与盾牌套装）' : '单手剑与盾牌套装';
}

function exchangeCurrencyName(source) {
  const currency = tomestoneName(source);
  if (currency) return currency;
  const wrapped = /^[（(].*[）)]$/u.test(source);
  const label = wrapped ? source.slice(1, -1) : source;
  const former = /^旧\s*(?:[:：]\s*)?(アラガントームストーン[:：]\S+)$/u.exec(label);
  if (!former || (wrapped && /[）)]/u.test(former[1]))) return null;
  const zh = tomestoneName(former[1]);
  if (!zh) return null;
  return wrapped ? '（旧：' + zh + '）' : '旧：' + zh;
}

function translateExchangeMetadata(weaponDetail) {
  const content = document.querySelector('#postContent');
  if (!content) return;
  const accordions = [...content.querySelectorAll('.c--accordion-contents')];
  const regions = weaponDetail || !accordions.length ? [content] : accordions;
  for (const region of regions) {
    const { nodes, labels } = exchangeText(region);
    const hasLabel = label => labels.has(label) || labels.has(exchangeDetailName(label));
    const headed = hasLabel(EXCHANGE_HEADINGS[0]) && EXCHANGE_VENDOR_LABELS.some(hasLabel);
    // Older Restoration articles omit the standard headings. Both markers
    // must be present in the same acquisition accordion.
    const restoration = region !== content && hasLabel('エニー')
      && ['蒼天街振興券', 'フェトゥ参加証'].some(hasLabel);
    const seriesTrade = region !== content && hasCategory('series-malmstones')
      && hasLabel('トロフィークリスタル取引窓口');
    if (headed || restoration || seriesTrade) translateExchangeLines(nodes, restoration, seriesTrade);
  }
}

function isExchangeHeading(source, label) {
  return source === label || source === exchangeDetailName(label);
}

function isExchangeVendor(source) {
  return EXCHANGE_VENDOR_LABELS.some(label => isExchangeHeading(source, label));
}

function translateExchangeLines(nodes, restoration, seriesTrade) {
  // Restrict canonical material names to a cost block ending in a vendor label.
  const isToc = text => !!text.parentElement?.closest('.rtoc-item');
  let vendorsRemaining = nodes.reduce((total, [text, lines]) => total + (isToc(text) ? 0
    : lines.filter(line => isExchangeVendor(line.trim())).length), 0);
  let inCost = false;
  for (const [text, lines] of nodes) {
    const toc = isToc(text);
    const restorationItem = restoration && text.parentElement?.closest('td,dd,p');
    const translated = lines.map(line => {
      const source = line.trim();
      if (!toc && isExchangeHeading(source, EXCHANGE_HEADINGS[0])) inCost = vendorsRemaining > 0;
      if (!toc && isExchangeVendor(source)) {
        inCost = false;
        vendorsRemaining--;
      }
      const zh = exchangeLineName(source, seriesTrade, !toc && (inCost || restorationItem));
      return zh && source !== zh ? line.replace(source, () => zh) : line;
    }).join('');
    if (translated !== text.data) text.data = translated;
  }
}

function exchangeLineName(source, seriesTrade, isMaterial) {
  const count = seriesTrade && /^(?:トロフィークリスタル|戦利水晶)\s+([\d,]+)$/u.exec(source);
  const material = isMaterial && source && uniqueItemName(source);
  return exchangeDetailName(source) || (count && uiName('トロフィークリスタル') + ' ' + count[1]) || material;
}

function translateEquipmentMetadata() {
  translateAcquisitionLinks();
  translateAfDetailMetadata();
  translateOtherAcquisitionMetadata();
  for (const link of document.querySelectorAll('#postContent a[href*="/lodestone/playguide/db/shop/"]')) {
    if (link.closest(EXCLUDED) || !/^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com$/i.test(link.origin)) continue;
    replaceLabel(link, 'スクリップ取引窓口', uiName('スクリップ取引窓口'));
  }
  // The level/job summary and dyeability labels occur on item detail pages,
  // not on player-authored glamour posts.
  for (const element of document.querySelectorAll('#postContent :is(p,span,strong,li,td,dd)')) {
    if (element.closest(EXCLUDED + ',a[href],' + CARD)) continue;
    const source = element.textContent.trim();
    const zh = equipmentMetadata(source);
    if (zh) replaceLabel(element, source, zh);
  }
}

function localizeRichMenu() {
  for (const element of document.querySelectorAll('#postContent .a--richmenu-text')) {
    if (element.closest(EXCLUDED) || element.querySelector('a,input,textarea,[contenteditable]')) continue;
    const nodes = labelTextNodes(element, 'script,style,svg');
    if (nodes.length < 2) continue;
    const parts = nodes.map(n => n.data.trim());
    const combined = DICT['attire:' + parts.join('')] || DICT['attire:' + parts.join(' ')];
    const first = uiName(parts[0]);
    const zh = combined || (first && parts.every(part => uiName(part) === first) ? first : null);
    if (!zh) continue;
    nodes[0].data = nodes[0].data.replace(parts[0], () => zh);
    for (const n of nodes.slice(1)) n.data = '';
  }
}

function dedupeRichHeadings() {
  for (const main of document.querySelectorAll('#postContent .a--h2rich-maincopy')) {
    const sub = main.parentElement?.querySelector(':scope > .a--h2rich-subcopy');
    if (!sub || sub === main) continue;
    const text = main.textContent.trim();
    if (text && text === sub.textContent.trim()) {
      if (!sub.hidden) {
        sub.hidden = true;
        sub.dataset.zhxAttireDeduped = '1';
      }
    } else if (sub.dataset.zhxAttireDeduped) {
      sub.hidden = false;
      delete sub.dataset.zhxAttireDeduped;
    }
  }
}

function translateTagCloudLabels() {
  // WordPress generates aria-label as "tag name (number of items)".
  // Localize the description, not the tag slug, count, or link destination.
  for (const link of document.querySelectorAll('a.tag-cloud-link[aria-label]')) {
    if (link.closest(EXCLUDED) || link.origin !== location.origin) continue;
    const source = link.getAttribute('aria-label');
    const match = /[（(]([\d,]+)\s*([^\s\d,（）()][^（）()]*)[）)]$/u.exec(source);
    if (!match?.index || !isTagCloudCountUnit(match[2])) continue;
    const native = source.slice(0, match.index).trim();
    const zh = uiName(native) || native;
    link.setAttribute('aria-label', zh + '（' + match[1] + ' 项）');
  }
}

function isTagCloudCountUnit(unit) {
  return /^(?:件(?:の(?:項目|記事|投稿|アイテム))?|個(?:の項目)?|項目|items?|posts?)$/iu.test(unit);
}

function translateArchiveControls() {
  // The site's WordPress weekly archive starts with this exact prompt.
  // Change only the display label, never the destination or selected index.
  for (const select of document.querySelectorAll('select')) {
    if (select.closest(EXCLUDED)) continue;
    const option = select.options[0];
    if (option?.textContent.trim() !== '週を選択') continue;
    for (const label of document.querySelectorAll('label')) {
      if (label.contains(select) || (select.id && label.htmlFor === select.id)) {
        replaceLabel(label, 'アーカイブ', uiName('アーカイブ'));
      }
    }
    if (!option.hasAttribute('value')) option.setAttribute('value', option.value);
    replaceLabel(option, '週を選択', uiName('週を選択'));
  }
}

function translateBreadcrumb(title, previous, current) {
  for (const link of document.querySelectorAll('#breadCrumb a')) {
    if (link.closest(EXCLUDED) || link.origin !== location.origin) continue;
    replaceLabel(link, 'HOME', DICT.HOME);
  }
  if (title && previous && current && previous !== current) {
    const prior = breadcrumbTitles.get(title);
    const source = prior?.localized === previous ? prior.source : previous;
    breadcrumbTitles.set(title, { source, previous, localized: current });
  }
  const state = title && breadcrumbTitles.get(title);
  const crumb = document.querySelector('#breadCrumb [aria-current="page"]')
    || Array.from(document.querySelectorAll('#breadCrumb li')).at(-1);
  if (!crumb || crumb.closest(EXCLUDED)) return;
  const glamour = hasCategory('glamour');
  const staticPage = document.body.matches('.page,.archive.tag,.archive.category');
  const search = document.body.matches('.search');
  const context = { glamour, search, staticPage, state, current };
  const walk = document.createTreeWalker(crumb, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    if (node.parentElement?.closest(EXCLUDED + ',script,style')) continue;
    const source = node.data.trim().replace(/^[＞>]\s*/u, '');
    const zh = breadcrumbName(source, context);
    if (zh && zh !== source) node.data = node.data.replace(source, () => zh);
  }
}

function breadcrumbName(source, { glamour, search, staticPage, state, current }) {
  if (glamour) {
    // The prefix belongs to the site; the title belongs to the author.
    const prefix = /^ミラプリ[：:](?=\S|\s)/u.exec(source);
    return prefix ? source.replace(prefix[0], '幻化：') : null;
  }
  if (state && state.localized === current && (source === state.source || source === state.previous)) return current;
  if (search) {
    const query = /^検索結果「(.+)」$/u.exec(source) || /^「(.+)」的搜索结果$/u.exec(source);
    return query ? '「' + (uniqueItemName(query[1]) || query[1]) + '」的搜索结果' : null;
  }
  return staticPage ? uiName(source) : null;
}

function clearItemLink(link) {
  itemLinks.delete(link);
  delete link.dataset.zhxAttireItem;
}

function originalItem(link) {
  let href = link.getAttribute('href');
  const displayed = link.textContent.trim();
  const prior = itemLinks.get(link);
  if (prior && href === prior.appliedHref && displayed === prior.label) {
    return { ...prior, displayed };
  }
  if (prior) {
    // The site changed the label: undo only our redirect, if still present.
    if (href === prior.appliedHref && href !== prior.href) {
      href = prior.href;
      link.setAttribute('href', href);
    }
    clearItemLink(link);
  }
  const hash = LODESTONE_ITEM.exec(href)?.[1].toLowerCase();
  return hash ? { href, hash, native: displayed, displayed } : null;
}

function itemTranslation(hash, native) {
  const names = resolveAllByName(native);
  const byHash = resolveByHash(hash);
  const fallback = DICT['attire:item:' + hash + ':' + native];
  // Even the local fallback must agree with the canonical hash, when known.
  let confirmed = fallback;
  if (byHash) confirmed = names.includes(byHash) || fallback === byHash ? byHash : null;
  return { confirmed, zh: confirmed || (!byHash && names.length === 1 ? names[0] : null) };
}

function translateOfficialItem(link) {
  const original = originalItem(link);
  if (!original) return null;
  const { href, hash, native, displayed } = original;
  const { confirmed, zh } = itemTranslation(hash, native);
  replaceLabel(link, displayed, zh || native);
  const label = link.textContent.trim();
  const appliedHref = confirmed && label === confirmed
    ? WIKI_ITEM + encodeURIComponent(confirmed) : href;
  if (link.getAttribute('href') !== appliedHref) link.setAttribute('href', appliedHref);
  if (label !== native || appliedHref !== href) {
    itemLinks.set(link, { href, hash, native, label, appliedHref });
    link.dataset.zhxAttireItem = '1';
  } else {
    clearItemLink(link);
  }
  return { native, label: zh && label === zh ? zh : native };
}

function translateOfficialItems(title) {
  const displayed = title?.textContent.trim();
  const prior = title && itemTitles.get(title);
  const tracked = prior && displayed === prior.label;
  const native = tracked ? prior.native : displayed;
  if (prior && !tracked) clearItemTitle(title);
  const { hasItems, labels } = translateOfficialItemLinks(title, native);
  if (title && (tracked || labels.size)) updateItemTitle(title, displayed, native, labels);
  return hasItems;
}

function clearItemTitle(title) {
  itemTitles.delete(title);
  delete title.dataset.zhxAttireNative;
}

function translateOfficialItemLinks(title, native) {
  const facewear = title && facewearItemSource(native);
  let hasItems = false;
  const labels = new Set();
  for (const link of document.querySelectorAll(ITEM)) {
    if (link.closest(EXCLUDED)) continue;
    const item = translateOfficialItem(link);
    if (!item) continue;
    hasItems = true;
    if (!title) continue;
    if (item.native === native) labels.add(item.label);
    else if (item.native === facewear) {
      labels.add(item.label === item.native ? native : item.label + '（' + uiName('フェイスアクセサリー') + '）');
    }
  }
  return { hasItems, labels };
}

function updateItemTitle(title, displayed, native, labels) {
  // Do not choose between conflicting translations for the same native name.
  const desired = labels.size === 1 ? [...labels][0] : native;
  if (!replaceLabel(title, displayed, desired)) return;
  if (desired === native) {
    clearItemTitle(title);
    return;
  }
  itemTitles.set(title, { native, label: desired });
  title.dataset.zhxAttireNative = native;
}

function translateSiteChrome() {
  for (const [selector, attr] of [['#headerLogoLink', 'title'], ['#headerLogoImage', 'alt']]) {
    const el = document.querySelector(selector);
    const source = el?.getAttribute(attr);
    if (SITE_TITLES.includes(source)) el.setAttribute(attr, uiName(source));
  }
  const copyright = document.querySelector('#copyright');
  const source = copyright?.textContent.trim();
  const match = source && /^(\d{4}(?:[–—-]\d{4})?\s+)(\S.*)$/u.exec(source);
  if (match && SITE_TITLES.includes(match[2]))
    replaceLabel(copyright, source, match[1] + uiName(match[2]));
}

function translateWeaponFilter(weaponPage) {
  if (!weaponPage) return;
  for (const label of document.querySelectorAll('#postContent .asr .asr-group > summary,#postContent .asr .asr-reset,#postContent .asr .asr-more')) {
    const source = label.textContent.trim();
    const more = /^さらに([\d,]+)件表示$/u.exec(source);
    const zh = more ? '再显示 ' + more[1] + ' 项'
      : DICT['attire:weapon-meta:' + source] || uiName(source);
    if (zh) replaceLabel(label, source, zh);
  }
  translateWeaponFilterCards();
}

function translateWeaponFilterCards() {
  for (const button of document.querySelectorAll('#postContent .asr .asr-card-trigger')) {
    const source = button.getAttribute('aria-label');
    const match = source && /^(.+)の詳細を表示$/u.exec(source);
    const zh = match && uniqueItemName(match[1]);
    if (zh) button.setAttribute('aria-label', '查看' + zh + '的详细信息');
    for (const img of button.querySelectorAll('img[alt]')) {
      const name = uniqueItemName(img.getAttribute('alt'));
      if (name) img.setAttribute('alt', name);
    }
  }
}

function achievementAcquisitionLabel(source) {
  if (!hasCategory('achievement')) return null;
  const exact = DICT['attire:acquisition-note:' + source];
  if (exact) return exact;
  const win = /^(初勝利|([1-9]\d{0,5})回勝利)で([頭胴手脚足])装備([：:]?)$/u.exec(source);
  if (!win) return null;
  const slots = { 頭: '头部', 胴: '身体', 手: '手部', 脚: '腿部', 足: '脚部' };
  return (win[2] ? '累计获胜' + win[2] + '次' : '首次获胜') + '可获得' + slots[win[3]] + '防具' + win[4];
}

function translateAcquisitionAccordionLabels() {
  for (const content of document.querySelectorAll('#postContent .c--accordion-contents')) {
    const heading = content.previousElementSibling;
    if (!heading?.matches('.a--accordion-title,.c--accordion-title')
      || !['入手方法などはこちら', uiName('入手方法などはこちら')].includes(heading.textContent.trim())) continue;
    const walk = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      if (node.parentElement?.closest(EXCLUDED + ',script,style,a[href]')) continue;
      const translated = node.data.split(/(\r?\n)/u).map(line => {
        const source = line.trim();
        const zh = achievementAcquisitionLabel(source)
          || (['マーケット取引可能', '入手方法', 'アチーブメント報酬', 'PvP>フロントライン'].includes(source) && uiName(source));
        return zh && zh !== source ? line.replace(source, () => zh) : line;
      }).join('');
      if (translated !== node.data) node.data = translated;
    }
  }
}

function translateSearchControls() {
  // WordPress block search can omit role/method; translate display attributes
  // without touching query parameters, input values or form destinations.
  for (const button of document.querySelectorAll('form.wp-block-search .wp-block-search__button')) {
    if (button.closest(EXCLUDED)) continue;
    translateSearchButton(button);
  }
  for (const input of document.querySelectorAll('form[role="search"][method="get"] input[type="search"][name="s"]')) {
    const form = input.form;
    if (form?.action !== location.origin + '/') continue;
    const zh = uiName(input.placeholder);
    if (zh && zh !== input.placeholder) input.placeholder = zh;
    translateSearchSubmitters(form);
  }
}

function translateSearchButton(button) {
  const zh = uiName('検索');
  replaceLabel(button, '検索', zh);
  for (const attr of ['aria-label', 'title']) {
    if (button.getAttribute(attr) === '検索') button.setAttribute(attr, zh);
  }
}

function translateSearchSubmitters(form) {
  for (const button of form.querySelectorAll('button[type="submit"],button:not([type])')) {
    translateSearchButton(button);
  }
  // A named submit input contributes its value to the GET request.
  for (const button of form.querySelectorAll('input[type="submit"]:not([name])')) {
    if (button.value === '検索') button.value = uiName('検索');
  }
}

// The macro generator is a separate tool. Translate only its landing-page
// heading and exact launch link, not the generated commands or form values.
// Native load-more buttons can sit outside navigation and rich headings.
function translateLoadMore() {
  for (const element of document.querySelectorAll('#postContent :is(a[href],button,.jinr-loadmore .a--postlist-more,.a--postlist-more)')) {
    if (element.closest(EXCLUDED + ',' + CARD + ',' + ITEM_LINK)) continue;
    if (element.matches('a[href]') && element.origin !== location.origin) continue;
    const source = element.textContent.trim();
    if (source === 'もっと見る' || source === 'Read More') replaceLabel(element, source, uiName(source));
  }
}

function translateMacroLanding() {
  if (!/^\/crafter-macro-generat\/?$/u.test(location.pathname)) return;
  const heading = 'Crafter Macro Generat';
  for (const element of document.querySelectorAll('#postContent :is(h2,h3,h4)')) {
    replaceLabel(element, heading, uiName(heading));
  }
  const label = 'FF14 制作マクロ自動生成ツール';
  for (const link of document.querySelectorAll('#postContent a[href]')) {
    if (link.origin === location.origin && link.pathname === '/wp-content/plugins/ff14-macro-tool/assets/tool.html') {
      replaceLabel(link, label, uiName(label));
    }
  }
}

// The native homepage shows a Sunday-first Frontline calendar. A single
// character such as 月 or 火 is not a safe global dictionary key.
function translateFrontlineCalendar() {
  const content = document.querySelector('body.home #postContent');
  if (!content || !content.textContent.includes(uiName('月間FLカレンダー'))
      && !content.textContent.includes('月間FLカレンダー')
      && !content.textContent.includes('FRONTLINE CALENDAR')) return;
  const buttons = [...content.querySelectorAll('button')].filter(button => !button.closest(EXCLUDED));
  const prev = buttons.filter(button => button.textContent.trim() === '‹');
  const next = buttons.filter(button => button.textContent.trim() === '›');
  if (prev.length !== 1 || next.length !== 1) return;
  const native = ['日', '月', '火', '水', '木', '金', '土'];
  const localized = ['日', '一', '二', '三', '四', '五', '六'];
  // Find the smallest shared calendar region containing both navigation
  // buttons and exactly one matching row. Preserve the date cells and controls.
  for (let region = prev[0].parentElement; region; region = region.parentElement) {
    if (region.contains(next[0])) {
      const rows = [region, ...region.querySelectorAll('div,tr,ul,ol,thead')].filter(row => {
        if (row.closest(EXCLUDED) || row.children.length < 7) return false;
        return native.every((day, i) => {
          const cell = row.children[i];
          return cell.textContent.trim() === day && !cell.matches('a,button,input,select,textarea')
            && !cell.querySelector('a,button,input,select,textarea,[contenteditable]');
        });
      });
      if (rows.length > 1) return;
      if (rows.length === 1) {
        const cells = [...rows[0].children].slice(0, 7);
        cells.forEach((cell, i) => replaceLabel(cell, native[i], localized[i]));
        return;
      }
    }
    if (region === content) break;
  }
}

function translateSplitSeriesLink() {
  for (const link of document.querySelectorAll('body.home #postContent a[href]')) {
    if (link.closest(EXCLUDED) || link.origin !== location.origin
        || link.pathname !== '/category/seriesb/' || link.textContent.trim() !== 'リーズ武器一覧') continue;
    const prefix = link.previousSibling;
    if (prefix?.nodeType !== 3 || !/シ\s*$/u.test(prefix.data)) continue;
    if (replaceLabel(link, 'リーズ武器一覧', uiName('シリーズ武器一覧'))) {
      prefix.data = prefix.data.replace(/シ(?=\s*$)/u, '');
    }
  }
}

function translateAttirePage() {
  const title = document.querySelector('#jinrPostTitle');
  const weaponPage = weaponPageAt(location.pathname);
  const weaponDetail = /^\/arms\/[^/]+\/?$/u.test(location.pathname) && !hasCategory('glamour');
  const nativeTitle = title?.textContent.trim();
  localizeRichMenu();
  translateExpansionCatalogue();
  for (const element of document.querySelectorAll(UI)) {
    if (element.closest(EXCLUDED)) continue;
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      if (node.parentElement?.closest(EXCLUDED + ',script,style,' + ITEM_LINK)) continue;
      const source = node.data.trim();
      const tag = node.parentElement?.closest('a[rel~="tag"],a[href^="/tag/"],a[href^="https://attire.jp/tag/"]');
      const tagName = tag && source.startsWith('#') && exactUiName(source.slice(1).trim());
      const localized = tagName ? '#' + tagName : uiName(source);
      if (localized && source !== localized) node.data = node.data.replace(source, () => localized);
    }
  }

  if (weaponDetail) translateWeaponDetailMetadata();
  translateSourceCatalogue(title, nativeTitle);
  translateTomestoneGuide(title, nativeTitle);
  translateSeasonalRewardLinks();
  if (/^\/market\/?$/u.test(location.pathname)) replaceLabel(title, 'マーケット取引可能装備', uiName('マーケット取引可能装備'));
  dedupeRichHeadings();
  for (const card of document.querySelectorAll(CARD)) localizeCard(card);
  translateEquipmentImageLabels(weaponDetail);
  translateRecentPosts();
  translateTagCloudLabels();
  translateArchiveControls();
  translateSiteChrome();
  translateSearchControls();
  translateWeaponFilter(weaponPage);
  translateLoadMore();
  translateMacroLanding();
  translateFrontlineCalendar();
  translateSplitSeriesLink();
  translateStructuredItems(weaponPage, weaponDetail);
  translateWeaponCatalogue(title, weaponPage);

  const searchTitle = document.querySelector('body.search #postHeader #jinrPostTitle');
  if (searchTitle) {
    const current = searchTitle.textContent.trim();
    const original = current === searchTitle.dataset.zhxAttireLocalizedTitle
      ? searchTitle.dataset.zhxAttireSearchTitle : current;
    const match = /^「(.+)」の検索結果は([0-9,]+)件です$/u.exec(original);
    if (match) {
      const [, query, count] = match;
      if (replaceLabel(searchTitle, searchTitle.textContent.trim(), `「${uniqueItemName(query) || query}」的搜索结果：${count} 条`)) {
        searchTitle.dataset.zhxAttireSearchTitle = original;
        searchTitle.dataset.zhxAttireLocalizedTitle = searchTitle.textContent.trim();
      }
    }
  }

  const isGlamour = hasCategory('glamour');
  if (!isGlamour) translateAcquisitionAccordionLabels();
  const itemDetail = translateOfficialItems(isGlamour ? null : title) && !isGlamour;
  if (itemDetail) translateEquipmentMetadata();
  if (!isGlamour && (weaponDetail || itemDetail)) {
    translateGrandCompanyMetadata();
    translateExchangeMetadata(weaponDetail);
  }
  if (title && !isGlamour && (itemDetail || hasCategory('seriesb'))) {
    const source = title.textContent.trim();
    const zh = groupArticleName(source);
    if (replaceLabel(title, source, zh)) title.dataset.zhxAttireNative = source;
  }
  const localizedTitle = title?.textContent.trim();
  translateBreadcrumb(title, nativeTitle, localizedTitle);
  if (nativeTitle && localizedTitle && nativeTitle !== localizedTitle && document.title.startsWith(nativeTitle)) {
    document.title = localizedTitle + document.title.slice(nativeTitle.length);
  }
  const siteTitle = SITE_TITLES.find(label => document.title.endsWith(label));
  if (siteTitle) document.title = document.title.slice(0, -siteTitle.length) + uiName(siteTitle);
}

function startAttire() {
  translateAttirePage();
  // Batched observer only for added content; text mutations from our own
  // translations do not trigger it.
  const regions = '#postContent,#jinrPostList,#postHeader,#jinrPostTitle,#jinrPostMeta,nav,'
    + '#globalMenuList,#hamburgerMenuList,#footerMenuList,#breadCrumb,aside,'
    + 'form[role="search"][method="get"],.widget_recent_entries,.wp-block-latest-posts,.wp-block-tag-cloud,.wp-block-categories,.wp-block-archives';
  createTranslationObserver({
    handler(nodes) {
      if (nodes.some(node => {
        const el = node.nodeType === 1 ? node : node.parentElement;
        return el?.closest(regions) || el?.querySelector(regions);
      })) translateAttirePage();
    },
  });
}
