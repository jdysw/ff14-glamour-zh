import { resolveEcId, resolveKo } from '../core/data-manager.js';
import { createObserver } from '../core/observer.js';
import { safe } from '../core/runtime.js';
export { EC_BASE, EC_SLOT, MIRAPRI_BASE, RONKA_BASE, _buildReverseBlock, _mountReverseBlock, _removeOldStarlight, _slotFromInfobox, _slotFromList, _slotHit, blockByTitle, eorzeaLink, getItemId, getItemZhName, getJapaneseName, getSlot, injectWikiButton, m_last, startWiki, wikiReverseItems };


  /* =====================================================================
   * 灰机 FF14 中文维基物品页 → 各幻化站装备反查链接
   * 依据：mirapri 的搜索关键词 = 日文装备名（与站内「この装備品で検索」一致）
   * ===================================================================== */

  // 各站公开图标的 32px PNG 快照；内嵌显示，不向第三方图标服务发送请求。
  const WIKI_SITE_ICONS = Object.freeze({
    // https://mirapri.ff14eden.work/img/icons/favicon-32x32.png
    eden: 'data:image/png;base64,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',
    // https://ff14risingstones.web.sdo.com/pc/favicon.ico
    starlight: 'data:image/png;base64,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',
    // https://mirapri.com/favicon.ico (favicon.im cache)
    mirapri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADJUlEQVR42u2XT2gTQRTGfzs7TZOUUGu9qLG0oGKClx48toqgiCgeBE/BU8Frr+JdDz0UPFuhvUkvFm+Cp5bSggdBpAWR+BeNCv5JWrWb3fHwGHZrsskmoEVxYFg2eTPve99775tZx1y7ZggCdmQohSYI2DEAgGKHxz8EwHH+EIAgAN8Xh0rJ03GgXgdjfjOAIIBcDnbtgk+f4OhR2LsXvn6FwUFIpzsGoTui2HUl0gsXoFyGgwfh7VsoFkFruH9fbDroKp3YuTHw/Tt4nji/eFHAFAqSipkZ+d+YjpjQiZz7vkR14gSMj8Pu3fKudZiaK1fg1St48AAePRIQSWIzV6/GK6F1rjWUSkJ1krG4CHfvQk9PWyVUiQrv8mVx7vutqTVG7MfG4Px5SYlSXXaBUrC5CcePw5Ej4tx1t/f7r2Bsa9p0FYvw7VtLECqWes+DgQE4eTLs+6TiY5k4ezYE1DEDnift1tcnkTeLwvOab27t83k4dUqYjGFBtaR+dBQ+fICHD+HNm5ByY8T51BTcvh3WigVVLsuaWg3OnJFUxNSDaqC0Xpc2O31aHLkuLC3BjRtw86aAcxy4dw9SKahUYHlZNq9U4Pp1mJ6Gx4/DNj13LlagdAOAHz/g2DGhPggEzOSkROX7kM3C8+eieqUSvH8P8/Miy3v2wKVL0N8P+/aFbOXzMDwMz56JPkSANE/M0FBjpY+MiPRWqzA7C4cPw/o6fP4sIGdnxa5QEOfRdIGAqNcTKKHjSJS/VrrvC83v3gmYUinMabUKd+7Aly/SOcY05jtGnnVT4alWG41dV56HDsmMRpfLwcRE6/as1RIUoe2Cp0/DAyhOHa0ja9esHe36IJAa0rphT9WwcToNT57IAtcNN49Oa2tn1FF0WmVcXYXXr6G3tw2A6NE7NwdrayEr3UzPg5UVWFgQ523b0NKmteTs1i3Yvx8OHJBKz2Yhk5FTzl7H7Brfh60t0f6NDfj4EV6+FG1IpcQ+URFGQYAo4IsX8pvNeavT0D6Vkj0yme1pSnwhsQtSKaGvmxFXnB3diIzp6rb7/8vorwGg293Zfvfn+U/WMmhMGSKEKwAAAABJRU5ErkJggg==',
    // https://ffxiv.eorzeacollection.com/favicon.ico (favicon.im cache)
    ec: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACvklEQVR42sWXzUtUURjGf+85d6ZFOracMvtYBBWUmpvKUSZIYtRc9AVRahAKpWa6SbPUZbQqHAnM6g+IqCG1WmVCVhSU9Q9IX7ZMazY5954Wo32Zduc2Os/qXs7hfR7er/O+wi+YjlQVG0WjQAkQBDTpgQ18MjAiSNQ3GBudPRAAEw5bdlbgkjE0sAQQiOr4VIsMDycsgKUkBzDQaC8PADTJt8je7aJkdNYbSwqHkEI4nRFywGhzUolIiAxBjJRaM9meOpRClUfAsnDuDoBte7EStLyWmqqvQ3JXJr/z8nB6ol7MWMoT+YH9qMryn/97ylD793lzZMpxK96Jqq2ea+hYDRIuXVwBsmEDuvU0yF+KRgR9qgnZtHFxBEgwiO46D8uWzX/J70d3nkNyV6VZQHYWqrsTVuS4uJuN6u6CnJw0CbAsdHsbsjrXfahWBtEdbeD3/6cAEXRzE7J1S+pNZvNmdEvz3/PFrQBVcxTZFfbe6UpCqOoj3gSost2ogwf+u92qQweTHTMVAbJ1C6rhRNp6vqqvQwoL3QmQNXnojnawrPS9OpZGnz2DrF/vQkBR0cK17hU+H1KQP1fbnBnh9h3M02eo2mokVJyed//VGE7fVczbd/8WAGAmJrAvXETy81F1x5F1a70Rf/iI038N8/zF/NFZ0MDYGHZzS7Iiao5CIOCOOR7HuXkL504MEomF0+PfA7WNc/8BzuPHqMOHURUR0POMEMZgHg5jX78Bnyfd5adrf375mozj0L1kWIq2/c79+g1OXz9mfDy1ZjVdUZXwMhXJzh1IYUGS/OUrzOgTL2mSkOmKqvdALhmAMbxTBkbI2FjMI4WRy8llJRP8ckX5h2LPBHozQN7jG4yNKgAdn2oRiC5V6AXp0fHJVv5cyaYrK3cYpFGMlM4sLOl6kRLGMIEwIuL0+gYGfpTMd30HwRwPanMEAAAAAElFTkSuQmCC',
    // https://lookbook.ronkacloset.com/logo/favicon.png
    ronka: 'data:image/png;base64,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',
    // https://miramiru.co/favicon-48.png
    miramiru: 'data:image/png;base64,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',
    // https://end-closet.com/logo.webp
    endcloset: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAEB0lEQVR42u1XTWtcZRR+znnv13xkTEpGECk1JbSadKE0rhSZNFShSDXBDEg3Cv4Cf0Bn4sql4kKqS3cz2KA7TcK0FlzFT2JBiZ0qVZC0NsnM3Ll37n3f42JmoiSmmXyZjWd7D/c853mf8wX8b0dstJODiFCxWNzGr4jR0TJls9O0sgKZnoYhIjnSjEoiajf+1k4OswvVj1zXG2qFoRERBgDpUsesmWiVlfoJRm7cD+8u5IkaAEHEUC9sUA8AbvUPDA4Fvg9ihgAQMRvfmRWUsqB1jCgKq2LwzsXco+8BkEKhwDMzM2ZfAK7OV7/3PG8kDEIDEhYB245LHYFA6xhGJIQIO45rJ5JpNOq1+dp67dVLFx+/uxOInRmYry65XmI0DJqGWLEYE4BwW0QIgAJoMJlK9+s4Rhg0YxAk89Axu1Ff/0psb/ylZwYbAGS75+De64W063oAyc3JiRMj3914bGRA3X5CdHw6DIO81vHNRCplAaLWV+9FfZn+s8avvU9Eplwu8/4ZCIPI85J2EDS+npwYOgsiQP5OarZS7WeyKrbtPBkGTQ1AEomU5Qe13NS5k9dLJVH5POm9M7AZ+OXLDAiJCJWWlpzJ8aHVMIxf10bHREQiAmYlZPjNB/1orwAExaIAJEQk+TNnWqWSqPwLQ9+2wuB6IpFigNBs1gnAuY8/W344nyfd0c2BANhi2SxIRIhZzSnLAiDQWhsvmUyz7TwFAOXy1ngHBmAl11E60Y9axyACATCW5YCMGe6CPDQAKG/IY1XHekPgRIAQjh20BrZXpxEj2Fzy28+HAwcgRjNtYlqEzOEDmO4wwJxhpbozq9MqzNqhA8hea1cByAxblgURCBFI6xgEdasr1MOrgpV2FWgtE1rrTvdm1fTroav4GwD4oViUXe8Dvdji4qI9NkbR1bmfT9muO+H7dQEIXiIlfr3+5YWJ43dEhIm2amFPDIgIlwAuFNoLytjYWHTlyqKtLOcDy3JciDGAgFkRlHm3U6W0p41oa3CYf2ZSqYhVo9+eBvC243rP+Y2aAWD6MgN2be3+3NT5k590stf7BCDcaoUgolOzC9XP22sX7FX9yyPKtk7btgu/sa4BMql0xg78+q8s/Fp7qd3HTtjOVgwEonVsmDnjeqnzXTpiHSNqhXEcRUYpy0n39aumX18KW8HUK88P/14Q4ZmZ7fuA1cN7JxzHY60Nc2cnjKKwM5MJzAqpdMZiVgiCxprv1z7848/qW2+8/GxtO+Ht7gmIlsMw4ChqGQJRdxoDBBAMkV43Wi8T0xdKm08vjB+/AwCFws7BewIQ3TvxYn/2GiX/pZvncjmzOUipJKpzoBj8NyZUKomqVCpWoVDgAz/N2j4Pui+O+BTbr/0FgPf6p4qIFdQAAAAASUVORK5CYII=',
  });

  const MIRAPRI_BASE = 'https://mirapri.com/';
  const RONKA_BASE = 'https://lookbook.ronkacloset.com/';
  const EC_BASE = 'https://ffxiv.eorzeacollection.com/glamours?';
  const MIRAMIRU_BASE = 'https://miramiru.co/en/items/';
  const ENDCLOSET_BASE = 'https://end-closet.com/?search=';

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

  // 一条一行；只有能构造有效装备反查地址的站点才显示。
  function wikiReverseItems() {
    const items = [];
    // 1) 光之收藏家（国服，已迁入石之家幻化版块；物品 ID 取自页面内 Garland / 光之收藏家链接）
    const id = getItemId();
    if (id) items.push(['https://ff14risingstones.web.sdo.com/pc/index.html#/search?equipmentid=' + id + '&section=glamour', '光之收藏家', 'starlight']);
    const zh = getItemZhName();
    // 2) 日服幻化站（mirapri，关键词=日文名）
    const jp = getJapaneseName();
    const nm = jp || zh;
    if (nm) items.push([MIRAPRI_BASE + '?keyword=' + encodeURIComponent(nm), '日服幻化站（MIRAPRI SNAP）', 'mirapri']);
    if (jp) items.push(['https://mirapri.ff14eden.work/#/?search=' + encodeURIComponent(jp), '幻化搭配站（Mirapri Eden）', 'eden']);
    // 3) 国际服幻化站（Eorzea Collection，内嵌表直查，零网络）
    eorzeaLink((ec) => { if (ec) items.push([ec.href, '国际服幻化站（Eorzea Collection）', 'ec']); });
    // 4) 韩服幻化站（Ronka LookBook，关键词=韩文名，由中文名反查）
    const ko = resolveKo(zh);
    if (ko) items.push([RONKA_BASE + '?keyword=' + encodeURIComponent(ko), '韩服幻化站（Ronka LookBook）', 'ronka']);
    // Miramiru 使用游戏物品 ID；End Closet 的原生穿搭搜索使用韩文装备名，
    // 其 /items/:id 实际为穿搭文档详情，不能将游戏 ID 拼到该路径。
    if (id) items.push([MIRAMIRU_BASE + id, '幻化展示站（Miramiru）', 'miramiru']);
    if (ko) items.push([ENDCLOSET_BASE + encodeURIComponent(ko), '韩服幻化站（End Closet）', 'endcloset']);
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
    for (const [href, text, site] of items) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'nofollow noreferrer noopener';
      a.textContent = text;
      const icon = document.createElement('img');
      icon.src = WIKI_SITE_ICONS[site];
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');
      icon.width = 16;
      icon.height = 16;
      icon.style.cssText = 'display:inline-block;vertical-align:-3px;margin-right:6px;object-fit:contain';
      a.insertBefore(icon, a.firstChild);
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
