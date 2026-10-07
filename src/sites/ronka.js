/* @phase15-module-order:sites/ronka */
/* @phase15-order-link:sites/ronka<-sites/ffxiv-collection */
import { bindZhxItemClick, ensureZhxItemStyle } from './ffxiv-collection.js';
import { ronkaItemLookup } from '../core/cache.js';
import { WIKI_ITEM, ZHX_WIKI_ICON } from '../core/constants.js';
import { DICT_RONKA } from '../core/dictionary.js';
import { _markScan, localScope, queryIn } from '../core/dom.js';
import { createObserver } from '../core/observer.js';
import { safe } from '../core/runtime.js';
import { SKIP_TAGS } from './mirapri.js';
export { RONKA_ITEM_CACHE, RONKA_KR, RONKA_RULE_FULL, RONKA_SKIP_SEL, _procRonkaNode, _ronkaAcceptNode, _ronkaAria, _ronkaImgAlt, _ronkaInput, _trRonkaDye, _trRonkaIcon, _trRonkaPatch, markRonkaItem, replaceRonkaLodestone, startRonka, trRonka, translateRonkaPage, translateRonkaRules, translateRonkaTitle, trimRonkaNode };


  /* ===================================================================== */
  /* =====================================================================
   * ronka（lookbook.ronkacloset.com，韩语幻化站）— 全站汉化
   * 界面/染剂走 DICT_RONKA；装备名走物品总表统一索引（韩文→国服名）。
   * 站点为 Next.js SPA（React 拆文本节点、频繁重渲染），observer 覆盖
   * childList 与 characterData；翻译幂等（不含韩文即跳过）防循环。
   * ===================================================================== */

  const RONKA_SKIP_SEL = 'script, style, noscript, textarea, .zhx-skip';
  const RONKA_KR = /[\uac00-\ud7a3]/;

  // 装备名单条查找（缓存 + 名称索引直查）；_ronkaCacheN = 条目计数（容量防线用）
  const RONKA_ITEM_CACHE = Object.create(null);

  // 逐条翻译：UI/染剂精确 → "N-染剂" → 装备名 → "X아이콘" → 版本前缀 → 空白归一化
  // v1.2.x：子步骤拆出（降认知复杂度）——② 染剂 "N-名称"
  function _trRonkaDye(t0) {
    const m = t0.match(/^([1-9])-(.+)$/);
    if (!m) return null;
    const s = DICT_RONKA[m[2].trim()];
    if (!s) return null;
    return m[1] + '-' + s;
  }

  // ④ "X아이콘" 组合（img alt，如 "머리 방어구아이콘"）
  function _trRonkaIcon(t0) {
    if (t0.length <= 3 || t0.slice(-3) !== '아이콘') return null;
    const base = t0.slice(0, -3).trim();
    const bz = DICT_RONKA[base] || ronkaItemLookup(base);
    if (!bz) return null;
    return bz + '图标';
  }

  // ⑤ 补丁版本前缀
  function _trRonkaPatch(t0) {
    if (t0.indexOf('현재 적용된 패치 데이터 버전') !== 0) return null;
    return t0.replace('현재 적용된 패치 데이터 버전(KOR): ', '当前应用的补丁数据版本(KOR): ');
  }

  function trRonka(text) {
    if (!text) return text;
    const t0 = text.trim();
    if (!t0 || t0.length > 120) return text;
    const hasKR = RONKA_KR.test(t0);
    // ① 无韩文：仅查词典（GALLERY/GENERATOR/ABOUT/LOGIN/JOIN 等）
    if (!hasKR) return DICT_RONKA[t0] || text;
    let zh = DICT_RONKA[t0] || null;
    // ② 染剂 "N-名称"（如 "1-하얀눈색"；React 拆分时 "하얀눈색" 单独命中 ①）
    if (zh == null) zh = _trRonkaDye(t0);
    // ③ 装备名（韩文 → 国服名）
    if (zh == null) zh = ronkaItemLookup(t0);
    // ④ "X아이콘" 组合
    if (zh == null) zh = _trRonkaIcon(t0);
    // ⑤ 补丁版本前缀
    if (zh == null) zh = _trRonkaPatch(t0);
    // ⑥ 空白归一化回退
    if (zh == null) {
      const norm = t0.replace(/[ \t\u00a0]+/g, ' ');
      if (norm !== t0) zh = DICT_RONKA[norm] || null;
    }
    if (zh == null || zh === t0) return text;
    const i = text.indexOf(t0);
    return text.slice(0, i) + zh + text.slice(i + t0.length);
  }

  // ===== 装备名点击跳转灰机 wiki（v1.15.0）=====
  // 详情页装备名：div.item-searcher > div.post-item-information > p
  // React 会重渲染冲掉 DOM 改动，故用「打标记 + document 级 capture 点击委托」，
  // 不包裹 <a>（避免嵌套冲突与重渲染闪烁）；样式另注入一次。
  function markRonkaItem(node, translated) {
    if (!translated || translated.length > 40) return;
    const p = node.parentElement;
    if (p?.tagName !== 'P') return;
    const wrap = p.parentElement;
    if (!wrap?.classList?.contains('post-item-information')) return;
    if (p.dataset.zhxItem === translated) return;
    p.dataset.zhxItem = translated;
    p.setAttribute('title', '点击查看灰机 wiki 物品页');
  }

  // 装备块 lodestone（官方指南）链接 → 灰机 wiki（图标 + 中文物品页）
  // 选择器只匹配 href 含 lodestone 的 <a>，替换后不再匹配 → 天然幂等；
  // React 若恢复原 href 会自动再次命中重替换。装备中文名来自同块 [data-zhx-item]。
  function replaceRonkaLodestone(rootArg) {
    const links = queryIn(localScope(rootArg), '.post-search-modal a[href*="lodestone"]');
    for (const a of links) {
      const box = a.closest('.item-searcher');
      const itemEl = box?.querySelector('[data-zhx-item]');
      const zh = itemEl?.dataset?.zhxItem;
      if (!zh) continue;
      a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
      a.textContent = '';
      const img = document.createElement('img');
      img.src = ZHX_WIKI_ICON;
      img.alt = '';
      img.style.cssText = 'width:14px;height:14px;vertical-align:-2px;margin-right:4px;border-radius:3px';
      img.onerror = function () { this.style.display = 'none'; };
      a.appendChild(img);
      a.appendChild(document.createTextNode('灰机 wiki'));
    }
  }

  // 规则区整行翻译（about 页 rule-list：逐节点拼接会语序错位的行，整行替换）
  // 仅对命中词典的 li 生效；标记防重入，React 重渲染后韩文重现时会再次命中。
  const RONKA_RULE_FULL = {
    '반드시 파이널판타지14 게임 내 배경을 사용해야 합니다.': '必须使用最终幻想14游戏内背景。',
    '게시물 중 파이널판타지14 운영정책 제7.4항 에 해당하는 ‘홈페이지 제재 항목’ 대상의 경우 작성자에게 사전통지 없이 해당 게시물을 삭제할 수 있으며, 이를 작성한 계정은 경고 1회 후 게시글 삭제': '帖子中属于最终幻想14运营政策第 7.4 条「官网处罚事项」的，可在不事先通知作者的情况下删除该帖子，相关账号警告 1 次后删除帖子',
  };
  function translateRonkaRules() {
    const lis = queryIn(null, '.rule-list-wrap li, .rule-block-wrap li');   // v1.4.1：统一查询入口（全页调用）
    for (const li of lis) {
      if (li.dataset.zhxRule) continue;
      const key = (li.textContent || '').trim();
      if (!key || !RONKA_KR.test(key)) continue;
      const zh = RONKA_RULE_FULL[key];
      if (zh) { li.textContent = zh; li.dataset.zhxRule = '1'; }
    }
  }

  function trimRonkaNode(node) {
    const raw = node.nodeValue;
    if (!raw?.trim()) return;
    const p = node.parentElement;
    if (p?.closest?.(RONKA_SKIP_SEL)) return;
    const next = trRonka(raw);
    if (next !== raw) {
      node.nodeValue = next;
      markRonkaItem(node, next);
    }
  }

  // v1.2.x：节点分派拆为子步骤（降认知复杂度）
  function _ronkaAcceptNode(n) {
    if (n.nodeType === 1) {
      if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
      if (n.closest?.(RONKA_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
  }

  function _ronkaInput(n) {
    const ph = n.getAttribute('placeholder');
    if (ph) { const nn = trRonka(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
  }

  function _ronkaImgAlt(n) {
    const alt = n.getAttribute('alt');
    if (alt && alt.length >= 2 && alt.length <= 90) {
      const nn = trRonka(alt);
      if (nn !== alt && !n.dataset.zhixiaRonkaAlt) { n.setAttribute('alt', nn); n.dataset.zhixiaRonkaAlt = '1'; }
    }
    const ti = n.getAttribute('title');
    if (ti) { const nn = trRonka(ti); if (nn !== ti) n.setAttribute('title', nn); }
  }

  function _ronkaAria(n) {
    const al = n.getAttribute('aria-label');
    if (al) { const nn = trRonka(al); if (nn !== al) n.setAttribute('aria-label', nn); }
  }

  function _procRonkaNode(n) {
    if (n.nodeType === 3) { trimRonkaNode(n); return; }
    if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') { _ronkaInput(n); return; }
    if (n.tagName === 'IMG' || n.hasAttribute('alt')) { _ronkaImgAlt(n); return; }
    if (n.hasAttribute?.('aria-label')) _ronkaAria(n);
  }

  function translateRonkaPage(rootArg) {
    if (rootArg?.nodeType === 3) { trimRonkaNode(rootArg); return; }
    if (!rootArg) safe(translateRonkaRules, 'Ronka 规则整行')();
    const root = rootArg || document.body || document.documentElement;
    if (!root) return;
    _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: _ronkaAcceptNode,
    });
    const batch = [];
    while (w.nextNode()) batch.push(w.currentNode);
    for (const n of batch) _procRonkaNode(n);
    safe(replaceRonkaLodestone, 'Ronka lodestone 替换')(rootArg);
  }

  function translateRonkaTitle() {
    const t = document.title;
    if (!t || !RONKA_KR.test(t)) return;
    const nt = trRonka(t);
    if (nt && nt !== t && nt.length <= 120) document.title = nt;
  }

  function startRonka() {
    ensureZhxItemStyle('zhx-ronka-item-style');
    bindZhxItemClick('__zhxRonkaItemBound');
    safe(translateRonkaPage, 'Ronka 全扫')();
    safe(translateRonkaTitle, 'Ronka 标题')();
    // v1.4 Phase 7：经统一观察器（本站必须保留 characterData——韩文文本变更很常见）
    createObserver({
      root: document.documentElement,
      characterData: true,
      filter: (m) => !!(m.target?.nodeValue && RONKA_KR.test(m.target.nodeValue)),
      debounce: 120,
      handler: (nodes) => {
        for (const n of nodes) safe(translateRonkaPage, 'Ronka 局部')(n);
        safe(translateRonkaTitle, 'Ronka 标题')();
      },
    });
    // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
    console.log('Ronka（韩服幻化站）汉化已启用');
  }
