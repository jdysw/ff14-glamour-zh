import { CACHE_CAP_LOOKUP, _en2zhCache, cacheGuard, cacheReset } from '../cache-primitives.js';
import { applyRuntimeDict } from './dictionary.js';
import { __zhxMark, _zhxErr } from '../runtime.js';
import { findSitePolicy as findSite, neededTables } from '../site-policy.js';
import { dyeColorName, indexItemIds } from './item-identity.js';
import { createChineseSearchIndex, isChineseSearchPhrase, normalizeSearchText } from './chinese-search-index.js';
import { createV3Loader } from './v3-loader.js';
import { _v3Pairs, validateV3Payload } from './v3-payload.js';
export { DATA_TEXT, DATA_VER, _applyV3, _dlStats, _ensureFinalize, _ensureMain, _ensurePromise, _ensureTryV3, _fireTablesReady, _irStats, _readyCbs, _tablesReady, dataGetIndex, dataGetStatus, dataInvalidate, tryEnToZh, ensureTables, onTablesReady, resolve, resolveAlias, resolveAllByName, resolveByHash, resolveByName, resolveDyeColor, itemById, findItemsByName, hasItemIdentities, resolveByZh, resolvePartialByZh, suggestByZh, resolveEcId, resolveKo };


  // 英文名 -> 国服中文名（单条查找 + 缓存）。用于 EC 上没进固定词典的
  // 装备名/染剂名等短英文串（如 Tule Tunic、Charcoal Grey）。
  function tryEnToZh(en) {
    if (!en) return null;
    if (_en2zhCache.has(en)) return _en2zhCache.get(en);
    // 物品总表统一索引（英/日/韩名 → 中文名；染剂色名回退已由 V3 names 文件展开）
    const out = resolveByName(en);
    cacheGuard(_en2zhCache, CACHE_CAP_LOOKUP);
    _en2zhCache.set(en, out);
    return out;
  }


  // 数据建表完成后通知 onTablesReady 订阅者。
  // 数据版本由当前清单赋值。
  let DATA_VER = ''; // NOSONAR — 数据版本由远程 manifest 生命周期更新
  let _manifestRefreshRequested = false;

  // 显式刷新数据后仍保留已注册的就绪回调。
  const _readyCbs = [];
  let _tablesReady = false; // NOSONAR — ready 状态由数据完成生命周期更新
  function onTablesReady(fn) {
    if (typeof fn !== 'function') return;
    if (!_readyCbs.includes(fn)) _readyCbs.push(fn);
    if (_tablesReady) { try { fn(dataGetStatus()); } catch (e) { _zhxErr('readyCb', e); } }
  }
  function _fireTablesReady() {
    if (_tablesReady) return;
    _tablesReady = true;
    // 清空「查不到」负缓存与派生缓存：外置版中数据到达前生成的结果必须作废
    //（新增缓存时在 Core Cache Registry 登记即被本处按类清理，勿在此手工追加）
    try { cacheReset('lookup'); } catch (e) { /* 忽略：单类缓存清理失败不阻断其余 */ }
    try { cacheReset('translate'); } catch (e) { /* 忽略：单类缓存清理失败不阻断其余 */ }
    try { cacheReset('derived'); } catch (e) { /* 忽略：单类缓存清理失败不阻断其余 */ }
    const cbs = _readyCbs.slice(); // 保留订阅，确保数据失效并重新加载后再次通知。
    const status = dataGetStatus();
    for (const f of cbs) { try { f(status); } catch (e) { _zhxErr('readyCb', e); } }
    __zhxMark('fireDone');   // Phase 19：就绪广播完成
  }
  // （站点 → 数据表/索引/页面入口配置：见下方「Site Registry」单一配置源）
  let SERIES_TEXT = '';
  let ACL_CFC_TEXT = '';
  const DATA_TEXT = {
    get series() { return SERIES_TEXT; },
    get acl() { return ACL_CFC_TEXT; },
  };


  const itemHash = Object.create(null);   // hash -> 中文名（EC / mirapri 用） // NOSONAR
  const ecidMap = Object.create(null);    // 中文名 -> EC_ID（wiki / EC 链接用） // NOSONAR
  const nameMap = Object.create(null);    // 英/日/韩名 -> 中文名（含染剂色名回退；各站共用） // NOSONAR
  let dyeColors = null;
  let itemIdRows = null;
  let itemIdIndex = null;
  const koByZh = Object.create(null);     // 中文名 -> 韩文名（ronka 反查用） // NOSONAR

  // （EC 装备 ID 单条查找已并入 Item Resolver：resolveEcId，v1.4 Phase 10）
  function _replaceMap(target, source) {
    for (const k of Object.keys(target)) delete target[k];
    if (source && typeof source === 'object') Object.assign(target, source);
  }

  /* 数据代际、索引发布、ready 广播与 dataManager API。 */
  let _ensurePromise = null; // NOSONAR — ensure 生命周期 promise 可被 invalidate 重置
  let _activeEnsure = null; // 请求进行中触发刷新时，串行执行前后两代加载。
  let _ensureGeneration = 0; // 过期加载不能应用数据表，也不能触发就绪通知。
  let _dataLoadState = 'idle'; // idle/loading/ready/degraded 与“广播已完成”分离。
  let _dataLoadOrigin = 'none'; // cache/network/fallback/none，用于调用方诊断。
  // 反向搜索索引按当前数据代际惰性构建，更新时一次性释放派生视图。
  let chineseSearchIndex = null;
  function _ensureFinalize(generation = _ensureGeneration) {
    if (generation !== _ensureGeneration) return Promise.resolve();
    __zhxMark('finalize');
    if (_dataLoadState === 'loading') _dataLoadState = 'degraded';
    try { _fireTablesReady(); } catch (e) { _zhxErr('fireReady', e); }
    __zhxMark('ready');
    return Promise.resolve();
  }

  // 已校验的 V3 数据同步发布到当前页，由解析器复用。
  function _applyV3(files) {
    // 取值包装拆为局部函数（仅降复杂度；取值顺序与语义不变）
    const take = (key, multi) => (files[key] ? _v3Pairs(files[key], multi) : null);
    try {
      const parsedNames = validateV3Payload(files);
      if (!parsedNames) return false;
      const { names, glam, slots } = parsedNames;
      const hash = take('hash') || Object.create(null);
      const ecid = take('ecid') || Object.create(null);
      const ko = take('ko') || Object.create(null);
      const ali = take('alias', true) || Object.create(null);
      const dup = take('dup', true) || Object.create(null);
      _replaceMap(nameMap, names);
      dyeColors = null;
      itemIdRows = parsedNames.rows || null;
      itemIdIndex = null;
      _replaceMap(itemHash, hash);
      chineseSearchIndex = null;
      _replaceMap(ecidMap, ecid);
      _replaceMap(koByZh, ko);
      _irAliasMap = ali;
      _irDupMap = dup;
      _irGlamMap = glam || Object.create(null);
      _irSearchSlotByNative = slots;
      _irCandidatePolicy = 1;
      SERIES_TEXT = files.series ? '\n' + files.series : '';
      ACL_CFC_TEXT = files.acl ? '\n' + files.acl : '';
      if (files.dict) applyRuntimeDict(files.dict);
      return true;
    } catch (e) {
      _zhxErr('v3apply', e);
      return false;
    }
  }

  function _recordV3Ready(manifest, origin) {
    if (manifest.version) DATA_VER = String(manifest.version);
    _dataLoadOrigin = origin;
    _dataLoadState = 'ready';
    return true;
  }

  const { tryLoad: _ensureTryV3, stats: _dlStats } = createV3Loader({
    getGeneration: () => _ensureGeneration,
    applyPayload: _applyV3,
    recordReady: _recordV3Ready,
  });

  async function _ensureMain(generation = _ensureGeneration) {
    _irCandidatePolicy = 0;
    if (!neededTables().length) return;
    const refreshManifest = _manifestRefreshRequested;
    _manifestRefreshRequested = false;
    const loaded = await _ensureTryV3(false, refreshManifest, generation);
    if (generation !== _ensureGeneration) return;
    _dataLoadState = loaded ? 'ready' : 'degraded';
  }

  function ensureTables() {
    if (_ensurePromise) return _ensurePromise;
    const generation = _ensureGeneration;
    _dataLoadState = 'loading';
    // 加载过程中触发刷新时，先等待旧请求完成，
    // 再通过代际校验防止过期请求发布结果。
    const previous = _activeEnsure;
    const promise = Promise.resolve(previous)
      .catch(() => {})
      .then(() => generation === _ensureGeneration ? _ensureMain(generation) : undefined)
      .catch((e) => { _zhxErr('ensureMain', e); })
      .then(() => _ensureFinalize(generation));
    _ensurePromise = promise;
    _activeEnsure = promise;
    return promise;
  }
  // 脚本层可观察的只读数据状态，不直接暴露持久缓存或可变索引对象。
  // 已通知回调不代表下载成功：失败时 state=degraded，仍通知订阅者结束等待。
  function dataGetStatus() {
    return Object.freeze({
      site: findSite()?.id || null,
      state: _dataLoadState,
      origin: _dataLoadOrigin,
      version: DATA_VER || null,
      generation: _ensureGeneration,
      ready: _tablesReady,
    });
  }
  // 保留稳定的按引用读取与 Object.keys 枚举，不额外复制大型索引。
  // 通过 Proxy 阻止诊断层和业务层绕过 Resolver 修改内部数据。
  const readonlyIndex = (target) => new Proxy(target, {
    set() { return false; },
    deleteProperty() { return false; },
    defineProperty() { return false; },
    setPrototypeOf() { return false; },
    preventExtensions() { return false; },
  });
  const publicIndexes = {
    itemHash: readonlyIndex(itemHash),
    nameMap: readonlyIndex(nameMap),
    ecidMap: readonlyIndex(ecidMap),
    koByZh: readonlyIndex(koByZh),
  };
  function dataGetIndex(name) {
    // 站点仍可读取和枚举索引，但不得修改数据管理器持有的原始索引。
    return _tablesReady && Object.hasOwn(publicIndexes, name) ? publicIndexes[name] : null;
  }
  function dataInvalidate() {
    // 重新检查 V3 manifest，同时保留按指纹校验的文件缓存供离线复用。
    _ensureGeneration++;
    _tablesReady = false;
    _ensurePromise = null;
    _dataLoadState = 'idle';
    _dataLoadOrigin = 'none';
    DATA_VER = '';
    _manifestRefreshRequested = true;
    _replaceMap(itemHash, null); _replaceMap(ecidMap, null); _replaceMap(nameMap, null); _replaceMap(koByZh, null);
    dyeColors = null;
    itemIdRows = null;
    itemIdIndex = null;
    _irDupMap = null; _irAliasMap = null; _irGlamMap = null; _irSearchSlotByNative = null; _irCandidatePolicy = 0;
    chineseSearchIndex = null;
    SERIES_TEXT = ''; ACL_CFC_TEXT = '';
  }
  /* @zhixia:data-layer-end */

  /* @zhixia:core-item-resolver-start */
  /* ── Core Item Resolver（v1.4 Phase 6）：物品索引统一解析层——对 hash / 名称索引
       与衍生注册表（重名 / 别名）的集中访问。解析语义与既有查询完全一致（同名键
       首行胜）；重名键（同键多译）经 resolveAllByName 取全量，顺序=TSV 行序
       （历史优先，禁止随机）。Phase 15 模块化构建时，本区段将原样抽出为
       src/core/item-resolver.js。 */

  let _irDupMap = null;     // 重名键（同键多译）: key → zh[]（含首行=nameMap 现值，按行序） // NOSONAR
  let _irGlamMap = null;
  let _irSearchSlotByNative = null; // 源自 V3 names 可选第四列；旧缓存默认其余
  let _irCandidatePolicy = 0;    // names 行级候选允许标记；仅明确的 '1' 进入中文搜索倒排 // NOSONAR
  let _irAliasMap = null;   // 别名表: alias → zh[]（按行序；alias 列以全角分号拆分） // NOSONAR

  function getChineseSearchIndex() {
    chineseSearchIndex ??= createChineseSearchIndex({
      names: nameMap, aliases: _irAliasMap, glam: _irGlamMap, slots: _irSearchSlotByNative,
      candidatePolicy: _irCandidatePolicy,
      preferJapanese: _irCandidatePolicy === 1 && typeof window !== 'undefined' && findSite()?.id === 'eden',
      lookupIdentities: itemIdRows ? findItemsByName : null,
    });
    return chineseSearchIndex;
  }

  // 解析统计（v1.4 Phase 10：Probe 读取——整数自增，无行为影响）
  const _irStats = { hit: 0, miss: 0 };
  function resolveByHash(hash) { const z = (hash && itemHash?.[hash]) ? itemHash[hash] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
  function resolveByName(name) { const z = (name && nameMap?.[name]) ? nameMap[name] : null; _irStats[z ? 'hit' : 'miss']++; return z; }

  function getItemIdIndex() {
    if (!itemIdRows) return null;
    itemIdIndex ||= indexItemIds(itemIdRows);
    return itemIdIndex;
  }

  function itemById(id) {
    return getItemIdIndex()?.byId.get(Number(id)) || null;
  }

  function findItemsByName(name, language = 'zh') {
    const records = getItemIdIndex()?.byLanguage.get(language)?.get(name);
    return records ? records.slice() : [];
  }

  function hasItemIdentities() {
    return itemIdRows !== null;
  }

  function dyeColorKey(name) {
    return /[가-힣]/u.test(name) ? name.replace(/\s+/gu, '') : name;
  }

  function buildDyeColors() {
    const colors = new Map();
    for (const [native, zh] of Object.entries(nameMap)) {
      if (!zh.endsWith('染剂')) continue;
      const color = dyeColorName(native);
      if (!color) continue;
      const key = dyeColorKey(color);
      const value = zh.slice(0, -2);
      if (!colors.has(key)) colors.set(key, value);
      else if (colors.get(key) !== value) colors.set(key, null);
    }
    return colors;
  }

  function resolveDyeColor(name) {
    if (!name) return null;
    dyeColors ||= buildDyeColors();
    return dyeColors.get(dyeColorKey(name)) || null;
  }

  function resolveByZh(zh) {
    const key = normalizeSearchText(zh);
    const result = getChineseSearchIndex().lookup(key);
    _irStats[result ? 'hit' : 'miss']++;
    return result;
  }

  function resolvePartialByZh(zh) {
    const key = normalizeSearchText(zh);
    if (!isChineseSearchPhrase(key)) return null;
    const result = getChineseSearchIndex().partial(key);
    _irStats[result ? 'hit' : 'miss']++;
    return result;
  }

  function suggestByZh(zh, limit = 0, scope = null, language = null) {
    const key = normalizeSearchText(zh);
    return isChineseSearchPhrase(key) ? getChineseSearchIndex().suggest(key, limit, scope, language) : [];
  }

  // Formatting-normalized lookups must retain all candidates to detect ambiguity.
  function resolveAllByName(name) {
    const first = nameMap?.[name];
    if (!first) return [];
    const d = _irDupMap?.[name];
    return d ? d.slice() : [first];
  }
  function resolveAlias(alias) {
    const d = _irAliasMap?.[alias];
    return d ? d.slice() : [];
  }
  // 统一优先级（计划书 6.4，以现有实际行为为准）：
  // hash 优先，再查统一名称索引。
  // 注：EC_ID / 韩文名反查见 resolveEcId / resolveKo（v1.4 Phase 10：Wiki 唯一数据入口）。
  function resolve(input) {
    if (!input) return null;
    if (input.hash) { const z = resolveByHash(input.hash); if (z) return z; }
    if (input.name) {
      const z = resolveByName(input.name); if (z) return z;
    }
    if (input.alias) { const zs = resolveAlias(input.alias); if (zs.length) return zs[0]; }
    return null;
  }
  // EC_ID / 韩文名反查（zh → 值）——v1.4 Phase 10：Wiki 与 Probe 的唯一数据入口
  function resolveEcId(zh) { const z = (zh && ecidMap?.[zh]) ? String(ecidMap[zh]) : null; _irStats[z ? 'hit' : 'miss']++; return z; }
  function resolveKo(zh) { const z = (zh && koByZh?.[zh]) ? koByZh[zh] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
  /* @zhixia:core-item-resolver-end */
