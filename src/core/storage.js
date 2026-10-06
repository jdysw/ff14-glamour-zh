/* @phase15-module-order:core/storage */
/* @phase15-order-link:core/storage<-core/data-manager */
import './data-manager.js';
export { _storeNorm, storeGetAsync, storeSet };


  /* @zhixia:core-storage-start */
  /* ── Core Storage（v1.4 Phase 4）：GM 存储读写封装——同步 / Promise 双
       兼容，存储不可用时静默降级（无持久缓存仍可工作）。Phase 15 模块化
       构建时，本区段将原样抽出为 src/core/storage.js。 */
  /* ── 存储封装：优先用户脚本管理器存储（跨站共享）；不可用时退化为
        无持久缓存（本次页面内仍可工作）────────────────────────────── */
  function _storeNorm(x) { if (typeof x === 'string') { return x; } return x == null ? null : String(x); }
  function storeGetAsync(k) {
    return new Promise((resolve) => {
      try {
        if (typeof GM_getValue === 'function') {
          const v = GM_getValue(k, null);
          if (v && typeof v.then === 'function') { v.then((x) => resolve(_storeNorm(x)), () => resolve(null)); }
          else resolve(_storeNorm(v));
          return;
        }
        if (typeof GM !== 'undefined' && GM && typeof GM.getValue === 'function') {
          GM.getValue(k, null).then((x) => resolve(_storeNorm(x)), () => resolve(null));
          return;
        }
      } catch (e) { /* 忽略：存储读取失败按无缓存处理 */ }
      resolve(null);
    });
  }
  function storeSet(k, v) {
    try {
      if (typeof GM_setValue === 'function') {
        const r = GM_setValue(k, v);
        if (r && typeof r.then === 'function') r.then(() => {}, () => {});
        return;
      }
      if (typeof GM !== 'undefined' && GM && typeof GM.setValue === 'function') {
        GM.setValue(k, v).then(() => {}, () => {});
        return;
      }
    } catch (e) { /* 忽略：存储写入失败不阻断主流程 */ }
  }

  /* @zhixia:core-storage-end */
