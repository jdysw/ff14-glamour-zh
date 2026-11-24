import { DATA_BASE_V3 } from '../constants.js';
import { DAY_MS } from '../cache-primitives.js';
import { _zhxErr } from '../runtime.js';
import { findSitePolicy as findSite, neededTables } from '../site-policy.js';
import { httpGet } from './http.js';
import { storeDeleteAsync, storeGetAsync, storeListAsync, storeSetAsync } from './storage.js';
import { requiredV3Files, validV3FileMeta, validV3Manifest } from './v3-contract.js';
import { parseItemIds } from './item-identity.js';
import { validateV3Payload } from './v3-payload.js';

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

function _freshV3Manifest(snapshot) {
  return snapshot.manT > 0 && Date.now() - snapshot.manT < DAY_MS && validV3Manifest(snapshot.man);
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

// 负责清单、内容寻址文件、提交快照及缓存淘汰。索引与就绪状态由调用方持有：
// applyPayload 和 recordReady 是同步回调，代际检查与当前页发布之间不引入等待。
export function createV3Loader({ getGeneration, applyPayload, recordReady }) {
  let _manifestNeedsCommit = false;
  let _manifestRejected = false;
  let _manifestNetworkAttempted = false;
  const _dlStats = { cache: 0, net: 0, fallback: 0 };

  // 清单值为时间戳 + '\n' + JSON，文件值为 SHA-256 + '\n' + 文本。
  const v3FileCachePrefix = (siteId) => 'zhx.v3.f.' + siteId + '.';
  const v3FileCacheKey = (siteId, name, fingerprint) => v3FileCachePrefix(siteId) + name + '.' + fingerprint;

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

  async function fetchManifest() {
    _manifestNetworkAttempted = true;
    _manifestNeedsCommit = false;
    _manifestRejected = false;
    const manifest = await _requestV3Manifest();
    _manifestNeedsCommit = Boolean(manifest);
    _manifestRejected = manifest === false;
    return manifest;
  }

  // 缓存优先 → 必要时网络（站点是否在列由 tryLoad 统一判断）
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

  async function _tryV3Bundle(site, manifest, need, force, staged, networkAllowed, generation = getGeneration()) {
    const files = await _readV3Bundle(site, manifest, need, force, staged, networkAllowed);
    if (!files || generation !== getGeneration()) return null;
    return applyPayload(files);
  }

  async function _tryV3WithCachedFallback(site, manifest, need, force, snapshots, staged, generation = getGeneration()) {
    let loaded = await _tryV3Bundle(site, manifest, need, force, staged, true, generation);
    if (generation !== getGeneration()) return { loaded: null, manifest };
    // A cached manifest can outlive files at mutable deployment URLs, or refer
    // to a dictionary rejected by the current reader. Recheck it once now.
    if (!loaded && !force && !_manifestNetworkAttempted) {
      const latest=await fetchManifest();
      if (generation !== getGeneration()) return { loaded: null, manifest };
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
    if (!manifest || generation !== getGeneration()) return;
    const staged = new Map();
    const files = await _readV3Bundle(site, manifest, need, false, staged, true);
    if (!files || generation !== getGeneration() || !validateV3Payload(files)) return;

    // 后台只发布已校验的缓存。手动刷新或其他页面提交新清单后，放弃旧写入。
    const canPublish = async () => {
      if (generation !== getGeneration()) return false;
      const current = await _readPreviousV3Manifest(site.id);
      return generation === getGeneration() && ['globalSnapshot', 'siteSnapshot'].every(key => {
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
    return recordReady(manifest, siteBehind ? 'fallback' : 'cache');
  }

  async function tryLoad(force = false, refreshManifest = false, generation = getGeneration()) {
    const policy = findSite();
    const site = policy?.dataSite ? { ...policy, id: policy.dataSite } : policy;
    if (!site?.id) return false;
    const sourceBefore = { ..._dlStats };
    try {
      const snapshots = await _readPreviousV3Manifest(site.id);
      const need = neededTables();
      if (!force && !refreshManifest && await _tryCachedV3(site, need, snapshots, generation)) return true;
      if (generation !== getGeneration()) return false;
      const manifest = await _selectV3Manifest(force, refreshManifest, snapshots);
      if (!manifest || generation !== getGeneration()) return false;
      const staged = new Map();
      const result = await _tryV3WithCachedFallback(site, manifest, need, force, snapshots, staged, generation);
      if (!result.loaded || generation !== getGeneration()) return false;
      if (!result.fromSnapshot) await _commitV3Selection(site.id, result.manifest, snapshots, force, staged);
      if (generation !== getGeneration()) return false;
      let origin = 'cache';
      if (_dlStats.fallback > sourceBefore.fallback) origin = 'fallback';
      else if (_dlStats.net > sourceBefore.net) origin = 'network';
      return recordReady(result.manifest, origin);
    } catch (e) {
      _zhxErr('v3', e);
      return false;
    }
  }

  return { tryLoad, stats: _dlStats };
}
