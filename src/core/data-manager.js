/* @phase15-module-order:core/data-manager */
/* @phase15-order-link:core/data-manager<-core/constants */
import { DATA_BASE_V3 } from './constants.js';
import { DAY_MS, _lcs90, cacheReset } from './cache.js';
import { applyRuntimeDict } from './dictionary.js';
import { httpGet } from './http.js';
import { tryEnToZh } from './item-resolver.js';
import { __zhxMark } from './probe.js';
import { _zhxErr } from './runtime.js';
import { findSite, neededTables } from './site-registry.js';
import { storeDeleteAsync, storeGetAsync, storeListAsync, storeSetAsync } from './storage.js';
export { DATA_TEXT, DATA_VER, _applyV3, _dlStats, _ensureFinalize, _ensureMain, _ensurePromise, _ensureTryV3, _fireTablesReady, _irStats, _readyCbs, _tablesReady, _v3FetchFile, _v3Pairs, allFilesReady, dataGetIndex, dataGetTable, dataInvalidate, dataManager, ensureTables, fetchManifest, fetchStationFiles, itemDbReady, loadManifest, onTablesReady, readCachedManifest, resolve, resolveAlias, resolveAllByName, resolveByHash, resolveByName, resolveByZh, resolvePartialByZh, suggestByZh, resolveEcId, resolveKo };


  /* ── 数据就绪广播（外置版 / 内嵌版共用）────────────────────────────
     外置版：数据异步到达并建表后触发；内嵌版：建表完成时触发。
     需要等数据就绪的补扫 / 刷新，通过 onTablesReady(fn) 登记。 */
  // 数据版本（外置版由加载器在版本清单到达后赋值；内嵌版保持空 = 随脚本版本）
  let DATA_VER = ''; // NOSONAR — 数据版本由远程 manifest 生命周期更新
  const DATA_REFRESH_EPOCH_KEY = 'zhx.data.refresh.epoch';
  const DATA_REFRESH_EPOCH = 'v3-only-1-force-refresh';
  let _forceDataRefresh = false;
  let _forceDataClearSucceeded = false;
  let _forceDataCacheWritesOk = true;
  let _manifestRefreshRequested = false;
  let _manifestNeedsCommit = false;
  let _manifestRejected = false;

  const _readyCbs = [];
  let _tablesReady = false; // NOSONAR — ready 状态由数据完成生命周期更新
  function onTablesReady(fn) {
    if (typeof fn !== 'function') return;
    if (_tablesReady) { try { fn(); } catch (e) { _zhxErr('readyCb', e); } return; }
    _readyCbs.push(fn);
  }
  function _fireTablesReady() {
    if (_tablesReady) return;
    _tablesReady = true;
    // 清空「查不到」负缓存与派生缓存：外置版中数据到达前生成的结果必须作废
    //（新增缓存时在 Core Cache Registry 登记即被本处按类清理，勿在此手工追加）
    try { cacheReset('lookup'); } catch (e) { /* 忽略：单类缓存清理失败不阻断其余 */ }
    try { cacheReset('translate'); } catch (e) { /* 忽略：单类缓存清理失败不阻断其余 */ }
    try { cacheReset('derived'); } catch (e) { /* 忽略：单类缓存清理失败不阻断其余 */ }
    const cbs = _readyCbs.splice(0);
    for (const f of cbs) { try { f(); } catch (e) { _zhxErr('readyCb', e); } }
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
  const koByZh = Object.create(null);     // 中文名 -> 韩文名（ronka 反查用） // NOSONAR

  // （EC 装备 ID 单条查找已并入 Item Resolver：resolveEcId，v1.4 Phase 10）
  function _replaceMap(target, source) {
    for (const k of Object.keys(target)) delete target[k];
    if (source && typeof source === 'object') Object.assign(target, source);
  }

  /* @zhixia:core-data-manager-start */
  /* V3 manifest、缓存、ready 广播与 dataManager API。 */
  let _ensurePromise = null; // NOSONAR — ensure 生命周期 promise 可被 invalidate 重置
  // V3 文件由 _applyV3 直接建立索引。无论网络或清单是否失败，Finalize 都会释放站点等待回调。
  const _dlStats = { cache: 0, net: 0, fallback: 0 };
  function _ensureFinalize() {
    __zhxMark('finalize');
    try { _fireTablesReady(); } catch (e) { _zhxErr('fireReady', e); }
    __zhxMark('ready');
    return Promise.resolve();
  }

  // ── Runtime Data v3（v1.4 Phase 12）：按站最小数据 + manifest ——
  // 只加载 V3；失败时保留空物品索引，并继续广播就绪。
  // v3 文件清单/格式由 build/make-runtime-data.py 生成（生成器侧已完成首行胜、
  // 染剂回退展开、'-' 行跳过等语义等价处理；此处直接建索引一次赋值）。
  // 缓存：manifest（zhx.v3.manifest = t + '\n' + 原文）；文件（zhx.v3.f.<site>.<name>
  // = sha256 + '\n' + 文本）。sha256 校验在 crypto.subtle 可用时执行，不可用不阻塞。

  // 「键\t值...」文本 → 映射（多值模式收集为数组；行内/键首列已由生成器去重）
  function _v3Pairs(txt, multi) {
    const m = Object.create(null);
    // 多值收集拆为局部函数（仅降复杂度；判定与产物不变）
    const collectMulti = (d, parts) => {
      for (let i = 1; i < parts.length; i++) { if (parts[i] && !d.includes(parts[i])) d.push(parts[i]); }
    };
    for (const ln of String(txt).split('\n')) {
      if (!ln) continue;
      const p = ln.split('\t');
      if (!p[0]) continue;
      if (multi) {
        if (!m[p[0]]) m[p[0]] = [];
        collectMulti(m[p[0]], p);
      } else if (p[1] !== undefined && m[p[0]] === undefined) {
        m[p[0]] = p[1];
      }
    }
    return m;
  }

  // names 文本 → {原生名: 候选允许标记('1'/'0'/'')}——行级、首见记录。
  // 仅用于智能候选：只有明确允许的装备、时尚配饰、鸟甲进入倒排。
  function _v3Glam(txt, requireFlags = false) {
    const m = Object.create(null);
    let sawRow = false;
    for (const ln of String(txt || '').split('\n')) {
      if (!ln) continue;
      const p = ln.split('\t');
      if (!p[0]) continue;
      if (requireFlags && (p[2] === undefined || !['0', '1'].includes(p[2].trim()))) return null;
      if (p[2] === undefined) continue;
      sawRow = true;
      if (m[p[0]] === undefined) m[p[0]] = p[2].trim();
    }
    return requireFlags && !sawRow ? null : m;
  }

  // names 第四列为 EquipSlotCategory 派生的展示组（0头 1身 2手 3腿 4脚 5其余）。
  // 旧 V3 文件只有前三列，全部归入其余，绝不从译名猜测分类。
  function _v3SearchSlots(txt) {
    const slots = Object.create(null);
    for (const ln of String(txt || '').split('\n')) {
      if (!ln) continue;
      const p = ln.split('\t');
      if (p.length < 4 || !p[0] || slots[p[0]] !== undefined) continue;
      if (/^[0-4]$/.test(p[3])) slots[p[0]] = Number(p[3]);
    }
    return slots;
  }

  // V3 数据直接映射为运行时索引；模块内状态由本 IIFE 共享。
  function _applyV3(files) {
    // 取值包装拆为局部函数（仅降复杂度；取值顺序与语义不变）
    const take = (key, multi) => (files[key] ? _v3Pairs(files[key], multi) : null);
    try {
      const names = take('names') || Object.create(null);
      const requireCandidateFlags = files.candidatePolicy === 1 && typeof files.names === 'string';
      const glam = _v3Glam(files.names, requireCandidateFlags);
      if (requireCandidateFlags && !glam) return false;
      const hash = take('hash') || Object.create(null);
      const ecid = take('ecid') || Object.create(null);
      const ko = take('ko') || Object.create(null);
      const ali = take('alias', true) || Object.create(null);
      const dup = take('dup', true) || Object.create(null);
      _replaceMap(nameMap, names);
      _replaceMap(itemHash, hash);
      _irSearchByZh = null;
      _irSearchKind = null;
      _irSearchCanonicalKeys = null;
      _irSearchAliasKeys = null;
      _replaceMap(ecidMap, ecid);
      _replaceMap(koByZh, ko);
      _irAliasMap = ali;
      _irDupMap = dup;
      _irGlamMap = glam || Object.create(null);
      _irSearchSlotByNative = _v3SearchSlots(files.names);
      _irCandidatePolicy = files.candidatePolicy === 1 ? 1 : 0;
      SERIES_TEXT = files.series ? '\n' + files.series : '';
      ACL_CFC_TEXT = files.acl ? '\n' + files.acl : '';
      if (files.dict) applyRuntimeDict(files.dict);
      return true;
    } catch (e) {
      _zhxErr('v3apply', e);
      return false;
    }
  }

  async function _v3ReadCachedFile(key, fingerprint) {
    try {
      const raw = await storeGetAsync(key);
      if (!raw) return null;
      const split = raw.indexOf('\n');
      return split > 0 && raw.slice(0, split) === fingerprint ? raw.slice(split + 1) : null;
    } catch (e) {
      _zhxErr('v3cacheRead', e);
      return null; // 缓存损坏时继续尝试网络下载。
    }
  }

  async function _v3VerifyFile(text, fingerprint) {
    if (!fingerprint || typeof crypto === 'undefined' || !crypto?.subtle || typeof TextEncoder !== 'function') return true;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const actual = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      return actual === fingerprint;
    } catch (e) {
      _zhxErr('v3verify', e);
      return false; // A failed SHA-256 operation must never count as a verified download.
    }
  }

  async function _v3WriteFileCache(key, value, force) {
    if (force) {
      const ok = await storeSetAsync(key, value);
      if (!ok) _forceDataCacheWritesOk = false;
      return ok;
    }
    const ok = await storeSetAsync(key, value);
    return ok;
  }

  async function _v3FindCachedFile(baseKey, fingerprint) {
    let cached = await _v3ReadCachedFile(baseKey + '.' + fingerprint, fingerprint);
    if (cached === null) cached = await _v3ReadCachedFile(baseKey, fingerprint);
    return cached !== null && await _v3VerifyFile(cached, fingerprint) ? cached : null;
  }

  // V3 单文件缓存按站点、文件名和 SHA-256 指纹寻址；旧无指纹 key 只读兼容。
  async function _v3FetchFile(siteId, name, meta, force = false, staged = null, networkAllowed = true) {
    if (!meta?.url || !/^[a-f0-9]{64}$/i.test(meta.sha256 || '')) return null;
    const baseKey = 'zhx.v3.f.' + siteId + '.' + name;
    const key = baseKey + '.' + meta.sha256;
    const cached = force ? null : await _v3FindCachedFile(baseKey, meta.sha256);
    if (cached !== null) {
      _dlStats.cache++;
      if (staged) staged.set(key, meta.sha256 + '\n' + cached);
      return cached;
    }
    if (!networkAllowed) return null;
    let text = null;
    try { text = await httpGet(DATA_BASE_V3 + meta.url, 25000, force ? { fresh: true } : undefined); }
    catch (e) { text = null; /* 请求失败返回 null，由更新流程选择重试或其他数据通道 */ }
    if (typeof text !== 'string' || !text) return null;
    if (!await _v3VerifyFile(text, meta.sha256)) return null;
    _dlStats.net++;
    if (staged) staged.set(key, meta.sha256 + '\n' + text);
    else await _v3WriteFileCache(key, meta.sha256 + '\n' + text, force);
    return text;
  }

  // v3 manifest 读取链（PR#16 审查：自 _ensureTryV3 提升为模块级，纯 IO 无外部捕获）。
  // 缓存 manifest 读取（读取/解析失败视为无缓存；返回 {manT, man}）
  async function readCachedManifest(siteId = '') {
    try {
      const key = siteId ? 'zhx.v3.manifest.' + siteId : 'zhx.v3.manifest';
      const mraw = await storeGetAsync(key);
      if (mraw) {
        const i = mraw.indexOf('\n');
        if (i > 0) return { manT: Number(mraw.slice(0, i)) || 0, man: JSON.parse(mraw.slice(i + 1)) };
      }
    } catch (e) { _zhxErr('v3manifest', e); }
    return { manT: 0, man: null };
  }

  // 网络刷新 manifest（每日至多一次探测路径；失败返回 null）
  function _validV3Manifest(man) {
    if (man?.schema !== 3 || ![0, 1].includes(man.candidatePolicy) || !man.sites || typeof man.sites !== 'object') return false;
    const validFile = (meta) => typeof meta?.url === 'string' && /^[a-f0-9]{64}$/i.test(meta?.sha256 || '');
    for (const site of Object.values(man.sites)) {
      if (!site?.files || typeof site.files !== 'object') return false;
      for (const meta of Object.values(site.files)) if (!validFile(meta)) return false;
    }
    if (man.shared?.dict && !validFile(man.shared.dict)) return false;
    return true;
  }

  async function fetchManifest(force = false) {
    _manifestNeedsCommit = false;
    _manifestRejected = false;
    let txt = null;
    try { txt = await httpGet(DATA_BASE_V3 + 'manifest.json', 10000, force ? { fresh: true } : undefined); }
    catch (e) { txt = null; /* 请求失败时由 loadManifest 决定是否复用旧清单 */ }
    if (typeof txt !== 'string' || !txt) return null;
    try {
      const manifest = JSON.parse(txt);
      if (_validV3Manifest(manifest)) { _manifestNeedsCommit = true; return manifest; }
    } catch (e) { /* manifest 解析或 schema/policy 校验失败 */ }
    _manifestRejected = true;
    return false;
  }

  // 缓存优先 → 必要时网络（站点是否在列由 _ensureTryV3 统一判断）
  async function loadManifest(force = false, refresh = false) {
    _manifestNeedsCommit = false;
    if (force) return await fetchManifest(true);
    const c = await readCachedManifest();
    const fresh = !!(c.manT && (Date.now() - c.manT < DAY_MS));
    const valid = _validV3Manifest(c.man);
    if (!refresh && valid && fresh && c.man.candidatePolicy === 1) return c.man;
    const latest = await fetchManifest();
    if (latest === false) return null;
    if (latest) return latest;
    return valid ? c.man : null;
  }

  // 站点文件并行获取（含共享词库）
  async function fetchStationFiles(siteId, names, sm, sharedDict, force = false, staged = null, networkAllowed = true) {
    const files = {};
    const jobs = names.map((n) => _v3FetchFile(siteId, n, sm[n], force, staged, networkAllowed)
      .then((t) => { files[n] = t; }, () => { files[n] = null; }));
    if (sharedDict) {
      jobs.push(_v3FetchFile(siteId, 'dict', sharedDict, force, staged, networkAllowed)
        .then((t) => { files.dict = t; }, () => { files.dict = null; }));
    }
    await Promise.all(jobs);
    return files;
  }

  function allFilesReady(names, files, sharedDict) {
    for (const n of names) { if (files[n] == null) return false; }
    return !(sharedDict && files.dict == null);
  }

  function _requiredV3Files(site) {
    const required = [];
    if (site.indexes?.includes('nameMap')) required.push('names', 'alias', 'dup');
    if (site.indexes?.includes('itemHash')) required.push('hash');
    if (site.indexes?.includes('ecidMap')) required.push('ecid');
    if (site.indexes?.includes('koByZh')) required.push('ko');
    if (site.tables?.includes('series')) required.push('series');
    if (site.tables?.includes('acl')) required.push('acl');
    return required;
  }

  // v3 主流程：manifest（24h 缓存）→ 站点文件（缓存优先）→ 应用。
  // 任何一步失败或缺文件均返回 false；调用方保持安全空索引。
  async function _commitV3Bundle(staged, manifest, siteId, force, commitSnapshot, commitManifest) {
    for (const [key, value] of staged) {
      if (!await _v3WriteFileCache(key, value, force)) return false;
    }
    const value = String(Date.now()) + '\n' + JSON.stringify(manifest);
    if (commitSnapshot && !await storeSetAsync('zhx.v3.manifest.' + siteId, value)) {
      if (force) _forceDataCacheWritesOk = false;
      return false;
    }
    if (commitManifest && !await storeSetAsync('zhx.v3.manifest', value)) {
      if (force) _forceDataCacheWritesOk = false;
      return false;
    }
    return true;
  }

  function _v3SiteCacheKeepKeys(siteId, manifest) {
    const keys = new Set();
    const files = manifest?.sites?.[siteId]?.files || {};
    for (const [name, meta] of Object.entries(files)) {
      if (meta?.sha256) keys.add('zhx.v3.f.' + siteId + '.' + name + '.' + meta.sha256);
    }
    const dict = manifest?.shared?.dict;
    if (dict?.sha256) keys.add('zhx.v3.f.' + siteId + '.dict.' + dict.sha256);
    return keys;
  }

  function _v3SiteCacheStaleFromList(siteId, keep, listed) {
    const prefix = 'zhx.v3.f.' + siteId + '.';
    return new Set(listed.filter((key) => key.startsWith(prefix) && !keep.has(key)));
  }

  function _v3SiteCacheStaleFromManifest(siteId, previousManifest, currentManifest) {
    const stale = new Set();
    const oldFiles = previousManifest?.sites?.[siteId]?.files || {};
    const currentFiles = currentManifest?.sites?.[siteId]?.files || {};
    for (const [name, meta] of Object.entries(oldFiles)) {
      const current = currentFiles[name];
      if (current && current.sha256 === meta?.sha256) continue;
      stale.add('zhx.v3.f.' + siteId + '.' + name);
      if (meta?.sha256) stale.add('zhx.v3.f.' + siteId + '.' + name + '.' + meta.sha256);
    }
    const oldDict = previousManifest?.shared?.dict;
    const currentDict = currentManifest?.shared?.dict;
    if (oldDict?.sha256 && oldDict.sha256 !== currentDict?.sha256) {
      stale.add('zhx.v3.f.' + siteId + '.dict.' + oldDict.sha256);
    }
    return stale;
  }

  async function _pruneV3SiteCache(siteId, previousManifest, currentManifest) {
    const keep = _v3SiteCacheKeepKeys(siteId, currentManifest);
    let listed = null;
    try { listed = await storeListAsync(); } catch (e) { listed = null; }
    const stale = Array.isArray(listed)
      ? _v3SiteCacheStaleFromList(siteId, keep, listed)
      : _v3SiteCacheStaleFromManifest(siteId, previousManifest, currentManifest);
    await Promise.all([...stale].map((key) => storeDeleteAsync(key)));
  }

  function _manifestSiteFiles(manifest, site, need) {
    const sm = manifest?.sites?.[site.id]?.files;
    if (!sm || typeof sm !== 'object') return null;
    const names = Object.keys(sm);
    const required = _requiredV3Files(site);
    if (!names.length || required.some((name) => !sm[name])) return null;
    const sharedDict = (need.includes('dict') && manifest.shared?.dict) || null;
    if (need.includes('dict') && !sharedDict) return null;
    return { sm, names, sharedDict };
  }

  async function _readPreviousV3Manifest(siteId) {
    const siteSnapshot = await readCachedManifest(siteId);
    const globalSnapshot = await readCachedManifest();
    const siteSnapshotValid = _validV3Manifest(siteSnapshot.man);
    const previous = siteSnapshotValid ? siteSnapshot : globalSnapshot;
    return { siteSnapshot, siteSnapshotValid, globalSnapshot, previous, previousValid: _validV3Manifest(previous.man) };
  }

  async function _selectV3Manifest(force, refreshManifest, snapshots) {
    let manifest = await loadManifest(force, refreshManifest);
    const { siteSnapshot, siteSnapshotValid, globalSnapshot } = snapshots;
    const pinnedNewer = siteSnapshotValid && siteSnapshot.manT > globalSnapshot.manT;
    const canUseSiteCache = !force && !_manifestRejected && siteSnapshotValid;
    if (canUseSiteCache && (!manifest || (pinnedNewer && !_manifestNeedsCommit))) manifest = siteSnapshot.man;
    return _validV3Manifest(manifest) && (!force || manifest.candidatePolicy === 1) ? manifest : null;
  }

  async function _tryV3Bundle(site, manifest, need, force, staged, networkAllowed) {
    const selected = _manifestSiteFiles(manifest, site, need);
    if (!selected) return null;
    const files = await fetchStationFiles(site.id, selected.names, selected.sm, selected.sharedDict, force, staged, networkAllowed);
    if (!allFilesReady(selected.names, files, selected.sharedDict)) return null;
    files.candidatePolicy = manifest.candidatePolicy;
    return _applyV3(files) ? { files } : null;
  }

  async function _tryV3WithCachedFallback(site, manifest, need, force, snapshots, staged) {
    let loaded = await _tryV3Bundle(site, manifest, need, force, staged, true);
    if (loaded || force || !snapshots.previousValid) return { loaded, manifest };
    staged.clear();
    loaded = await _tryV3Bundle(site, snapshots.previous.man, need, false, null, false);
    if (!loaded) return { loaded: null, manifest };
    _dlStats.fallback++;
    return { loaded, manifest: snapshots.previous.man };
  }

  async function _commitV3Selection(siteId, manifest, snapshots, force, staged) {
    const snapshotNewer = snapshots.siteSnapshotValid
      && snapshots.siteSnapshot.manT > snapshots.globalSnapshot.manT;
    const commitSnapshot = force || _manifestNeedsCommit || !snapshots.siteSnapshotValid
      || (!snapshotNewer && snapshots.siteSnapshot.man?.version !== manifest.version);
    const committed = await _commitV3Bundle(staged, manifest, siteId, force, commitSnapshot, _manifestNeedsCommit);
    if (committed) await _pruneV3SiteCache(siteId, snapshots.previous.man, manifest);
    return committed;
  }

  async function _ensureTryV3(force = false, refreshManifest = false) {
    const site = findSite();
    if (!site?.id) return false;
    try {
      const snapshots = await _readPreviousV3Manifest(site.id);
      const manifest = await _selectV3Manifest(force, refreshManifest, snapshots);
      if (!manifest) return false;
      const staged = new Map();
      const result = await _tryV3WithCachedFallback(site, manifest, neededTables(), force, snapshots, staged);
      if (!result.loaded) return false;
      if (result.manifest === manifest) await _commitV3Selection(site.id, manifest, snapshots, force, staged);
      if (result.manifest.version) DATA_VER = String(result.manifest.version);
      return true;
    } catch (e) {
      _zhxErr('v3', e);
      return false;
    }
  }



  // 旧缓存键只在此处保留，用于 V3 一次性迁移清理。
  const LEGACY_META_KEY = 'zhx.meta';
  const LEGACY_DT_PREFIX = 'zhx.dt.';
  function _isDataCacheKey(key) {
    return key === LEGACY_META_KEY || key === 'zhx.v3.manifest' || key.startsWith('zhx.v3.manifest.')
      || key === 'zhx.candidate.policy' || key.startsWith(LEGACY_DT_PREFIX) || key.startsWith('zhx.v3.f.');
  }

  function _knownDataCacheKeys() {
    const keys = new Set([LEGACY_META_KEY, 'zhx.v3.manifest', 'zhx.candidate.policy']);
    for (const siteId of ['mirapri', 'ec', 'fc', 'ronka', 'collection', 'wiki', 'endcloset']) {
      keys.add('zhx.v3.manifest.' + siteId);
    }
    for (const name of ['items', 'series', 'acl', 'dict']) keys.add(LEGACY_DT_PREFIX + name);
    const sites = ['mirapri', 'ec', 'fc', 'ronka', 'collection', 'wiki', 'endcloset'];
    const files = ['names', 'hash', 'alias', 'dup', 'ecid', 'ko', 'series', 'acl', 'dict'];
    for (const site of sites) for (const file of files) keys.add('zhx.v3.f.' + site + '.' + file);
    return keys;
  }

  function _addSiteManifestCacheKeys(keys, siteId, site, sharedDictHash) {
    for (const [name, meta] of Object.entries(site.files || {})) {
      const base = 'zhx.v3.f.' + siteId + '.' + name;
      keys.add(base);
      if (meta?.sha256) keys.add(base + '.' + meta.sha256);
    }
    if (sharedDictHash) keys.add('zhx.v3.f.' + siteId + '.dict.' + sharedDictHash);
  }

  function _addManifestCacheKeys(keys, manifest) {
    if (!_validV3Manifest(manifest)) return;
    const sharedDictHash = manifest.shared?.dict?.sha256;
    for (const [siteId, site] of Object.entries(manifest.sites)) {
      _addSiteManifestCacheKeys(keys, siteId, site, sharedDictHash);
    }
  }

  async function _readCachedManifests() {
    const sites = ['mirapri', 'ec', 'fc', 'ronka', 'collection', 'wiki', 'endcloset'];
    return Promise.all([readCachedManifest(), ...sites.map((siteId) => readCachedManifest(siteId))]);
  }

  async function _clearDataCaches() {
    let listed = null;
    try { listed = await storeListAsync(); } catch (e) { listed = null; }
    const keys = _knownDataCacheKeys();
    for (const stored of await _readCachedManifests()) _addManifestCacheKeys(keys, stored.man);
    if (Array.isArray(listed)) {
      for (const key of listed) if (_isDataCacheKey(key)) keys.add(key);
    }
    const results = await Promise.all([...keys].map((key) => storeDeleteAsync(key)));
    return results.every(Boolean);
  }

  async function _prepareDataRefresh() {
    let epoch = null;
    try { epoch = await storeGetAsync(DATA_REFRESH_EPOCH_KEY); } catch (e) { epoch = null; }
    if (epoch === DATA_REFRESH_EPOCH) {
      _forceDataClearSucceeded = true;
      _forceDataCacheWritesOk = true;
      return false;
    }
    _forceDataRefresh = true;
    _forceDataCacheWritesOk = true;
    _forceDataClearSucceeded = await _clearDataCaches();
    return true;
  }

  async function _completeDataRefresh() {
    if (!_forceDataClearSucceeded || !_forceDataCacheWritesOk) return false;
    const stored = await storeSetAsync(DATA_REFRESH_EPOCH_KEY, DATA_REFRESH_EPOCH);
    if (stored) _forceDataRefresh = false;
    return stored;
  }

  async function _ensureMain() {
    _irCandidatePolicy = 0;
    _forceDataRefresh = await _prepareDataRefresh();
    if (!neededTables().length) return;
    const refreshManifest = _manifestRefreshRequested;
    _manifestRefreshRequested = false;
    const loaded = await _ensureTryV3(_forceDataRefresh, refreshManifest);
    if (loaded && _forceDataRefresh && _irCandidatePolicy === 1) await _completeDataRefresh();
  }

  function ensureTables() {
    if (_ensurePromise) return _ensurePromise;
    _ensurePromise = _ensureMain().catch((e) => { _zhxErr('ensureMain', e); }).then(_ensureFinalize);
    return _ensurePromise;
  }
  function itemDbReady(cb) {
    ensureTables().then(() => { try { if (typeof cb === 'function') cb(); } catch (e) { _zhxErr('readyCb', e); } });
  }

  // ── DataManager 统一 API（v1.4 Phase 11）─────────────────────────────
  // 说明：既有 ensureTables / itemDbReady / onTablesReady 行为与调用点全部保留；
  // 本对象为别名与扩展入口，新代码统一经 dataManager 访问。site 参数为将来按站
  // 数据链预留（现状六站共享同一数据链，忽略该参数）。
  function dataGetTable(name) {
    // 表文本（只读引用）：items / series / acl；未就绪或未知表 → null
    switch (name) {
      case 'series': return SERIES_TEXT || null;
      case 'acl': return ACL_CFC_TEXT || null;
      default: return null;
    }
  }
  function dataGetIndex(name) {
    // 索引引用（数据层与核心模块内部/调试用途；业务侧查询一律走 Item Resolver）
    switch (name) {
      case 'itemHash': return _tablesReady ? itemHash : null;
      case 'nameMap': return _tablesReady ? nameMap : null;
      case 'ecidMap': return _tablesReady ? ecidMap : null;
      case 'koByZh': return _tablesReady ? koByZh : null;
      default: return null;
    }
  }
  function dataInvalidate() {
    // 重新检查 V3 manifest，同时保留按指纹校验的文件缓存供离线复用。
    _ensurePromise = null;
    DATA_VER = '';
    _manifestRefreshRequested = true;
    _replaceMap(itemHash, null); _replaceMap(ecidMap, null); _replaceMap(nameMap, null); _replaceMap(koByZh, null);
    _irDupMap = null; _irAliasMap = null; _irGlamMap = null; _irSearchSlotByNative = null; _irCandidatePolicy = 0;
    _irSearchByZh = null; _irSearchKind = null; _irSearchCanonicalKeys = null; _irSearchAliasKeys = null;
    SERIES_TEXT = ''; ACL_CFC_TEXT = '';
  }
  const dataManager = {   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
    ensure(site) { return ensureTables(); },                       // site：预留（见上）
    ready(cb) {
      const p = ensureTables();
      if (typeof cb === 'function') p.then(() => { try { cb(); } catch (e) { _zhxErr('readyCb', e); } });
      return p;
    },
    getTable(name) { return dataGetTable(name); },
    getIndex(name) { return dataGetIndex(name); },
    invalidate() { dataInvalidate(); },
  };
  /* @zhixia:core-data-manager-end */
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

  // 中文装备搜索反向索引：国服中文名/中文别名 → 当前站点原生名称。
  // 仅构建当前站点所需的原生语言映射，不扩大现有 v3 数据文件。
  let _irSearchByZh = null; // NOSONAR — 数据就绪后按当前站点数据重建
  let _irSearchKind = null;  // 0=正式名称，1=中文别名
  let _irSearchCanonicalKeys = null;
  let _irSearchAliasKeys = null;

  function _irNormZhSearch(value) {
    return String(value ?? '').trim().replace(/[ \t\u00a0]+/g, ' ');
  }

  function _irSearchPut(map, zh, native, kind, kindMap) {
    if (!map || !zh || !native) return;
    const key = _irNormZhSearch(zh);
    const value = _irNormZhSearch(native);
    if (!key || !value) return;
    if (map[key] === undefined) {
      map[key] = value;
      if (kindMap) kindMap[key] = kind;
    }
  }

  function _irBuildSearchFromNames(names, ali, glam) {
    const out = Object.create(null);
    const kind = Object.create(null);
    if (_irCandidatePolicy !== 1) return { map: out, kind };
    for (const [native, zh] of Object.entries(names || {})) {
      if (glam?.[native] !== '1') continue;   // 仅明确允许的装备、时尚配饰、鸟甲进入中文候选
      _irSearchPut(out, zh, native, 0, kind);
    }
    for (const [alias, zhs] of Object.entries(ali || {})) {
      const key = _irNormZhSearch(alias);
      if (!key || out[key] !== undefined) continue;
      const list = Array.isArray(zhs) ? zhs : [zhs];
      for (const zh of list) {
        const native = out[_irNormZhSearch(zh)];
        if (native) {
          out[key] = native;
          kind[key] = 1;
          break;
        }
      }
    }
    return { map: out, kind };
  }

  function _ensureIrSearch() {
    if (_irSearchByZh !== null) return _irSearchByZh;
    const built = _irBuildSearchFromNames(nameMap, _irAliasMap, _irGlamMap);
    _irSearchByZh = built.map;
    _irSearchKind = built.kind;
    _irSearchCanonicalKeys = null;
    _irSearchAliasKeys = null;
    return _irSearchByZh;
  }

  function _getIrSearchKeysByKind(kind) {
    if (kind === 0 && _irSearchCanonicalKeys !== null) return _irSearchCanonicalKeys;
    if (kind === 1 && _irSearchAliasKeys !== null) return _irSearchAliasKeys;
    const out = Object.keys(_irSearchByZh || {}).filter((k) => _irSearchKind?.[k] === kind);
    out.sort((a, b) => a.localeCompare(b));
    if (kind === 0) _irSearchCanonicalKeys = out;
    else _irSearchAliasKeys = out;
    return out;
  }

  function _irSearchLowerBound(keys, target) {
    let lo = 0, hi = keys.length;
    while (lo < hi) {
      const mid = lo + ((hi - lo) >> 1);
      if (keys[mid].localeCompare(target) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function _irSearchCollectPrefix(keys, target, limit, out, excluded) {
    const start = _irSearchLowerBound(keys, target);
    for (let i = start; i < keys.length && out.length < limit; i++) {
      const candidate = keys[i];
      if (!candidate.startsWith(target)) break;
      if (candidate !== excluded) out.push(candidate);
    }
  }

  // 除前缀外也支持中文装备名中间连续片段；保持允许名单、按站语言映射不变。
  function _irSearchCollectContains(keys, target, limit, out, excluded) {
    for (const candidate of keys) {
      if (out.length >= limit) break;
      if (candidate !== excluded && !candidate.startsWith(target) && candidate.includes(target)) out.push(candidate);
    }
  }

  // 解析统计（v1.4 Phase 10：Probe 读取——整数自增，无行为影响）
  const _irStats = { hit: 0, miss: 0 };
  function resolveByHash(hash) { const z = (hash && itemHash?.[hash]) ? itemHash[hash] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
  function resolveByName(name) { const z = (name && nameMap?.[name]) ? nameMap[name] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
  function resolveByZh(zh) {
    const key = _irNormZhSearch(zh);
    const map = _ensureIrSearch();
    const z = (key && map?.[key]) ? map[key] : null;
    _irStats[z ? 'hit' : 'miss']++;
    return z;
  }

  // 部分词解析的外层收集：kind 0/1（主名 + 别名）两类键各收集一轮，
  // 合计超过 1000 条即停（防病态输入把收集循环拖长）。
  function _zhPartialCollect(key, map) {
    const natives = [];
    for (const kind of [0, 1]) {
      _zhPartialCollectKind(natives, key, map, kind);
      if (natives.length > 1000) break;
    }
    return natives;
  }

  // 单类收集：键含部分词且非键本身时，取对应原生名入列。
  function _zhPartialCollectKind(natives, key, map, kind) {
    for (const k of _getIrSearchKeysByKind(kind)) {
      if (k === key || !k.includes(key)) continue;
      const native = map[k];
      if (native) natives.push(native);
      if (natives.length > 1000) return;
    }
  }

  // v1.4.2 后续：部分词解析（完整名失败时兜底）——子串收集 + 公共子串提取（复用系列名推导 _lcs90 经验）。
  // 场景：「女仆」→ 收集所有含「女仆」的中文名 → 提取原生名（按站裁剪）的公共子串「メイド」→ 交给站内部分匹配搜索。
  // 提取不到公共子串（各族原生名互异）时返回 null，保持「不转换」原行为。
  function resolvePartialByZh(zh) {
    const key = _irNormZhSearch(zh);
    if (key.length < 2 || !/[\u3400-\u9fff]/u.test(key)) return null;
    const map = _ensureIrSearch();
    if (!map) return null;
    const natives = _zhPartialCollect(key, map);
    let z = null;
    if (natives.length === 1) z = natives[0];
    else if (natives.length > 1) z = _lcs90(natives);
    // 英文（非 CJK）片段质量门：如 "ai"、"Loyal Housem" 这类词中片段判为不合格，
    // 保持不转换——避免把无意义的片段当搜索词（英文站数据混杂时 _lcs90 会产出此类结果）。
    if (z && /[A-Za-z]/.test(z) && !_zhPartialEdgeOk(z, natives)) z = null;
    _irStats[z ? 'hit' : 'miss']++;
    return z;
  }

  // 部分词提取的英文片段边界校验：含 ASCII 字母的片段必须在某个样本中存在「合格窗口」
  // ——左端为串首或前邻非字母数字；右端为串尾、后邻非字母数字、或末字符本身即分隔符
  // （如「Housemaid 」尾随空格）；否则视为词中片段（如 "ai"、"Loyal Housem"）判不合格。
  function _zhPartialEdgeOk(seg, list) {
    for (const s of list) {
      let i = s.indexOf(seg);
      while (i !== -1) {
        const left = i === 0 || !/[0-9A-Za-z]/.test(s[i - 1]);
        const end = i + seg.length;
        const right = end >= s.length
          || !/[0-9A-Za-z]/.test(s[end])
          || !/[0-9A-Za-z]/.test(s[end - 1]);
        if (left && right) return true;
        i = s.indexOf(seg, i + 1);
      }
    }
    return false;
  }

  // 智能输入候选的防御性上限：实测当前数据最大前缀组 2450 条（「改良」）；
  // 3 千条兜底，防止病态输入把候选列表渲染到卡顿（正常输入远低于此）。
  const SUGGEST_ABS_MAX = 3000;
  // 匹配度在每个装备部位内计算：精确 / 正式名前缀 / 正式名包含 /
  // 别名前缀 / 别名包含；非匹配项返回 -1。
  function _irSuggestionScore(name, query, kind) {
    if (name === query) return 0;
    if (name.startsWith(query)) return kind === 0 ? 1 : 3;
    if (name.includes(query)) return kind === 0 ? 2 : 4;
    return -1;
  }

  // 每个部位设五个有序匹配桶；先采集完整匹配，再进行最终限流，
  // 否则高优先级部位可能被词典顺序和 limit 提前截断。
  // Scope before bucketing and limiting, not after truncating 3,000 results.
  // A set represents exact official native-name membership (e.g. bardings);
  // a numeric value represents the official V3 equipment slot group.
  function _irSuggestionCollect(buckets, query, kind, limit, map, scope) {
    for (const name of _getIrSearchKeysByKind(kind)) {
      const score = _irSuggestionScore(name, query, kind);
      if (score < 0) continue;
      const native = map[name];
      if (!native) continue;
      const group = _irSearchSlotByNative?.[native] ?? 5;
      if (scope instanceof Set && !scope.has(native)) continue;
      if (typeof scope === 'number' && scope !== group) continue;
      const bucket = buckets[group][score];
      if (bucket.length < limit) bucket.push({ zh: name, native });
    }
  }

  function _irSuggestionFlatten(buckets, limit) {
    const rows = [];
    for (const bucket of buckets.flat()) {
      for (const row of bucket) {
        rows.push(row);
        if (rows.length >= limit) return rows;
      }
    }
    return rows;
  }

  // 先按头、身、手、腿、脚、其余；组内按匹配度排序，保持已存在的
  // 正式名、别名、limit、旧 V3 缓存及六站原生名行为。
  function suggestByZh(zh, limit = 0, scope = null) {
    const key = _irNormZhSearch(zh);
    if (key.length < 2 || !/[\u3400-\u9fff]/u.test(key)) return [];
    const map = _ensureIrSearch();
    if (!map) return [];
    const raw = Number(limit);
    const max = Number.isFinite(raw) && raw > 0 ? Math.min(raw, SUGGEST_ABS_MAX) : SUGGEST_ABS_MAX;
    const buckets = Array.from({ length: 6 }, () => Array.from({ length: 5 }, () => []));
    _irSuggestionCollect(buckets, key, 0, max, map, scope);
    _irSuggestionCollect(buckets, key, 1, max, map, scope);
    return _irSuggestionFlatten(buckets, max);
  }

  function resolveAllByName(name) {   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
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
  // 1) hash → 2) 名称 → 3) 历史兼容 fallback（latinFallback：外文名自动查物品总表）。
  // 注：EC_ID / 韩文名反查见 resolveEcId / resolveKo（v1.4 Phase 10：Wiki 唯一数据入口）。
  function resolve(input, opts) {
    if (!input) return null;
    if (input.hash) { const z = resolveByHash(input.hash); if (z) return z; }
    if (input.name) {
      const z = resolveByName(input.name); if (z) return z;
      if (opts?.latinFallback) { const z2 = tryEnToZh(input.name); if (z2) return z2; }
    }
    if (input.alias) { const zs = resolveAlias(input.alias); if (zs.length) return zs[0]; }
    return null;
  }
  // EC_ID / 韩文名反查（zh → 值）——v1.4 Phase 10：Wiki 与 Probe 的唯一数据入口
  function resolveEcId(zh) { const z = (zh && ecidMap?.[zh]) ? String(ecidMap[zh]) : null; _irStats[z ? 'hit' : 'miss']++; return z; }
  function resolveKo(zh) { const z = (zh && koByZh?.[zh]) ? koByZh[zh] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
