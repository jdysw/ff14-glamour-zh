/* @phase15-module-order:sites/miramiru */
import { DICT_MIRAMIRU } from '../core/dictionary.js';
import { resolveByHash, resolveByName } from '../core/data-manager.js';
import { SKIP_TAGS, _markScan, localScope } from '../core/dom.js';
import { createObserver } from '../core/observer.js';
import { safe } from '../core/runtime.js';
import { WIKI_ITEM } from '../core/constants.js';

export { trMiramiru, translateMiramiruPage, translateMiramiruTitle, startMiramiru };

// Preserve React-owned elements and their children. Only replace text nodes and
// the main equipment-name anchor's destination; secondary official/source links
// and /items/<id> (other outfits using this equipment) retain their destinations.
const SKIP = 'script,style,noscript,textarea,[contenteditable]:not([contenteditable="false"]),.zhx-skip';
const ITEM_LINK = 'a.eorzeadb_link';
const officialItem = /^https:\/\/(?:na|eu|jp|de|fr)\.finalfantasyxiv\.com\/lodestone\/playguide\/db\/item\/([a-f0-9]+)\/?$/i;

function trMiramiru(text) {
  const raw = text?.trim();
  if (!raw) return text;
  let zh = Object.hasOwn(DICT_MIRAMIRU, raw) ? DICT_MIRAMIRU[raw] : null;
  if (!zh && raw.length <= 100) zh = resolveByName(raw);
  if (!zh) {
    const count = raw.match(/^([\d,.]+[KM]?)\s*(Glamours|ミラプリ|투영|Creators|クリエイター|크리에이터|Likes|いいね|좋아요|uses|回使用|회 사용)$/);
    if (count) zh = count[1] + ' ' + ({ Glamours: '套幻化', 'ミラプリ': '套幻化', '투영': '套幻化',
      Creators: '位作者', 'クリエイター': '位作者', '크리에이터': '位作者',
      Likes: '次点赞', 'いいね': '次点赞', '좋아요': '次点赞', uses: '次使用', '回使用': '次使用', '회 사용': '次使用' })[count[2]];
  }
  if (!zh || zh === raw) return text;
  return text.replace(raw, zh);
}

function translateMiramiruLink(element) {
  if (!element.matches?.(ITEM_LINK)) return;
  const href = element.getAttribute('href') || '';
  const hash = officialItem.exec(href)?.[1];
  // A reused React node must not keep the preceding equipment's destination.
  if (hash && element.dataset.zhxMiramiruHref !== href) {
    delete element.dataset.zhxMiramiruZh;
    element.dataset.zhxMiramiruHref = href;
  }
  const name = element.querySelector('img[alt]')?.getAttribute('alt');
  const zh = (hash && (resolveByHash(hash) || resolveByName(name))) || element.dataset.zhxMiramiruZh;
  if (!zh) return;
  if (hash && name) element.dataset.zhxMiramiruName = name;
  element.dataset.zhxMiramiruZh = zh;
  const wiki = WIKI_ITEM + encodeURIComponent(zh);
  if (href !== wiki) element.setAttribute('href', wiki);
  const title = '查看灰机 Wiki：' + zh;
  if (element.getAttribute('title') !== title) element.setAttribute('title', title);
}

function translateMiramiruAttributes(element) {
  for (const attr of ['placeholder', 'alt', 'title', 'aria-label']) {
    const raw = element.getAttribute(attr);
    if (!raw) continue;
    const next = trMiramiru(raw);
    if (next !== raw) element.setAttribute(attr, next);
  }
}

function processMiramiruNode(node) {
  const element = node.nodeType === 1 ? node : node.parentElement;
  if (!element || element.closest(SKIP)) return;
  if (node.nodeType === 3) {
    // An equipment hash is authoritative even when international names differ.
    const link = element.closest(ITEM_LINK);
    const raw = node.nodeValue;
    const trimmed = raw?.trim();
    const item = link?.dataset.zhxMiramiruZh;
    const isName = item && trimmed && (trimmed === link.dataset.zhxMiramiruName || resolveByName(trimmed));
    const next = isName ? raw.replace(trimmed, item) : trMiramiru(raw);
    if (next !== raw) node.nodeValue = next;
    return;
  }
  translateMiramiruLink(element);
  translateMiramiruAttributes(element);
}

function translateMiramiruPage(rootArg) {
  const root = rootArg || document.body || document.documentElement;
  if (!root) return;
  if (root.nodeType === 3) { processMiramiruNode(root); translateMiramiruTitle(); return; }
  if (root.tagName === 'TEXTAREA') { translateMiramiruAttributes(root); return; }
  if (root.closest?.(SKIP)) return;
  _markScan(localScope(rootArg));
  // Resolve links before walking their names, including when a text-only
  // mutation triggers a local scan after a React navigation.
  const links = [root.closest?.(ITEM_LINK), ...root.querySelectorAll(ITEM_LINK)];
  for (const link of links) if (link) translateMiramiruLink(link);
  processMiramiruNode(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeType === 1 && (SKIP_TAGS.has(node.tagName) || node.matches(SKIP))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) processMiramiruNode(walker.currentNode);
  for (const field of root.querySelectorAll('textarea')) {
    if (!field.parentElement?.closest(SKIP)) translateMiramiruAttributes(field);
  }
  translateMiramiruTitle();
}

function translateMiramiruTitle() {
  const next = trMiramiru(document.title).replace(/FFXIV (?:Glamour Showcase|Mirapuri Showcase|ミラプリ紹介サイト|투영 소개 사이트)/g, 'FF14 幻化展示');
  if (next !== document.title) document.title = next;
}

function startMiramiru() {
  safe(translateMiramiruPage, 'Miramiru 首屏')();
  createObserver({
    root: document.documentElement,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'alt', 'title', 'aria-label', 'href'],
    debounce: 120,
    handler(nodes, texts = []) {
      for (const node of [...nodes, ...texts]) safe(translateMiramiruPage, 'Miramiru 动态翻译')(node);
    },
  });
}
