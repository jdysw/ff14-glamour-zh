/* @phase15-module-order:core/observer */
/* @phase15-order-link:core/observer<-core/translator */
import './translator.js';
import { dedupeByAncestor } from './dom.js';
import { _perfNow, _zhxErr } from './runtime.js';
export { _obsStats, createObserver, observeLocal };


  /* @zhixia:core-observer-start */
  /* ── Core Observer（v1.4 Phase 7）：统一 MutationObserver 调度层——pending 队列 /
       debounce 计时 / 洪峰保护 / 祖先去重（dedupeByAncestor）/ childList 与可选
       characterData（按站点显式开启，禁止无条件开启）。所有站点的观察器都经由
       createObserver（或兼容包装 observeLocal）创建。Phase 15 模块化构建时，
       本区段将原样抽出为 src/core/observer.js。 */

  // 统一观察器工厂。
  // opts: {
  //   handler(nodes, cds)  必填——批次处理器（nodes = 去重后的新增节点；cds = characterData 变更目标，未开启时为空；signal 型站点可忽略）
  //   debounce = 350       debounce 毫秒（站点独立）
  //   characterData false  是否纳入 characterData 变更（仅确需的站点开启，如 Ronka）
  //   filter = null        characterData 逐条过滤器：(mutation) => boolean
  //   floodLimit = 800     pending 洪峰阈值：超阈值时重置计时器，待洪峰平息再处理
  //   root = null          观察根（默认 document.body || document.documentElement）
  // }
  // 返回 { disconnect } 便于站点销毁（现状站点均为常驻，保留扩展位）。
  // 观察统计（v1.4 Phase 10：Probe 读取——整数自增，无行为影响）
  const _obsStats = { ticks: 0, nodes: 0, ms: 0, maxMs: 0 };   // Phase 19：ms/maxMs = 回调处理时长累计/峰值（mutation processing）
  function createObserver(opts) {
    const o = opts || {};
    const debounce = o.debounce || 350;
    const floodLimit = o.floodLimit || 800;
    const root = o.root || document.body || document.documentElement;
    let timer = null;
    let pending = [];
    let pendingCD = [];              // v1.4.1：characterData 变更目标（与 pending 分列；nodes 语义不变）
    // v1.4.1：变更目标入队（独立函数——为 collectMuts 控制认知复杂度预算）
    const _queueCD = (t) => { if (t) pendingCD.push(t); };
    const _queueAttribute = (mutation) => {
      if (o.filter && !o.filter(mutation)) return;
      if (mutation.target) pending.push(mutation.target);
    };
    // mutation 明细收集拆为局部函数（仅降复杂度；判定与产物不变）
    const collectMuts = (muts) => {
      let hitCD = false;
      for (const m of muts) {
        if (m.type === 'characterData') {
          if (!o.characterData) continue;                 // 未开启：完全忽略
          if (o.filter && !o.filter(m)) continue;         // 站点过滤（如 RONKA_KR）
          hitCD = true;
          _queueCD(m.target);                             // v1.4.1：变更目标经第二参数传出（供局部处理）
          continue;
        }
        if (m.type === 'attributes') {
          _queueAttribute(m);
          continue;
        }
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 || n.nodeType === 3) pending.push(n);
        }
      }
      return hitCD;
    };
    const mo = new MutationObserver((muts) => {
      const hitCD = collectMuts(muts);
      const flood = pending.length > floodLimit;          // 洪峰保护：避免 pending 无限增长
      if (flood && timer) { clearTimeout(timer); timer = null; }
      if (timer || (!pending.length && !hitCD)) return;
      timer = setTimeout(() => {
        timer = null;
        const nodes = dedupeByAncestor(pending);
        const cdTargets = dedupeByAncestor(pendingCD);        // v1.4.1：变更目标（去重后）随批次传出
        pending = [];
        pendingCD = [];
        _obsStats.ticks++; _obsStats.nodes += nodes.length;   // Phase 10：Probe 统计
        const t0 = _perfNow();                                // Phase 19：处理时长统计
        try { o.handler(nodes, cdTargets); } catch (e) { _zhxErr('createObserver', e); }
        const dt = _perfNow() - t0;
        _obsStats.ms += dt;
        if (dt > _obsStats.maxMs) _obsStats.maxMs = dt;
      }, debounce);
    });
    const subscription = { childList: true, subtree: true };
    if (o.characterData) subscription.characterData = true;
    if (o.attributes) {
      subscription.attributes = true;
      if (o.attributeFilter) subscription.attributeFilter = o.attributeFilter;
    }
    mo.observe(root, subscription);
    return { disconnect: () => mo.disconnect() };
  }

  // 兼容包装：既有站点的局部观察器（handler 收新增节点批次；delay 为 debounce）
  function observeLocal(handler, delay) {
    return createObserver({ handler, debounce: delay || 350 });
  }
  /* @zhixia:core-observer-end */
