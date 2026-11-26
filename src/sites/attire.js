import { WIKI_ITEM } from '../core/constants.js';
import { resolveAllByName, resolveByHash, resolveDyeColor } from '../core/data/data-manager.js';
import { createTranslationObserver } from '../core/observer.js';
import { DICT, lookupDutyName } from '../core/data/dictionary.js';

export { startAttire, translateAttirePage };

const UI = 'nav a,#globalMenuList a,#hamburgerMenuList a,#footerMenuList a,.a--spmenu-item-label,'
  + '#breadCrumb a,#jinrPostMeta .a--post-cat a,a[rel~="tag"],.a--post-category,'
  + '#postContent :is(.a--richmenu-text,.a--h2rich-maincopy,.a--h2rich-subcopy,.c--tab-title,.rtoc-item a),'
  + '#postContent .c--tab-contents :is(h2,h3),#postContent .c--accordion-contents strong,#postContent .c--accordion-title,'
  + '#postContent #ws h5,body.home #postContent .has-text-align-center a,body:is(.page,.archive.tag,.archive.category) #jinrPostTitle,'
  + '#postContent .wp-block-heading,#postContent .wp-block-button__link,#postContent .a--post-category,'
  + '.widget-title,.widgettitle,.tag-cloud-link,.wp-block-tag-cloud a,.wp-block-categories a,.wp-block-archives a';
const ITEM = '#postContent a[href*="/lodestone/playguide/db/item/"]';
const CARD = 'a.c--post-link[rel~="bookmark"]';
const RECENT = '.widget_recent_entries a,.wp-block-latest-posts__post-title';
const LODESTONE_ITEM = /^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com\/lodestone\/playguide\/db\/item\/([0-9a-f]{11})\/?(?:\?patch=latest)?$/i;
const EXCLUDED = 'form textarea,input,[contenteditable],#comments,.comment-list';
const JOBS = new Set('ナイト 戦士 暗黒騎士 ガンブレイカー 竜騎士 リーパー モンク 侍 忍者 ヴァイパー 吟遊詩人 機工士 踊り子 黒魔道士 召喚士 赤魔道士 青魔道士 ピクトマンサー 白魔道士 学者 占星術師 賢者'.split(' '));
const SITE_TITLE = '〖FF14 装備手帳〗｜ミラプリ用装備見た目まとめ';

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

function uiName(source) {
  const exact = DICT['attire:' + source] || lookupDutyName(source);
  if (exact) return exact;
  const count = /^(.+?)(\s*\([\d,]+\))$/u.exec(source);
  if (count) {
    const name = DICT['attire:' + count[1]] || lookupDutyName(count[1]);
    return name ? name + count[2] : null;
  }
  const duty = /^Lv\s*(\d{1,3})\s*ID\s+(.+)$/iu.exec(source);
  const name = duty && lookupDutyName(duty[2]);
  return name ? duty[1] + '级副本 ' + name : null;
}

// These display titles are not individual item identities. Never use them for
// Wiki redirects or search conversion.
function groupArticleName(source) {
  if (!source) return null;
  if (uniqueItemName(source)) return null;
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
  if (/^染色(?:不可|[◯○×✕])?$/u.test(source)) return uiName(source);
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

function translateAttirePage() {
  const title = document.querySelector('#jinrPostTitle');
  const nativeTitle = title?.textContent.trim();
  localizeRichMenu();
  for (const element of document.querySelectorAll(UI)) {
    if (element.closest(EXCLUDED)) continue;
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      if (node.parentElement?.closest(EXCLUDED + ',script,style,a[href*="/lodestone/playguide/db/item/"]')) continue;
      const source = node.data.trim();
      const localized = uiName(source);
      if (localized && source !== localized) node.data = node.data.replace(source, () => localized);
    }
  }

  dedupeRichHeadings();
  for (const card of document.querySelectorAll(CARD)) localizeCard(card);
  translateRecentPosts();
  for (const input of document.querySelectorAll('form[role="search"][method="get"] input[type="search"][name="s"]')) {
    if (input.form?.action !== location.origin + '/') continue;
    const zh = uiName(input.placeholder);
    if (zh && zh !== input.placeholder) input.placeholder = zh;
  }
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
  const itemDetail = !isGlamour && !!document.querySelector(ITEM + ',#postContent a[data-zhx-attire-native]');
  if (itemDetail) translateEquipmentMetadata();
  for (const link of document.querySelectorAll(ITEM)) {
    if (link.closest(EXCLUDED)) continue;
    const hash = LODESTONE_ITEM.exec(link.getAttribute('href'))?.[1].toLowerCase();
    if (!hash) continue;
    const displayed = link.textContent.trim();
    const native = displayed === link.dataset.zhxAttireLocalizedLabel
      ? link.dataset.zhxAttireNative : displayed;
    const names = resolveAllByName(native);
    const byHash = resolveByHash(hash);
    // A few Lodestone items have a known official name but no canonical
    // hash yet. The local fallback identifies the hash AND original label.
    const fallback = DICT['attire:item:' + hash + ':' + native];
    const confirmed = byHash
      ? (names.includes(byHash) || fallback === byHash ? byHash : null)
      : fallback;
    const zh = confirmed || (!byHash && names.length === 1 ? names[0] : null);
    if (!zh) {
      // A provisional name-only match can become ambiguous or contradicted
      // when the canonical hash/name table arrives. Revert only our own label.
      if (displayed !== native && replaceLabel(link, displayed, native)) {
        delete link.dataset.zhxAttireNative;
        delete link.dataset.zhxAttireLocalizedLabel;
        if (!isGlamour && title?.dataset.zhxAttireNative === native
            && title.textContent.trim() === displayed) {
          replaceLabel(title, displayed, native);
          delete title.dataset.zhxAttireNative;
        }
      }
      continue;
    }
    if (replaceLabel(link, displayed, zh)) {
      link.dataset.zhxAttireNative = native;
      link.dataset.zhxAttireLocalizedLabel = zh;
    }
    if (confirmed && link.textContent.trim() === zh) link.href = WIKI_ITEM + encodeURIComponent(zh);
    if (!isGlamour && native === nativeTitle && replaceLabel(title, nativeTitle, zh)) {
      title.dataset.zhxAttireNative = nativeTitle;
    }
  }
  if (title && !isGlamour && (itemDetail || hasCategory('seriesb'))) {
    const source = title.textContent.trim();
    const zh = groupArticleName(source);
    if (replaceLabel(title, source, zh)) title.dataset.zhxAttireNative = source;
  }
  const localizedTitle = title?.textContent.trim();
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
        return el?.closest('#postContent,#jinrPostList,#globalMenuList,#hamburgerMenuList,#footerMenuList,aside')
          || el?.querySelector('#postContent,#jinrPostList,aside');
      })) translateAttirePage();
    },
  });
}
