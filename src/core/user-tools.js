import { dataGetStatus, dataInvalidate, ensureTables, dataGetIndex } from './data/data-manager.js';
import { itemNames } from './item-languages.js';
import { WIKI_ITEM } from './constants.js';

let panel;
let returnFocus;
let itemButton;
let currentItem;

function closePanel() {
  panel?.remove();
  panel = null;
  if (returnFocus?.isConnected) returnFocus.focus?.({ preventScroll: true });
}

function openPanel(title) {
  closePanel();
  returnFocus = document.activeElement;
  panel = document.createElement('div');
  panel.className = 'zhx-skip';
  panel.id = 'zhx-tools-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', title);
  panel.style.cssText = 'position:fixed;inset:50% auto auto 50%;transform:translate(-50%,-50%);z-index:2147483647;max-height:85vh;overflow:auto;width:min(360px,90vw);padding:18px;border:1px solid #9aabb8;border-radius:10px;background:#fff;color:#173446;box-shadow:0 8px 40px #0005;font:14px/1.6 system-ui;';
  const heading = document.createElement('h2');
  heading.textContent = title;
  heading.style.cssText = 'font-size:18px;margin:0 0 12px';
  panel.append(heading);
  addAction('关闭', closePanel);
  const nativeDialog = [...document.querySelectorAll('[role="dialog"]')].find(element =>
    element !== panel && element.getClientRects().length && element.getAttribute('aria-hidden') !== 'true');
  (nativeDialog || document.body).append(panel);
  panel.style.pointerEvents = 'auto';
  panel.querySelector('button').focus();
  return panel;
}

function addAction(text, action, href) {
  const element = document.createElement(href ? 'a' : 'button');
  element.textContent = text;
  element.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin:6px 0;padding:8px;border:1px solid #b5c8d4;border-radius:5px;background:#f5f9fc;color:#173446;text-align:left;cursor:pointer;font:inherit;';
  if (href) { element.href = href; element.target = '_blank'; element.rel = 'noopener'; }
  else { element.type = 'button'; element.addEventListener('click', action); }
  panel.append(element);
  return element;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* Clipboard may be unavailable in a userscript sandbox. */ }
  const field = document.createElement('textarea');
  field.value = text;
  field.style.cssText = 'position:fixed;left:-9999px';
  document.body.append(field);
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { /* Show selectable text below. */ }
  field.remove();
  return copied;
}

function diagnostic() {
  return JSON.stringify({ host: location.hostname, script: typeof GM_info !== 'undefined' ? GM_info.script?.version : 'dev',
    data: dataGetStatus(), itemNames: Object.keys(dataGetIndex('nameMap') || {}).length }, null, 2);
}

function showStatus(message = '') {
  const box = openPanel('词库状态');
  const status = dataGetStatus();
  const text = document.createElement('p');
  const states = { idle: '尚未加载', loading: '正在加载', ready: '已就绪', degraded: '部分数据不可用' };
  const origins = { cache: '本地缓存', network: '网络下载', fallback: '备用数据', none: '暂无' };
  text.textContent = [message, states[status.state] || status.state, '数据来源：' + (origins[status.origin] || '本地与网络'),
    '数据版本：' + (status.version || '暂无')].filter(Boolean).join('\n');
  text.style.whiteSpace = 'pre-wrap';
  box.append(text);
  addAction('立即检查更新', refreshData);
  addAction('复制诊断', async () => {
    const info = diagnostic();
    if (await copyText(info)) text.textContent = '诊断已复制';
    else { text.textContent = info; text.style.userSelect = 'text'; }
  });
}

let refreshing = false;
async function refreshData() {
  if (refreshing) return;
  refreshing = true;
  showStatus('正在检查更新…');
  try {
    dataInvalidate();
    await ensureTables();
    showStatus(dataGetStatus().state === 'ready' ? '检查完成；网络不可用时会继续使用有效缓存。' : '部分数据未就绪，可稍后重试。');
  } catch { showStatus('检查失败，保留已有缓存，可稍后重试。'); }
  finally { refreshing = false; }
}

const ITEM_SELECTOR = '[data-zhx-item],[data-zhx-miramiru-zh],a[href*="ff14.huijiwiki.com/wiki/"]';
function recognizedItem(target) {
  const element = target?.closest?.(ITEM_SELECTOR);
  if (!element || element.closest('#zhx-tools-panel')) return null;
  let zh = element.dataset.zhxItem || element.dataset.zhxMiramiruZh;
  if (!zh) {
    try {
      const title = decodeURIComponent(new URL(element.href).pathname.split('/wiki/')[1] || '');
      if (!/^(?:物品|Item):/.test(title)) return null;
      zh = title.replace(/^(?:物品|Item):/, '');
    }
    catch { return null; }
  }
  return zh ? { element, zh } : null;
}

function showItemMenu(item) {
  const names = itemNames(item.zh);
  openPanel(item.zh);
  const copy = (label, value) => {
    const button = addAction(label, async () => { button.textContent = await copyText(value) ? '已复制' : value; });
  };
  copy('复制国服名称', item.zh);
  for (const [lang, label] of [['en', '英文'], ['ja', '日文'], ['ko', '韩文']])
    if (names[lang]) copy('复制' + label + '名称', names[lang]);
  addAction('灰机 Wiki · 更多幻化反查', null, WIKI_ITEM + encodeURIComponent(item.zh));
  if (names.ja) {
    addAction('MIRAPRI SNAP', null, 'https://mirapri.com/?keyword=' + encodeURIComponent(names.ja));
    addAction('Mirapri Eden', null, 'https://mirapri.ff14eden.work/#/?search=' + encodeURIComponent(names.ja));
  }
  if (names.ko) {
    addAction('Ronka LookBook', null, 'https://lookbook.ronkacloset.com/?keyword=' + encodeURIComponent(names.ko));
    addAction('End Closet', null, 'https://end-closet.com/?search=' + encodeURIComponent(names.ko));
  }
}

function revealItemButton(event) {
  if (event.target?.closest?.('#zhx-tools-item,#zhx-tools-panel')) return;
  const item = recognizedItem(event.target);
  if (!item) { if (itemButton && document.activeElement !== itemButton) itemButton.hidden = true; return; }
  currentItem = item;
  if (!itemButton) {
    itemButton = document.createElement('button');
    itemButton.id = 'zhx-tools-item';
    itemButton.className = 'zhx-skip';
    itemButton.type = 'button';
    itemButton.textContent = '⋯';
    itemButton.setAttribute('aria-label', '装备操作');
    itemButton.title = '装备操作（也可按 Alt 点击装备）';
    itemButton.style.cssText = 'position:fixed;z-index:2147483646;padding:2px 8px;border:1px solid #9aabb8;border-radius:6px;background:#fff;color:#173446;font:18px/1.4 system-ui;cursor:pointer;';
    itemButton.addEventListener('click', () => { if (currentItem?.element.isConnected) showItemMenu(currentItem); });
    document.body.append(itemButton);
  }
  const rect = item.element.getBoundingClientRect();
  itemButton.style.left = Math.max(4, Math.min(innerWidth - 42, rect.right + 2)) + 'px';
  itemButton.style.top = Math.max(4, Math.min(innerHeight - 36, rect.top)) + 'px';
  itemButton.hidden = false;
}

export function startUserTools() {
  if (window.__zhxUserTools) return;
  window.__zhxUserTools = true;
  const register = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand
    : typeof GM !== 'undefined' && GM.registerMenuCommand ? GM.registerMenuCommand.bind(GM) : null;
  register?.('词库状态', () => showStatus());
  register?.('立即检查词库更新', refreshData);
  register?.('复制诊断', async () => {
    const text = diagnostic();
    if (await copyText(text)) showStatus('诊断已复制');
    else { const pre = document.createElement('pre'); pre.textContent = text; pre.style.whiteSpace = 'pre-wrap'; openPanel('请选择并复制诊断').append(pre); }
  });
  register?.('装备操作说明', () => {
    const text = document.createElement('p');
    text.textContent = '将鼠标移到已识别装备名上，点击旁边的「⋯」，或按住 Alt 点击装备，可复制名称及跨站搜索。仅显示当前已知的原文和有效入口；更多站点可使用 Wiki 的幻化反查。';
    openPanel('装备操作').append(text);
  });
  document.addEventListener('pointerover', revealItemButton);
  document.addEventListener('focusin', revealItemButton);
  document.addEventListener('click', event => {
    if (!event.altKey) return;
    const item = recognizedItem(event.target);
    if (!item) return;
    event.preventDefault(); event.stopImmediatePropagation(); showItemMenu(item);
  }, true);
  document.addEventListener('keydown', event => {
    if (!panel) return;
    if (event.key === 'Escape') { event.preventDefault(); closePanel(); }
    if (event.key === 'Tab') {
      const nodes = [...panel.querySelectorAll('button,a[href]')];
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('scroll', () => { if (itemButton) itemButton.hidden = true; }, true);
}
