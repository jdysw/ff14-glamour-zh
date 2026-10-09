/* @phase15-module-order:core/storage */
/* @phase15-order-link:core/storage<-core/data-manager */
import './data-manager.js';
export { _storeNorm, storeDeleteAsync, storeGetAsync, storeListAsync, storeSet, storeSetAsync };


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
  function storeSetAsync(k, v) {
    return new Promise((resolve) => {
      try {
        if (typeof GM_setValue === 'function') {
          const result = GM_setValue(k, v);
          if (result && typeof result.then === 'function') result.then(() => resolve(true), () => resolve(false));
          else resolve(result !== false);
          return;
        }
        if (typeof GM !== 'undefined' && GM && typeof GM.setValue === 'function') {
          Promise.resolve(GM.setValue(k, v)).then(() => resolve(true), () => resolve(false));
          return;
        }
      } catch (e) { /* persistence failure must be observable to callers */ }
      resolve(false);
    });
  }
  function storeSet(k, v) {
    void storeSetAsync(k, v);
  }
  function storeListAsync() {
    return new Promise((resolve) => {
      try {
        let result;
        if (typeof GM_listValues === 'function') result = GM_listValues();
        else if (typeof GM !== 'undefined' && GM && typeof GM.listValues === 'function') result = GM.listValues();
        else { resolve(null); return; }
        Promise.resolve(result).then((keys) => {
          resolve(Array.isArray(keys) && keys.every((k) => typeof k === 'string') ? keys : null);
        }, () => resolve(null));
      } catch (e) { resolve(null); /* 枚举失败后按已知数据键清除，强制模式继续禁止读旧缓存 */ }
    });
  }
  async function storeDeleteAsync(k) {
    try {
      if (typeof GM_deleteValue === 'function') {
        const result = GM_deleteValue(k);
        const ok = result && typeof result.then === 'function'
          ? await result.then(() => true, () => false) : result !== false;
        if (ok) return true;
      } else if (typeof GM !== 'undefined' && GM && typeof GM.deleteValue === 'function') {
        const ok = await Promise.resolve(GM.deleteValue(k)).then(() => true, () => false);
        if (ok) return true;
      } else {
        return await storeSetAsync(k, '');
      }
    } catch (e) { /* fall through to empty-value invalidation */ }
    return await storeSetAsync(k, '');
  }

  /* @zhixia:core-storage-end */
