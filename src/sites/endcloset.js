import { DICT_ENDCLOSET } from '../core/data/dictionary.js';
import { resolveByName, resolveDyeColor } from '../core/data/data-manager.js';
import { createTranslationObserver } from '../core/observer.js';
import { SKIP_TAGS, _markScan, localScope, snapshotTranslationNodes } from '../core/dom.js';
import { safe } from '../core/runtime.js';
import { bindZhxItemClick, ensureZhxItemStyle } from '../core/item-links.js';
import { startChineseSearch } from '../core/chinese-search.js';
import { isAuthoredContent } from '../core/content-scope.js';

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
const exactUiLabel = text => Object.hasOwn(DICT_ENDCLOSET, text) ? DICT_ENDCLOSET[text] : null;
// Keep recognizing the localized suffix for the pass after name data loads.
const DETAIL_TITLE_SUFFIXES = new Set(['FF14 글래머 투영', 'FF14 Glamour Collection', 'FF14 ミラプリコレクション', 'FF14 幻化投影']);
// 装备名识别辅助：韩文装备名通常较长且包含 FF14 特征词；UI 词短。
// 用「DICT 未命中 + resolveByName 命中」判定装备名。

// 逐条翻译：UI 词典 → 装备名映射 → 空白归一化
function _trEndClosetDye(t0) {
  // End Closet 染剂名可能带数字前缀（类似 ronka 的 "N-色名"）
  const m = t0.match(/^([1-9])-(.+)$/);
  if (!m) return null;
  const color = m[2].trim();
  const s = DICT_ENDCLOSET[color] || resolveDyeColor(color);
  if (!s) return null;
  return m[1] + '-' + s;
}

function _trEndClosetItem(t0) {
  // 装备名映射：韩/英/日 → 中文（物品总表 nameMap）
  const zh = resolveByName(t0);
  return zh || null;
}

function trEndClosetCount(text) {
  const count = text.match(/^(\d[\d,]*)\s*(개 선택됨|개 아이템|개 투영세트|items|glamour sets)$/);
  if (count) return count[1] + ({ '개 선택됨': ' 项已选择', '개 아이템': ' 件装备', 'items': ' 件装备' }[count[2]] || ' 套幻化');
  const english = text.match(/^Showing\s+([\d,]+)\s+of\s+([\d,]+)\s+items?$/i);
  if (english) return '显示 ' + english[1] + ' / 共 ' + english[2] + ' 件装备';
  const glamourId = text.match(/^Glamour Set\s+([a-zA-Z0-9_-]{8,40})$/);
  if (glamourId) return '幻化套装 ' + glamourId[1];
  const look = /^Look (\d+)$/u.exec(text);
  if (look) return '穿搭 ' + look[1];
  const author = text.match(/^작성자\s*:\s*(.{1,80})$/);
  if (author) return '作者：' + author[1];
  const total = text.match(/^총\s+([\d,]+)개의\s+(투영 세트|아이템)\s+중\s+([\d,]+)개\s+표시$/);
  if (total) return '共 ' + total[1] + (total[2] === '아이템' ? ' 件装备，显示 ' : ' 套幻化，显示 ') + total[3] + ' 项';
  return null;
}

function trEndClosetDyeLimit(text) {
  const limit = /^(?:최대 (\d+)개까지 선택할 수 있어요|Select up to (\d+) colors|最大(\d+)つまで選択可能)$/u.exec(text);
  return limit ? '最多可选 ' + (limit[1] ?? limit[2] ?? limit[3]) + ' 种颜色' : null;
}

function trEndCloset(text) {
  if (!text) return text;
  const t0 = text.trim();
  if (!t0) return text;
  const exact = exactUiLabel(t0);
  if (t0.length > 120 && !exact) return text;
  const hasForeign = EC_KR.test(t0) || EC_EN_WORD.test(t0) || EC_JA.test(t0);
  if (!hasForeign && !exact) return text;
  let zh = exact || resolveDyeColor(t0);
  if (zh == null) zh = trEndClosetDyeLimit(t0) || trEndClosetCount(t0);
  if (zh == null) zh = _trEndClosetDye(t0);
  if (zh == null) zh = _trEndClosetItem(t0);
  if (zh == null) {
    const norm = t0.replace(/[ \t\u00a0]+/g, ' ');
    if (norm !== t0) zh = DICT_ENDCLOSET[norm] || resolveDyeColor(norm) || _trEndClosetItem(norm);
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
    if (isAuthoredContent(n, 'endcloset')) return NodeFilter.FILTER_REJECT;
  }
  return NodeFilter.FILTER_ACCEPT;
}

function _ecInput(n) {
  const ph = n.getAttribute('placeholder');
  if (ph) { const nn = trEndCloset(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
}

function _ecImgAlt(n) {
  const alt = n.getAttribute('alt');
  if (alt) {
    const nn = trEndCloset(alt);
    if (nn !== alt) n.setAttribute('alt', nn);
  }
  const ti = n.getAttribute('title');
  if (ti) { const nn = trEndCloset(ti); if (nn !== ti) n.setAttribute('title', nn); }
}

function _ecAria(n) {
  const al = n.getAttribute('aria-label');
  if (!al) return;
  // "primary" is a landmark name only on <nav>, not a generic UI label.
  const nn = n.tagName === 'NAV' && al === 'primary' ? '主导航' : trEndCloset(al);
  if (nn !== al) n.setAttribute('aria-label', nn);
}

function _ecProcNode(n) {
  if (isAuthoredContent(n.nodeType === 3 ? n.parentElement : n, 'endcloset')) return;
  if (n.nodeType === 3) {
    const raw = n.nodeValue;
    if (!raw?.trim()) return;
    const p = n.parentElement;
    if (p?.closest?.(EC_SKIP_SEL)) return;
    const next = trEndCloset(raw);
    if (next !== raw) {
      n.nodeValue = next;
      const itemZh = _trEndClosetItem(raw.trim());
      const shown = next.trim();
      if (itemZh && (shown === itemZh || shown + '染剂' === itemZh)) markEndClosetItem(n, itemZh);
    }
    return;
  }
  if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') _ecInput(n);
  // title/alt/aria 不只存在于图片，按钮和普通元素也需要处理。
  _ecImgAlt(n);
  _ecAria(n);
}

function translateEndClosetPage(rootArg) {
  if (rootArg?.nodeType === 3) {
    _ecProcNode(rootArg);
    return;
  }
  const root = rootArg || document.body || document.documentElement;
  if (!root) return;
  if (root.nodeType === 1) {
    if (root.tagName === 'TEXTAREA') { _ecProcNode(root); return; }
    if (_ecAcceptNode(root) === NodeFilter.FILTER_REJECT) return;
    _ecProcNode(root);
  }
  _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
  for (const n of snapshotTranslationNodes(root, _ecAcceptNode)) _ecProcNode(n);
  // 文本域内容属于用户输入，仍跳过；单独处理被跳过元素上的界面属性。
  for (const n of root.querySelectorAll?.('textarea') || []) _ecProcNode(n);
}

function translateEndClosetDetailTitle(title) {
  // The site's detail title is generated from at most three equipment names,
  // unlike authored concept titles. Preserve unknown names and truncation.
  const separator = title.lastIndexOf(' - ');
  if (separator < 0) return null;
  const suffix = title.slice(separator + 3);
  if (!DETAIL_TITLE_SUFFIXES.has(suffix)) return null;
  const source = title.slice(0, separator);
  const siteName = trEndCloset(suffix);
  if (source === suffix) return siteName;
  const truncated = source.endsWith('...');
  const names = (truncated ? source.slice(0, -3) : source).split(', ');
  const translated = names.map(name => _trEndClosetItem(name) || name).join(', ');
  return translated + (truncated ? '...' : '') + ' - ' + siteName;
}

function translateEndClosetTitle() {
  const t = document.title;
  if (!t) return;
  const isDetail = /^\/(?:detail|items)\/[^/]+\/?$/u.test(globalThis.location?.pathname || '');
  const nt = (isDetail && translateEndClosetDetailTitle(t)) || (DETAIL_TITLE_SUFFIXES.has(t) ? trEndCloset(t) : t);
  if (nt !== t && nt.length <= 160) document.title = nt;
}

function startEndCloset() {
  ensureZhxItemStyle('zhx-endcloset-item-style');
  bindZhxItemClick('__zhxEndClosetItemBound');
  safe(translateEndClosetPage, 'EndCloset 全扫')();
  safe(translateEndClosetTitle, 'EndCloset 标题')();
  // React SPA：childList + characterData（三语文本节点更新频繁）
  createTranslationObserver({
    root: document.documentElement,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'alt', 'aria-label'],
    filter: (m) => {
      const text = m.type === 'attributes' ? m.target?.getAttribute(m.attributeName) : m.target?.nodeValue;
      if (!text) return false;
      const raw = text.trim();
      const exact = exactUiLabel(raw);
      // A known Japanese UI label may contain only kanji (e.g. 種族).
      return (exact && exact !== raw) || EC_KR.test(text) || EC_EN_WORD.test(text) || EC_JA.test(text);
    },
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
