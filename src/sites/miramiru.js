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
const OFFICIAL_TAG_SUFFIX = /^(.{1,100}?)\s{0,8}(?:\((?:Official tag|公式タグ|공식 태그)\)|（(?:公式タグ|官方标签)）)$/u;
const knownMiramiruText = key => Object.hasOwn(DICT_MIRAMIRU, key) ? DICT_MIRAMIRU[key] : null;

function translateMiramiruCount(raw) {
  const posts = raw.match(/^([\d,]+)\s*(posts|件|건)$/u);
  if (posts) return posts[1] + ' 篇投稿';
  const count = raw.match(/^([\d,.]+[KM]?)\s*(Glamours|ミラプリ|투영|Creators|クリエイター|크리에이터|Likes|いいね|좋아요|uses|回使用|회 사용)$/);
  return count ? count[1] + ' ' + ({ Glamours: '套幻化', 'ミラプリ': '套幻化', '투영': '套幻化',
    Creators: '位作者', 'クリエイター': '位作者', '크리에이터': '位作者',
    Likes: '次点赞', 'いいね': '次点赞', '좋아요': '次点赞', uses: '次使用', '回使用': '次使用', '회 사용': '次使用' })[count[2]] : null;
}

function translateMiramiruTag(raw, official) {
  const marked = OFFICIAL_TAG_SUFFIX.exec(raw);
  if (!official && !marked) return null;
  const content = marked ? marked[1].trim() : raw;
  const tag = content.match(/^(#?)(.{1,60}?)(?: \((\d{1,10})\))?$/u);
  if (!tag) return null;
  const name = knownMiramiruText('tag:' + tag[2]);
  if (!name && !marked) return null;
  return tag[1] + (name || tag[2]) + (tag[3] ? ' (' + tag[3] + ')' : '') + (marked ? '（官方标签）' : '');
}

function translateMiramiruFilterSummary(raw) {
  const job = raw.match(/^(?:Job|ジョブ|직업):\s*(.{1,160})$/u);
  if (job) return '职业：' + job[1].split(/[,、]\s*/u).map(name => knownMiramiruText(name) || knownMiramiruText('job:' + name) || name).join('、');
  const tag = raw.match(/^(?:Tag|タグ|태그):\s*(.{1,100})$/u);
  if (tag) return '标签：' + (knownMiramiruText('tag:' + tag[1]) || tag[1]);
  const slot = raw.match(/^([^:]{1,30}):\s*(.{1,100})$/u);
  const label = slot && knownMiramiruText('slot:' + slot[1]);
  return label ? label + '：' + (resolveByName(slot[2]) || slot[2]) : null;
}

function trMiramiru(text, officialTag = false) {
  const raw = text?.trim();
  if (!raw) return text;
  const normalized = raw.replace(/\s+/gu, ' ');
  let zh = officialTag ? translateMiramiruTag(raw, true) : null;
  if (!zh) zh = knownMiramiruText(raw) || knownMiramiruText(normalized);
  if (!zh && raw.length <= 100) zh = resolveByName(raw);
  if (!zh) zh = translateMiramiruCount(raw) || translateMiramiruTag(raw, officialTag) || translateMiramiruFilterSummary(raw);
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

function isMiramiruOfficialTag(element) {
  const label = element.closest('[aria-label]')?.getAttribute('aria-label') || '';
  const badge = element.closest('[data-slot="badge"]')?.textContent.trim() || '';
  const knownBadge = badge.startsWith('#') && !!knownMiramiruText('tag:' + badge.slice(1).trim());
  return knownBadge || OFFICIAL_TAG_SUFFIX.test(label) || !!element.closest('[role="option"]')?.querySelector('svg.lucide-shield');
}

function translateMiramiruText(raw, element) {
  const officialTag = isMiramiruOfficialTag(element);
  const badge = element.closest('[data-slot="badge"],[role="option"] .truncate');
  if (badge?.textContent.trim().startsWith('#') && !officialTag) return raw;
  const jobButton = element.closest('[role="dialog"] button');
  if (jobButton) {
    const job = knownMiramiruText('job:' + raw.trim());
    if (job) {
      const title = knownMiramiruText('job-title:' + raw.trim());
      if (title && jobButton.getAttribute('title') !== title) jobButton.setAttribute('title', title);
      return raw.replace(raw.trim(), job);
    }
  }
  // An equipment hash is authoritative even when international names differ.
  const link = element.closest(ITEM_LINK);
  const trimmed = raw?.trim();
  const item = link?.dataset.zhxMiramiruZh;
  if (item && trimmed && (trimmed === link.dataset.zhxMiramiruName || resolveByName(trimmed))) return raw.replace(trimmed, item);
  const aboutParticle = /^\/(?:en\/|ko\/|ja\/)?about\/?$/.test(location.pathname)
    && element.closest('h1') && (trimmed === 'を' || trimmed === '을');
  if (aboutParticle) return raw.replace(trimmed, '，');
  return trMiramiru(raw, officialTag);
}

function processMiramiruNode(node) {
  const element = node.nodeType === 1 ? node : node.parentElement;
  if (!element || element.closest(SKIP)) return;
  if (node.nodeType === 3) {
    const raw = node.nodeValue;
    const next = translateMiramiruText(raw, element);
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
