/* @phase15-module-order:core/item-resolver */
/* @phase15-order-link:core/item-resolver<-sites/huiji-wiki */
import '../sites/huiji-wiki.js';
import { CACHE_CAP_LOOKUP, _getSeriesMap, cacheGuard } from './cache.js';
import { resolveByName } from './data-manager.js';
import { DICT_EC } from './dictionary.js';
import { PATTERNS_EC } from '../sites/eorzea-collection.js';
export { _en2zhCache, _jp2zhCache, _mutualPrefix, _prefixBest, _stripSeriesHit, lookupJp2Zh, lookupSeries, trEC, tryEnToZh };


  // 英文名 -> 国服中文名（单条查找 + 缓存）。用于 EC 上没进固定词典的
  // 装备名/染剂名等短英文串（如 Tule Tunic、Charcoal Grey）。
  const _en2zhCache = new Map();
  function tryEnToZh(en) {
    if (!en) return null;
    if (_en2zhCache.has(en)) return _en2zhCache.get(en);
    // 物品总表统一索引（英/日/韩名 → 中文名；染剂色名回退已由 buildTables 展开）
    const out = resolveByName(en);
    cacheGuard(_en2zhCache, CACHE_CAP_LOOKUP);
    _en2zhCache.set(en, out);
    return out;
  }

  function trEC(text) {
    if (!text) return text;
    const t = text.trim();
    if (!t) return text;
    if (t.length > 90) return text;          // 长句多为用户描述，不动
    if (!/[a-zA-Z]/.test(t)) return text;    // 快速跳过：DICT_EC/PATTERNS_EC 全部含拉丁字母（v1.11.1）
    const hit = DICT_EC[t];
    if (hit) {
      const i = text.indexOf(t);
      return text.slice(0, i) + hit + text.slice(i + t.length);
    }
    // 纯英文短串（字母开头，含有限符号）→ 查主表/染剂表拿国服中文名
    if (/^[A-Za-z]/.test(t) && /^[A-Za-z0-9'\-.,:&!? ()（）]+$/.test(t)) {
      const zhName = tryEnToZh(t);
      if (zhName && zhName !== t) {
        const i2 = text.indexOf(t);
        return text.slice(0, i2) + zhName + text.slice(i2 + t.length);
      }
    }
    let out = text;
    for (const [re, to] of PATTERNS_EC) out = out.replace(re, to);
    return out;
  }


  // 日文 → 中文 单条查找（物品总表统一索引；日文名 → 国服中文名）
  const _jp2zhCache = new Map();
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
