/* @phase15-module-order:sites/mirapri-eden */
import { DICT, DICT_COMMON } from '../core/dictionary.js';
import { resolveByHash, resolveByName } from '../core/data-manager.js';
import { SKIP_TAGS, localScope, _markScan } from '../core/dom.js';
import { createObserver } from '../core/observer.js';
import { bindZhxItemClick, ensureZhxItemStyle } from '../core/item-links.js';
import { WIKI_ITEM } from '../core/constants.js';
import { safe } from '../core/runtime.js';

export { trEden, translateEdenPage, startEden };

// 只改可见文本和显示属性，保留 Vue 节点、内部枚举和用户填写的值。
const SKIP = 'script,style,noscript,textarea,input,[contenteditable]:not([contenteditable="false"]),.v-icon,canvas,'
  + '.image-container .overlay,.recipe-dialog-title-text,.recipe-dialog-user,.recipe-dialog-text,'
  + '.gallery-hero-text,.gallery-tile-title,.gallery-tile-img,.zhx-skip';
const EQUIPMENT = '.v-data-table td,.v-list-item__title,.v-select__selection,#equipment-view h6';
const ITEM_URL = /^https:\/\/(?:jp|na|eu|de|fr)\.finalfantasyxiv\.com\/lodestone\/playguide\/db\/item\/([a-f0-9]+)\/?$/i;
const known = raw => Object.hasOwn(DICT, 'eden:' + raw) ? DICT['eden:' + raw] : null;

function trEden(text) {
  const raw = text?.trim();
  if (!raw) return text;
  let value = known(raw) || known(raw.replace(/\s+/gu, ' '))
    || (Object.hasOwn(DICT_COMMON, raw) ? DICT_COMMON[raw] : null);
  const numbers = raw.match(/\d+/gu);
  if (!value && numbers?.length === 1) value = known(raw.replace(/\d+/u, '{count}'))?.replace('{count}', numbers[0]);
  const summary = !value && /^(種族（任意）|性別（任意）|Race \(optional\)|Gender \(optional\)):\s*(.{1,50})$/u.exec(raw);
  if (summary) value = trEden(summary[1]) + '：' + trEden(summary[2]);
  const page = !value && /^(\d+)-(\d+) of (\d+)$/u.exec(raw);
  if (page) value = `第 ${page[1]}–${page[2]} 项，共 ${page[3]} 项`;
  return value ? text.replace(raw, value) : text;
}

function isRankingName(element) {
  return /^#\/components\/popular-equipment\/?(?:\?|$)/.test(location.hash)
    && element.matches('.flex-grow-1');
}

function isEdenEquipmentSearch(input, label) {
  if (/^(?:装備を検索する|search for equipment|搜索装备)$/i.test(label)) return true;
  // Vuetify solo 输入框在开始输入后会移除 label，仍按实测容器识别。
  return /^#\/components\/glamour-recipe-maker(?:\/|\?|$)/.test(location.hash)
    && !!input.closest('main .v-toolbar .v-autocomplete');
}

function markEdenSearch(root) {
  const fields = root.matches?.('input') ? [root] : root.querySelectorAll('input');
  for (const input of fields) {
    if (input.readOnly || input.type === 'hidden') continue;
    const field = input.closest('.v-input');
    const label = field?.querySelector('label')?.textContent.trim() || '';
    const global = input.closest('.input-area,.gallery-search');
    const equipment = isEdenEquipmentSearch(input, label);
    if (!global && !equipment) { delete input.dataset.zhxEdenSearch; delete input.dataset.zhxEdenMaker; continue; }
    input.dataset.zhxEdenSearch = '1';
    if (equipment) input.dataset.zhxEdenMaker = '1';
    else delete input.dataset.zhxEdenMaker;
    const hint = '搜索（支持中文装备名）';
    if (input.getAttribute('placeholder') !== hint) input.setAttribute('placeholder', hint);
  }
}

function updateEdenItemTarget(element) {
  const href = element.getAttribute('href') || '';
  const hash = ITEM_URL.exec(href)?.[1];
  const zh = hash && resolveByHash(hash);
  if (element.matches('a') && element.dataset.zhxItem && href !== WIKI_ITEM + encodeURIComponent(element.dataset.zhxItem))
    delete element.dataset.zhxItem;
  if (zh) {
    element.dataset.zhxItem = zh;
    element.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
    element.setAttribute('title', '查看灰机 Wiki：' + zh);
  }
  const native = element.textContent.trim();
  const item = (isRankingName(element) || element.matches('.v-data-table td,#equipment-view h6')) && resolveByName(native);
  if (native && element.matches('#equipment-view h6') && native !== element.dataset.zhxItem) element.dataset.zhxEdenNative = native;
  // 装备名才获得 Wiki 点击；下拉选项和筛选按钮继续由站点处理。
  if (item && !element.querySelector('button,input,select,[role="button"]')) element.dataset.zhxItem = item;
  else if (element.dataset.zhxItem && !element.matches('a') && native !== element.dataset.zhxItem) delete element.dataset.zhxItem;
}

function translateEdenElement(element) {
  if (element.closest(SKIP)) return;
  updateEdenItemTarget(element);
  for (const attr of ['title', 'aria-label', 'alt', 'placeholder']) {
    const value = element.getAttribute(attr);
    if (!value) continue;
    const next = trEden(value);
    if (next !== value) element.setAttribute(attr, next);
  }
}

function translateEdenText(node) {
  const element = node.parentElement;
  if (!element || element.closest(SKIP)) return;
  const raw = node.nodeValue;
  const item = element.closest(EQUIPMENT + ',#equipment-view button') || (isRankingName(element) && element);
  const name = item && resolveByName(raw.trim());
  const next = name ? raw.replace(raw.trim(), name) : trEden(raw);
  if (raw !== next) node.nodeValue = next;
}

function translateEdenTitle() {
  const title = document.title;
  const pieces = title.split(' | ');
  const next = trEden(pieces[0]) + (pieces.length > 1 ? ' | ' + pieces.slice(1).join(' | ') : '');
  if (title !== next) document.title = next;
}

function translateEdenPage(rootArg) {
  let root = rootArg || document.body;
  if (!root) return;
  if (root.nodeType === 1 && root.matches('input')) { markEdenSearch(root); return; }
  if (root.nodeType === 3) {
    // 名称节点可能由 Vue 替换，先更新其所属元素上的装备目标。
    root = root.parentElement;
  }
  if (!root || root.closest?.(SKIP)) return;
  _markScan(localScope(rootArg));
  markEdenSearch(root);
  translateEdenElement(root);
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeType === 1 && (SKIP_TAGS.has(node.tagName) || node.matches(SKIP))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walk.nextNode()) {
    if (walk.currentNode.nodeType === 3) translateEdenText(walk.currentNode);
    else translateEdenElement(walk.currentNode);
  }
  translateEdenTitle();
}

function startEden() {
  ensureZhxItemStyle('zhx-eden-item-style');
  bindZhxItemClick('__zhxEdenItemClick');
  safe(translateEdenPage, 'Eden 首屏')();
  createObserver({ root: document.documentElement, characterData: true,
    attributes: true, attributeFilter: ['href', 'title', 'alt', 'placeholder', 'aria-label'], debounce: 120,
    handler(nodes, texts = []) {
      for (const node of [...nodes, ...texts]) safe(translateEdenPage, 'Eden 动态翻译')(node);
    },
  });
}
