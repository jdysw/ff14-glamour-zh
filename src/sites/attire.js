import { WIKI_ITEM } from '../core/constants.js';
import { resolveAllByName, resolveByHash } from '../core/data/data-manager.js';
import { DICT } from '../core/data/dictionary.js';

export { translateAttirePage };

const UI = 'nav a,#globalMenuList a,#hamburgerMenuList a,#footerMenuList a,.a--spmenu-item-label,'
  + '#breadCrumb a,#jinrPostMeta .a--post-cat a,a[rel~="tag"],.a--post-category,'
  + '#postContent :is(.a--richmenu-text,.a--h2rich-maincopy,.a--h2rich-subcopy,.c--tab-title,.rtoc-item a),'
  + '#postContent .c--tab-contents :is(h2,h3),#postContent .c--accordion-contents strong,#postContent .c--accordion-title,'
  + '#postContent #ws h5,body.home #postContent .has-text-align-center a,body:is(.page,.archive.tag) #jinrPostTitle';
const ITEM = '#postContent a[href*="/lodestone/playguide/db/item/"]';
const CARD = 'body:is(.home,.archive,.search) #jinrPostList a.c--post-link[rel~="bookmark"]';
const LODESTONE_ITEM = /^https:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com\/lodestone\/playguide\/db\/item\/([0-9a-f]{11})\/?(?:\?patch=latest)?$/i;
const EXCLUDED = 'form textarea,input,[contenteditable],#comments,.comment-list';

function uniqueItemName(source) {
  const names = resolveAllByName(source);
  return names.length === 1 ? names[0] : null;
}

function replaceLabel(element, source, translation) {
  if (!element || !translation || source === translation) return false;
  const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    // Do not flatten icons, nested links, or split bilingual marketing copy.
    if (node.data.trim() !== source || node.parentElement?.closest('script,style')) continue;
    node.data = node.data.replace(source, () => translation);
    return true;
  }
  return false;
}

function translateAttirePage() {
  for (const element of document.querySelectorAll(UI)) {
    if (element.closest(EXCLUDED)) continue;
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      if (node.parentElement?.closest(EXCLUDED + ',script,style')) continue;
      const source = node.data.trim();
      const localized = DICT['attire:' + source];
      if (localized && source !== localized) node.data = node.data.replace(source, () => localized);
    }
  }

  for (const card of document.querySelectorAll(CARD)) {
    const category = card.querySelector('.a--post-category');
    if (!category || category.classList.contains('category-glamour')) continue;
    const heading = card.querySelector('.a--post-title');
    const source = heading?.textContent.trim();
    if (source) replaceLabel(heading, source, uniqueItemName(source));
  }

  const searchTitle = document.querySelector('body.search #postHeader #jinrPostTitle');
  if (searchTitle) {
    const original = searchTitle.dataset.zhxAttireSearchTitle || searchTitle.textContent.trim();
    const match = /^「(.+)」の検索結果は([0-9,]+)件です$/u.exec(original);
    if (match) {
      const [, query, count] = match;
      if (replaceLabel(searchTitle, searchTitle.textContent.trim(), `「${uniqueItemName(query) || query}」的搜索结果：${count} 条`)) {
        searchTitle.dataset.zhxAttireSearchTitle = original;
      }
    }
  }

  const title = document.querySelector('#jinrPostTitle');
  const nativeTitle = title?.textContent.trim();
  const isGlamour = Array.from(document.querySelectorAll('#jinrPostMeta .a--post-cat a'))
    .some(link => /\/category\/glamour(?:\/|$)/i.test(link.pathname));
  for (const link of document.querySelectorAll(ITEM)) {
    if (link.closest(EXCLUDED)) continue;
    const hash = LODESTONE_ITEM.exec(link.getAttribute('href'))?.[1].toLowerCase();
    if (!hash) continue;
    const displayed = link.textContent.trim();
    const native = link.dataset.zhxAttireNative || displayed;
    const names = resolveAllByName(native);
    const byHash = resolveByHash(hash);
    // A few Lodestone items have a known official name but no canonical
    // hash yet. The local fallback identifies the hash AND original label.
    const confirmed = byHash
      ? (names.includes(byHash) ? byHash : null)
      : DICT['attire:item:' + hash + ':' + native];
    const zh = confirmed || (!byHash && names.length === 1 ? names[0] : null);
    if (!zh) continue;
    if (replaceLabel(link, displayed, zh)) link.dataset.zhxAttireNative = native;
    if (confirmed && link.textContent.trim() === zh) link.href = WIKI_ITEM + encodeURIComponent(zh);
    if (!isGlamour && native === nativeTitle) replaceLabel(title, nativeTitle, zh);
  }
}
