/* @phase15-module-order:sites/endcloset */
/* @phase15-order-link:sites/endcloset<-core/http */
import '../core/http.js';
import { trRonka } from './ronka.js';
import { WIKI_ITEM } from '../core/constants.js';
import { DICT_ENDCLOSET } from '../core/dictionary.js';
import { resolveByName } from '../core/data-manager.js';
import { createObserver } from '../core/observer.js';
import { _markScan, localScope, queryIn } from '../core/dom.js';
import { safe } from '../core/runtime.js';
import { SKIP_TAGS } from './mirapri.js';
import { bindZhxItemClick, ensureZhxItemStyle } from './ffxiv-collection.js';
import { startChineseSearch } from '../core/chinese-search.js';

export {
  _ecAcceptNode,
  _ecImgAlt,
  _ecInput,
  _ecProcNode,
  _trEndClosetDye,
  _trEndClosetItem,
  markEndClosetItem,
  startEndCloset,
  trEndCloset,
  translateEndClosetPage,
  translateEndClosetTitle,
};

/* ===================================================================== */
/* =====================================================================
 * end-closet.com（End Closet，韩服 FF14 幻化站）— 全站汉化 + 道具跳转
 * 站点为 React SPA（Vite + Firebase）。装备名原生三语 name:{ko,en,ja}，
 * UI 语言 localStorage.language 可切（ko/en/ja）。
 * 汉化策略：
 *   1. UI 词（韩/英/日）→ 中文：DICT_ENDCLOSET
 *   2. 装备名（韩/英/日）→ 国服中文名：物品总表 nameMap 索引（resolveByName）
 *   3. 装备名文本节点打 data-zhx-item 标记 → 点击跳灰机 wiki
 *   4. 中文搜索：搜索框输入中文 → 自动转韩文/英文（startChineseSearch）
 * ===================================================================== */

const EC_SKIP_SEL = 'script, style, noscript, textarea, .zhx-skip, #zhx-chinese-suggest-list';
const EC_KR = /[\uac00-\ud7a3]/;
const EC_EN_WORD = /[A-Za-z]{2,}/;
const EC_JA = /[\u3040-\u30ff]/;
// 装备名识别辅助：韩文装备名通常较长且包含 FF14 特征词；UI 词短。
// 用「DICT 未命中 + resolveByName 命中」判定装备名。

// 逐条翻译：UI 词典 → 装备名映射 → 空白归一化
function _trEndClosetDye(t0) {
  // End Closet 染剂名可能带数字前缀（类似 ronka 的 "N-色名"）
  const m = t0.match(/^([1-9])-(.+)$/);
  if (!m) return null;
  const s = DICT_ENDCLOSET[m[2].trim()];
  if (!s) return null;
  return m[1] + '-' + s;
}

function _trEndClosetItem(t0) {
  // 装备名映射：韩/英/日 → 中文（物品总表 nameMap）
  const zh = resolveByName(t0);
  return zh || null;
}

function trEndCloset(text) {
  if (!text) return text;
  const t0 = text.trim();
  if (!t0 || t0.length > 120) return text;
  const hasForeign = EC_KR.test(t0) || EC_EN_WORD.test(t0) || EC_JA.test(t0);
  if (!hasForeign) return text;
  let zh = DICT_ENDCLOSET[t0] || null;
  if (zh == null) zh = _trEndClosetDye(t0);
  if (zh == null) zh = _trEndClosetItem(t0);
  if (zh == null) {
    const norm = t0.replace(/[ \t\u00a0]+/g, ' ');
    if (norm !== t0) zh = DICT_ENDCLOSET[norm] || null;
  }
  if (zh == null || zh === t0) return text;
  const i = text.indexOf(t0);
  return text.slice(0, i) + zh + text.slice(i + t0.length);
}

// 装备名点击跳灰机 wiki：文本节点翻译后，若为装备名（resolveByName 命中），
// 给父元素打 data-zhx-item 标记。React 重渲染后韩文重现会再次命中。
function markEndClosetItem(node, translated) {
  if (!translated || translated.length > 50) return;
  const p = node.parentElement;
  if (!p) return;
  if (p.dataset.zhxItem === translated) return;
  p.dataset.zhxItem = translated;
  p.setAttribute('title', '点击查看灰机 wiki 物品页');
}

function _ecAcceptNode(n) {
  if (n.nodeType === 1) {
    if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
    if (n.closest?.(EC_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
  }
  return NodeFilter.FILTER_ACCEPT;
}

function _ecInput(n) {
  const ph = n.getAttribute('placeholder');
  if (ph) { const nn = trEndCloset(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
}

function _ecImgAlt(n) {
  const alt = n.getAttribute('alt');
  if (alt && alt.length >= 2 && alt.length <= 90) {
    const nn = trEndCloset(alt);
    if (nn !== alt && !n.dataset.zhixiaEndClosetAlt) { n.setAttribute('alt', nn); n.dataset.zhixiaEndClosetAlt = '1'; }
  }
  const ti = n.getAttribute('title');
  if (ti) { const nn = trEndCloset(ti); if (nn !== ti) n.setAttribute('title', nn); }
}

function _ecAria(n) {
  const al = n.getAttribute('aria-label');
  if (al) { const nn = trEndCloset(al); if (nn !== al) n.setAttribute('aria-label', nn); }
}

function _ecProcNode(n) {
  if (n.nodeType === 3) {
    const raw = n.nodeValue;
    if (!raw?.trim()) return;
    const p = n.parentElement;
    if (p?.closest?.(EC_SKIP_SEL)) return;
    const next = trEndCloset(raw);
    if (next !== raw) {
      n.nodeValue = next;
      const itemZh = _trEndClosetItem(raw.trim());
      if (itemZh) markEndClosetItem(n, itemZh);
    }
    return;
  }
  if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') { _ecInput(n); return; }
  if (n.tagName === 'IMG' || n.hasAttribute('alt')) { _ecImgAlt(n); return; }
  if (n.hasAttribute?.('aria-label')) _ecAria(n);
}

function translateEndClosetPage(rootArg) {
  if (rootArg?.nodeType === 3) {
    _ecProcNode(rootArg);
    return;
  }
  const root = rootArg || document.body || document.documentElement;
  if (!root) return;
  if (root.nodeType === 1) {
    if (_ecAcceptNode(root) === NodeFilter.FILTER_REJECT) return;
    _ecProcNode(root);
  }
  _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: _ecAcceptNode,
  });
  const batch = [];
  while (w.nextNode()) batch.push(w.currentNode);
  for (const n of batch) _ecProcNode(n);
}

function translateEndClosetTitle() {
  const t = document.title;
  if (!t) return;
  const nt = trEndCloset(t);
  if (nt && nt !== t && nt.length <= 120) document.title = nt;
}

function startEndCloset() {
  ensureZhxItemStyle('zhx-endcloset-item-style');
  bindZhxItemClick('__zhxEndClosetItemBound');
  safe(translateEndClosetPage, 'EndCloset 全扫')();
  safe(translateEndClosetTitle, 'EndCloset 标题')();
  // React SPA：childList + characterData（三语文本节点更新频繁）
  createObserver({
    root: document.documentElement,
    characterData: true,
    filter: (m) => !!(m.target?.nodeValue && (EC_KR.test(m.target.nodeValue) || EC_EN_WORD.test(m.target.nodeValue) || EC_JA.test(m.target.nodeValue))),
    debounce: 120,
    handler: (nodes, cds = []) => {
      for (const n of [...nodes, ...cds]) safe(translateEndClosetPage, 'EndCloset 局部')(n);
      safe(translateEndClosetTitle, 'EndCloset 标题')();
    },
  });
  // 中文搜索（独立框自动转换：输入中文 → 韩文/英文）
  startChineseSearch('endcloset');
  console.log('End Closet（韩服幻化站）汉化已启用');
}
