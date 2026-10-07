/* @phase15-module-order:sites/ff14-fc */
/* @phase15-order-link:sites/ff14-fc<-core/cache */
import { _getItemPfx, _getSeriesPfx, _getSubstrKeysAll } from '../core/cache.js';
import { WIKI_ITEM } from '../core/constants.js';
import { _tablesReady, resolveByHash } from '../core/data-manager.js';
import { DICT_FC } from '../core/dictionary.js';
import { lookupJp2Zh, lookupSeries } from '../core/item-resolver.js';
import { observeLocal } from '../core/observer.js';
import { safe } from '../core/runtime.js';
import { SKIP_TAGS } from './mirapri.js';
export { FC_BANNER_RULES, FC_DECOR_HEAD, FC_DECOR_TAIL, FC_ROLE_ZH, FC_SKIP_SEL, FC_WEAPON_CARDS, _fcAcceptNode, _fcJumpClick, _fcJumpName, _fcJumpResolve, _procFCImg, _procFCNode, _trFCDecor, _trFCExact, _trFCName, _trFCSubstr, _wowFCInput, bindFCBanners, bindFCWikiJump, fcBannerMatch, fcLinkZhName, fixFCMenu, rewriteFCForeignLink, startFC, trFC, trFCSegments, translateFCPage, translateFCTitle, trimFCNode };


  // v1.12.3：职能/类别词（・复合名逐段翻译用）
  const FC_ROLE_ZH = {
    'ディフェンダー': '御敌', 'スレイヤー': '制敌', 'ストライカー': '强袭',
    'スカウト': '游击', 'ヒーラー': '治愈', 'キャスター': '咏咒',
    'レンジャー': '精准', 'ファイター': '战斗', 'ソーサラー': '法系',
  };

  // v1.12.3：「・」复合名逐段翻译（ダークマホガニー・スレイヤー → 深红木·制敌）
  function trFCSegments(t) {
    if (!t?.includes('・')) return null;
    const parts = t.split('・');
    if (parts.length < 2 || parts.length > 5) return null;
    let hit = 0;
    const zh = parts.map((p) => {
      const z = FC_ROLE_ZH[p] || DICT_FC[p] || lookupJp2Zh(p) || lookupSeries(p);
      if (z) { hit++; return z; }
      return null;
    });
    if (hit < 1) return null;
    // 有未命中的段：仅当未命中段可安全保留（短拉丁/数字）才输出
    const out = parts.map((p, i) => (zh[i] != null ? zh[i] : p));
    return out.join('·');
  }

  // 装饰性首尾符号（菜单里的 ≫ ▶ » ✨ 😊 等，不参与查表）
  // v1.2.2：加 u 标志——emoji（星面字符）在无 u 的字符类里按代理对拆半匹配
  // v1.2.3：TAIL 量词改有界 {1,64}——消除 S8786 潜在超线性回溯（>64 个连续装饰的输入不现实）
  const FC_DECOR_HEAD = /^[\s|｜<＜≪«◀◁▷●○★☆🎉✨👗💍🛡💬]+/u;
  const FC_DECOR_TAIL = /[\s|｜>＞≫»▶▽◆■□●○★☆♪！!。、…😊✨🎉]{1,64}$/u;

  // 逐条替换：整串精确 → 剥离装饰 → 当日文装备名 → 子串兜底
  // v1.2.8：四步链拆为子步骤（降认知复杂度）
  // ① 整串精确（v1.12.11：空白归一化回退，防空格式差异）
  function _trFCExact(text, t0) {
    let hit0 = DICT_FC[t0];
    if (!hit0) {
      const norm = t0.replace(/[ \t\u00a0]+/g, ' ').trim();
      if (norm !== t0) hit0 = DICT_FC[norm];
    }
    if (!hit0) return null;
    const i = text.indexOf(t0);
    return text.slice(0, i) + hit0 + text.slice(i + t0.length);
  }

  // ② 剥离装饰符号后再试
  function _trFCDecor(text, t0, core) {
    if (!core || core === t0) return null;
    const hit1 = DICT_FC[core];
    if (!hit1) return null;
    const head = t0.slice(0, t0.indexOf(core));
    const tail = t0.slice(t0.indexOf(core) + core.length);
    const i = text.indexOf(t0);
    return text.slice(0, i) + head + hit1 + tail + text.slice(i + t0.length);
  }

  // ③ 日文装备名（剥「画像」等后缀）；失败再试系列名（v1.12.0）
  // v1.12.2：含假名 OR 纯汉字串（≤20字，如 夜桜上衣）都试查
  // v1.2.1：判定前剥【…】标记——「春日半頬【想】」等「纯汉字+全角标记」名此前两条件都不满足，整名不查表
  function _trFCName(text, t0, core) {
    const c3 = core || t0;
    const c3p = c3.replace(/【[^【】]*】/g, '').trim() || c3;
    const isKana = /[\u3040-\u30ff]/.test(c3p);
    const isKanji = /^[\u3005\u3006\u4e00-\u9fff]+$/.test(c3p) && c3p.length >= 2 && c3p.length <= 20;
    if (!isKana && !isKanji) return null;
    const cand = c3.replace(/(の画像|画像|イメージ|の見た目)$/, '').trim();
    // v1.1.3：数据就绪前不跑逐段翻译——「系列・职业」半翻译（ファントムヴィジョン·御敌）会破坏原文，
    // 数据到后的补扫将无法再识别（整体译名依赖完整日文名）；等数据齐由补扫统一处理
    let zh = lookupJp2Zh(cand) || lookupSeries(cand);
    if (!zh && _tablesReady) zh = trFCSegments(cand);
    if (!zh || zh === cand) return null;
    const i2 = text.indexOf(t0);
    return text.slice(0, i2) + zh + text.slice(i2 + t0.length);
  }

  // ④ 子串兜底：含菜单词/装备名的片段（v1.14.5：门槛 6→2，覆盖被 <br> 等拆分的短节点如「で制作」）
  // v1.1.3：数据就绪前不跑——避免对「系列・职业」复合名做部分替换破坏原文（如 ファントムヴィジョン・御敌）；补扫时统一处理
  function _trFCSubstr(text, t0, core) {
    if (!_tablesReady || (core || t0).length < 2 || !/[^\x00-\x7F]/.test(t0)) return null;
    let out = text;
    let changed = false;
    // 长词优先，避免短词先替换（v1.1.6：含系列 + 物品前缀推导）
    for (const k of _getSubstrKeysAll()) {
      if (!out.includes(k)) continue;
      const v = DICT_FC[k] != null ? DICT_FC[k] : _getSeriesPfx().get(k) || _getItemPfx().get(k);
      if (v == null) continue;
      out = out.split(k).join(v);
      changed = true;
    }
    return changed ? out : null;
  }

  // 逐条替换：整串精确 → 剥离装饰 → 当日文装备名 → 子串兜底
  function trFC(text) {
    if (!text) return text;
    const t0 = text.trim();
    if (!t0) return text;
    if (t0.length > 120) return text;
    const core = t0.replace(FC_DECOR_HEAD, '').replace(FC_DECOR_TAIL, '').trim();
    const s1 = _trFCExact(text, t0);
    if (s1 !== null) return s1;
    const s2 = _trFCDecor(text, t0, core);
    if (s2 !== null) return s2;
    const s3 = _trFCName(text, t0, core);
    if (s3 !== null) return s3;
    const s4 = _trFCSubstr(text, t0, core);
    if (s4 !== null) return s4;
    return text;
  }

  const FC_SKIP_SEL = 'script, style, noscript, textarea, .sns, .twitter, .line';

  function trimFCNode(node) {
    const raw = node.nodeValue;
    if (!raw?.trim()) return;
    const p = node.parentElement;
    if (p?.closest?.(FC_SKIP_SEL)) return;
    const next = trFC(raw);
    if (next !== raw) node.nodeValue = next;
  }

  // v1.2.8：节点分派拆为子步骤（降认知复杂度）
  function _fcAcceptNode(n) {
    if (n.nodeType === 1) {
      if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
      if (n.closest?.(FC_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
  }

  function _wowFCInput(n) {
    const ph = n.getAttribute('placeholder');
    if (ph) { const nn = trFC(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
    // v1.2.1：合并原被 2882 分支遮蔽的 input[value] 处理（v1.12.7 起从未生效；仅 submit/button/reset 防误伤）
    const v0 = n.getAttribute('value');
    if (v0 && v0.length <= 24 && /^(submit|button|reset)$/i.test(n.getAttribute('type') || '')) {
      const tv = trFC(v0);
      if (tv && tv !== v0) n.setAttribute('value', tv);
    }
  }

  function _procFCImg(n) {
    const alt = n.getAttribute('alt');
    if (!alt || alt.length < 2 || alt.length > 90) return;
    const nn = trFC(alt);
    if (nn !== alt && !n.dataset.zhixiaFcAlt) { n.setAttribute('alt', nn); n.dataset.zhixiaFcAlt = '1'; }
  }

  function _procFCNode(n) {
    if (n.nodeType === 3) { trimFCNode(n); return; }
    if (n.tagName === 'INPUT') { _wowFCInput(n); return; }
    if (n.tagName === 'A' && /lodestone|finalfantasyxiv|garland|eriones|ffxivdb|gamerescape/i.test(n.getAttribute('href') || '')) {
      // v1.12.1：外服链接 → 直接改写为灰机 wiki（文字查表；已中文则直接用）
      rewriteFCForeignLink(n);
      return;
    }
    if (n.tagName === 'IMG' || n.hasAttribute('alt')) _procFCImg(n);
  }

  function translateFCPage(rootArg) {
    const isFull = !rootArg;
    if (isFull) {
      if (window.__zhixiaFcBusy) return;
      window.__zhixiaFcBusy = true;
    }
    try {
      if (rootArg?.nodeType === 3) { trimFCNode(rootArg); return; }
      const root = rootArg || document.body || document.documentElement;
      if (!root) return;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: _fcAcceptNode,
      });
      const batch = [];
      while (w.nextNode()) batch.push(w.currentNode);
      for (const n of batch) _procFCNode(n);
    } finally {
      if (isFull) window.__zhixiaFcBusy = false;
    }
  }

  // <title> 汉化（子页标题：装备一覧＆検索 | ミラプリライフ 等）
  function translateFCTitle() {
    const t = document.title;
    if (!t || !/[\u3040-\u30ff]/.test(t)) return;
    let out = t;
    const parts = out.split(/[|｜\-–—]/).map((x) => x.trim()).filter(Boolean);
    const mapped = parts.map((pp) => {
      const hit = DICT_FC[pp];
      if (hit) return hit;
      const zh = lookupJp2Zh(pp.replace(/(の一覧|一覧|まとめ)$/, ''));
      return zh || pp;
    });
    out = mapped.join(' | ');
    if (out !== t && out.length <= 80) document.title = out;
  }

  // v1.12.1：外服装备链接（Lodestone 等）→ 改写为灰机 wiki 链接
  function fcLinkZhName(a) {
    const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 2 || t.length > 60) return null;
    // v1.2.1：① Lodestone hash 直查（hash→物品表中文名，不受文本侧子串替换污染，如「春日护手【想】」）
    const hm = (a.getAttribute('href') || '').match(/lodestone\/playguide\/db\/item\/([0-9a-f]+)/i);
    if (hm) {
      const z = resolveByHash(hm[1]);
      if (z && z !== t) return z;
    }
    // v1.2.1：② 判定前剥【…】标记（「春日半頬【想】」等「纯汉字+全角标记」名此前不查表）
    const tp = t.replace(/【[^【】]*】/g, '').trim() || t;
    if (/[\u3040-\u30ff]/.test(tp) || (/^[\u3005\u3006\u4e00-\u9fff]+$/.test(tp) && tp.length <= 20)) {
      const z = lookupJp2Zh(t) || lookupSeries(t) || DICT_FC[t];
      if (z && z !== t) return z;
    }
    // 已是中文（或中日共用汉字）→ 去掉空格直接用
    if (/^[\u4e00-\u9fff·\u3040-\u30ffA-Za-z0-9'\- ]+$/.test(t) && /[\u4e00-\u9fff]/.test(t)) {
      return t;
    }
    return null;
  }
  function rewriteFCForeignLink(a) {
    if (a.dataset.zhixiaFcHref) return;
    const zh = fcLinkZhName(a);
    if (!zh) return;
    a.dataset.zhixiaFcHref = '1';
    a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
    a.removeAttribute('target');
  }

  // v1.12.7：菜单「ID」→「副本装备」
  function fixFCMenu() {
    let changed = false;
    document.querySelectorAll('a[href*="/summary_equipment_id/"]').forEach((a) => {
      if (a.dataset.zhixiaMenu) return;
      const t = (a.textContent || '').trim();
      if (t === 'ID' || t === 'id') {
        a.dataset.zhixiaMenu = '1';
        a.textContent = '副本装备';
        changed = true;
      }
    });
    return changed;
  }

  // 装备名点击 → 灰机 wiki（fc 站装备名多为纯文本/链接，统一兜底）
  // v1.2.8：click 回调拆为子步骤（降认知复杂度）
  function _fcJumpName(probe, t, isForeign) {
    // v1.2.1：① Lodestone hash 直查（不受文本污染）
    if (probe.tagName === 'A') {
      const hm = (probe.getAttribute('href') || '').match(/lodestone\/playguide\/db\/item\/([0-9a-f]+)/i);
      if (hm) { const z = resolveByHash(hm[1]); if (z) return z; }
    }
    // v1.2.1：② 判定前剥【…】标记（同 fcLinkZhName）
    const tp = t.replace(/【[^【】]*】/g, '').trim() || t;
    if (/[\u3040-\u30ff]/.test(tp) || (/^[\u3005\u3006\u4e00-\u9fff]+$/.test(tp) && tp.length <= 20)) {
      const z = lookupJp2Zh(t) || lookupSeries(t) || DICT_FC[t];
      if (z) return z;
    }
    if (isForeign && /^[\u4e00-\u9fff·・A-Za-z0-9'\- ]+$/.test(t) && /[\u4e00-\u9fff]/.test(t)) return t;
    return null;
  }

  function _fcJumpResolve(el0, isForeign) {
    // 向上探测 5 层找可译名
    let probe = el0;
    let guard = 0;
    while (probe && guard < 5) {
      const t = (probe.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t.length >= 2 && t.length <= 60) {
        const z = _fcJumpName(probe, t, isForeign);
        if (z && z !== t) return z;
      }
      probe = probe.parentElement;
      guard++;
    }
    return null;
  }

  function _fcJumpClick(e) {
    const el0 = e.target;
    if (!el0?.closest) return;
    // ① 站内导航/卡片链接放行（非外服）
    if (el0.closest('a[href*="/equipment/"], a[href*="/equipment_"], a[href*="/summary/"], a[href*="/fashion_accessories/"], a[href*="/modern_aesthetics/"]')) return;
    // ② 已是灰机的链接放行
    const a = el0.closest('a');
    if (a && /huijiwiki\.com/i.test(a.getAttribute('href') || '')) return;
    // ③ 外服链接（Lodestone 等）→ 拦截改跳灰机
    const aHref = a ? (a.getAttribute('href') || '') : '';
    const isForeign = /lodestone|finalfantasyxiv\.com|garland|eriones|ffxivdb|gamerescape/i.test(aHref);
    const zh = _fcJumpResolve(el0, isForeign);
    if (!zh || !isForeign) return;
    e.preventDefault();
    e.stopPropagation();
    window.open(WIKI_ITEM + encodeURIComponent(zh), '_blank', 'noopener');
  }

  // 装备名点击 → 灰机 wiki（fc 站装备名多为纯文本/链接，统一兜底）
  function bindFCWikiJump() {
    if (window.__zhixiaFcJump) return;
    window.__zhixiaFcJump = true;
    document.addEventListener('click', _fcJumpClick, true);
  }

  // v1.12.6：横幅汉化 —— 左侧图区不遮，右侧文字区：原日文模糊(亚克力) + 中文双行
  // v1.12.8：武器页职业卡中文（slug → 职业·武器）
  const FC_WEAPON_CARDS = {
    gladiators_arm: '骑士·单手剑', shield: '骑士·盾',
    marauders_arm: '战士·大斧', dark_knights_arm: '暗黑骑士·双手剑',
    gunbreakers_arm: '绝枪战士·枪盾', skyltborg: '特殊职业',
    lancers_arm: '龙骑士·长枪', reapers_arm: '钐镰客·双手镰刀',
    pugilists_arm: '武僧·格斗武器', samurais_arm: '武士·刀',
    rogues_arm: '忍者·双剑', vipers_arm: '蝰蛇剑士·蝰蛇对剑',
    one_handed_axe: '单手斧',
    archers_arm: '吟游诗人·弓', machinists_arm: '机工士·火枪',
    dancers_arm: '舞者·投掷武器', evercoldranges_arm: '远敏职业',
    thaumaturges_arm: '黑魔法师·咒杖', arcanists_grimoire: '召唤师·魔导书',
    red_mages_arm: '赤魔法师·刺剑', pictomancers_arm: '绘灵法师·画笔',
    blue_mages_arm: '青魔法师·青魔法', conjurers_arm: '白魔法师·幻杖',
    scholars_arm: '学者·魔导书', astrologians_arm: '占星术士·天球仪',
    sages_arm: '贤者·咒杖',
  };

  const FC_BANNER_RULES = [
    { match: /banner_001|equipment_search_parts|部位ごと/i, zh: '部位分类' },
    { match: /banner_002|equipment_series_search|装備シリーズ/i, zh: '装备系列' },
    { match: /banner_003|fashion_accessories|ファッションアクセ/i, zh: '时尚配饰' },
    { match: /banner_004|hair_catalog|ヘアカタログ/i, zh: '发型图鉴' },
    { match: /banner_005|weapon_search|武器シリーズ/i, zh: '武器系列' },
  ];
  function fcBannerMatch(a, img) {
    const probe = ((img && (img.dataset.src || img.getAttribute('src') || img.getAttribute('title') || img.getAttribute('alt'))) || '') + ' ' + (a.getAttribute('href') || '');
    for (const r of FC_BANNER_RULES) if (r.match.test(probe)) return r;
    return null;
  }
  function bindFCBanners() {
    let changed = false;
    document.querySelectorAll('div.banner-wrap a').forEach((a) => {
      if (a.dataset.zhixiaBanner) return;
      const img = a.querySelector('img');
      if (!img) return;
      const rule = fcBannerMatch(a, img);
      if (!rule) return;
      a.dataset.zhixiaBanner = '1';
      changed = true;
      a.style.position = a.style.position || 'relative';
      a.style.display = a.style.display || 'block';
      a.style.overflow = 'hidden';
      const big = !!a.closest('.banner-wrap');
      const span = document.createElement('span');
      span.dataset.zhixiaBannerSpan = '1';
      if (big) {
        // 右侧文字区：亚克力（模糊日文）+ 中文双行
        span.style.cssText = 'position:absolute;top:0;bottom:0;right:0;width:42%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:linear-gradient(160deg,rgba(255,255,255,.34),rgba(255,255,255,.12));backdrop-filter:blur(7px) saturate(1.4);-webkit-backdrop-filter:blur(7px) saturate(1.4);border-left:1px solid rgba(255,255,255,.45);pointer-events:none;z-index:2;';
        const l1 = document.createElement('strong');
        l1.textContent = rule.zh;
        l1.style.cssText = 'font-size:20px;font-weight:900;letter-spacing:1px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.65),0 0 14px rgba(0,0,0,.4);line-height:1.15;';
        const l2 = document.createElement('em');
        l2.textContent = '一览・搜索';
        l2.style.cssText = 'font-style:normal;font-size:12px;font-weight:700;letter-spacing:.5px;color:rgba(255,255,255,.95);text-shadow:0 1px 4px rgba(0,0,0,.6);';
        span.appendChild(l1); span.appendChild(l2);
      } else {
        // 小按钮：整块亚克力 + 中文
        span.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.14);backdrop-filter:blur(6px) saturate(1.3);-webkit-backdrop-filter:blur(6px) saturate(1.3);font-weight:800;font-size:12px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.75);pointer-events:none;z-index:2;';
        span.textContent = rule.zh;
      }
      a.appendChild(span);
    });
    // v1.12.8：武器页职业卡（26 张 SVG，文字为矢量路径无法改）→ 右侧叠中文
    document.querySelectorAll('li.weapon-banner-item a').forEach((a) => {
      if (a.dataset.zhixiaWeapon) return;
      const img = a.querySelector('img');
      if (!img) return;
      const href = a.getAttribute('href') || '';
      const mm = /weapon_search\/([a-z_0-9]+)\//.exec(href);
      if (!mm) return;
      const zh = FC_WEAPON_CARDS[mm[1]];
      if (!zh) return;
      a.dataset.zhixiaWeapon = '1';
      changed = true;
      a.style.position = 'relative';
      a.style.display = a.style.display || 'block';
      a.style.overflow = 'hidden';
      const sp = document.createElement('span');
      const parts = zh.split('·');
      sp.style.cssText = 'position:absolute;top:0;bottom:0;right:0;width:54%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:linear-gradient(160deg,rgba(255,255,255,.32),rgba(255,255,255,.1));backdrop-filter:blur(6px) saturate(1.4);-webkit-backdrop-filter:blur(6px) saturate(1.4);border-left:1px solid rgba(255,255,255,.4);pointer-events:none;z-index:2;';
      const b1 = document.createElement('strong');
      b1.textContent = parts[0];
      b1.style.cssText = 'font-size:13px;font-weight:900;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.75),0 0 10px rgba(0,0,0,.45);line-height:1.15;letter-spacing:.5px;';
      sp.appendChild(b1);
      if (parts[1]) {
        const b2 = document.createElement('em');
        b2.textContent = parts[1];
        b2.style.cssText = 'font-style:normal;font-size:10px;font-weight:700;color:rgba(255,255,255,.95);text-shadow:0 1px 3px rgba(0,0,0,.65);';
        sp.appendChild(b2);
      }
      a.appendChild(sp);
    });
    return changed;
  }

  function startFC() {
    safe(translateFCPage, 'FC 全扫')();
    safe(translateFCTitle, 'FC 标题')();
    bindFCWikiJump();
    safe(fixFCMenu, 'FC 菜单')();
    safe(bindFCBanners, 'FC 横幅')();
    observeLocal((nodes) => {
      for (const n of nodes) safe(translateFCPage, 'FC 局部')(n);
      safe(fixFCMenu, 'FC 菜单')();
      safe(bindFCBanners, 'FC 横幅')();
    }, 300);
    // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
  }
