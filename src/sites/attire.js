import { WIKI_ITEM } from '../core/constants.js';
import { resolveAllByName, resolveByHash, resolveDyeColor } from '../core/data/data-manager.js';
import { createTranslationObserver } from '../core/observer.js';
import { DICT, DICT_COMMON, lookupDutyName } from '../core/data/dictionary.js';

export { startAttire, translateAttirePage };

const UI = 'nav a,#globalMenuList a,#hamburgerMenuList a,#footerMenuList a,.a--spmenu-item-label,'
  + '#breadCrumb a,#jinrPostMeta .a--post-cat a,a[rel~="tag"],.a--post-category,'
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
const JOBS = new Set('ナイト 戦士 暗黒騎士 ガンブレイカー 竜騎士 リーパー モンク 侍 忍者 ヴァイパー 吟遊詩人 機工士 踊り子 黒魔道士 召喚士 赤魔道士 青魔道士 ピクトマンサー 白魔道士 学者 占星術師 賢者'.split(' '));
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
    || (Object.hasOwn(DICT_COMMON, source) ? DICT_COMMON[source] : null)
    || lookupDutyName(source);
}

function uiName(source) {
  const exact = exactUiName(source);
  if (exact) return exact;
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

function articleName(source) {
  return uniqueItemName(source) || groupArticleName(source);
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

function translateStructuredItems() {
  const glamour = hasCategory('glamour');
  const weapons = hasCategory('seriesb') || /weapon-coffer/i.test(location.pathname);
  const catalogue = document.body.matches('.page') || weapons;
  const title = document.querySelector('#jinrPostTitle');
  const detail = !glamour && !!(title?.dataset.zhxAttireNative || articleName(title?.textContent.trim()));
  for (const link of document.querySelectorAll('#postContent a[href]')) {
    if (link.closest(EXCLUDED + ',' + CARD) || link.origin !== location.origin) continue;
    if (glamour) {
      localizeCompositeLink(link, dyeName);
      continue;
    }
    if (!catalogue && !detail) continue;
    const source = link.textContent.trim();
    const zh = articleName(source);
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
  if (/^染色(?:不可|[◯○×✕])?$/u.test(source) || source === 'マーケット取引可能') return uiName(source);
  const match = /^Lv\s*(\d{1,3})\s+(.+)$/iu.exec(source);
  if (!match) return null;
  const jobs = /^(?:All Jobs?|AllJobs)$/i.test(match[2])
    ? ['全职业'] : match[2].split(/\s+/u).map(jobName);
  if (!jobs.length || !jobs.every(Boolean)) return null;
  return match[1] + '级 ' + jobs.join('／');
}

function translateEquipmentMetadata() {
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
  const nativeTitle = title?.textContent.trim();
  localizeRichMenu();
  for (const element of document.querySelectorAll(UI)) {
    if (element.closest(EXCLUDED)) continue;
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      if (node.parentElement?.closest(EXCLUDED + ',script,style,' + ITEM_LINK)) continue;
      const source = node.data.trim();
      const localized = uiName(source);
      if (localized && source !== localized) node.data = node.data.replace(source, () => localized);
    }
  }

  dedupeRichHeadings();
  for (const card of document.querySelectorAll(CARD)) localizeCard(card);
  translateRecentPosts();
  translateArchiveControls();
  translateSearchControls();
  translateSplitSeriesLink();
  translateStructuredItems();

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
  createTranslationObserver({
    handler(nodes) {
      if (nodes.some(node => {
        const el = node.nodeType === 1 ? node : node.parentElement;
        return el?.closest('#postContent,#jinrPostList,#globalMenuList,#hamburgerMenuList,#footerMenuList,#breadCrumb,aside')
          || el?.querySelector('#postContent,#jinrPostList,#breadCrumb,aside');
      })) translateAttirePage();
    },
  });
}
