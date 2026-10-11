/* @phase15-module-order:core/item-resolver */
import { CACHE_CAP_LOOKUP, _jp2zhCache, _getSeriesMap, cacheGuard } from './cache.js';
import { resolveByName } from './data-manager.js';
// 仅转发其他模块拥有的符号，避免在此建立多余的本地绑定。
export { _en2zhCache } from './cache.js';
export { tryEnToZh } from './data-manager.js';
export { _jp2zhCache, _mutualPrefix, _prefixBest, _stripSeriesHit, lookupJp2Zh, lookupSeries };


  // 日文 → 中文 单条查找（物品总表统一索引；日文名 → 国服中文名）
  function lookupJp2Zh(jp) {
    if (!jp || jp.length > 80) return null;   // v1.12.0 放宽
    if (_jp2zhCache.has(jp)) return _jp2zhCache.get(jp);
    const out = resolveByName(jp);
    cacheGuard(_jp2zhCache, CACHE_CAP_LOOKUP);
    _jp2zhCache.set(jp, out);
    return out;
  }
  // v1.2.7：② 剥离 / ③ 前缀匹配拆为子步骤（降认知复杂度）
  function _stripSeriesHit(map, jp) {
    let s = jp;
    for (let guard = 0; guard < 6; guard++) {
      const di = s.lastIndexOf('・');
      if (di >= 2) s = s.slice(0, di);
      else break;
      const hit = map.get(s);
      if (hit) return hit;
    }
    return null;
  }

  function _mutualPrefix(k, jp) {
    return jp.startsWith(k) || k.startsWith(jp);
  }

  function _prefixBest(map, jp) {
    const head = jp.slice(0, 2);
    let bestKey = '', bestVal = null;
    for (const [k, v] of map) {
      if (k.length < 2 || !k.startsWith(head)) continue;
      if (k.length > head.length + 14 && !k.startsWith(jp)) continue;
      if (_mutualPrefix(k, jp) && k.length > bestKey.length) { bestKey = k; bestVal = v; }
    }
    return bestVal;
  }

  function lookupSeries(jp) {
    if (!jp || jp.length < 2 || jp.length > 60) return null;
    const map = _getSeriesMap();
    if (!map.size) return null;
    // ① 精确
    const exact = map.get(jp);
    if (exact) return exact;
    // ② 逐步剥离：优先在 ・ 处剥
    const hit = _stripSeriesHit(map, jp);
    if (hit) return hit;
    // ③ 前缀匹配（桶：首2字）：k 与 jp 互为前缀（双向），取最长键
    return _prefixBest(map, jp);
  }
