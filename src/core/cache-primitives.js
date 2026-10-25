// 通用缓存状态、失效注册表与纯字符串算法；禁止依赖业务数据或站点模块。
export { CACHE_CAP_LOOKUP, DAY_MS, _cacheReg, _en2zhCache, _countIncludes, _lcs90, _shortestStr, cacheGuard, cacheRegister, cacheReset };

/* @zhixia:core-cache-primitives-start */
  const DAY_MS = 24 * 60 * 60 * 1000;
  const _en2zhCache = new Map();

  // v1.2.7：_shortestStr/_countIncludes 拆为子步骤（降认知复杂度）
  function _shortestStr(list) {
    let shortest = list[0];
    for (const x of list) if (x.length < shortest.length) shortest = x;
    return shortest;
  }

  function _countIncludes(list, sub) {
    let c = 0;
    for (const x of list) if (x.includes(sub)) c++;
    return c;
  }

  function _lcs90(list) {
    const need = Math.ceil(list.length * 0.9);
    const shortest = _shortestStr(list);
    const maxLen = Math.min(12, shortest.length);
    for (let len = maxLen; len >= 2; len--) {
      for (let i = 0; i + len <= shortest.length; i++) {
        const sub = shortest.slice(i, i + len);
        if (_countIncludes(list, sub) >= need) return sub;
      }
    }
    return null;
  }

  const _cacheReg = new Map();
  const CACHE_CAP_LOOKUP = 5000;   // lookup 类容量防线：超出即清空重建（避免长会话无界增长）
  function cacheRegister(name, kind, reset, size) { _cacheReg.set(name, { kind, reset, size }); }
  function cacheReset(kind) {
    for (const e of _cacheReg.values()) {
      if (kind && e.kind !== kind) continue;
      try { e.reset(); } catch (error_) { /* 忽略：单个缓存清理失败不阻断其余 */ }
    }
  }

  /* 容量防线：条目数达到上限时清空缓存（清空即重建，不影响正确性）。
     count 供无 size 的对象型缓存（如 RONKA 物品表）传入计数器。 */
  function cacheGuard(cache, cap, count) {
    if (!cache) return false;
    let n = (typeof count === 'number') ? count : cache.size;
    if (typeof n !== 'number') n = Object.keys(cache).length;
    if (n < cap) return false;
    if (typeof cache.clear === 'function') { try { cache.clear(); } catch (e) { /* 忽略：清空失败则重建继续（正确性不受影响） */ } return true; }
    for (const k in cache) { try { delete cache[k]; } catch (e) { /* 忽略：同上（清空失败无碍） */ } }
    return true;
  }

  /* @zhixia:core-cache-primitives-end */
