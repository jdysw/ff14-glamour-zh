/* @phase15-module-order:core/observer */
/* @phase15-order-link:core/observer<-core/translator */
import './translator.js';
import { dedupeByAncestor } from './dom.js';
import { _zhxErr } from './runtime.js';
export { _obsStats, createObserver, observeLocal };


  /* @zhixia:core-observer-start */
  /* ── Core Observer（v1.4 Phase 7）：统一 MutationObserver 调度层——pending 队列 /
       debounce 计时 / 洪峰保护 / 祖先去重（dedupeByAncestor）/ childList 与可选
       characterData（按站点显式开启，禁止无条件开启）。所有站点的观察器都经由
       createObserver（或兼容包装 observeLocal）创建。Phase 15 模块化构建时，
       本区段将原样抽出为 src/core/observer.js。 */

  // 统一观察器工厂。
  // opts: {
  //   handler(nodes)       必填——批次处理器（nodes = 去重后的新增节点；signal 型站点可忽略）
  //   debounce = 350       debounce 毫秒（站点独立）
  //   characterData false  是否纳入 characterData 变更（仅确需的站点开启，如 Ronka）
  //   filter = null        characterData 逐条过滤器：(mutation) => boolean
  //   floodLimit = 800     pending 洪峰阈值：超阈值时重置计时器，待洪峰平息再处理
  //   root = null          观察根（默认 document.body || document.documentElement）
  // }
  // 返回 { disconnect } 便于站点销毁（现状站点均为常驻，保留扩展位）。
  // 观察统计（v1.4 Phase 10：Probe 读取——整数自增，无行为影响）
  const _obsStats = { ticks: 0, nodes: 0 };
  function createObserver(opts) {
    const o = opts || {};
    const debounce = o.debounce || 350;
    const floodLimit = o.floodLimit || 800;
    const root = o.root || document.body || document.documentElement;
    let timer = null;
    let pending = [];
    const mo = new MutationObserver((muts) => {
      let hitCD = false;
      for (const m of muts) {
        if (m.type === 'characterData') {
          if (!o.characterData) continue;                 // 未开启：完全忽略
          if (o.filter && !o.filter(m)) continue;         // 站点过滤（如 RONKA_KR）
          hitCD = true;
          continue;
        }
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 || n.nodeType === 3) pending.push(n);
        }
      }
      const flood = pending.length > floodLimit;          // 洪峰保护：避免 pending 无限增长
      if (flood && timer) { clearTimeout(timer); timer = null; }
      if (timer || (!pending.length && !hitCD)) return;
      timer = setTimeout(() => {
        timer = null;
        const nodes = dedupeByAncestor(pending);
        pending = [];
        _obsStats.ticks++; _obsStats.nodes += nodes.length;   // Phase 10：Probe 统计
        try { o.handler(nodes); } catch (e) { _zhxErr('createObserver', e); }
      }, debounce);
    });
    mo.observe(root, o.characterData
      ? { childList: true, subtree: true, characterData: true }
      : { childList: true, subtree: true });
    return { disconnect: () => mo.disconnect() };
  }

  // 兼容包装：既有站点的局部观察器（handler 收新增节点批次；delay 为 debounce）
  function observeLocal(handler, delay) {
    return createObserver({ handler, debounce: delay || 350 });
  }
  /* @zhixia:core-observer-end */
