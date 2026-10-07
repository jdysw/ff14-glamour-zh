/* @phase15-module-order:sites/ffxiv-collection */
/* @phase15-order-link:sites/ffxiv-collection<-sites/ff14-fc */
import './ff14-fc.js';
import { WIKI_ITEM, ZHX_WIKI_ICON } from '../core/constants.js';
import { DATA_TEXT } from '../core/data-manager.js';
import { DICT_ACL } from '../core/dictionary.js';
import { _markScan, localScope, queryIn } from '../core/dom.js';
import { lookupJp2Zh, lookupSeries } from '../core/item-resolver.js';
import { observeLocal } from '../core/observer.js';
import { safe } from '../core/runtime.js';
import { SKIP_TAGS } from './mirapri.js';
export { ACL_DECOR_HEAD, ACL_DECOR_TAIL, ACL_SET_RE, ACL_SKIP_SEL, _aclAcceptNode, _aclItemNameEl, _aclSwapIcon, _aclZhName, _procACLNode, _trACLCfc, _trACLExact, _trACLItem, _trACLSet, bindZhxItemClick, ensureZhxItemStyle, lookupAclCfc, markACLItem, replaceACLLodestone, startACL, trACL, translateACLPage, translateACLTitle, trimACLNode };


  /* ===================================================================== */
  /* =====================================================================
   * ffxivcollection.com（FFXIV ARMOURY COLLECTION，日文装备图鉴站）— 全站汉化
   * 界面/筛选器走 DICT_ACL；装备名单件走物品总表统一索引（日文→国服名，单条查找）；
   * 套装名按「系列・职能アタイア[RE]」组合规则生成（系列/职能词在 DICT_ACL）。
   * 站为 WordPress 服务端渲染（jQuery 增强），observer 覆盖筛选/懒加载。
   */

  const ACL_DECOR_HEAD = /^[\s\u00a0※◆■□●○▼▽☆★]+/;
  const ACL_DECOR_TAIL = /[\s\u00a0※◆■□●○▲△☆★]{1,64}$/;
  const ACL_SET_RE = /^(.+?)・(ディフェンダー|スレイヤー|ストライカー|スカウト|レンジャー|キャスター|ヒーラー)アタイア(RE|ＲＥ)?$/;

  // v1.2.x：四步链拆为子步骤（降认知复杂度）
  // ① 词典精确（含空白归一化回退）
  function _trACLExact(text, t0) {
    let hit = DICT_ACL[t0];
    if (!hit) {
      const norm = t0.replace(/[ \t\u00a0]+/g, ' ').trim();
      if (norm !== t0) hit = DICT_ACL[norm];
    }
    if (!hit) return null;
    const i = text.indexOf(t0);
    return text.slice(0, i) + hit + text.slice(i + t0.length);
  }

  // ② 套装名规则：系列・职能アタイア[RE] → （改良型）系列职能套装
  //    优先 lookupSeries（与主站系列表口径一致：方舟天使御敌），兜底 DICT_ACL 逐词
  function _trACLSet(text, t0) {
    const m = t0.match(ACL_SET_RE);
    if (!m) return null;
    const series = lookupSeries(m[1] + '・' + m[2])
      || ((DICT_ACL[m[1]] || m[1]) + (DICT_ACL[m[2]] || m[2]));
    const zh = (m[3] ? '改良型' : '') + series + '套装';
    const i = text.indexOf(t0);
    return text.slice(0, i) + zh + text.slice(i + t0.length);
  }

  // ③ 日文装备名（JP2ZH 对照表单条查找）
  // v1.2.1：判定前剥【…】标记（与 trFC 同修；「纯汉字+全角标记」名此前不查表）
  function _trACLItem(text, t0) {
    const core = (t0.replace(ACL_DECOR_HEAD, '').replace(ACL_DECOR_TAIL, '')).trim() || t0;
    const corep = core.replace(/【[^【】]*】/g, '').trim() || core;
    const isKana = /[\u3040-\u30ff]/.test(corep);
    const isKanji = /^[\u3005\u3006\u4e00-\u9fff]+$/.test(corep) && corep.length >= 2 && corep.length <= 30;
    if (!isKana && !isKanji) return null;
    const zh = lookupJp2Zh(core);
    if (!zh || zh === core) return null;
    const i = text.indexOf(t0);
    return text.slice(0, i) + zh + text.slice(i + t0.length);
  }

  // ④ 副本名（保留「Lv.NN 」前缀，查 ACL_CFC 表）
  function _trACLCfc(text, t0) {
    const mLv = t0.match(/^(Lv\.\d+ )(.+)$/);
    if (!mLv) return null;
    const zh = lookupAclCfc(mLv[2]);
    if (!zh || zh === mLv[2]) return null;
    const zhFull = mLv[1] + zh;
    const i = text.indexOf(t0);
    return text.slice(0, i) + zhFull + text.slice(i + t0.length);
  }

  function trACL(text) {
    if (!text) return text;
    const t0 = text.trim();
    if (!t0) return text;
    if (t0.length > 120) return text;
    const s1 = _trACLExact(text, t0);
    if (s1 !== null) return s1;
    const s2 = _trACLSet(text, t0);
    if (s2 !== null) return s2;
    const s3 = _trACLItem(text, t0);
    if (s3 !== null) return s3;
    const s4 = _trACLCfc(text, t0);
    if (s4 !== null) return s4;
    return text;
  }

  // 副本名单条查找：「日文名|中文名」表（DATA_TEXT.acl）
  function lookupAclCfc(ja) {
    if (!ja || typeof DATA_TEXT.acl !== 'string' || !DATA_TEXT.acl) return null;
    const key = '\n' + ja + '|';
    const at = DATA_TEXT.acl.indexOf(key);
    if (at < 0) return null;
    const s0 = at + 1 + ja.length + 1;
    const e0 = DATA_TEXT.acl.indexOf('\n', s0);
    const v = DATA_TEXT.acl.slice(s0, e0 < 0 ? undefined : e0).trim();
    return v || null;
  }

  const ACL_SKIP_SEL = 'script, style, noscript, textarea, ins, .adsbygoogle, [class*="ads-"], [id*="aswift"]';

  // ===== 装备名点击跳转灰机 wiki（v1.16.1）=====
  // 详情页单件装备名：div.item-name > p（套装名在 h2/h3，不标记）
  function markACLItem(node, translated) {
    if (!translated || translated.length > 50) return;
    const p = node.parentElement;
    if (p?.tagName !== 'P') return;
    const wrap = p.parentElement;
    if (!wrap?.classList?.contains('item-name')) return;
    // 排除部位名（<p class="region-name">頭防具</p>），只标记装备名
    if (p.classList.contains('region-name')) return;
    if (p.dataset.zhxItem === translated) return;
    p.dataset.zhxItem = translated;
    p.setAttribute('title', '点击查看灰机 wiki 物品页');
  }

  function ensureZhxItemStyle(id) {
    if (document.getElementById(id)) return;
    const st = document.createElement('style');
    st.id = id;
    st.textContent = '[data-zhx-item]{cursor:pointer;transition:text-decoration-color .15s}[data-zhx-item]:hover{text-decoration:underline;text-underline-offset:3px}';
    (document.head || document.documentElement).appendChild(st);
  }

  function bindZhxItemClick(flag) {
    if (window[flag]) return;
    window[flag] = true;
    document.addEventListener('click', (e) => {
      const el = e.target?.closest?.('[data-zhx-item]') ?? null;
      if (!el) return;
      const zh = el.dataset.zhxItem;
      if (!zh) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(WIKI_ITEM + encodeURIComponent(zh), '_blank', 'noopener');
    }, true);
  }

  // 装备块的 The Lodestone 图标链接 → 灰机 wiki（图标 + 中文物品页）
  // 站点每个装备条目带 a.item-link-1（日服 Lodestone）与 a.item-link-2（MIRAPRI）。
  // 选择器只匹配 href 含 lodestone 的链接 → 替换后不再命中，天然幂等。
  // v1.2.x：子步骤拆出（降认知复杂度）
  function _aclItemNameEl(box) {
    for (const p of box.querySelectorAll('p')) if (!p.classList.contains('region-name')) return p;
    return null;
  }

  function _aclZhName(nameEl) {
    const cached = nameEl.dataset.zhxItem;
    if (cached) return cached;
    const t0 = (nameEl.textContent || '').trim();
    if (!t0) return null;
    const t1 = trACL(t0);
    if (!t1 || t1 === t0) return null;   // 未获得中文名则跳过（保守）
    return t1;
  }

  function _aclSwapIcon(a, zh) {
    a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
    a.setAttribute('title', '灰机 wiki：' + zh);
    const img = a.querySelector('img');
    if (img) {
      img.removeAttribute('loading');   // 原图 lazy，data URI 无需延迟（未滚动时懒加载不解码）
      img.setAttribute('src', ZHX_WIKI_ICON);
      img.setAttribute('alt', '灰机 wiki');
      img.style.width = '18px';
      img.style.height = '18px';
      img.style.objectFit = 'contain';
    }
    if (!a.querySelector('.zhx-wiki-text')) {
      const lb = document.createElement('span');
      lb.className = 'zhx-wiki-text';
      lb.textContent = '灰机 wiki';
      lb.style.cssText = 'margin-left:4px;font-size:12px;vertical-align:middle;color:inherit';
      a.appendChild(lb);
    }
  }

  function replaceACLLodestone(rootArg) {
    const links = queryIn(localScope(rootArg), 'a.item-link-1[href*="lodestone"]');
    for (const a of links) {
      const box = a.closest('.item-name');
      if (!box) continue;
      const nameEl = _aclItemNameEl(box);
      if (!nameEl) continue;
      const zh = _aclZhName(nameEl);
      if (!zh) continue;
      _aclSwapIcon(a, zh);
    }
  }

  function trimACLNode(node) {
    const raw = node.nodeValue;
    if (!raw?.trim()) return;
    const pe = node.parentElement;
    if (pe?.closest?.(ACL_SKIP_SEL)) return;
    const next = trACL(raw);
    if (next !== raw) {
      node.nodeValue = next;
      markACLItem(node, next);
    }
  }

  // v1.2.x：节点分派拆为子步骤（降认知复杂度）
  function _aclAcceptNode(n) {
    if (n.nodeType === 1) {
      if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
      if (n.closest?.(ACL_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
  }

  function _procACLNode(n) {
    if (n.nodeType === 3) { trimACLNode(n); return; }
    if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') {
      const ph = n.getAttribute('placeholder');
      if (ph) { const nn = trACL(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
      return;
    }
    if (n.hasAttribute?.('title')) {
      const ti = n.getAttribute('title');
      if (ti && /[\u3040-\u30ff]/.test(ti)) { const nn = trACL(ti); if (nn !== ti) n.setAttribute('title', nn); }
    }
  }

  function translateACLPage(rootArg) {
    if (rootArg?.nodeType === 3) { trimACLNode(rootArg); return; }
    const root = rootArg || document.body || document.documentElement;
    if (!root) return;
    _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: _aclAcceptNode,
    });
    const batch = [];
    while (w.nextNode()) batch.push(w.currentNode);
    for (const n of batch) _procACLNode(n);
    safe(replaceACLLodestone, 'ACL lodestone 替换')(rootArg);
  }

  function translateACLTitle() {
    const t = document.title;
    if (!t || !/[\u3040-\u30ff]/.test(t)) return;
    const parts = t.split('｜');
    const nt = parts.map((x) => trACL(x.trim())).join(' ｜ ');
    if (nt && nt !== t && nt.length <= 160) document.title = nt;
  }

  function startACL() {
    ensureZhxItemStyle('zhx-acl-item-style');
    bindZhxItemClick('__zhxAclItemBound');
    safe(translateACLPage, 'ACL 全扫')();
    safe(translateACLTitle, 'ACL 标题')();
    observeLocal((nodes) => {
      for (const n of nodes) safe(translateACLPage, 'ACL 局部')(n);
      safe(translateACLTitle, 'ACL 标题')();
    }, 300);
    // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
  }
