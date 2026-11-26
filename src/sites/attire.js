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
  + '.widget-title,.widgettitle,.tag-cloud-link,.wp-block-tag-cloud a,.wp-block-categories a,.wp-block-archives a';
const ITEM_LINK = 'a[href*="/lodestone/playguide/db/item/"],a[data-zhx-attire-item]';
const ITEM = '#postContent :is(' + ITEM_LINK + ')';
const CARD = 'a.c--post-link[rel~="bookmark"]';
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

function exactUiName(source) {
  return DICT['attire:' + source]
    || DICT['attire:event:' + source]
    || (Object.hasOwn(DICT_COMMON, source) ? DICT_COMMON[source] : null)
    || lookupDutyName(source);
}

function uiName(source) {
  const exact = exactUiName(source);
  if (exact) return exact;
  const artifact = /^(新生|蒼天|紅蓮|漆黒|暁月|黄金)アーティファクト$/u.exec(source);
  if (artifact) return exactUiName(artifact[1] + '編') + ' 职业专属装备';
  const craftArtifact = /^(新生|蒼天|紅蓮|漆黒|暁月|黄金)(ギャザラー|クラフター)AF$/u.exec(source);
  if (craftArtifact) return exactUiName(craftArtifact[1] + '編') + ' ' + exactUiName(craftArtifact[2] + 'AF');
  const count = /^(.+?)(\s*\([\d,]+\))$/u.exec(source);
  if (count) {
    const name = exactUiName(count[1]);
    return name ? name + count[2] : null;
  }
  const duty = /^Lv\s*(\d{1,3})\s*ID\s+(.+)$/iu.exec(source);
  const name = duty && lookupDutyName(duty[2]);
  return name ? duty[1] + '级副本 ' + name : null;
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

// These display titles are not individual item identities. Never use them for
// Wiki redirects or search conversion.
function groupArticleName(source) {
  if (!source || resolveAllByName(source).length) return null;
  const flower = flowerArticleName(source);
  if (flower) return flower;
  if (source === 'トリテレイアイヤリング' || source.endsWith('武器一覧')) return DICT['attire:' + source] || null;
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
  const match = /^(.+?)\s+歴代AF\s+男女着用SSまとめ$/u.exec(source || '');
  if (!match) return null;
  const job = jobName(match[1] === '踊り子士' ? '踊り子' : match[1]);
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

function articleName(source) {
  return afSummaryName(source) || eventName(source) || uniqueItemName(source) || groupArticleName(source);
}

function localizeCard(card) {
  if (card.closest(EXCLUDED) || card.origin !== location.origin) return;
  const category = card.querySelector('.a--post-category');
  if (!category || category.classList.contains('category-glamour')) return;
  const heading = card.querySelector('.a--post-title');
  const source = heading?.textContent.trim();
  if (!source) return;
  const exact = articleName(source);
  if (exact) replaceLabel(heading, source, exact);
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
  const normalized = source.replace(/\s+/gu, '');
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
  const match = /^(?:(新生|蒼天|紅蓮|漆黒|暁月|黄金)AF|ジョブ取得時にもらえる装備品)\s*([^/]+)\/.*$/u.exec(source);
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
  const pair = /^(\S+)\s+(.+)$/u.exec(source);
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
    const zh = mogLabel(source);
    if (zh && source !== zh) node.data = node.data.replace(source, () => zh);
  }
}

function sourceCatalogueName(source, kind) {
  if (kind === 'af') return afSetName(source) || uiName(source);
  if (kind === 'seasonal') return eventName(source) || uiName(source);
  return (kind === 'hand-land' ? catalogueSetName(source) : DICT['attire:set:' + source]) || uiName(source);
}

function translateSourceCatalogue(title, nativeTitle) {
  const path = location.pathname.replace(/\/$/u, '');
  const kind = path === '/hand-land' ? 'hand-land'
    : path === '/pvp' ? 'pvp' : path === '/s-g' ? 'seasonal'
      : path === '/gc' ? 'gc' : afSummaryName(nativeTitle) || hasCategory('af-nyuusyu') ? 'af' : null;
  // Event names and AF index titles are display labels, not item identities.
  const titleZh = afSummaryName(nativeTitle) || eventName(nativeTitle);
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
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walk.nextNode())) if (node.data.trim()) nodes.push(node);
    if (nodes.length === 2 && nodes.every(n => eventName(n.data.trim()) === zh)) {
      nodes[0].data = nodes[0].data.replace(nodes[0].data.trim(), () => zh);
      nodes[1].data = '';
    }
  }
}

// Historical seasonal reward links contain a year, event copy and an item
// name. Keep the year, copy, DOM and destination; translate only the exact
// final item name. A single text node may contain all three parts.
function translateSeasonalRewardLinks() {
  if (!hasCategory('seasonal-event-all') || hasCategory('glamour')) return;
  for (const link of document.querySelectorAll('#postContent a[href]')) {
    if (link.closest(EXCLUDED + ',' + ITEM_LINK + ',' + CARD) || link.origin !== location.origin) continue;
    if (!/^\d{4}年/u.test(link.textContent.trim())) continue;
    const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
    let node;
    let last;
    while ((node = walker.nextNode())) {
      if (node.data.trim() && !node.parentElement?.closest(EXCLUDED + ',script,style,svg')) last = node;
    }
    const text = last?.data.trim();
    if (!text || text.length > 300) continue;
    const exact = uniqueItemName(text);
    if (exact) {
      last.data = last.data.replace(text, () => exact);
      continue;
    }
    const matches = new Map();
    for (const space of text.matchAll(/\s+/gu)) {
      const suffix = text.slice(space.index + space[0].length);
      const zh = uniqueItemName(suffix);
      if (zh) matches.set(suffix, zh);
    }
    if (matches.size === 1) {
      const [suffix, zh] = [...matches][0];
      last.data = last.data.replace(text, () => text.slice(0, -suffix.length) + zh);
    }
  }
}

function weaponDetailName(source) {
  const level = /^Lv\s*(\d{1,3})\s+ILv?\s*(\d{1,4})$/iu.exec(source);
  if (level) return '等级 ' + level[1] + '／品级 ' + level[2];
  // Exact acquisition labels and known official terminology only.
  const known = DICT['attire:weapon-meta:' + source];
  if (known) return known;
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
    if (!element.querySelector('br')) continue;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const replacements = [];
    let node;
    let valid = true;
    while ((node = walker.nextNode())) {
      const part = node.data.trim();
      if (!part) continue;
      if (node.parentElement?.closest(EXCLUDED + ',script,style,svg,' + ITEM_LINK)) {
        valid = false;
        break;
      }
      const zh = weaponDetailName(part);
      if (!zh && !/^\d+$/u.test(part)) {
        valid = false;
        break;
      }
      if (zh && zh !== part) replacements.push([node, part, zh]);
    }
    if (valid) for (const [text, part, zh] of replacements) {
      text.data = text.data.replace(part, () => zh);
    }
  }
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
  // The catalogue's official duty links use the shared duty dictionary.
  for (const link of document.querySelectorAll('#postContent a[href*="/lodestone/playguide/db/duty/"]')) {
    if (link.closest(EXCLUDED) || !/^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com$/i.test(link.origin)) continue;
    const source = link.textContent.trim();
    replaceLabel(link, source, lookupDutyName(source));
  }
  // Keep Lodestone item links untouched until the identity-aware pass below.
  if (!glamour) return;
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

function equipmentMetadata(source) {
  if (/^染色(?:不可|[◯○×✕])?$/u.test(source) || source === 'マーケット取引可能'
      || /^(?:ギャザラー|クラフター)スクリップ:[白紫橙]貨$/u.test(source)
      || ['女性専用装備','男性専用装備','Fall Guys コラボレーションイベント',
        '現在は終了しているイベントのため入手できません'].includes(source)) return uiName(source);
  const match = /^Lv\s*(\d{1,3})\s+(.+)$/iu.exec(source);
  if (!match) return null;
  const jobs = /^(?:All Jobs?|AllJobs)$/i.test(match[2])
    ? ['全职业'] : match[2].split(/\s+/u).map(jobName);
  if (!jobs.length || !jobs.every(Boolean)) return null;
  return match[1] + '级 ' + jobs.join('／');
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

function translateEquipmentMetadata() {
  translateAcquisitionLinks();
  for (const link of document.querySelectorAll('#postContent a[href*="/lodestone/playguide/db/shop/"]')) {
    if (link.closest(EXCLUDED) || !/^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com$/i.test(link.origin)) continue;
    replaceLabel(link, 'スクリップ取引窓口', uiName('スクリップ取引窓口'));
  }
  // The level/job summary and dyeability labels occur on item detail pages,
  // not on player-authored glamour posts.
  for (const element of document.querySelectorAll('#postContent :is(p,span,strong)')) {
    if (element.closest(EXCLUDED + ',a[href]')) continue;
    const source = element.textContent.trim();
    const zh = equipmentMetadata(source);
    if (zh) replaceLabel(element, source, zh);
  }
}

function localizeRichMenu() {
  for (const element of document.querySelectorAll('#postContent .a--richmenu-text')) {
    if (element.closest(EXCLUDED) || element.querySelector('a,input,textarea,[contenteditable]')) continue;
    const nodes = [];
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      if (node.parentElement?.closest('script,style,svg')) continue;
      if (node.data.trim()) nodes.push(node);
    }
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

function translateArchiveControls() {
  // The site's WordPress weekly archive starts with this exact prompt.
  // Change only the display label, never the destination or selected index.
  for (const select of document.querySelectorAll('select')) {
    if (select.closest(EXCLUDED)) continue;
    const option = select.options[0];
    if (!option || option.textContent.trim() !== '週を選択') continue;
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
  if (!title || !previous || !current) return;
  if (previous !== current) {
    const prior = breadcrumbTitles.get(title);
    const source = prior?.localized === previous ? prior.source : previous;
    breadcrumbTitles.set(title, { source, previous, localized: current });
  }
  const state = breadcrumbTitles.get(title);
  if (!state || state.localized !== current) return;
  const crumb = document.querySelector('#breadCrumb [aria-current="page"]')
    || Array.from(document.querySelectorAll('#breadCrumb li')).at(-1);
  if (!crumb || crumb.closest(EXCLUDED)) return;
  const walk = document.createTreeWalker(crumb, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    if (node.parentElement?.closest(EXCLUDED + ',script,style')) continue;
    const source = node.data.trim().replace(/^[＞>]\s*/u, '');
    if (source !== state.source && source !== state.previous) continue;
    node.data = node.data.replace(source, () => current);
  }
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
  const confirmed = byHash
    ? (names.includes(byHash) || fallback === byHash ? byHash : null)
    : fallback;
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
  if (prior && !tracked) {
    itemTitles.delete(title);
    delete title.dataset.zhxAttireNative;
  }
  let hasItems = false;
  const labels = new Set();
  for (const link of document.querySelectorAll(ITEM)) {
    if (link.closest(EXCLUDED)) continue;
    const item = translateOfficialItem(link);
    if (!item) continue;
    hasItems = true;
    if (title && item.native === native) labels.add(item.label);
  }
  if (title && (tracked || labels.size)) {
    // Do not pick the first of two contradictory exact native names.
    const desired = labels.size === 1 ? [...labels][0] : native;
    if (replaceLabel(title, displayed, desired)) {
      if (desired === native) {
        itemTitles.delete(title);
        delete title.dataset.zhxAttireNative;
      } else {
        itemTitles.set(title, { native, label: desired });
        title.dataset.zhxAttireNative = native;
      }
    }
  }
  return hasItems;
}

function translateSearchControls() {
  for (const input of document.querySelectorAll('form[role="search"][method="get"] input[type="search"][name="s"]')) {
    const form = input.form;
    if (form?.action !== location.origin + '/') continue;
    const zh = uiName(input.placeholder);
    if (zh && zh !== input.placeholder) input.placeholder = zh;
    for (const button of form.querySelectorAll('button[type="submit"],button:not([type])')) {
      replaceLabel(button, '検索', uiName('検索'));
    }
    // A named submit input contributes its value to the GET request.
    for (const button of form.querySelectorAll('input[type="submit"]:not([name])')) {
      if (button.value === '検索') button.value = uiName('検索');
    }
  }
}

// The macro generator is a separate tool. Translate only its landing-page
// heading and exact launch link, not the generated commands or form values.
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
  translateSeasonalRewardLinks();
  if (/^\/market\/?$/u.test(location.pathname)) replaceLabel(title, 'マーケット取引可能装備', uiName('マーケット取引可能装備'));
  dedupeRichHeadings();
  for (const card of document.querySelectorAll(CARD)) localizeCard(card);
  translateRecentPosts();
  translateArchiveControls();
  translateSearchControls();
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
  const itemDetail = translateOfficialItems(isGlamour ? null : title) && !isGlamour;
  if (itemDetail) translateEquipmentMetadata();
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
  if (document.title.endsWith(SITE_TITLE)) {
    document.title = document.title.slice(0, -SITE_TITLE.length) + uiName(SITE_TITLE);
  }
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
