/* @phase15-module-order:core/cache */
/* @phase15-order-link:core/cache<-core/item-resolver */
import { DATA_TEXT, DATA_VER, dataGetIndex, resolveByName } from './data-manager.js';
import { DICT_FC, dictGetRevision } from './dictionary.js';
import { _en2zhCache, _jp2zhCache } from './item-resolver.js';
import { storeGetAsync, storeSet } from './storage.js';
import { FC_ROLE_ZH } from '../sites/ff14-fc.js';
import { RONKA_ITEM_CACHE } from '../sites/ronka.js';
export { CACHE_CAP_LOOKUP, DAY_MS, DT_PREFIX, META_KEY, _allKeysCache, _cacheReg, _countIncludes, _fcSubstrCache, _getFCSubstrKeys, _getItemPfx, _getSeriesMap, _getSeriesPfx, _getSubstrKeysAll, _itemPfxCache, _itemPfxGroup, _lcs90, _readCachedTable, _ronkaCacheN, _seriesMap, _seriesPfxCache, _seriesPfxCollect, _shortestStr, _writeCachedTable, cacheGuard, cacheInfo, cacheRegister, cacheReset, ronkaItemLookup };


  // ── 系列名前缀查找（v1.12.0）：从单件装备表自动推导的系列名（如 ファントムヴィジョン・ディフェンダー → 幻境意象御敌）
  let _seriesMap = null; // NOSONAR — 派生缓存按需构建并由 cacheReset 失效
  function _getSeriesMap() {
    if (_seriesMap) return _seriesMap;
    _seriesMap = new Map();
    if (typeof DATA_TEXT.series === 'string' && DATA_TEXT.series) {
      for (const line of DATA_TEXT.series.split('\n')) {
        if (!line) continue;
        const i = line.indexOf('|');
        if (i > 0) _seriesMap.set(line.slice(0, i), line.slice(i + 1));
      }
    }
    return _seriesMap;
  }

  // 子串替换词表：长度 ≥ 2 的键按长→短排序（用于长句/alt 兜底）
  // v1.2.0：改为懒构建函数——词库运行时更新（dict.json）后清缓存即可重算
  let _fcSubstrCache = null; // NOSONAR — 派生缓存按需构建并由 cacheReset 失效
  function _getFCSubstrKeys() {
    if (_fcSubstrCache) return _fcSubstrCache;
    _fcSubstrCache = Object.keys(DICT_FC)
      .filter((k) => k.length >= 2 && !/^[A-Za-z0-9]+$/.test(k))
      .sort((a, b) => b.length - a.length);
    return _fcSubstrCache;
  }

  // v1.1.5：系列名前缀推导（从系列表「系列・职业」条目反推「系列→系列译」）
  // 用途：长标题等「裸前缀」场景（如 H1「ファントムヴィジョン・法系装备」）；严格双验证：
  //   ① 条目尾部是已知职业词（FC_ROLE_ZH）② 译文以该职业译名结尾 → 切出前缀译
  //   仅当同一前缀所有样本译名一致（set.size === 1）才启用；带缓存，数据就绪后懒构建。
  let _seriesPfxCache = null; // NOSONAR — 派生缓存按需构建并由 cacheReset 失效
  let _allKeysCache = null; // NOSONAR — 派生缓存按需构建并由 cacheReset 失效
  // v1.2.7：_seriesPfxCollect 拆为子步骤（降认知复杂度）
  function _seriesPfxCollect(map, cand) {
    for (const [jp, zh] of map) {
      const di = jp.lastIndexOf('・');
      if (di <= 0) continue;
      const roleZh = FC_ROLE_ZH[jp.slice(di + 1)];
      if (!roleZh || !zh.endsWith(roleZh)) continue;
      const zhHead = zh.slice(0, zh.length - roleZh.length);
      if (zhHead.length < 2) continue;
      const key = jp.slice(0, di);
      if (key.length < 3) continue;
      if (!cand.has(key)) cand.set(key, new Set());
      cand.get(key).add(zhHead);
    }
  }

  function _getSeriesPfx() {
    if (_seriesPfxCache) return _seriesPfxCache;
    _seriesPfxCache = new Map();
    try {
      const map = _getSeriesMap();
      if (map.size) {
        const cand = new Map();
        _seriesPfxCollect(map, cand);
        for (const [key, set] of cand) if (set.size === 1) _seriesPfxCache.set(key, [...set][0]);
      }
    } catch (e) { /* 忽略：系列前缀推导 best-effort，失败返回空表 */ }
    return _seriesPfxCache;
  }
  function _getSubstrKeysAll() {
    if (_allKeysCache) return _allKeysCache;
    const keys = _getFCSubstrKeys().slice();
    for (const k of _getSeriesPfx().keys()) if (!DICT_FC[k]) keys.push(k);
    for (const k of _getItemPfx().keys()) if (!DICT_FC[k]) keys.push(k);
    keys.sort((a, b) => b.length - a.length);
    _allKeysCache = keys;
    return keys;
  }

  // v1.1.6：物品系列名前缀推导（从物品表「系列・部件」条目反推「系列→系列译」）
  // 用途：fc 卡片标题等「裸系列名」场景（ネオイシュガルディアン、イディル、キングダムテール 等）
  // 算法：按「・」前段分组，求组内中文名的最长公共子串（≥90% 覆盖、≥2 字）；
  //   处理「改良型×」等修饰词混入（公共子串而非前缀，规避前段差异）。带缓存，数据就绪后懒构建。
  let _itemPfxCache = null; // NOSONAR — 派生缓存按需构建并由 cacheReset 失效
  // v1.2.7：_itemPfxGroup 拆为子步骤（降认知复杂度）
  function _itemPfxGroup(nm) {
    const groups = new Map();
    for (const k in nm) {
      const di = k.indexOf('・');
      if (di <= 0 || di >= k.length - 1) continue;
      const zh = nm[k];
      if (!zh) continue;
      const key = k.slice(0, di);
      if (key.length < 3) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(zh);
    }
    return groups;
  }

  function _getItemPfx() {
    if (_itemPfxCache) return _itemPfxCache;
    _itemPfxCache = new Map();
    try {
      const nameMap = dataGetIndex('nameMap');
      if (!nameMap) return _itemPfxCache;
      const groups = _itemPfxGroup(nameMap);
      for (const [key, list] of groups) {
        if (list.length < 2) continue;
        const sub = _lcs90(list);
        if (sub && sub.length >= 2 && !DICT_FC[key]) _itemPfxCache.set(key, sub);
      }
    } catch (e) { /* 忽略：物品前缀推导 best-effort，失败返回空表 */ }
    return _itemPfxCache;
  }
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
  let _ronkaCacheN = 0; // NOSONAR — 缓存容量计数器随缓存写入/清理变化
  function ronkaItemLookup(ko) {
    if (!ko || ko.length > 80) return null;
    if (ko in RONKA_ITEM_CACHE) return RONKA_ITEM_CACHE[ko];
    const v = resolveByName(ko);
    if (cacheGuard(RONKA_ITEM_CACHE, CACHE_CAP_LOOKUP, _ronkaCacheN)) _ronkaCacheN = 0;
    RONKA_ITEM_CACHE[ko] = v;
    _ronkaCacheN++;
    return v;
  }

  /* @zhixia:core-cache-start */
  /* ── Core Cache（v1.4 Phase 4，段1/2）：缓存策略——每日至多一次版本探测、
       元数据与表缓存键。本模块共 2 处标记区段（段2 = 读写接口，见下文）；
       Phase 15 模块化构建时，原样抽出为 src/core/cache.js。 */

  /* ── 版本与缓存：每日至多一次版本探测；指纹一致直接复用本地缓存 ──
     缓存键 zhx.dt.<表名> = 「指纹 + 换行 + 文本」（单键原子写入） */
  const DAY_MS = 24 * 60 * 60 * 1000;
  const META_KEY = 'zhx.meta';        // {"v":"...","t":时间戳}
  const DT_PREFIX = 'zhx.dt.';

  /* @zhixia:core-cache-end */

  /* @zhixia:core-cache-start */
  /* ── Core Cache（段2/2）：缓存读取 / 写入接口——zhx.dt.* 序列化格式
       （指纹 + 换行 + 文本）与空闲延迟写入。Phase 15 随段1 一同抽出为
       src/core/cache.js。 */
  function _readCachedTable(t) {
    return storeGetAsync(DT_PREFIX + t).then((raw) => {
      if (!raw) return null;
      const i = raw.indexOf('\n');
      if (i <= 0) return null;
      const fp = raw.slice(0, i);
      const tx = raw.slice(i + 1);
      return (fp && tx && tx.length > 100) ? { fp: fp, tx: tx } : null;
    });
  }
  function _writeCachedTable(t, fp, tx) {
    if (!fp || !tx) return;
    // v1.3：大字符串（数 MB 级）写入推迟到页面空闲，避免同步写造成瞬时卡顿；
    // 写入失败仅影响下次重新下载，可接受
    const key = DT_PREFIX + t, val = fp + '\n' + tx;
    const put = () => { try { storeSet(key, val); } catch (e) { /* 忽略：缓存写入失败仅影响下次重新下载（见上注释） */ } };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(put, { timeout: 3000 });
    else setTimeout(put, 50);
  }

  /* @zhixia:core-cache-end */

  /* @zhixia:core-cache-registry-start */
  /* ── Core Cache Registry（v1.4 Phase 14）：缓存体系集中登记 ─────────────
     目标：每类缓存的「职责 / 生命周期 / 容量 / 失效」在此唯一登记，
     禁止散落的手工 reset。新增缓存时，在本段 cacheRegister 一行登记即可，
     并由 unit/test-cache.mjs 守卫（登记数量断言）。

     四类缓存（按职责划分，不强制统一数据结构）：
       · data      数据缓存（持久，GM 存储）：zhx.meta / zhx.dt.* / zhx.v3.*
                   生命周期：跨会话；由版本探测与 dataInvalidate 管理（不在此登记）
       · lookup    查找缓存（内存，页面生命周期）：名称 → 中文 的直查结果（含负缓存）
                   失效：数据到达（_fireTablesReady）/ 容量防线（CACHE_CAP_LOOKUP）
       · translate 翻译缓存（内存，页面生命周期）：由词典派生的子串键与组合键表
                   失效：词典更新（dictInvalidate）/ 数据到达
       · derived   派生缓存（内存，页面生命周期）：由数据表派生的映射与前缀表
                   失效：数据到达（_fireTablesReady）；容量由数据表规模界定
     统一入口：cacheReset(kind) 按类清理；cacheInfo() 观测（修订号 + 条目数）。 */
  const _cacheReg = new Map();
  const CACHE_CAP_LOOKUP = 5000;   // lookup 类容量防线：超出即清空重建（避免长会话无界增长）
  function cacheRegister(name, kind, reset, size) { _cacheReg.set(name, { kind, reset, size }); }
  function cacheReset(kind) {
    for (const e of _cacheReg.values()) {
      if (kind && e.kind !== kind) continue;
      try { e.reset(); } catch (error_) { /* 忽略：单个缓存清理失败不阻断其余 */ }
    }
  }
  function cacheInfo() {
    const entries = {};
    for (const [name, e] of _cacheReg) {
      try { entries[name] = e.size ? e.size() : null; } catch (error_) { entries[name] = null; /* 忽略：单项尺寸读取失败记 null（诊断不中断） */ }
    }
    return {
      entries,
      rev: {
        data: (typeof DATA_VER === 'string' ? DATA_VER : ''),
        dict: (typeof dictGetRevision === 'function' ? dictGetRevision() : 0),
      },
    };
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
  /* ── 登记（新增缓存必须在此加一行；kind 见四类划分）── */
  cacheRegister('en2zh', 'lookup', () => { _en2zhCache.clear(); }, () => _en2zhCache.size);
  cacheRegister('jp2zh', 'lookup', () => { _jp2zhCache.clear(); }, () => _jp2zhCache.size);
  cacheRegister('ronkaItems', 'lookup', () => { for (const k in RONKA_ITEM_CACHE) { delete RONKA_ITEM_CACHE[k]; } _ronkaCacheN = 0; }, () => _ronkaCacheN);
  cacheRegister('seriesMap', 'derived', () => { _seriesMap = null; }, () => (_seriesMap ? _seriesMap.size : 0));
  cacheRegister('seriesPfx', 'derived', () => { _seriesPfxCache = null; }, () => (_seriesPfxCache ? _seriesPfxCache.size : 0));
  cacheRegister('itemPfx', 'derived', () => { _itemPfxCache = null; }, () => (_itemPfxCache ? _itemPfxCache.size : 0));
  cacheRegister('fcSubstr', 'translate', () => { _fcSubstrCache = null; }, () => (_fcSubstrCache ? _fcSubstrCache.length : 0));
  cacheRegister('allKeys', 'translate', () => { _allKeysCache = null; }, () => (_allKeysCache ? _allKeysCache.length : 0));
  /* @zhixia:core-cache-registry-end */
