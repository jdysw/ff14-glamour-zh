/* @phase15-module-order:sites/xivc */
import { DICT, DICT_COMMON, DICT_MIRAMIRU } from '../core/dictionary.js';
import { resolveByName } from '../core/data-manager.js';
import { dedupeByAncestor, localScope, _markScan } from '../core/dom.js';
import { createObserver } from '../core/observer.js';
import { WIKI_ITEM } from '../core/constants.js';
import { safe } from '../core/runtime.js';

export { startXivc, translateXivcPage, trXivc };

const SKIP = 'script,style,noscript,textarea,input,[contenteditable]:not([contenteditable="false"]),canvas,'
  + '.zhx-skip,.preset-name,#fps';
const ATTR_SKIP = 'script,style,noscript,textarea,[contenteditable]:not([contenteditable="false"]),canvas,'
  + '.zhx-skip,.preset-name,#fps';
const GEAR_NAME = '#item-grid .item-card:not(.set-card) > .item-card-name,#slot-list .slot-row > .slot-item';
const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt'];
const UI_ROOTS = ['#drawer', '#freecam-button', '#custom-dialog-modal'];
const EQUIPMENT_SLOTS = new Set(['Head', 'Body', 'Gloves', 'Legs', 'Feet', 'Facewear']);

function trXivc(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return raw;
  return (Object.hasOwn(DICT, 'xivc:' + text) ? DICT['xivc:' + text]
    : Object.hasOwn(DICT_COMMON, text) ? DICT_COMMON[text] : null) || raw;
}

function translateAttribute(raw, attr) {
  if (attr === 'title') {
    const dye = /^Dye ([12]): (.+)$/u.exec(raw);
    if (dye) {
      const color = Object.hasOwn(DICT_MIRAMIRU, dye[2]) ? DICT_MIRAMIRU[dye[2]] : trXivc(dye[2]);
      if (color !== dye[2]) return `染剂 ${dye[1]}：${color}`;
    }
    const update = /^Update Preset with current (equipment|customization)$/u.exec(raw);
    if (update) return update[1] === 'equipment' ? '用当前装备更新预设' : '用当前自定义内容更新预设';
  }
  return trXivc(raw);
}

function translatePresetText(raw) {
  let match = /^Overwrite (equipment|customization) preset "([\s\S]*)" with current (equipment|customization)\?$/u.exec(raw);
  if (match && match[1] === match[3]) {
    const type = match[1] === 'equipment' ? '装备' : '自定义内容';
    return `确定要用当前${type}覆盖预设“${match[2]}”吗？`;
  }
  match = /^Delete (equipment|customization) preset "([\s\S]*)"\?$/u.exec(raw);
  if (match) return `确定要删除${match[1] === 'equipment' ? '装备' : '自定义内容'}预设“${match[2]}”吗？`;
  match = /^Enter a name for this (equipment|customization) preset:$/u.exec(raw);
  if (match) return `请输入${match[1] === 'equipment' ? '装备' : '自定义内容'}预设名称：`;
  return trXivc(raw);
}

function gearWikiLink(element, zh) {
  let link = element.querySelector(':scope > .zhx-xivc-wiki');
  const href = WIKI_ITEM + encodeURIComponent(zh);
  if (!link) {
    link = document.createElement('a');
    link.className = 'zhx-xivc-wiki zhx-skip';
    link.textContent = 'Wiki';
    link.target = '_blank';
    link.rel = 'nofollow noreferrer noopener';
    link.addEventListener('click', event => event.stopPropagation());
    element.appendChild(link);
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  const title = '查看灰机 Wiki：' + zh;
  if (link.getAttribute('title') !== title) link.setAttribute('title', title);
}

function nativeNameParts(element) {
  const children = [...element.childNodes];
  const label = children.find(child => child.nodeType === 1 && child.matches('.zhx-xivc-name')) || null;
  const link = children.find(child => child.nodeType === 1 && child.matches('.zhx-xivc-wiki')) || null;
  const nativeNodes = children.filter(child => child !== label && child !== link
    && (child.nodeType === 3 || child.nodeType === 1 && child.tagName === 'MARK'));
  const hasForeign = children.some(child => child !== label && child !== link && !nativeNodes.includes(child));
  return { label, link, nativeNodes, hasForeign, native: nativeNodes.map(child => child.textContent).join('').trim() };
}

function updateGearLabel(element, value) {
  const parts = nativeNameParts(element);
  let { label } = parts;
  if (!label) {
    if (parts.hasForeign || !parts.nativeNodes.length) return null;
    label = document.createElement('span');
    label.className = 'zhx-xivc-name';
    element.appendChild(label);
  }
  for (const child of parts.nativeNodes) child.remove();
  if (label.textContent !== value) label.textContent = value;
  return label;
}

function nativeGearName(element) {
  const parts = nativeNameParts(element);
  if (parts.native) return parts.native;
  if (parts.hasForeign) return null;
  return parts.label ? element.dataset.zhxXivcNative || parts.label.textContent.trim() : element.textContent.trim();
}

function isEquipmentSlotItem(element) {
  const slot = element.parentElement?.querySelector('.slot-name');
  return EQUIPMENT_SLOTS.has(slot?.dataset.zhxXivcNative || slot?.textContent.trim());
}

function translateSelectedSlot(element) {
  if (isEquipmentSlotItem(element)) {
    translateGearName(element);
    return;
  }
  const native = nativeGearName(element);
  const translated = trXivc(native);
  if (translated !== native || element.querySelector(':scope > .zhx-xivc-name'))
    updateGearLabel(element, translated);
  element.querySelector(':scope > .zhx-xivc-wiki')?.remove();
  delete element.dataset.zhxXivcNative;
}

function translateGearName(element) {
  if (element.closest(SKIP)) return;
  const native = nativeGearName(element);
  if (!native) return;
  const zh = resolveByName(native);
  if (zh) {
    element.dataset.zhxXivcNative = native;
    if (!updateGearLabel(element, zh)) return;
    gearWikiLink(element, zh);
    return;
  }
  const fixed = trXivc(native);
  const hasName = !!element.querySelector(':scope > .zhx-xivc-name');
  if (fixed !== native || hasName) updateGearLabel(element, fixed);
  element.querySelector(':scope > .zhx-xivc-wiki')?.remove();
  delete element.dataset.zhxXivcNative;
}

function pickerMode(grid) {
  if (grid.classList.contains('grid-sets')) return 'sets';
  const actions = grid.querySelectorAll('.unequip-card > .item-card-name');
  for (const element of actions) {
    const raw = element.dataset.zhxXivcNative || element.textContent.trim();
    if (['Back', 'No Dye', '返回', '不染色'].includes(raw)) return 'dye';
    if (raw === 'Unequip' || raw === '卸下') return 'gear';
  }
  return null;
}

function translatePickerCard(element, isDye) {
  const native = nativeGearName(element);
  if (!native) return;
  if (isDye) {
    element.querySelector(':scope > .zhx-xivc-wiki')?.remove();
    const translated = Object.hasOwn(DICT_MIRAMIRU, native) ? DICT_MIRAMIRU[native] : trXivc(native);
    updateGearLabel(element, translated);
    element.dataset.zhxXivcNative = native;
    return;
  }
  if (element.closest('.unequip-card')) {
    updateGearLabel(element, trXivc(native));
    return;
  }
  translateGearName(element);
}

function translateAttributes(element) {
  if (element.matches?.(ATTR_SKIP) || element.closest?.(ATTR_SKIP)) return;
  for (const attr of ATTRIBUTES) {
    const raw = element.getAttribute(attr);
    if (!raw) continue;
    const next = translateAttribute(raw, attr);
    if (next !== raw) element.setAttribute(attr, next);
  }
}

function translateStaticText(scope) {
  if (!scope) return;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP) || parent.closest(GEAR_NAME)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const raw = node.nodeValue;
    const trimmed = raw.trim();
    const next = translatePresetText(trimmed);
    if (!trimmed || next === trimmed) continue;
    const leading = raw.match(/^\s*/u)?.[0] || '';
    const trailing = raw.match(/\s*$/u)?.[0] || '';
    node.nodeValue = leading + next + trailing;
  }
}

function scopedMatches(scope, selector) {
  const matches = scope.matches?.(selector) ? [scope] : [];
  matches.push(...scope.querySelectorAll(selector));
  return matches;
}

function markSlotLabels(context) {
  if (context.slotLabelsMarked) return;
  const slotList = document.getElementById('slot-list');
  if (!slotList) return;
  for (const element of scopedMatches(slotList, '.slot-name')) {
    if (!element.dataset.zhxXivcNative) element.dataset.zhxXivcNative = element.textContent.trim();
  }
  context.slotLabelsMarked = true;
}

function translateScopeAttributes(scope) {
  for (const element of scopedMatches(scope, '[title],[aria-label],[placeholder],[alt]'))
    translateAttributes(element);
}

function translateScopeNames(scope, mode) {
  for (const element of scopedMatches(scope, GEAR_NAME)) {
    if (element.matches('#slot-list .slot-row > .slot-item')) {
      translateSelectedSlot(element);
      continue;
    }
    if (!element.matches('#item-grid .item-card:not(.set-card) > .item-card-name')) {
      translateGearName(element);
      continue;
    }
    if (mode === 'gear' || mode === 'dye') translatePickerCard(element, mode === 'dye');
  }
}

function syncSearchMarker(mode) {
  const search = document.getElementById('item-search');
  if (!search) return;
  if (mode === 'gear' || mode === 'sets') search.dataset.zhxXivcSearch = '1';
  else delete search.dataset.zhxXivcSearch;
}

function pickerContext() {
  const grid = document.getElementById('item-grid');
  return { grid, mode: grid ? pickerMode(grid) : null, slotLabelsMarked: false };
}

function processScope(scope, context) {
  if (!scope) return;
  _markScan(localScope(scope));
  markSlotLabels(context);
  translateStaticText(scope);
  translateScopeAttributes(scope);
  const { grid, mode } = context;
  if (grid && mode) grid.dataset.zhxXivcPicker = mode;
  else if (grid) delete grid.dataset.zhxXivcPicker;
  translateScopeNames(scope, mode);
}

function translateXivcPage(rootArg) {
  const scope = localScope(rootArg);
  const root = scope || document.body || document.documentElement;
  if (!root) return;
  const context = pickerContext();
  processScope(root, context);
  syncSearchMarker(context.mode);
}

function ensureXivcStyle() {
  if (document.getElementById('zhx-xivc-style')) return;
  const style = document.createElement('style');
  style.id = 'zhx-xivc-style';
  style.textContent = '.zhx-xivc-wiki{display:inline-block;margin-left:.45em;font-size:.78em;line-height:1.35;vertical-align:middle;opacity:.72}'
    + '.zhx-xivc-wiki:hover{opacity:1}';
  (document.head || document.documentElement).appendChild(style);
}

function startXivc() {
  ensureXivcStyle();
  safe(translateXivcPage, 'xivc 首屏')(document.getElementById('app') || document.body);
  for (const selector of UI_ROOTS) {
    const root = document.querySelector(selector);
    if (!root) continue;
    createObserver({
      root,
      debounce: 180,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
      handler(nodes, texts = []) {
        const scopes = dedupeByAncestor([...nodes, ...texts].map(localScope).filter(Boolean));
        const context = pickerContext();
        const process = safe(processScope, 'xivc 动态翻译');
        for (const node of scopes) process(node, context);
        syncSearchMarker(context.mode);
      },
    });
  }
}
