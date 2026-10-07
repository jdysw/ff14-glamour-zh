/* @phase15-module-order:sites/huiji-wiki */
/* @phase15-order-link:sites/huiji-wiki<-sites/mirapri */
import './mirapri.js';
import { resolveEcId, resolveKo } from '../core/data-manager.js';
import { createObserver } from '../core/observer.js';
import { safe } from '../core/runtime.js';
export { EC_BASE, EC_SLOT, MIRAPRI_BASE, RONKA_BASE, _buildReverseBlock, _mountReverseBlock, _removeOldStarlight, _slotFromInfobox, _slotFromList, _slotHit, blockByTitle, eorzeaLink, getItemId, getItemZhName, getJapaneseName, getSlot, injectWikiButton, m_last, startWiki, wikiReverseItems };


  /* =====================================================================
   * 第二部分：灰机 FF14 中文维基物品页 → 「在 MIRAPRI 搜索」按钮
   * 依据：mirapri 的搜索关键词 = 日文装备名（与站内「この装備品で検索」一致）
   * ===================================================================== */

  const MIRAPRI_BASE = 'https://mirapri.com/';
  const RONKA_BASE = 'https://lookbook.ronkacloset.com/';
  const EC_BASE = 'https://ffxiv.eorzeacollection.com/glamours?';

  // wiki 装备栏目 → Eorzea Collection 的部位筛选参数
  const EC_SLOT = {
    '头部防具': 'headPiece',
    '身体防具': 'bodyPiece',
    '手部防具': 'handsPiece',
    '腿部防具': 'legsPiece',
    '脚部防具': 'feetPiece',
    '耳饰': 'earringsPiece',
    '项链': 'necklacePiece',
    '手镯': 'braceletsPiece',
    '戒指': 'ringPiece',
    '武器': 'weaponPiece',
    '盾': 'offhandPiece',
    '时尚配饰': 'fashionPiece',
    '面饰': 'facePiece',
  };

  // EC 的部位筛选用的是它自己的装备 ID（不是 wiki 的物品 ID），
  // EC 装备 ID 从内嵌主表第 4 列读取（中文名 -> EC_ID，由离线采集写入），
  // 不再实时调 EC 接口——那个请求会被 Cloudflare 拦，按钮永远等不到回调。

  // 元素在当前视口下是否可见（用于 hide-m / hide-pc 双份结构：
  // 灰机移动版把同一内容渲染两份，仅其中一份对当前端可见）
  function _visible(el) {
    for (let n = el; n?.nodeType === 1; n = n.parentElement) {
      let cs;
      try { cs = getComputedStyle(n); } catch (e) { /* 忽略：样式读取失败不影响判定 */ }
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
    }
    return true;
  }

  // 按标题找区块：同名多份时优先返回「当前端可见」的一份，
  // 避免把反查块插进被 CSS 隐藏的副本（手机端不可见 bug 的根因）
  function blockByTitle(title) {
    const blocks = document.querySelectorAll('.ff14-content-box-block');
    let firstAny = null;
    for (const b of blocks) {
      const t = b.querySelector('.ff14-content-box-block--title');
      if (!(t && t.textContent.trim() === title)) continue;
      if (!firstAny) firstAny = b;
      if (_visible(b)) return b;
    }
    return firstAny;
  }

  function getJapaneseName() {
    const block = blockByTitle('各语言名称');
    if (!block) return null;
    for (const li of block.querySelectorAll('li')) {
      const img = li.querySelector('img');
      const key = (img && (img.getAttribute('alt') || img.getAttribute('src'))) || '';
      if (/flag[_\s-]?jp/i.test(key)) {
        const txt = li.textContent.replace(/\s+/g, ' ').trim();
        if (txt) return txt;
      }
    }
    const second = block.querySelectorAll('li')[1];
    return second ? second.textContent.replace(/\s+/g, ' ').trim() : null;
  }

  // 物品 ID：取自「其他站点链接」里的 Garland / 光之收藏家 链接
  function getItemId() {
    const as = document.querySelectorAll(
      'a[href*="garlandtools"], a[href*="ff14risingstones"], a[href*="risingstones"]');
    for (const a of as) {
      const h = a.getAttribute('href') || '';
      const m = /#item\/(\d+)/.exec(h) || /[?&]equipmentid=(\d+)/.exec(h) || m_last(h);
      if (m) return typeof m === 'string' ? m : m[1];
    }
    return null;
  }

  function m_last(h) {
    const m = h.match(/\/item\/(\d+)/);
    return m ? m[1] : null;
  }

  // wiki 页当前物品的国服中文名（页面标题形如「物品:伽拉忒亚吊带袜」）
  // 注意：灰机新版把「XXX 于N个月前修改了此页面。」也塞在 h1 里，
  // 必须先截断再规范化，否则中文名会带上编辑者信息，查表必然失败。
  function getItemZhName() {
    const clean = (v) => {
      let t = (v || '').replace(/^\s*(物品|道具|Item)\s*[:：]\s*/i, '');
      t = t.split(/\n|\r|于.{0,8}(?:前|ago)修改|修改了此页面/)[0];
      return t.replace(/\s+/g, ' ').trim();
    };
    const ok = (v) => {
      const t = clean(v);
      return (t && t.length <= 40 && /[\u4e00-\u9fff]/.test(t)) ? t : null;
    };
    let t = null;
    const main = document.querySelector('#firstHeading .mw-page-title-main, .mw-page-title-main');
    if (main) t = ok(main.textContent);
    const h = document.querySelector('#firstHeading, h1.firstHeading, h1');
    if (!t && h) {
      const it = h.innerText || '';
      const firstLine = it.split('\n').map((x) => x.trim()).find(Boolean) || '';
      t = ok(firstLine) || ok(h.textContent);
    }
    if (!t) {
      const m = /^\s*(?:物品|道具|Item)\s*[:：]\s*([^\-|]{1,40})/i.exec(document.title || '');
      if (m) t = ok(m[1]);
    }
    return t;
  }

  // 装备栏目（部位）
  // v1.3.1：多路回退——移动皮肤/类名变体下也能识别部位（原单选择器在部分皮肤下失效）
  function _slotHit(el) {
    if (!el) return null;
    const t = (el.textContent || '').trim();
    return EC_SLOT[t] ? { key: EC_SLOT[t], label: t } : null;
  }
  function _slotFromList(list) {
    for (const el of list) {
      const r = _slotHit(el);
      if (r) return r;
    }
    return null;
  }
  function _slotFromInfobox() {
    const root = document.querySelector('.infobox, [class*="infobox"]');
    if (!root) return null;
    for (const el of root.querySelectorAll('div, td, dt, dd, li')) {
      if (el.children.length > 2) continue;
      const t = (el.textContent || '').trim();
      if (t.length <= 6 && EC_SLOT[t]) return { key: EC_SLOT[t], label: t };
    }
    return null;
  }
  function getSlot() {
    let r = _slotHit(document.querySelector('.infobox-item--name-category'));
    if (r) return r;
    try { r = _slotFromList(document.querySelectorAll('[class*="name-category"]')); } catch (e) { /* 忽略：类名变体查询失败——继续兜底扫描 */ }
    if (r) return r;
    try { r = _slotFromInfobox(); } catch (e) { /* 忽略：兜底扫描失败——按非装备页处理 */ }
    return r;
  }

  // → Eorzea Collection「已筛好这件装备」的搜索页（零网络：本地表直查）
  function eorzeaLink(cb) {
    const slot = getSlot();
    if (!slot) { cb(null); return; }
    const zh = getItemZhName();
    if (!zh) { cb(null); return; }
    const ecId = resolveEcId(zh);
    if (!ecId) { cb(null); return; }
    cb({ href: EC_BASE + encodeURIComponent('filter[' + slot.key + ']') + '=' + ecId,
         why: slot.label + ' · ' + zh });
  }

  // 「幻化装备反查链接」四站（一条一行，与「其他站点链接」同款区块样式）
  function wikiReverseItems() {
    const items = [];
    // 1) 光之收藏家（国服，已迁入石之家幻化版块；物品 ID 取自页面内 Garland / 光之收藏家链接）
    const id = getItemId();
    if (id) items.push(['https://ff14risingstones.web.sdo.com/pc/index.html#/search?equipmentid=' + id + '&section=glamour', '光之收藏家']);
    const zh = getItemZhName();
    // 2) 日服幻化站（mirapri，关键词=日文名）
    const jp = getJapaneseName();
    const nm = jp || zh;
    if (nm) items.push([MIRAPRI_BASE + '?keyword=' + encodeURIComponent(nm), '日服幻化站（MIRAPRI SNAP）']);
    // 3) 国际服幻化站（Eorzea Collection，内嵌表直查，零网络）
    eorzeaLink((ec) => { if (ec) items.push([ec.href, '国际服幻化站（Eorzea Collection）']); });
    // 4) 韩服幻化站（Ronka LookBook，关键词=韩文名，由中文名反查）
    const ko = resolveKo(zh);
    if (ko) items.push([RONKA_BASE + '?keyword=' + encodeURIComponent(ko), '韩服幻化站（Ronka LookBook）']);
    return items;
  }

  // v1.2.7：DOM 清理/构建/挂载拆为子步骤（降认知复杂度）
  function _removeOldStarlight(src) {
    if (!src) return;
    for (const a of src.querySelectorAll('a')) {
      const h = a.getAttribute('href') || '';
      if (/risingstones/i.test(h) || (a.textContent || '').includes('光之收藏家')) {
        const li = a.closest('li');
        (li || a).remove();
      }
    }
  }

  function _buildReverseBlock(items) {
    const block = document.createElement('div');
    block.className = 'ff14-content-box-block zhixia-reverse-block';
    const title = document.createElement('div');
    title.className = 'ff14-content-box-block--title';
    title.textContent = '幻化装备反查链接';
    block.appendChild(title);
    // 与「其他站点链接」等灰机原生区块同款：标题下一道分隔线（hr）
    block.appendChild(document.createElement('hr'));
    const ul = document.createElement('ul');
    for (const [href, text] of items) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'nofollow noreferrer noopener';
      a.textContent = text;
      li.appendChild(a);
      ul.appendChild(li);
    }
    block.appendChild(ul);
    return block;
  }

  // 从选择器命中的元素中取第一个「当前端可见」的（无可见项时退回第一项）
  function _pickVisible(sel) {
    const list = document.querySelectorAll(sel);
    let first = null;
    for (const el of list) {
      if (!first) first = el;
      if (_visible(el)) return el;
    }
    return first;
  }

  function _mountReverseBlock(block, src) {
    // 位置：「其他站点链接」之后；无该区块时退回 infobox / 正文顶
    // （双份结构下取当前端可见的那份，避免插进隐藏副本）
    if (src?.parentElement) {
      src.parentElement.insertBefore(block, src.nextSibling);
      return;
    }
    const info = _pickVisible('.infobox, [class*="infobox"]');
    if (info?.parentElement) {
      info.parentElement.insertBefore(block, info.nextSibling);
      return;
    }
    const content = document.querySelector('#mw-content-text, .mw-parser-output, #content');
    if (content) content.insertBefore(block, content.firstChild);
  }

  function injectWikiButton() {
    // 幂等重建：数据晚到时刷新会先移除上一版区块再重建
    const prev = document.querySelector('.zhixia-reverse-block');
    if (prev) prev.remove();

    // 仅在装备页注入：页面 infobox 部位类目须属于幻化装备（与 EC 链接同一判定）。
    // 非装备页（消耗品/素材/家具/任务/NPC 等）直接退出——既不注入反查区块，
    // 也不改动「其他站点链接」。
    if (!getSlot()) return;

    // 原「其他站点链接」列表里的光之收藏家移除（新块内已有，避免重复）
    const src = blockByTitle('其他站点链接');
    _removeOldStarlight(src);

    // 「幻化装备反查链接」区块（与「其他站点链接」同款式：区块 + 标题 + 列表，一行一条）
    const items = wikiReverseItems();
    if (!items.length) return;
    const block = _buildReverseBlock(items);
    _mountReverseBlock(block, src);
    document.documentElement.dataset.zhixiaWikiDone = '1';
  }

  function startWiki() {
    // 灰机页面 DOM 变动极频繁（目录/评论区/懒加载），必须节流并限制重试次数，
    // 否则按钮插不进去时会每次变动都重跑把页面拖死。
    // 移动端（Via 等）首屏渲染慢：放宽总重试次数 + 阶梯定时兜底，避免固定 3 次
    // 尝试在前几秒用尽后永久放弃；注入为纯本地查询（无网络），重试成本极低。
    let tries = 0;
    const MAX_TRIES = 16;
    const attempt = () => {
      if (tries >= MAX_TRIES) return;
      if (document.documentElement.dataset.zhixiaWikiDone) return;
      tries++;
      try { window.__zhxWikiTries = tries; } catch (e) { /* 忽略：探测钩子，失败不影响注入 */ }
      safe(injectWikiButton, 'Wiki 按钮注入')();
    };
    attempt();
    // 阶梯定时：覆盖移动端首屏渲染慢的场景（成功即止，重复触发为幂等重建）；
    // v1.3.1：增补 22s / 30s 两档，覆盖移动端极端慢渲染
    [1500, 4000, 8000, 15000, 22000, 30000].forEach((ms) => setTimeout(attempt, ms));
    // v1.4 Phase 7：经统一观察器（debounce 由统一层管理；尝试次数守卫仍在 attempt 内）
    createObserver({ debounce: 1200, handler: () => attempt() });
    // 数据就绪刷新「幻化装备反查链接」区块由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
  }
