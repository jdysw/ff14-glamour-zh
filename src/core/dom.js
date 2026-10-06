/* @phase15-module-order:core/dom */
/* @phase15-order-link:core/dom<-sites/eorzea-collection */
import '../sites/eorzea-collection.js';
export { _zhixiaTitleKeep, dedupeByAncestor };


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
    const out = [];
    for (const n of uniq) {
      if (n.nodeType === 1) {
        let p = n.parentNode;
        let covered = false;
        while (p) {
          if (elems.has(p)) { covered = true; break; }
          p = p.parentNode;
        }
        if (covered) continue;
      }
      out.push(n);
    }
    return out;
  }

  /* @zhixia:core-dom-end */
