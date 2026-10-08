/* @phase15-module-order:core/data-manager */
/* @phase15-order-link:core/data-manager<-core/constants */
import { DATA_BASE, DATA_BASE_V3, DATA_FILES } from './constants.js';
import { DAY_MS, META_KEY, _lcs90, _readCachedTable, _writeCachedTable, cacheReset } from './cache.js';
import { applyRuntimeDict } from './dictionary.js';
import { httpGet } from './http.js';
import { tryEnToZh } from './item-resolver.js';
import { __zhxMark } from './probe.js';
import { _zhxErr } from './runtime.js';
import { _siteIndexes, findSite, neededTables } from './site-registry.js';
import { storeGetAsync, storeSet } from './storage.js';
export { DATA_TEXT, DATA_VER, _applyV3, _btApplyTargets, _btHashRow, _btNamePut, _btNameRow, _btNext, _btRow, _btStep, _btTargets, _dlStats, _ensureFetchAll, _ensureFetchTable, _ensureFinalize, _ensureMain, _ensurePromise, _ensureReadLocal, _ensureTryFast, _ensureTryV3, _fireTablesReady, _irBuildAux, _irRegAlias, _irRegDup, _irScanLine, _irStats, _readyCbs, _tablesReady, _v3Applied, _v3FetchFile, _v3Pairs, _waitPageLoad, allFilesReady, applyTable, buildTables, dataGetIndex, dataGetTable, dataInvalidate, dataManager, ensureTables, fetchManifest, fetchStationFiles, itemDbReady, loadManifest, onTablesReady, readCachedManifest, resolve, resolveAlias, resolveAllByName, resolveByHash, resolveByName, resolveByZh, resolvePartialByZh, suggestByZh, resolveEcId, resolveKo };


  /* ── 数据就绪广播（外置版 / 内嵌版共用）────────────────────────────
     外置版：数据异步到达并建表后触发；内嵌版：建表完成时触发。
     需要等数据就绪的补扫 / 刷新，通过 onTablesReady(fn) 登记。 */
  // 数据版本（外置版由加载器在版本清单到达后赋值；内嵌版保持空 = 随脚本版本）
  let DATA_VER = ''; // NOSONAR — 数据版本由远程 manifest 生命周期更新

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
  let ITEM_DB_TEXT = '';
  let SERIES_TEXT = '';
  let ACL_CFC_TEXT = '';
  const DATA_TEXT = {
    get items() { return ITEM_DB_TEXT; },
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

  // v1.2.x：单行解析拆出（降认知复杂度）；v1.3：按需写目标索引 + 染剂候选顺手收集
  function _btHashRow(p, zh, t) {
    if (p[0] === '-') return;
    if (t.itemHash && p[5] && t.itemHash[p[5]] === undefined) t.itemHash[p[5]] = zh;   // hash -> 中文名
    if (t.ecidMap && p[6] && t.ecidMap[zh] === undefined) t.ecidMap[zh] = p[6];       // 中文名 -> EC_ID
  }

  // 写入一个名字键；成功写入且形如「Xxx Dye」时顺手收集（构建后统一补开）
  function _btNamePut(nm, key, zh, dye) {
    if (!nm || !key || nm[key] !== undefined) return;
    nm[key] = zh;
    if (dye && key.length > 4 && key.endsWith(' Dye')) dye.push(key);
  }

  function _btNameRow(zh, en, ja, ko, t) {
    _btNamePut(t.nameMap, en, zh, t.dye);
    _btNamePut(t.nameMap, ja, zh, t.dye);
    _btNamePut(t.nameMap, ko, zh, t.dye);
    if (t.koByZh && zh && ko && t.koByZh[zh] === undefined) t.koByZh[zh] = ko;
  }

  function _btRow(ln, t) {
    const c0 = ln.codePointAt(0);
    if (c0 !== 45 && (c0 < 48 || c0 > 57)) return;   // 仅「数字」或「-」开头的行（跳过表头）
    const p = ln.split('\t');
    if (p.length < 5) return;
    const zh = p[1] || '', en = p[2] || '', ja = p[3] || '', ko = p[4] || '';
    _btHashRow(p, zh, t);
    _btNameRow(zh, en, ja, ko, t);
  }

  // 构建目标：按站裁剪所需索引（scope 为 null 时全建——未知站点/测试环境），
  // 并携带染剂候选缓冲（构建中顺手收集，替代原先对 nameMap 十余万键的全量扫描）
  function _btTargets(scope) {
    const pick = (k) => !scope || scope.includes(k);
    return {
      itemHash: pick('itemHash') ? {} : null,
      ecidMap: pick('ecidMap') ? {} : null,
      nameMap: pick('nameMap') ? {} : null,
      koByZh: pick('koByZh') ? {} : null,
      dye: [],
    };
  }

  /* v1.3 分片构建：每片目标 ≤8ms 后让出主线程，避免移动端主线程被连续阻塞
     1-2 秒（页面渲染/交互停顿、圈圈转不出）。构建在局部对象上完成，全部完成
     前各查表函数仍拿到 null（静默跳过）——与原同步版语义一致；完成后一次性
     赋值 + 染剂回退 + 回调。
     v1.3.1：让出改用 MessageChannel（嵌套 setTimeout 到第 5 级后每级被浏览器
     钳 +4~8ms，MC 恒定 ~0.2ms；创建失败或运行异常时回退分片 setTimeout）。 */
  function buildTables(scope, done) {
    const st = { i: 0, mc: null, done: done, t: _btTargets(scope), lines: ITEM_DB_TEXT.split('\n') };
    try {
      const m = new MessageChannel();
      m.port2.onmessage = () => _btStep(st);
      st.mc = m;
    } catch (e) {
      // 忽略：MessageChannel 不可用（旧环境/异常）——mc 保持 null，回退分片 setTimeout 让出
    }
    _btStep(st);
  }
  // 分片让出调度：MC 优先（~0.2ms/级），端口失效则置空并改走 setTimeout
  function _btNext(st) {
    if (st.mc) {
      let ok = false;
      try { st.mc.port1.postMessage(0); ok = true; } catch (e) { /* 忽略：MC 端口失效——置空后改走 setTimeout */ }
      if (ok) return;
      st.mc = null;
    }
    setTimeout(() => _btStep(st), 0);
  }
  // 单片构建：≤8ms 或 ≤250 行后让出
  function _btStep(st) {
    try {
      const deadline = Date.now() + 8;
      while (st.i < st.lines.length) {
        const end = Math.min(st.i + 250, st.lines.length);
        while (st.i < end) {
          const ln = st.lines[st.i++];
          if (ln) _btRow(ln, st.t);
        }
        if (Date.now() >= deadline) break;
      }
    } catch (e) { /* 忽略：单行解析失败不阻断（尽力构建） */ }
    if (st.i < st.lines.length) { _btNext(st); return; }
    _btApplyTargets(st.t);
    if (typeof st.done === 'function') { try { st.done(); } catch (e) { /* 忽略：完成回调异常不上抛 */ } }
  }
  // 构建收尾：染剂色名回退 + 一次性赋值索引
  function _btApplyTargets(t) {
    try {
      // 染剂色名回退（顺手收集版）：「Xxx Dye → 中文名」补开「Xxx → 中文名」
      if (t.nameMap && t.dye.length) {
        for (const key of t.dye) {
          const base = key.slice(0, -4);
          if (t.nameMap[base] === undefined) t.nameMap[base] = t.nameMap[key];
        }
      }
      _replaceMap(itemHash, t.itemHash); _replaceMap(ecidMap, t.ecidMap); _replaceMap(nameMap, t.nameMap); _replaceMap(koByZh, t.koByZh);
    } catch (e) { /* 忽略：构建收尾 best-effort */ }
  }

  function applyTable(name, txt) {
    if (typeof txt !== 'string' || !txt) return;
    switch (name) {
      case 'items':  ITEM_DB_TEXT = txt; break;        // 物品总表（8 列，制表符分隔）
      case 'series': SERIES_TEXT = '\n' + txt; break;  // 行首锚定查找需要前导换行
      case 'acl':    ACL_CFC_TEXT = '\n' + txt; break;
      case 'dict':   applyRuntimeDict(txt); break;     // 词库运行时合并（v1.2.0）
    }
  }

  /* @zhixia:core-data-manager-start */
  /* ── Core Data Manager（v1.4 Phase 11）：远程数据 + 版本 + 缓存 + 重试 +
       ready + fallback 的集中管理。既有链路行为逐字保留（ensureTables /
       itemDbReady / onTablesReady 均为原语义）；对外的 dataManager 对象
       提供统一 API：ensure / ready / getTable / getIndex / invalidate。
       缓存与版本探测契约见 Core Cache（段1/2）；Phase 15 模块化构建时，
       本区段将原样抽出为 src/core/data-manager.js。 */
  let _ensurePromise = null; // NOSONAR — ensure 生命周期 promise 可被 invalidate 重置
  // v1.2.x：局部缓存读取与单表拉取拆出（降认知复杂度）
  // Phase 19：数据来源统计（cache=本地缓存交付 / net=网络下载交付 / fallback=下载失败旧缓存兜底）
  const _dlStats = { cache: 0, net: 0, fallback: 0 };
  function _ensureReadLocal(need) {
    const local = {};
    return Promise.all(need.map((t) => _readCachedTable(t).then((c) => { if (c) local[t] = c; }, () => {}))).then(() => local);
  }

  async function _ensureFetchTable(t, vfps, local) {
    const fp = vfps?.[t] ? String(vfps[t]) : null;
    const cached = local[t] || null;
    if (fp && cached?.fp === fp) { applyTable(t, cached.tx); _dlStats.cache++; return 1; }
    if (!fp && cached) { applyTable(t, cached.tx); _dlStats.cache++; return 1; }   // 无版本信息时不盲刷
    let txt = null;
    try { txt = await httpGet(DATA_BASE + DATA_FILES[t], 25000); }
    catch (e) { txt = null; _zhxErr('fetch:' + t, e); }
    const fmtOk = (t === 'dict') ? (txt?.charAt(0) === '{') : (txt && (txt.includes('\t') || txt.includes('|')));
    if (txt && txt.length > 100 && fmtOk) {
      applyTable(t, txt);
      _writeCachedTable(t, fp, txt);
      _dlStats.net++;
      return 1;
    }
    if (cached) { applyTable(t, cached.tx); _dlStats.fallback++; return 1; }   // 下载失败 → 兜底旧缓存
    return 0;
  }

  // v1.2.x：主体抽为具名函数（匿名 IIFE 会把复杂度并入 ensureTables 度量）
  // ① 读本地缓存；「缓存齐全 + 24 小时内已对齐版本」则零网络直接用
  async function _ensureTryFast(need) {
    const local = await _ensureReadLocal(need);
    __zhxMark('readEnd');   // Phase 19：本地读取结束
    let meta = null;
    try { const s = await storeGetAsync(META_KEY); meta = s ? JSON.parse(s) : null; } catch (e) { /* 忽略：元数据读取失败按无缓存处理（meta 保持 null） */ }
    const fresh = !!(meta?.t && (Date.now() - meta.t < DAY_MS));
    const allCached = need.every((t) => !!local[t]);
    if (!allCached || !fresh) return { local };
    for (const t of need) applyTable(t, local[t].tx);
    DATA_VER = (meta.v ? String(meta.v) : '');
    _dlStats.cache += need.length;
    __zhxMark('applied');   // Phase 19：缓存文本应用完成
    return null;
  }

  // ②③④ 版本清单 + 逐表拉取（指纹一致→缓存；不一致/缺失→下载，失败回退旧缓存）+ 记录检查时间
  async function _ensureFetchAll(need, local) {
    let ver = null;
    try { ver = JSON.parse(await httpGet(DATA_BASE + 'version.json', 10000)); } catch (e) { ver = null; _zhxErr('version', e); }
    const vfps = (ver?.files && typeof ver.files === 'object') ? ver.files : null;
    let okCount = 0;
    (await Promise.all(need.map((t) => _ensureFetchTable(t, vfps, local).catch((e) => { _zhxErr('table:' + t, e); return 0; })))).forEach((v) => { okCount += v; });
    if (ver?.v) DATA_VER = String(ver.v);
    __zhxMark('applied');   // Phase 19：表格拉取/应用完成
    if (ver && okCount === need.length) {
      storeSet(META_KEY, JSON.stringify({ v: (ver.v ? String(ver.v) : ''), t: Date.now() }));
    }
  }

  // ⑤ 建表 + 广播（无论成败：页面按可用数据尽力工作，界面词不受影响）
  // v1.3：buildTables 改分片（回调式）——分片全部完成后才广播就绪
  function _ensureFinalize() {
    __zhxMark('finalize');
    return new Promise((resolve) => {
      const go = () => {
        __zhxMark('buildStart');
        const finish = () => {
          __zhxMark('buildEnd');
          try { _fireTablesReady(); } catch (e) { _zhxErr('fireReady', e); }
          __zhxMark('ready');
          try {
            console.info('幻化数据就绪 → 物品表 ' + (ITEM_DB_TEXT ? ITEM_DB_TEXT.length : 0)
              + ' / 系列表 ' + (SERIES_TEXT ? SERIES_TEXT.length : 0)
              + ' / 副本表 ' + (ACL_CFC_TEXT ? ACL_CFC_TEXT.length : 0)
              + ' / 数据版本 ' + (DATA_VER || '未记录'));
          } catch (e) { /* 忽略：日志输出失败不影响就绪 */ }
          resolve();
        };
        if (_v3Applied) { finish(); return; }   // v3：索引已直接就绪，跳过 v2 建表
        buildTables(_buildScope, finish);
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 500 }); // v1.3.1：兜底 2000→500，消除静止页面等满 2s 的最坏情况
      else setTimeout(go, 50);
    });
  }

  // 首屏优先：网络下载推迟到页面 load 之后（弱网/移动端避免与页面自身资源抢带宽，
  // 缓解页面图片流被饿死/加载缓慢；缓存命中路径不受影响），最长兜底等待 12s，
  // 防 load 迟迟不触发时数据永不拉取。
  function _waitPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') { resolve(); return; }
      let done = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      try { window.addEventListener('load', fin, { once: true }); } catch (e) { /* 兜底计时器保底 */ }
      setTimeout(fin, 12000);
    });
  }

  let _buildScope = null;   // 本页索引构建范围（按站裁剪；null = 全建） // NOSONAR

  // ── Runtime Data v3（v1.4 Phase 12）：按站最小数据 + manifest ——
  // 加载顺序：v3 →（失败 / schema 不兼容）→ v2 → 缓存 / 内嵌 fallback。
  // v3 文件清单/格式由 build/make-runtime-data.py 生成（生成器侧已完成首行胜、
  // 染剂回退展开、'-' 行跳过等语义等价处理；此处直接建索引一次赋值）。
  // 缓存：manifest（zhx.v3.manifest = t + '\n' + 原文）；文件（zhx.v3.f.<site>.<name>
  // = sha256 + '\n' + 文本）。sha256 校验在 crypto.subtle 可用时执行，不可用不阻塞。
  let _v3Applied = false; // NOSONAR — v3 数据应用状态按加载结果更新

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

  // v3 数据应用（一次性赋值——与 v2 构建收尾同语义；'_' 前缀变量跨段引用见 IIFE 说明）
  function _applyV3(files) {
    // 取值包装拆为局部函数（仅降复杂度；取值顺序与语义不变）
    const take = (key, multi) => (files[key] ? _v3Pairs(files[key], multi) : null);
    try {
      const names = take('names');
      const hash = take('hash');
      const ecid = take('ecid');
      const ko = take('ko');
      const ali = take('alias', true);
      const dup = take('dup', true);
      if (names) _replaceMap(nameMap, names);
      if (hash) _replaceMap(itemHash, hash);
      _irSearchByZh = null;
      _irSearchKind = null;
      _irSearchCanonicalKeys = null;
      _irSearchAliasKeys = null;
      if (ecid) _replaceMap(ecidMap, ecid);
      if (ko) _replaceMap(koByZh, ko);
      if (ali) _irAliasMap = ali;
      if (dup) _irDupMap = dup;
      if (files.series) SERIES_TEXT = '\n' + files.series;
      if (files.acl) ACL_CFC_TEXT = '\n' + files.acl;
      if (files.dict) applyRuntimeDict(files.dict);
      _v3Applied = true;
      return true;
    } catch (e) {
      _zhxErr('v3apply', e);
      return false;
    }
  }

  // v3 单文件获取：缓存命中且 sha 一致直接用；否则下载 + sha 校验 + 写缓存
  async function _v3FetchFile(siteId, name, meta) {
    if (!meta?.url) return null;
    const ck = 'zhx.v3.f.' + siteId + '.' + name;
    try {
      const raw = await storeGetAsync(ck);
      if (raw) {
        const i = raw.indexOf('\n');
        if (i > 0 && raw.slice(0, i) === meta.sha256) return raw.slice(i + 1);
      }
    } catch (e) { /* 忽略：缓存读取失败走网络 */ }
    let txt = null;
    try { txt = await httpGet(DATA_BASE_V3 + meta.url, 25000); } catch (e) { txt = null; }
    if (typeof txt !== 'string' || !txt) return null;
    try {
      if (meta.sha256 && typeof crypto !== 'undefined' && crypto?.subtle && typeof TextEncoder === 'function') {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
        const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        if (hex !== meta.sha256) return null;
      }
    } catch (e) { /* 忽略：校验不可用/失败不阻塞（下载成功即可用） */ }
    try { storeSet(ck, meta.sha256 + '\n' + txt); } catch (e) { /* 忽略：缓存写入失败不影响本次使用 */ }
    return txt;
  }

  // v3 manifest 读取链（PR#16 审查：自 _ensureTryV3 提升为模块级，纯 IO 无外部捕获）。
  // 缓存 manifest 读取（读取/解析失败视为无缓存；返回 {manT, man}）
  async function readCachedManifest() {
    try {
      const mraw = await storeGetAsync('zhx.v3.manifest');
      if (mraw) {
        const i = mraw.indexOf('\n');
        if (i > 0) return { manT: Number(mraw.slice(0, i)) || 0, man: JSON.parse(mraw.slice(i + 1)) };
      }
    } catch (e) { _zhxErr('v3manifest', e); }
    return { manT: 0, man: null };
  }

  // 网络刷新 manifest（每日至多一次探测路径；失败返回 null）
  async function fetchManifest() {
    let txt = null;
    try { txt = await httpGet(DATA_BASE_V3 + 'manifest.json', 10000); } catch (e) { txt = null; }
    if (typeof txt !== 'string' || !txt) return null;
    try {
      const m2 = JSON.parse(txt);
      if (m2?.schema === 3 && m2.sites) {
        const manT = Date.now();
        try { storeSet('zhx.v3.manifest', String(manT) + '\n' + txt); } catch (e) { /* 忽略：缓存写入失败不影响本次使用 */ }
        return m2;
      }
    } catch (e) { /* 忽略：manifest 解析失败 → 回退 v2 */ }
    return null;
  }

  // 缓存优先 → 必要时网络（站点是否在列由 _ensureTryV3 统一判断）
  async function loadManifest() {
    const c = await readCachedManifest();
    const fresh = !!(c.manT && (Date.now() - c.manT < DAY_MS));
    if (c.man && fresh && c.man.schema === 3 && c.man.sites) return c.man;
    return await fetchManifest();
  }

  // 站点文件并行获取（含共享词库）
  async function fetchStationFiles(siteId, names, sm, sharedDict) {
    const files = {};
    const jobs = names.map((n) => _v3FetchFile(siteId, n, sm[n])
      .then((t) => { files[n] = t; }, () => { files[n] = null; }));
    if (sharedDict) {
      jobs.push(_v3FetchFile(siteId, 'dict', sharedDict)
        .then((t) => { files.dict = t; }, () => { files.dict = null; }));
    }
    await Promise.all(jobs);
    return files;
  }

  function allFilesReady(names, files, sharedDict) {
    for (const n of names) { if (files[n] == null) return false; }
    return !(sharedDict && files.dict == null);
  }

  // v3 主流程：manifest（24h 缓存）→ 站点文件（缓存优先）→ 应用。
  // 任何一步失败/缺文件 → false（调用方回退 v2，不改变现有行为）。
  async function _ensureTryV3() {
    const site = findSite();
    if (!site?.id) return false;
    try {
      const man = await loadManifest();
      if (!man?.sites?.[site.id]) return false;
      const sm = man.sites[site.id].files || {};
      const names = Object.keys(sm);
      if (!names.length) return false;
      const need = neededTables();
      // 共享词库（manifest.shared.dict；neededTables 含 dict 的站点拉取）
      const sharedDict = (need.includes('dict') && man.shared?.dict) || null;
      const files = await fetchStationFiles(site.id, names, sm, sharedDict);
      if (!allFilesReady(names, files, sharedDict)) return false;
      if (!_applyV3(files)) return false;
      try { if (man.version) DATA_VER = String(man.version); } catch (e) { /* 忽略 */ }
      return true;
    } catch (e) {
      _zhxErr('v3', e);
      return false;
    }
  }

  async function _ensureMain() {
    const need = neededTables();
    if (!need.length) return;
    _buildScope = _siteIndexes();
    // v3 优先：成功即返回（_ensureFinalize 将跳过 v2 建表）；失败 → 现有 v2 链
    const v3 = await _ensureTryV3();
    if (v3) return;
    const fast = await _ensureTryFast(need);
    if (!fast) return;
    await _waitPageLoad();
    await _ensureFetchAll(need, fast.local);
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
      case 'items': return ITEM_DB_TEXT || null;
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
    // 失效就绪状态：下次 ensure 重新探测版本（表缓存不删除——旧缓存仍可兜底复用）
    _ensurePromise = null;
    DATA_VER = '';
    try { storeSet(META_KEY, ''); } catch (e) { /* 忽略：元数据清除失败不影响主流程 */ }
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

  function _irSearchLocaleIndex() {
    const id = findSite()?.id;
    if (id === 'ec') return 2; // en
    if (id === 'ronka') return 4; // ko
    if (id === 'mirapri' || id === 'fc' || id === 'collection') return 3; // ja
    return null;
  }

  function _irBuildSearchFromNames(names, ali) {
    const out = Object.create(null);
    const kind = Object.create(null);
    for (const [native, zh] of Object.entries(names || {})) _irSearchPut(out, zh, native, 0, kind);
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

  function _irBuildSearchAliases(out, aliasText, native, kind) {
    if (!aliasText) return;
    for (const part of aliasText.split('；')) {
      const alias = part.trim();
      if (/^[\u3400-\u9fff]/.test(alias)) _irSearchPut(out, alias, native, 1, kind);
    }
  }

  function _irBuildSearchFromText(text) {
    const out = Object.create(null);
    const kind = Object.create(null);
    const localeIndex = _irSearchLocaleIndex();
    if (!localeIndex || typeof text !== 'string' || !text) return { map: out, kind };
    for (const ln of text.split('\n')) {
      const c0 = ln.codePointAt(0);
      if (c0 !== 45 && (c0 < 48 || c0 > 57)) continue;
      const p = ln.split('\t');
      if (p.length < 5 || !p[1] || !p[localeIndex]) continue;
      const native = p[localeIndex];
      _irSearchPut(out, p[1], native, 0, kind);
      _irBuildSearchAliases(out, p[7], native, kind);
    }
    return { map: out, kind };
  }

  // 从物品总表建立衍生注册表（重名 / 别名）。须在 nameMap 就绪后调用（itemDbReady 钩子）；
  // 未就绪或异常时保持/回退 null——所有查询路径对空表安全（等同主索引既有行为）。
  function _irBuildAux(text) {
    if (_v3Applied) {
      // v3 已直接拿到按站裁剪后的 names/alias；首次调用时倒排为中文搜索索引。
      if (_irSearchByZh === null) {
        const built = _irBuildSearchFromNames(nameMap, _irAliasMap);
        _irSearchByZh = built.map;
        _irSearchKind = built.kind;
        _irSearchCanonicalKeys = null;
        _irSearchAliasKeys = null;
      }
      return true;
    }
    if (!_tablesReady || typeof text !== 'string' || !text) return false;
    const dup = Object.create(null);
    const ali = Object.create(null);
    for (const ln of text.split('\n')) {
      _irScanLine(ln, dup, ali);
    }
    _irDupMap = dup;
    _irAliasMap = ali;
    const built = _irBuildSearchFromText(text);
    _irSearchByZh = built.map;
    _irSearchKind = built.kind;
    _irSearchCanonicalKeys = null;
    _irSearchAliasKeys = null;
    return true;
  }

  // 单行扫描：登记重名（同键多译）与别名（alias 列以全角分号拆分）
  function _irScanLine(ln, dup, ali) {
    const c0 = ln.codePointAt(0);
    if (c0 !== 45 && (c0 < 48 || c0 > 57)) return;   // 仅「数字」或「-」开头（与构建器同规则，跳过表头）
    const p = ln.split('\t');
    if (!p[1]) return;
    const zh = p[1];
    for (let ci = 2; ci <= 4 && ci < p.length; ci++) {
      _irRegDup(p[ci], zh, dup);
    }
    if (p.length > 7 && p[7]) {
      for (const part of p[7].split('；')) {
        const a = part.trim();
        if (a) _irRegAlias(a, zh, ali);
      }
    }
  }

  // 登记重名键（仅「同键多译」；同名同译的直接跳过）
  function _irRegDup(k, zh, dup) {
    if (!k) return;
    const cur = nameMap[k];
    if (cur === undefined || cur === zh) return;
    const d = dup[k] || (dup[k] = [cur]);
    if (!d.includes(zh)) d.push(zh);
  }

  // 登记别名（1 别名 → 多 zh，按行序）
  function _irRegAlias(a, zh, ali) {
    const d = ali[a] || (ali[a] = []);
    if (!d.includes(zh)) d.push(zh);
  }

  // 解析统计（v1.4 Phase 10：Probe 读取——整数自增，无行为影响）
  const _irStats = { hit: 0, miss: 0 };
  function resolveByHash(hash) { const z = (hash && itemHash?.[hash]) ? itemHash[hash] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
  function resolveByName(name) { const z = (name && nameMap?.[name]) ? nameMap[name] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
  function resolveByZh(zh) {
    const key = _irNormZhSearch(zh);
    const z = (key && _irSearchByZh?.[key]) ? _irSearchByZh[key] : null;
    _irStats[z ? 'hit' : 'miss']++;
    return z;
  }

  // v1.4.2 后续：部分词解析（完整名失败时兜底）——子串收集 + 公共子串提取（复用系列名推导 _lcs90 经验）。
  // 场景：「女仆」→ 收集所有含「女仆」的中文名 → 提取原生名（按站裁剪）的公共子串「メイド」→ 交给站内部分匹配搜索。
  // 提取不到公共子串（各族原生名互异）时返回 null，保持「不转换」原行为。
  function resolvePartialByZh(zh) {
    const key = _irNormZhSearch(zh);
    if (key.length < 2 || !/[\u3400-\u9fff]/u.test(key)) return null;
    const map = _irSearchByZh;
    if (!map) return null;
    const natives = [];
    for (const kind of [0, 1]) {
      for (const k of _getIrSearchKeysByKind(kind)) {
        if (k === key || !k.includes(key)) continue;
        const native = map[k];
        if (native) natives.push(native);
        if (natives.length > 1000) break;
      }
      if (natives.length > 1000) break;
    }
    let z = null;
    if (natives.length === 1) z = natives[0];
    else if (natives.length > 1) z = _lcs90(natives);
    _irStats[z ? 'hit' : 'miss']++;
    return z;
  }

  // 智能输入候选的防御性上限：实测当前数据最大前缀组 2450 条（「改良」）；
  // 3 千条兜底，防止病态输入把候选列表渲染到卡顿（正常输入远低于此）。
  const SUGGEST_ABS_MAX = 3000;
  // 智能输入候选：默认（未传 / <= 0）返回全部匹配——「显示所有含输入字的装备」；
  // 显式传正数 limit 时按上限截断（保留给调用方按需限流的语义）。
  function suggestByZh(zh, limit = 0) {
    const key = _irNormZhSearch(zh);
    if (key.length < 2 || !/[\u3400-\u9fff]/u.test(key)) return [];
    const map = _irSearchByZh;
    if (!map) return [];
    const raw = Number(limit);
    const max = Number.isFinite(raw) && raw > 0 ? Math.min(raw, SUGGEST_ABS_MAX) : SUGGEST_ABS_MAX;
    const out = [];
    const exact = map[key];
    if (exact) out.push({ zh: key, native: exact });

    const canonical = [];
    _irSearchCollectPrefix(_getIrSearchKeysByKind(0), key, max, canonical, exact ? key : '');
    for (const candidate of canonical) out.push({ zh: candidate, native: map[candidate] });
    if (out.length < max) {
      const aliases = [];
      _irSearchCollectPrefix(_getIrSearchKeysByKind(1), key, max - out.length, aliases, exact ? key : '');
      for (const candidate of aliases) out.push({ zh: candidate, native: map[candidate] });
    }
    return out.slice(0, max);
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
