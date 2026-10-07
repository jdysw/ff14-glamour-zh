/* @phase15-module-order:core/dom */
/* @phase15-order-link:core/dom<-sites/eorzea-collection */
import '../sites/eorzea-collection.js';
export { _markScan, _scanStats, _zhixiaTitleKeep, dedupeByAncestor, localScope, queryIn };


  // 属性翻译：EC 部分导航/图标的文字在 alt / aria-label / title 属性里，
  // 文本节点遍历够不到，这里补齐。（被汉化标记过 title 的元素的 title 不动）
  const _zhixiaTitleKeep = new WeakSet();

  /* @zhixia:core-dom-start */
  /* ── Core DOM（v1.4 Phase 4）：DOM 节点批量处理工具——祖先去重
       （dedupeByAncestor；v1.4 Phase 7 升级为 O(n·depth)）。Phase 15 模块化
       构建时，本区段将原样抽出为 src/core/dom.js。 */
  // 祖先去重（v1.4 Phase 7 升级：原 O(n²) contains 扫描 → O(n·depth) 祖先链查询）：
  // ① 完全去重：同一节点重复入队只保留一次；
  // ② 父子不同队：凡「祖先也在本批次」的节点一律跳过（只处理最上层祖先——其处理范围覆盖后代）。
  function dedupeByAncestor(nodes) {
    const uniq = (nodes.length > 1) ? [...new Set(nodes)] : nodes;
    const elems = new Set();
    for (const n of uniq) if (n.nodeType === 1) elems.add(n);
    if (!elems.size) return uniq;
    // 祖先链查询拆为局部函数（仅降复杂度；语义不变）
    const covered = (n) => {
      let p = n.parentNode;
      while (p) {
        if (elems.has(p)) return true;
        p = p.parentNode;
      }
      return false;
    };
    const out = [];
    for (const n of uniq) {
      if (n.nodeType === 1 && covered(n)) continue;
      out.push(n);
    }
    return out;
  }

  /* ── 局部扫描工具与计数（v1.4.1 Mobile Perf）──
     queryIn / localScope：把「局部回调里的全页扫描」收口为「只扫变化子树」的统一入口；
     _scanStats：Probe 读取的扫描计数（global=整文档级扫描、local=局部子树扫描）。 */
  const _scanStats = { global: 0, local: 0 };

  // 局部根解析：元素 → 自身；文本节点 → 父元素；缺省（全页调用）→ null。
  const localScope = (rootArg) => (rootArg == null ? null : (rootArg.nodeType === 1 ? rootArg : (rootArg.parentElement || null)));

  // 扫描计数：scopeEl 非空记 local，否则记 global。
  const _markScan = (scopeEl) => { if (scopeEl) _scanStats.local++; else _scanStats.global++; };

  // 统一查询：scopeEl 缺省 → 全页 document；元素 → 自身（若命中；querySelectorAll 不含自身）+ 子树。
  function queryIn(scopeEl, sel) {
    const out = [];
    if (scopeEl) {
      if (scopeEl.matches?.(sel)) out.push(scopeEl);
      scopeEl.querySelectorAll(sel).forEach((el) => out.push(el));
    } else {
      document.querySelectorAll(sel).forEach((el) => out.push(el));
    }
    _markScan(scopeEl);
    return out;
  }

  /* @zhixia:core-dom-end */
