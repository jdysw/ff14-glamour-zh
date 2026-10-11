/* @phase15-module-order:core/observer */
/* @phase15-order-link:core/observer<-core/site-registry */
import './site-registry.js';
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
    const maxPending = Math.max(floodLimit + 1, floodLimit * 2);
    const root = o.root || document.body || document.documentElement;
    let timer = null;
    let pending = [];
    let pendingCD = [];
    let collapsed = false;
    let floodRescheduled = false;
    let stopped = false;

    // 超出队列容量上限时，重新扫描观察根即可覆盖所有待处理变更。
    // 只保留一个观察根，避免 SPA 持续更新导致队列无限增长。
    const collapse = () => {
      pending = [root];
      pendingCD = [];
      collapsed = true;
    };
    const queueNode = (n) => {
      if (!n || collapsed) return;
      pending.push(n);
      if (pending.length + pendingCD.length > maxPending) collapse();
    };
    const queueCD = (n) => {
      if (!n || collapsed) return;
      pendingCD.push(n);
      if (pending.length + pendingCD.length > maxPending) collapse();
    };
    const queueCharacterData = (mutation) => {
      if (!o.characterData || (o.filter && !o.filter(mutation))) return false;
      queueCD(mutation.target);
      return true;
    };
    const queueAttribute = (mutation) => {
      if (!o.filter || o.filter(mutation)) queueNode(mutation.target);
    };
    const queueAdded = (mutation) => {
      for (const n of mutation.addedNodes) {
        if (n.nodeType === 1 || n.nodeType === 3) queueNode(n);
        if (collapsed) break;
      }
    };
    const collectMuts = (muts) => {
      let hitCD = false;
      for (const m of muts) {
        if (collapsed) break;
        if (m.type === 'characterData') hitCD = queueCharacterData(m) || hitCD;
        else if (m.type === 'attributes') queueAttribute(m);
        else queueAdded(m);
      }
      return hitCD;
    };
    const mo = new MutationObserver((muts) => {
      if (stopped) return;
      const hitCD = collectMuts(muts);
      const flood = collapsed || pending.length + pendingCD.length > floodLimit;
      // 洪峰期间最多重新计时一次；若持续重置计时器，
      // 即使队列有大小限制，也会导致处理器长期无法执行。
      if (flood && timer !== null && !floodRescheduled) {
        clearTimeout(timer);
        timer = null;
        floodRescheduled = true;
      }
      if (timer !== null || (!pending.length && !pendingCD.length && !hitCD)) return;
      timer = setTimeout(() => {
        timer = null;
        if (stopped) return;
        const nodes = collapsed ? [root] : dedupeByAncestor(pending);
        const cdTargets = collapsed ? [] : dedupeByAncestor(pendingCD);
        pending = [];
        pendingCD = [];
        collapsed = false;
        floodRescheduled = false;
        _obsStats.ticks++; _obsStats.nodes += nodes.length;
        const t0 = _perfNow();
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
    return {
      disconnect() {
        stopped = true;
        mo.disconnect();
        if (timer !== null) clearTimeout(timer);
        timer = null;
        pending = [];
        pendingCD = [];
        collapsed = false;
      },
    };
  }

  // 兼容包装：既有站点的局部观察器（handler 收新增节点批次；delay 为 debounce）
  function observeLocal(handler, delay) {
    return createObserver({ handler, debounce: delay || 350 });
  }
  /* @zhixia:core-observer-end */
