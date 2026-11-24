import { DATA_BASE_V3 } from '../constants.js';
import { CACHE_CAP_LOOKUP, _en2zhCache, DAY_MS, cacheGuard, cacheReset } from '../cache-primitives.js';
import { applyRuntimeDict } from './dictionary.js';
import { validRuntimeDictionary } from './dict-contract.js';
import { httpGet } from './http.js';
import { __zhxMark, _zhxErr } from '../runtime.js';
import { findSitePolicy as findSite, neededTables } from '../site-policy.js';
import { storeDeleteAsync, storeGetAsync, storeListAsync, storeSetAsync } from './storage.js';
import { requiredV3Files, validV3FileMeta, validV3Manifest } from './v3-contract.js';
import { dyeColorName, indexItemIds, parseItemIds } from './item-identity.js';
import { createChineseSearchIndex, isChineseSearchPhrase, normalizeSearchText } from './chinese-search-index.js';
export { DATA_TEXT, DATA_VER, _applyV3, _dlStats, _ensureFinalize, _ensureMain, _ensurePromise, _ensureTryV3, _fireTablesReady, _irStats, _readyCbs, _tablesReady, _v3FetchFile, _v3Pairs, allFilesReady, dataGetIndex, dataGetStatus, dataInvalidate, tryEnToZh, ensureTables, fetchManifest, fetchStationFiles, loadManifest, onTablesReady, readCachedManifest, resolve, resolveAlias, resolveAllByName, resolveByHash, resolveByName, resolveDyeColor, itemById, findItemsByName, hasItemIdentities, resolveByZh, resolvePartialByZh, suggestByZh, resolveEcId, resolveKo };


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
  let _manifestNeedsCommit = false;
  let _manifestRejected = false;

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

  /* @zhixia:core-data-manager-start */
  /* V3 manifest、缓存、ready 广播与 dataManager API。 */
  let _ensurePromise = null; // NOSONAR — ensure 生命周期 promise 可被 invalidate 重置
  let _activeEnsure = null; // 请求进行中触发刷新时，串行执行前后两代加载。
  let _ensureGeneration = 0; // 过期加载不能应用数据表，也不能触发就绪通知。
  let _dataLoadState = 'idle'; // idle/loading/ready/degraded 与“广播已完成”分离。
  let _dataLoadOrigin = 'none'; // cache/network/fallback/none，用于调用方诊断。
  let _manifestNetworkAttempted = false;
  // V3 文件由 _applyV3 直接建立索引。无论网络或清单是否失败，Finalize 都会释放站点等待回调。
  const _dlStats = { cache: 0, net: 0, fallback: 0 };
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

  // ── Runtime Data v3（v1.4 Phase 12）：按站最小数据 + manifest ——
  // 只加载 V3；失败时保留空物品索引，并继续广播就绪。
  // v3 文件清单/格式由 build/data/make-runtime-data.py 生成（生成器侧已完成首行胜、
  // 染剂回退展开、'-' 行跳过等语义等价处理；此处直接建索引一次赋值）。
  // 缓存：manifest（zhx.v3.manifest = t + '\n' + 原文）；文件键含站点、名称和 SHA-256。
  // 文件值为 sha256 + '\n' + 文本；字节数和摘要均须匹配，无 WebCrypto 时拒绝加载并结束等待。

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

  // names 同时驱动多语解析、候选策略和展示分组。一次拆行构建三张表，
  // 保留每个索引原有的首行/严格校验规则，避免大文件重复 split。
  function _v3Names(txt) {
    const names = Object.create(null);
    const glam = Object.create(null);
    const slots = Object.create(null);
    let sawRow = false;
    for (const ln of String(txt || '').split('\n')) {
      if (!ln) continue;
      const p = ln.split('\t');
      if (!p[0]) continue;
      if (p.length !== 4 || !['0', '1'].includes(p[2].trim()) || !/^[0-5]$/.test(p[3].trim())) return null;
      sawRow = true;
      if (names[p[0]] === undefined) {
        names[p[0]] = p[1];
        glam[p[0]] = p[2].trim();
        slots[p[0]] = Number(p[3].trim());
      }
    }
    return sawRow ? { names, glam, slots } : null;
  }

  function _validateV3Payload(files) {
    if (files.candidatePolicy !== 1) return null;
    if (files.dict && !validRuntimeDictionary(JSON.parse(files.dict))) return null;
    if (files.identity) return files.identity;
    return typeof files.names === 'string'
      ? _v3Names(files.names)
      : { names: Object.create(null), glam: Object.create(null), slots: Object.create(null) };
  }

  // V3 数据直接映射为运行时索引；模块内状态由本 IIFE 共享。
  function _applyV3(files) {
    // 取值包装拆为局部函数（仅降复杂度；取值顺序与语义不变）
    const take = (key, multi) => (files[key] ? _v3Pairs(files[key], multi) : null);
    try {
      const parsedNames = _validateV3Payload(files);
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

  const v3FileCachePrefix = (siteId) => 'zhx.v3.f.' + siteId + '.';
  const v3FileCacheKey = (siteId, name, fingerprint) => v3FileCachePrefix(siteId) + name + '.' + fingerprint;

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

  async function _v3VerifyFile(text, fingerprint, expectedBytes) {
    // 两端共享 SHA-256 + UTF-8 字节长度契约；禁止字节数不同的数据污染缓存。
    if (typeof TextEncoder !== 'function') return false;
    let encoded;
    try {
      encoded = new TextEncoder().encode(text);
      if (encoded.byteLength !== expectedBytes) return false;
      // 无 WebCrypto 时拒绝未经摘要验证的数据，而不是降级为仅检查长度。
      // 加载流程会正常进入 degraded 并通知订阅者，不会无限等待。
      if (!fingerprint || typeof crypto === 'undefined' || !crypto?.subtle?.digest) return false;
      const buf = await crypto.subtle.digest('SHA-256', encoded);
      const actual = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      return actual === fingerprint;
    } catch (e) {
      _zhxErr('v3verify', e);
      return false;
    }
  }

  async function _v3FindCachedFile(key, fingerprint, expectedBytes) {
    const current = await _v3ReadCachedFile(key, fingerprint);
    if (current !== null && await _v3VerifyFile(current, fingerprint, expectedBytes)) return current;
    return null;
  }

  // 只读取按站点、文件名和 SHA-256 指纹寻址的当前缓存。
  async function _v3FetchFile(siteId, name, meta, force = false, staged = null, networkAllowed = true) {
    const extension = name === 'series' || name === 'acl' ? '.txt' : '.tsv';
    const filename = name === 'itemIds' ? 'item-ids.tsv' : name + extension;
    const expectedUrl = name === 'dict' ? 'dict.json' : siteId + '/' + filename;
    if (!validV3FileMeta(meta, expectedUrl)) return null;
    const key = v3FileCacheKey(siteId, name, meta.sha256);
    const cached = force ? null : await _v3FindCachedFile(key, meta.sha256, meta.bytes);
    if (cached !== null) {
      _dlStats.cache++;
      if (staged) staged.set(key, meta.sha256 + '\n' + cached);
      return cached;
    }
    if (!networkAllowed) return null;
    let text = null;
    // Paths are mutable at deployment. GM's hash-addressed cache is reused
    // above; a real download must not reuse a stale HTTP response body.
    try { text = await httpGet(DATA_BASE_V3 + meta.url, 25000, { fresh: true }); }
    catch (e) { text = null; /* 请求失败返回 null，由更新流程选择重试或其他数据通道 */ }
    if (typeof text !== 'string' || !text) return null;
    if (!await _v3VerifyFile(text, meta.sha256, meta.bytes)) return null;
    _dlStats.net++;
    if (staged) staged.set(key, meta.sha256 + '\n' + text);
    else await storeSetAsync(key, meta.sha256 + '\n' + text);
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
        if (i > 0) {
          const timestamp=Number(mraw.slice(0,i));
          const manT=Number.isSafeInteger(timestamp)&&timestamp>0&&timestamp<=Date.now()?timestamp:0;
          return { manT, man: JSON.parse(mraw.slice(i + 1)) };
        }
      }
    } catch (e) { _zhxErr('v3manifest', e); }
    return { manT: 0, man: null };
  }

  // 网络刷新 manifest（每日至多一次探测路径；失败返回 null）
  async function _requestV3Manifest() {
    let txt = null;
    try { txt = await httpGet(DATA_BASE_V3 + 'manifest.json', 10000, { fresh: true }); }
    catch (e) { txt = null; /* 请求失败时由 loadManifest 决定是否复用旧清单 */ }
    if (typeof txt !== 'string' || !txt) return null;
    try {
      const manifest = JSON.parse(txt);
      if (validV3Manifest(manifest)) return manifest;
    } catch (e) { /* manifest 解析或 schema/policy 校验失败 */ }
    return false;
  }

  async function fetchManifest() {
    _manifestNetworkAttempted = true;
    _manifestNeedsCommit = false;
    _manifestRejected = false;
    const manifest = await _requestV3Manifest();
    _manifestNeedsCommit = Boolean(manifest);
    _manifestRejected = manifest === false;
    return manifest;
  }

  function _freshV3Manifest(snapshot) {
    return snapshot.manT > 0 && Date.now() - snapshot.manT < DAY_MS && validV3Manifest(snapshot.man);
  }

  // 缓存优先 → 必要时网络（站点是否在列由 _ensureTryV3 统一判断）
  async function loadManifest(force = false, refresh = false) {
    _manifestNeedsCommit = false;
    _manifestNetworkAttempted = false;
    if (force) return await fetchManifest();
    const c = await readCachedManifest();
    if (!refresh && _freshV3Manifest(c)) return c.man;
    const latest = await fetchManifest();
    if (latest === false) return null;
    if (latest) return latest;
    return validV3Manifest(c.man) ? c.man : null;
  }

  // 站点文件并行获取（含共享词库）
  async function fetchStationFiles(siteId, names, sm, sharedDict, force = false, staged = null, networkAllowed = true) {
    const files = {};
    const fetchOne = (name, meta) => _v3FetchFile(siteId, name, meta, force, staged, networkAllowed)
      .then((text) => { files[name] = text; }, () => { files[name] = null; });
    const jobs = names.map((name) => fetchOne(name, sm[name]));
    if (sharedDict) jobs.push(fetchOne('dict', sharedDict));
    await Promise.all(jobs);
    return files;
  }

  function allFilesReady(names, files, sharedDict) {
    for (const n of names) { if (files[n] == null) return false; }
    return !(sharedDict && files.dict == null);
  }

  // v3 主流程：manifest（24h 缓存）→ 站点文件（缓存优先）→ 应用。
  // 任何一步失败或缺文件均返回 false；调用方保持安全空索引。
  async function _commitV3Bundle(staged, manifest, siteId, commitSnapshot, commitManifest, canPublish) {
    for (const [key, value] of staged) {
      if (!await storeSetAsync(key, value)) return false;
    }
    const value = String(Date.now()) + '\n' + JSON.stringify(manifest);
    if (canPublish && !await canPublish()) return false;
    if (commitSnapshot && !await storeSetAsync('zhx.v3.manifest.' + siteId, value)) {
      return false;
    }
    if (commitManifest && ((canPublish && !await canPublish()) || !await storeSetAsync('zhx.v3.manifest', value))) {
      return false;
    }
    return true;
  }

  function _v3SiteCacheKeys(siteId, manifest) {
    const site = manifest?.sites?.[siteId];
    const entries = Object.entries(site?.files || {});
    entries.push(['itemIds', site?.itemIds], ['dict', manifest?.shared?.dict]);
    return new Set(entries.filter(([, meta]) => meta?.sha256)
      .map(([name, meta]) => v3FileCacheKey(siteId, name, meta.sha256)));
  }

  function _deleteStaleV3Files(siteId, previousManifest, currentManifest, listed = null) {
    const keep = _v3SiteCacheKeys(siteId, currentManifest);
    const prefix = v3FileCachePrefix(siteId);
    const candidates = Array.isArray(listed)
      ? new Set(listed.filter(key => key.startsWith(prefix)))
      : _v3SiteCacheKeys(siteId, previousManifest);
    return Promise.all([...candidates].filter(key => !keep.has(key)).map(key => storeDeleteAsync(key)));
  }

  async function _pruneV3SiteCache(siteId, previousManifest, currentManifest) {
    let listed = null;
    try { listed = await storeListAsync(); } catch (e) { listed = null; }
    await _deleteStaleV3Files(siteId, previousManifest, currentManifest, listed);
  }

  function _manifestSiteFiles(manifest, site, need) {
    const sm = manifest?.sites?.[site.id]?.files;
    if (!sm || typeof sm !== 'object') return null;
    const names = Object.keys(sm);
    const required = requiredV3Files(site);
    if (!names.length || required.some((name) => !sm[name])) return null;
    const sharedDict = (need.includes('dict') && manifest.shared?.dict) || null;
    if (need.includes('dict') && !sharedDict) return null;
    return { sm, names, sharedDict, itemIds: manifest.sites[site.id].itemIds };
  }

  async function _readPreviousV3Manifest(siteId) {
    const [siteSnapshot, globalSnapshot] = await Promise.all([
      readCachedManifest(siteId),
      readCachedManifest(),
    ]);
    const siteSnapshotValid = validV3Manifest(siteSnapshot.man);
    const previous = siteSnapshotValid ? siteSnapshot : globalSnapshot;
    return { siteSnapshot, siteSnapshotValid, globalSnapshot, previous, previousValid: validV3Manifest(previous.man) };
  }

  async function _selectV3Manifest(force, refreshManifest, snapshots) {
    let manifest = await loadManifest(force, refreshManifest);
    const { siteSnapshot, siteSnapshotValid, globalSnapshot } = snapshots;
    const pinnedNewer = siteSnapshotValid && siteSnapshot.manT > globalSnapshot.manT;
    const canUseSiteCache = !force && !_manifestRejected && siteSnapshotValid;
    if (canUseSiteCache && (!manifest || (pinnedNewer && !_manifestNeedsCommit))) manifest = siteSnapshot.man;
    return validV3Manifest(manifest) ? manifest : null;
  }

  async function _readV3Bundle(site, manifest, need, force, staged, networkAllowed) {
    const selected = _manifestSiteFiles(manifest, site, need);
    if (!selected) return null;
    const names = selected.itemIds ? selected.names.filter(name => name !== 'names') : selected.names;
    const [files, identityText] = await Promise.all([
      fetchStationFiles(site.id, names, selected.sm, selected.sharedDict, force, staged, networkAllowed),
      selected.itemIds ? _v3FetchFile(site.id, 'itemIds', selected.itemIds, force, staged, networkAllowed) : null,
    ]);
    if (identityText) files.identity = parseItemIds(identityText);
    if (selected.itemIds && !files.identity)
      files.names = await _v3FetchFile(site.id, 'names', selected.sm.names, force, staged, networkAllowed);
    if (!allFilesReady(files.identity ? names : selected.names, files, selected.sharedDict)) return null;
    files.candidatePolicy = manifest.candidatePolicy;
    return files;
  }

  async function _tryV3Bundle(site, manifest, need, force, staged, networkAllowed, generation = _ensureGeneration) {
    const files = await _readV3Bundle(site, manifest, need, force, staged, networkAllowed);
    if (!files || generation !== _ensureGeneration) return null;
    return _applyV3(files);
  }

  async function _tryV3WithCachedFallback(site, manifest, need, force, snapshots, staged, generation = _ensureGeneration) {
    let loaded = await _tryV3Bundle(site, manifest, need, force, staged, true, generation);
    if (generation !== _ensureGeneration) return { loaded: null, manifest };
    // A cached manifest can outlive files at mutable deployment URLs, or refer
    // to a dictionary rejected by the current reader. Recheck it once now.
    if (!loaded && !force && !_manifestNetworkAttempted) {
      const latest=await fetchManifest();
      if (generation !== _ensureGeneration) return { loaded: null, manifest };
      if (latest) {
        staged.clear();
        manifest=latest;
        loaded=await _tryV3Bundle(site,manifest,need,false,staged,true,generation);
      }
    }
    if (loaded || force || !snapshots.previousValid) return { loaded, manifest, fromSnapshot: false };
    staged.clear();
    loaded = await _tryV3Bundle(site, snapshots.previous.man, need, false, null, false, generation);
    if (!loaded) return { loaded: null, manifest };
    _dlStats.fallback++;
    return { loaded, manifest: snapshots.previous.man, fromSnapshot: true };
  }

  async function _commitV3Selection(siteId, manifest, snapshots, force, staged) {
    const snapshotNewer = snapshots.siteSnapshotValid
      && snapshots.siteSnapshot.manT > snapshots.globalSnapshot.manT;
    const commitSnapshot = force || _manifestNeedsCommit || !snapshots.siteSnapshotValid
      || (!snapshotNewer && snapshots.siteSnapshot.man?.version !== manifest.version);
    const committed = await _commitV3Bundle(staged, manifest, siteId, commitSnapshot, _manifestNeedsCommit);
    if (committed) await _pruneV3SiteCache(siteId, snapshots.previous.man, manifest);
    return committed;
  }

  async function _refreshV3Cache(site, need, snapshots, globalFresh, generation) {
    const manifest = globalFresh ? snapshots.globalSnapshot.man : await _requestV3Manifest();
    if (!manifest || generation !== _ensureGeneration) return;
    const staged = new Map();
    const files = await _readV3Bundle(site, manifest, need, false, staged, true);
    if (!files || generation !== _ensureGeneration || !_validateV3Payload(files)) return;

    // 后台只发布已校验的缓存。手动刷新或其他页面提交新清单后，放弃旧写入。
    const canPublish = async () => {
      if (generation !== _ensureGeneration) return false;
      const current = await _readPreviousV3Manifest(site.id);
      return generation === _ensureGeneration && ['globalSnapshot', 'siteSnapshot'].every(key => {
        const snapshot = current[key];
        const initial = snapshots[key];
        return snapshot.man?.version === manifest.version ||
          (snapshot.manT === initial.manT && snapshot.man?.version === initial.man?.version);
      });
    };
    if (!await _commitV3Bundle(staged, manifest, site.id, true, !globalFresh, canPublish)) return;
    if (!await canPublish()) return;
    // 仅淘汰已知旧清单的文件，避免误删其他页面刚写入的文件。
    await _deleteStaleV3Files(site.id, snapshots.previous.man, manifest);
  }

  function _recordV3Ready(manifest, origin) {
    if (manifest.version) DATA_VER = String(manifest.version);
    _dataLoadOrigin = origin;
    _dataLoadState = 'ready';
    return true;
  }

  async function _tryCachedV3(site, need, snapshots, generation) {
    if (!snapshots.previousValid) return false;
    const globalFresh = _freshV3Manifest(snapshots.globalSnapshot);
    const siteBehind = snapshots.siteSnapshotValid
      && snapshots.siteSnapshot.manT <= snapshots.globalSnapshot.manT
      && snapshots.siteSnapshot.man?.version !== snapshots.globalSnapshot.man?.version;
    const manifest = snapshots.previous.man;
    const cached = await _tryV3Bundle(site, manifest, need, false, null, false, generation);
    if (!cached) return false;

    if (siteBehind) _dlStats.fallback++;
    if (!globalFresh || siteBehind || !snapshots.siteSnapshotValid) {
      void _refreshV3Cache(site, need, snapshots, globalFresh, generation)
        .catch(error => _zhxErr('v3cacheRefresh', error));
    }
    return _recordV3Ready(manifest, siteBehind ? 'fallback' : 'cache');
  }

  async function _ensureTryV3(force = false, refreshManifest = false, generation = _ensureGeneration) {
    const policy = findSite();
    const site = policy?.dataSite ? { ...policy, id: policy.dataSite } : policy;
    if (!site?.id) return false;
    const sourceBefore = { ..._dlStats };
    try {
      const snapshots = await _readPreviousV3Manifest(site.id);
      const need = neededTables();
      if (!force && !refreshManifest && await _tryCachedV3(site, need, snapshots, generation)) return true;
      if (generation !== _ensureGeneration) return false;
      const manifest = await _selectV3Manifest(force, refreshManifest, snapshots);
      if (!manifest || generation !== _ensureGeneration) return false;
      const staged = new Map();
      const result = await _tryV3WithCachedFallback(site, manifest, need, force, snapshots, staged, generation);
      if (!result.loaded || generation !== _ensureGeneration) return false;
      if (!result.fromSnapshot) await _commitV3Selection(site.id, result.manifest, snapshots, force, staged);
      if (generation !== _ensureGeneration) return false;
      let origin = 'cache';
      if (_dlStats.fallback > sourceBefore.fallback) origin = 'fallback';
      else if (_dlStats.net > sourceBefore.net) origin = 'network';
      return _recordV3Ready(result.manifest, origin);
    } catch (e) {
      _zhxErr('v3', e);
      return false;
    }
  }



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
