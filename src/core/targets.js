/* @phase15-module-order:core/targets */
/* @phase15-order-link:core/targets<-core/observer */
import './observer.js';
import { WIKI_ITEM } from './constants.js';
import { itemDbReady, resolveByName } from './data-manager.js';
import { observeLocal } from './observer.js';
import { _perfNow, lookupZh, safe } from './runtime.js';
export { EC_CARD_SEL, EC_ITEMS_APPLY, EC_ITEM_SKIP_SEL, PLACEHOLDER, _domStats, applyItemZh, applyPlaceholder, bindGlobalWikiJump, collectTargets, dispatchTargets, processRoot, startItems, zhApply, zhApplyCards, zhApplyDye, zhApplyPlain };


  /* @zhixia:core-targets-start */
  /* ── Core Targets（v1.4 Phase 8）：统一 DOM Target Pipeline——
     采集（collectTargets）→ 分派（dispatchTargets）→ 处理（processRoot）。
     root 缺省 = 全页（document 范围）；传元素 = 局部（Mutation 新增子树）：
     两条路径经同一采集 / 判定逻辑，行为与旧版逐项一致（golden 冻结）。
     Phase 15 模块化构建时原样抽出为 src/core/targets.js。 */

  // 统一采集：root 内（含自身）按类型收集候选，输出标准 target：
  //   { type, element, text, context }
  // type：item / plain-item / card / dye（EC 物品链；其他站按需扩展）
  // 全页（root 缺省）：仅 document.querySelectorAll；
  // 局部（root 为元素）：先 matches 自身、再子树，与旧 *In 版逐字一致。
  function collectTargets(root) {
    const local = root != null;
    const scope = local ? root : document;
    const list = [];
    if (local && !scope.querySelectorAll) return list;   // 局部根非元素：无目标
    const scan = (sel) => {
      const cands = [];
      if (local && scope.matches?.(sel)) cands.push(scope);
      scope.querySelectorAll(sel).forEach((el) => cands.push(el));
      return cands;
    };

    // 四类采集拆为局部函数（仅降复杂度；判定、顺序与产物逐字不变）
    const pushItems = () => {
      // item：装备链接（两站均用 eorzeadb_link 标记）
      for (const a of scan('a.eorzeadb_link')) {
        if (a.classList.contains('zhixia-item-zh')) continue;
        const el = a.querySelector('span') || a;
        const name = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!name || name.length < 2 || name.length > 48) continue;
        if (/^(https?:|\/)/.test(name)) continue;
        list.push({ type: 'item', element: a, text: name, context: { el } });
      }
    };
    const pushPlainItems = () => {
      // plain-item：EC「套装」区块里的纯文本装备名（无链接、无 hash）
      for (const sp of scan('span[class*="has-text-rarity-"]')) {
        if (sp.classList.contains('zhixia-item-zh')) continue;
        const name = (sp.textContent || '').replace(/\s+/g, ' ').trim();
        if (!name || name.length < 3 || name.length > 48) continue;
        if (!resolveByName(name)) continue;
        list.push({ type: 'plain-item', element: sp, text: name, context: {} });
      }
    };
    const pushCards = () => {
      // card：EC 列表页卡片标题（外层 <a> 指向站内页）
      for (const el of scan(EC_CARD_SEL)) {
        if (el.dataset.zhixiaCard) continue;
        const name = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!name || name.length < 3 || name.length > 48) continue;
        if (!resolveByName(name)) continue;
        list.push({ type: 'card', element: el, text: name, context: {} });
      }
    };
    const pushDyes = () => {
      // dye：染剂标签（「⬤ Ink Blue」）
      for (const el of scan('div.tag, span.tag')) {
        if (el.classList.contains('zhixia-dye-zh')) continue;
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const m = /^([\u25EF\u2B24\u25CB\u25CF])\s{0,8}(.{1,200})$/.exec(t);
        if (!m) continue;
        const name = m[2].trim();
        const zh = resolveByName(name) || (name === 'Undyed' ? '未染色' : null);
        if (!zh) continue;
        list.push({ type: 'dye', element: el, text: name, context: { zh } });
      }
    };
    pushItems();
    pushPlainItems();
    pushCards();
    pushDyes();

    return list;
  }

  // 统一分派：按 type 交给对应处理器；各处理器收到的仍是「同类 target 数组」，
  // 调用顺序固定为 item → plain-item → card → dye（与旧版四件套执行顺序一致）。
  function dispatchTargets(targets, applyMap) {
    const m = applyMap || {};
    const by = {};
    for (const t of targets) {
      if (!by[t.type]) by[t.type] = [];
      by[t.type].push(t);
    }
    if (m.item && by.item) m.item(by.item);
    if (m['plain-item'] && by['plain-item']) m['plain-item'](by['plain-item']);
    if (m.card && by.card) m.card(by.card);
    if (m.dye && by.dye) m.dye(by.dye);
  }

  // 统一处理路径：全页（root 缺省）与局部（元素）同路径；
  // context.applyMap 提供各 type 的处理器；返回本次采集到的 targets。
  // Phase 19：处理统计（次数 / 累计 / 峰值 / 首次耗时；整数与毫秒累加，无行为影响）
  const _domStats = { calls: 0, ms: 0, maxMs: 0, firstMs: -1 };
  function processRoot(root, context) {
    const c = context || {};
    const t0 = _perfNow();
    const targets = collectTargets(root);
    dispatchTargets(targets, c.applyMap);
    const dt = _perfNow() - t0;
    _domStats.calls++;
    _domStats.ms += dt;
    if (dt > _domStats.maxMs) _domStats.maxMs = dt;
    if (_domStats.firstMs < 0) _domStats.firstMs = dt;
    return targets;
  }
  /* @zhixia:core-targets-end */


  // EC 列表页（面饰 / 时尚配饰 / 陆行鸟 / 时尚趋势）的装备名是纯文本卡片标题，
  // 外层 <a> 指向 EC 站内页：这里把标题换成国服中文名，点标题直接去灰机 wiki。
  const EC_CARD_SEL = 'p.title.has-text-text.is-5, p.title.has-text-text,' +
                      ' h3[class*="has-text-rarity-"], h4[class*="has-text-rarity-"], h3.minititle';

  // 文本链需避让的「物品链管辖」选择器：这些元素内的文本由 zhApply / zhApplyPlain /
  // zhApplyCards 处理（链接改写 / 包装成 a / 打点标记），文本链若抢先翻译会让物品链
  // 拿不到原文而跳过（历史缺陷：EC 站装备链接点击不跳 wiki）。注意本常量引用
  // EC_CARD_SEL，只能在 4053 行（其定义）之后使用——调用均发生在脚本分发阶段，安全。
  const EC_ITEM_SKIP_SEL = 'a.eorzeadb_link, span[class*="has-text-rarity-"], ' + EC_CARD_SEL;

  function zhApplyCards(targets) {
    targets.forEach((t) => {
      const zh = resolveByName(t.name);
      if (!zh || zh === t.name) return;
      t.el.textContent = zh;
      t.el.dataset.zhixiaCard = '1';
      t.el.title = t.name + '（国服：' + zh + '）— 点击打开灰机 wiki';
      t.el.style.cursor = 'pointer';
      t.el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(WIKI_ITEM + encodeURIComponent(zh), '_blank', 'noopener');
      }, true);
    });
  }

  function zhApplyPlain(targets) {
    targets.forEach((t) => {
      const zh = resolveByName(t.name);
      if (!zh || zh === t.name) return;
      const a = document.createElement('a');
      a.className = t.sp.className;
      a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'nofollow noopener');
      a.title = t.name + '（国服：' + zh + '）';
      a.textContent = zh;
      a.classList.add('zhixia-item-zh');
      t.sp.replaceWith(a);
    });
  }

  // 输入框提示文字
  const PLACEHOLDER = {
    'Search by title': '按标题搜索',
    'Search by player': '按玩家搜索',
    'Search by name': '按名称搜索',
    'Search': '搜索',
    'Search...': '搜索…',
    'Filter': '筛选',
  };

  function applyPlaceholder() {
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((el) => {
      if (el.dataset.zhixiaPh === '1') return;
      const t = (el.getAttribute('placeholder') || '').trim();
      if (!t) return;
      const v = PLACEHOLDER[t];
      if (!v) return;
      el.setAttribute('placeholder', v);
      el.dataset.zhixiaPh = '1';
    });
  }

  function zhApplyDye(targets) {
    targets.forEach((t) => {
      const zh = t.zh;
      if (!zh || zh === t.name) return;
      let changed = false;
      const walk = (node) => {
        for (const n of Array.from(node.childNodes)) {
          if (n.nodeType === 3) {
            if (n.nodeValue?.includes(t.name)) {
              n.nodeValue = n.nodeValue.replace(t.name, zh);
              changed = true;
            }
          } else if (n.nodeType === 1) {
            walk(n);
          }
        }
      };
      walk(t.el);
      if (changed) {
        t.el.classList.add('zhixia-dye-zh');
        t.el.title = t.name + '（国服：' + zh + '）';
      }
    });
  }

  function zhApply(targets) {
    targets.forEach((t) => {
      const zh = lookupZh(t.a, t.name);
      if (!zh || zh === t.name) return;
      t.el.textContent = zh;
      t.a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
      t.a.setAttribute('target', '_blank');
      t.a.setAttribute('rel', 'nofollow noopener');
      t.a.title = t.name + '（国服：' + zh + '）';
      t.a.classList.add('zhixia-item-zh');
    });
  }

  // EC 全局兜底：无论装备名以何种元素呈现，点击时一律跳国服灰机 wiki。
  // 用捕获阶段监听，抢在 EC 自己的跳转逻辑之前。
  function bindGlobalWikiJump() {
    if (window.__zhixiaWikiJumpBound) return;
    window.__zhixiaWikiJumpBound = true;
    document.addEventListener('click', (e) => {
      const el0 = e.target;
      if (!el0?.closest) return;
      const a = el0.closest('a[href*="lodestone"], a[href*="eorzeadb"], a.eorzeadb_link, a[href*="/gear/"], a[href*="garland"], a[href*="eriones"], a[href*="gamerescape"], a[href*="ffxivdb"]');
      let probe = a || el0;
      let guard = 0;
      let zh = null;
      while (probe && guard < 6) {
        const t = (probe.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length >= 2 && t.length <= 48) {
          const z = lookupZh(a, t);
          if (z && z !== t) { zh = z; break; }
        }
        probe = probe.parentElement;
        guard++;
      }
      if (!zh) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(WIKI_ITEM + encodeURIComponent(zh), '_blank', 'noopener');
    }, true);
  }

  // EC 物品链统一分派映射：标准 target → 既有 apply（字段与行为逐字保持）
  const EC_ITEMS_APPLY = {
    item: (ts) => safe(zhApply, 'zhApply')(ts.map((t) => ({ a: t.element, el: t.context.el, name: t.text }))),
    'plain-item': (ts) => safe(zhApplyPlain, 'zhApplyPlain')(ts.map((t) => ({ sp: t.element, name: t.text }))),
    card: (ts) => safe(zhApplyCards, 'zhApplyCards')(ts.map((t) => ({ el: t.element, name: t.text }))),
    dye: (ts) => safe(zhApplyDye, 'zhApplyDye')(ts.map((t) => ({ el: t.element, name: t.text, zh: t.context.zh }))),
  };

  // 统一入口：装备/染剂/卡片/占位符 一次跑完（全页；经统一 Target Pipeline）
  function applyItemZh() {
    processRoot(null, { applyMap: EC_ITEMS_APPLY });
    safe(applyPlaceholder, 'placeholder')();
  }

  function startItems() {
    itemDbReady(() => {
      safe(bindGlobalWikiJump, 'wikiJump')();
      applyItemZh();
      // 局部：新增节点收窄到 subtree，避免全页重查（与全页同一条 Target Pipeline）
      observeLocal((nodes) => {
        for (const n of nodes) {
          if (n.nodeType === 1) safe(processRoot, 'EC 物品局部')(n, { applyMap: EC_ITEMS_APPLY });
        }
      }, 400);
    });
  }
