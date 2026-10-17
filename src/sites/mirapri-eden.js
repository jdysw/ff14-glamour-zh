/* @phase15-module-order:sites/mirapri-eden */
import { DICT, DICT_COMMON, DICT_MIRAMIRU } from '../core/dictionary.js';
import { resolveByHash, resolveByName } from '../core/data-manager.js';
import { SKIP_TAGS, localScope, _markScan, dedupeByAncestor } from '../core/dom.js';
import { createObserver } from '../core/observer.js';
import { bindZhxItemClick, ensureZhxItemStyle } from '../core/item-links.js';
import { WIKI_ITEM } from '../core/constants.js';
import { safe } from '../core/runtime.js';

export { trEden, translateEdenPage, startEden, edenImageKey, indexEdenRecipes, loadEdenRecipes };

// 只改可见文本和显示属性，保留 Vue 节点、内部枚举和用户填写的值。
const SKIP = 'script,style,noscript,textarea,input,[contenteditable]:not([contenteditable="false"]),.v-icon,canvas,'
  + '.image-container .overlay,.recipe-dialog-title-text,.recipe-dialog-user,.recipe-dialog-text,'
  + '.gallery-hero-text,.gallery-tile-title,.gallery-tile-img,.zhx-skip';
const EQUIPMENT = '.v-data-table td,.v-list-item__title,.v-select__selection,#equipment-view h6';
const ITEM_TARGET = 'a,.flex-grow-1,.v-data-table td,#equipment-view h6';
const ITEM_URL = /^https:\/\/(?:jp|na|eu|de|fr)\.finalfantasyxiv\.com\/lodestone\/playguide\/db\/item\/([a-f0-9]+)\/?$/i;
const known = raw => Object.hasOwn(DICT, 'eden:' + raw) ? DICT['eden:' + raw] : null;

const RECIPE_DATA = 'https://mirapri.ff14eden.work/glamour/all_users_glamour.json';
const RECIPE_DIALOGS = '.v-dialog--active.recipe-dialog-content .recipe-dialog-card,.v-dialog--active.glamour-dialog-content .recipe-dialog-card';
const RECIPE_PANEL = 'zhx-eden-recipe-items';
let recipeRequest = null;
const recipePanels = new WeakMap();

// 原站也以 origin + pathname 对图片去重；尺寸、格式查询不改变作品身份。
function edenImageKey(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 8192) return null;
  try {
    const url = new URL(raw, 'https://mirapri.ff14eden.work/');
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.origin + url.pathname : null;
  } catch { return null; }
}

function recipeEquipment(row) {
  if (!Array.isArray(row.equipments)) return [];
  const items = row.equipments.slice(0, 80).filter(item => typeof item?.name === 'string' && item.name.trim() && item.name.length <= 160)
    .map(item => ({name:item.name.trim(), colors:Array.isArray(item.colorNames)
      ? item.colorNames.filter(color => typeof color === 'string' && color.trim() && color.length <= 80).slice(0,8).map(color => color.trim()) : []}));
  const seen = new Set();
  return items.filter(item => {const key=JSON.stringify(item);const fresh=!seen.has(key);seen.add(key);return fresh;});
}

function indexEdenRecipes(rows) {
  if (!Array.isArray(rows)) throw new Error('Eden 投稿数据格式错误');
  const index = new Map();
  const signatures = new Map();
  for (const row of rows) {
    if (!Array.isArray(row?.image_urls)) continue;
    const items = recipeEquipment(row);
    const signature = JSON.stringify(items.map(item => JSON.stringify(item)).sort());
    for (const image of row.image_urls) {
      const key = edenImageKey(image);
      if (!key) continue;
      // 同图对应互相冲突的装备时不猜测；保留同名但染色不同的原始记录。
      if (signatures.has(key) && signatures.get(key) !== signature) index.set(key, null);
      else if (!signatures.has(key)) { signatures.set(key, signature); index.set(key, items); }
    }
  }
  return index;
}

function recipeDataUrl() {
  // 优先复用原站已加载的精确请求及浏览器缓存，不拦截 fetch/XHR。
  const entries = globalThis.performance?.getEntriesByType?.('resource') || [];
  for (const entry of [...entries].reverse()) {
    try {
      const url = new URL(entry.name);
      const stamp = url.searchParams.get('timestamp');
      if (url.origin + url.pathname === RECIPE_DATA && !url.username && !url.password && /^\d{10,16}$/.test(stamp || ''))
        return RECIPE_DATA + '?timestamp=' + stamp;
    } catch { /* 非 URL 的资源条目不参与匹配。 */ }
  }
  return RECIPE_DATA;
}

function loadEdenRecipes(refresh = false) {
  if (!recipeRequest || refresh) {
    const url = recipeDataUrl();
    recipeRequest = fetch(url, {credentials:'omit', cache:refresh ? 'reload' : 'force-cache', signal:AbortSignal.timeout(45000)})
      .then(response => { if (!response.ok) { throw new Error('Eden HTTP ' + response.status); } return response.json(); })
      .then(indexEdenRecipes);
  }
  return recipeRequest;
}

function recipeImageKey(card) {
  const image = card.querySelector('.dialog-image img');
  const direct = image && edenImageKey(image.currentSrc || image.getAttribute('src'));
  if (direct) return direct;
  const layers = card.querySelectorAll('.dialog-image .v-image__image');
  for (const layer of layers) {
    const value = layer.style.backgroundImage;
    const source = /^url\(["']?(.+?)["']?\)$/.exec(value || '')?.[1];
    const key = source && edenImageKey(source);
    if (key) return key;
  }
  return null;
}

function ensureRecipeStyle() {
  if (document.getElementById('zhx-eden-recipe-style')) return;
  const style = document.createElement('style');
  style.id = 'zhx-eden-recipe-style';
  style.textContent = '.recipe-dialog-card:has(>.zhx-eden-recipe-items){display:block!important;overflow-y:auto!important}'
    + '.recipe-dialog-card:has(>.zhx-eden-recipe-items)>.recipe-dialog-actions{position:sticky;bottom:0;background:inherit;z-index:1}'
    + '.zhx-eden-recipe-items{padding:12px 20px;border-top:1px solid #ddd;font:inherit}'
    + '.zhx-eden-recipe-items h3{font-size:15px;margin:0 0 8px}.zhx-eden-recipe-items ul{list-style:none;margin:0;padding:0}'
    + '.zhx-eden-recipe-items li{margin:8px 0;line-height:1.6;overflow-wrap:anywhere}.zhx-eden-recipe-items small{display:block;color:#666}'
    + '.zhx-eden-recipe-items p{font-size:12px;margin:6px 0}.zhx-eden-recipe-items button{padding:4px 8px;border:1px solid #888;border-radius:4px;margin-top:6px}';
  (document.head || document.documentElement).appendChild(style);
}

function recipeRows(items) {
  return items?.map(item => ({...item, zh:resolveByName(item.name), colors:item.colors.map(color =>
    resolveByName(color) || (Object.hasOwn(DICT_MIRAMIRU,color) ? DICT_MIRAMIRU[color] : color))}));
}

function appendRecipeItems(panel, rows) {
  const list = document.createElement('ul');
  for (const row of rows) {
    const item = document.createElement('li');
    const name = document.createElement(row.zh ? 'a' : 'span');
    name.textContent = row.zh || row.name;
    if (row.zh) { name.href = WIKI_ITEM + encodeURIComponent(row.zh); name.target = '_blank'; name.rel = 'nofollow noreferrer noopener'; }
    item.appendChild(name);
    if (row.zh && row.zh !== row.name) { const native = document.createElement('small'); native.textContent = row.name; item.appendChild(native); }
    if (row.colors.length) { const dyes = document.createElement('small'); dyes.textContent = '染色：' + row.colors.join('／'); item.appendChild(dyes); }
    list.appendChild(item);
  }
  panel.appendChild(list);
}

function renderRecipePanel(card, state) {
  const panel = card.querySelector('.' + RECIPE_PANEL);
  if (!panel) return;
  const rows = recipeRows(state.items);
  const signature = JSON.stringify([state.phase, rows]);
  if (panel.dataset.zhxSignature === signature) return;
  panel.dataset.zhxSignature = signature;
  panel.replaceChildren();
  const title = document.createElement('h3'); title.textContent = '投稿装备清单'; panel.appendChild(title);
  const note = document.createElement('p');
  if (rows?.length) { note.textContent = '来自本站投稿数据；点击中文装备名查看灰机 Wiki。'; panel.appendChild(note); appendRecipeItems(panel, rows); return; }
  const messages = {loading:'正在加载投稿装备数据…', error:'装备数据暂时无法加载。'};
  note.textContent = messages[state.phase] || (state.items === null ? '该图片关联的装备记录不一致，暂不生成链接。' : '这篇投稿未提供可匹配的装备清单。');
  panel.appendChild(note);
  if (state.phase === 'error' || state.phase === 'ready') {
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重新载入';
    retry.addEventListener('click', event => { event.stopPropagation(); void loadEdenRecipes(true).catch(() => {}); syncEdenRecipePanels(); });
    panel.appendChild(retry);
  }
}

function beginRecipePanel(card, key) {
  let panel = card.querySelector('.' + RECIPE_PANEL);
  if (!panel) {
    panel = document.createElement('section'); panel.className = RECIPE_PANEL + ' zhx-skip';
    panel.setAttribute('aria-label','投稿装备清单'); panel.setAttribute('aria-live','polite');
    card.insertBefore(panel,card.querySelector('.recipe-dialog-actions'));
  }
  const request = loadEdenRecipes();
  const state = {key, request, phase:'loading', items:undefined};
  recipePanels.set(card,state); renderRecipePanel(card,state);
  const renderCurrent = () => {
    if (recipePanels.get(card) === state && card.isConnected && card.closest('.v-dialog--active') && recipeImageKey(card) === key)
      renderRecipePanel(card,state);
  };
  request.then(index => {state.items=index.get(key); state.phase='ready'; renderCurrent();},
    () => {state.phase='error'; renderCurrent();});
}

function syncEdenRecipePanels() {
  const cards = document.querySelectorAll(RECIPE_DIALOGS);
  if (!cards.length) return;
  ensureRecipeStyle();
  for (const card of cards) {
    const key = recipeImageKey(card);
    if (!key) {card.querySelector('.'+RECIPE_PANEL)?.remove();recipePanels.delete(card);continue;}
    const state = recipePanels.get(card);
    if (state?.key !== key || state?.request !== recipeRequest) beginRecipePanel(card,key);
    else renderRecipePanel(card,state);
  }
}

function edenMutationRelevant(mutation) {
  if (mutation.type !== 'attributes' || !['class','style','src'].includes(mutation.attributeName)) return true;
  return !!mutation.target.closest('.recipe-dialog-content,.glamour-dialog-content')
    && !mutation.target.closest('.'+RECIPE_PANEL);
}

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
  if (!element.matches(ITEM_TARGET)) return;
  if (element.matches('a')) {
    const href = element.getAttribute('href') || '';
    const hash = ITEM_URL.exec(href)?.[1];
    const zh = hash && resolveByHash(hash);
    if (element.dataset.zhxItem && href !== WIKI_ITEM + encodeURIComponent(element.dataset.zhxItem))
      delete element.dataset.zhxItem;
    if (zh) {
      element.dataset.zhxItem = zh;
      element.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
      element.setAttribute('title', '查看灰机 Wiki：' + zh);
    }
  }
  if (!isRankingName(element) && !element.matches('.v-data-table td,#equipment-view h6')) return;
  const native = element.textContent.trim();
  const item = resolveByName(native);
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

function translateEdenPage(rootArg, syncRecipes = true) {
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
  if (syncRecipes) syncEdenRecipePanels();
}

function startEden() {
  ensureZhxItemStyle('zhx-eden-item-style');
  bindZhxItemClick('__zhxEdenItemClick');
  safe(translateEdenPage, 'Eden 首屏')();
  createObserver({ root: document.documentElement, characterData: true,
    attributes: true, attributeFilter: ['href', 'title', 'alt', 'placeholder', 'aria-label', 'style', 'src', 'class'], debounce: 120,
    filter: edenMutationRelevant,
    handler(nodes, texts = []) {
      const targets = dedupeByAncestor([...nodes, ...texts]
        .map(node => node.nodeType === 3 ? node.parentElement : node).filter(Boolean));
      for (const node of targets) safe(translateEdenPage, 'Eden 动态翻译')(node, false);
      syncEdenRecipePanels();
    },
  });
}
