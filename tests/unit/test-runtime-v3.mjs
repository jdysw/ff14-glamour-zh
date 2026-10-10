// tests/unit/test-runtime-v3.mjs — Phase 12：Runtime Data v3（生成器产物 + v3-only 运行时加载）
//
// 目的：
//   A. 校验 build/make-runtime-data.py 的产物（data/v3/）：manifest 结构、
//      逐文件 sha256/bytes、names 去重与染剂回退、站点清单、Phase 13 语言裁剪
//      （各站 names/dup 仅含其翻译链语言：ja 表无韩文、en 表无韩文/假名、ko 表无假名）。
//   B. 用桩装配 data-manager 段，钉死 v3 加载路径：成功应用（含缓存写入）、
//      离线快路径、manifest/schema/hash 失败时安全空索引且无旧数据请求，
//      强制迁移、每站 manifest 快照、ready 广播与内容寻址缓存。
//
// 机制：同 test-data-manager.mjs——从 dist 提取区段以桩装配，不依赖 Chrome / 外网。
//
// 运行：node tests/unit/test-runtime-v3.mjs
import { readDist } from '../helpers/paths.mjs';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};
const eq = (name, actual, expected) => ok(name, actual === expected,
  `实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`);

const ROOT = new URL('../../', import.meta.url);
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

// 每次测试都从当前源码生成独立 V3 fixture，避免复用旧 data/v3 产物。
const tmp = mkdtempSync(join(tmpdir(), 'zhx-v3-test-'));
execFileSync('python3', ['build/make-runtime-data.py', '--out', tmp],
  { cwd: fileURLToPath(ROOT), stdio: 'pipe' });
process.once('exit', () => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });
const V3_DIR = new URL('file://' + tmp + '/');

// ══════════ A. 生成器产物校验 ══════════
console.log('\n── A. 生成器产物（data/v3/）──');

const manifestPath = new URL('manifest.json', V3_DIR);
ok('A1 manifest.json 存在', existsSync(manifestPath));
const man = JSON.parse(readFileSync(manifestPath, 'utf8'));
eq('A2 schema=3', man.schema, 3);
eq('A2b candidatePolicy=1', man.candidatePolicy, 1);
ok('A3 version 为 12 位 hex', /^[0-9a-f]{12}$/.test(man.version || ''), `version=${man.version}`);
ok('A4 generated 为 ISO 时间', /^\d{4}-\d{2}-\d{2}T/.test(man.generated || ''));
ok('A5 shared.dict 存在', !!(man.shared && man.shared.dict && man.shared.dict.url === 'dict.json'));

const SITE_NAMES = ['mirapri', 'ec', 'fc', 'ronka', 'collection', 'wiki', 'endcloset'];
eq('A6 七站齐备', Object.keys(man.sites || {}).sort().join(','), [...SITE_NAMES].sort().join(','));

// 逐文件 sha256/bytes 全量校验
let fileCount = 0; let badSha = 0; let badBytes = 0;
for (const site of SITE_NAMES) {
  const files = (man.sites[site] || {}).files || {};
  for (const [name, meta] of Object.entries(files)) {
    fileCount++;
    const p = new URL(meta.url, V3_DIR);
    if (!existsSync(p)) { badSha++; continue; }
    const buf = readFileSync(p);
    if (sha256(buf) !== meta.sha256) badSha++;
    if (buf.length !== meta.bytes) badBytes++;
  }
}
ok(`A7 逐文件 sha256 校验（${fileCount} 个文件）`, badSha === 0, `不一致 ${badSha}`);
ok('A8 逐文件 bytes 校验', badBytes === 0, `不一致 ${badBytes}`);

// shared dict 校验
{
  const p = new URL(man.shared.dict.url, V3_DIR);
  ok('A9 dict.json 存在且 sha 一致', existsSync(p) && sha256(readFileSync(p)) === man.shared.dict.sha256);
}

// names：无重复键 + 行数合理 + 染剂回退展开
{
  const txt = readFileSync(new URL('mirapri/names.tsv', V3_DIR), 'utf8');
  const lines = txt.trim().split('\n');
  ok('A10 names 行数约 50k（Phase 13 裁剪后）', lines.length > 45000 && lines.length < 55000, `行数=${lines.length}`);
  const seen = new Set(); let dupKey = 0; let fmt = 0;
  for (const ln of lines) {
    const i = ln.indexOf('\t');
    if (i <= 0) { fmt++; continue; }
    const k = ln.slice(0, i);
    if (seen.has(k)) dupKey++;
    else seen.add(k);
  }
  eq('A11 names 无重复键（生成器已首行胜）', dupKey, 0);
  eq('A12 names 行格式均为「键\\tzh」', fmt, 0);
  // 染剂回退（en 表验证；Phase 13：Dye 键只存在于 en 语言表）
  const ecTxt = readFileSync(new URL('ec/names.tsv', V3_DIR), 'utf8');
  const ecLines = ecTxt.trim().split('\n');
  const ecSeen = new Set(ecLines.filter((l) => l.indexOf('\t') > 0).map((l) => l.slice(0, l.indexOf('\t'))));
  let ecFound = 0; let ecChecked = 0; let ecBad = 0;
  for (const ln of ecLines) {
    const i = ln.indexOf('\t');
    if (i <= 0) continue;
    const k = ln.slice(0, i);
    if (k.endsWith(' Dye') && k.length > 4) {
      ecFound++;
      if (ecChecked < 5) {
        ecChecked++;
        const base = k.slice(0, -4);
        if (!ecSeen.has(base)) ecBad++;
        else {
          const got = ecLines.find((l) => l.startsWith(base + '\t'));
          if (got && got.slice(base.length + 1) !== ln.slice(i + 1)) ecBad++;
        }
      }
    }
  }
  ok('A13 染剂回退展开正确（ec/en 表）', ecFound > 0 && ecChecked > 0 && ecBad === 0,
    `found=${ecFound} checked=${ecChecked} bad=${ecBad}`);
}

// End Closet can display equipment names in Korean, English, or Japanese.
{
  const names = new Map(readFileSync(new URL('endcloset/names.tsv', V3_DIR), 'utf8')
    .split('\n').filter(Boolean).map((line) => line.split('\t').slice(0, 2)));
  const items = readFileSync(new URL('data/ff14-items.tsv', ROOT), 'utf8');
  const item = items.split('\n').map((line) => line.split('\t'))
    .find((row) => row[1] === '女仆围裙装');
  ok('End Closet 真实装备含韩英日三个名称映射', !!item
    && [item[4], item[2], item[3]].every((name) => names.get(name) === item[1]));
}

// wiki 两文件
{
  const ecid = readFileSync(new URL('wiki/ecid.tsv', V3_DIR), 'utf8').trim().split('\n');
  const ko = readFileSync(new URL('wiki/ko.tsv', V3_DIR), 'utf8').trim().split('\n');
  ok('A14 wiki/ecid.tsv 行数 > 20000', ecid.length > 20000, `行数=${ecid.length}`);
  ok('A15 wiki/ko.tsv 行数 > 40000', ko.length > 40000, `行数=${ko.length}`);
}

// alias 行数（23；全站一致）与 dup 行数（13；ja 语言裁剪）
{
  const ali = readFileSync(new URL('mirapri/alias.tsv', V3_DIR), 'utf8').trim().split('\n');
  const dup = readFileSync(new URL('mirapri/dup.tsv', V3_DIR), 'utf8').trim().split('\n');
  eq('A16 alias.tsv 行数 = 23', ali.length, 23);
  eq('A17 dup.tsv 行数 = 13（ja 语言裁剪）', dup.length, 13);
}

// Phase 13 语言裁剪：各站 names 仅含其翻译链语言；dup 同步裁剪
{
  const keyLang = (p, re) => {
    let n = 0;
    for (const ln of readFileSync(new URL(p, V3_DIR), 'utf8').split('\n')) {
      const i = ln.indexOf('\t');
      if (i <= 0) continue;
      if (re.test(ln.slice(0, i))) n++;
    }
    return n;
  };
  const HANGUL = /[\uac00-\ud7af]/; const KANA = /[\u3040-\u30ff]/;
  const koInJa = ['mirapri', 'fc', 'collection'].reduce((n, s) => n + keyLang(`${s}/names.tsv`, HANGUL), 0);
  eq('A19 ja 三站 names 无韩文键（裁剪）', koInJa, 0);
  const weirdInEn = keyLang('ec/names.tsv', HANGUL) + keyLang('ec/names.tsv', KANA);
  eq('A20 ec names 无韩文/假名键（裁剪）', weirdInEn, 0);
  eq('A21 ronka names 无假名键（裁剪）', keyLang('ronka/names.tsv', KANA), 0);
  ok('A22 ja 表假名键 > 40000（内容未裁空）', keyLang('mirapri/names.tsv', KANA) > 40000);
  ok('A23 ko 表韩文键 > 50000（内容未裁空）', keyLang('ronka/names.tsv', HANGUL) > 50000);
  const dupCount = (s) => readFileSync(new URL(`${s}/dup.tsv`, V3_DIR), 'utf8').trim().split('\n').length;
  eq('A24 dup 裁剪（mirapri=13）', dupCount('mirapri'), 13);
  eq('A25 dup 裁剪（ec=20）', dupCount('ec'), 20);
  eq('A26 dup 裁剪（ronka=19）', dupCount('ronka'), 19);
}

// 站点文件清单与预期一致
{
  const expect = {
    mirapri: ['alias.tsv', 'dup.tsv', 'hash.tsv', 'names.tsv'],
    ec: ['alias.tsv', 'dup.tsv', 'hash.tsv', 'names.tsv'],
    fc: ['alias.tsv', 'dup.tsv', 'hash.tsv', 'names.tsv', 'series.txt'],
    ronka: ['alias.tsv', 'dup.tsv', 'names.tsv'],
    collection: ['acl.txt', 'alias.tsv', 'dup.tsv', 'names.tsv', 'series.txt'],
    wiki: ['ecid.tsv', 'ko.tsv'],
  };
  let mism = 0;
  for (const [site, want] of Object.entries(expect)) {
    const got = readdirSync(new URL(`${site}/`, V3_DIR)).sort();
    if (got.join(',') !== want.join(',')) { mism++; console.log(`     ${site}: 实际=${got.join(',')}`); }
  }
  eq('A18 站点文件清单与预期一致', mism, 0);
}

// ══════════ B. 运行时 v3 加载（桩装配）══════════
console.log('\n── B. 运行时 v3 加载 ──');

const DIST_TEXT = readDist();

function sliceAll(s, tag) {
  const startTag = `/* @zhixia:${tag}-start */`;
  const endTag = `/* @zhixia:${tag}-end */`;
  const out = [];
  let from = 0;
  for (;;) {
    const i = s.indexOf(startTag, from);
    if (i < 0) break;
    const j = s.indexOf(endTag, i + startTag.length);
    if (j < 0) throw new Error(`区段未闭合：${tag}`);
    out.push(s.slice(i, j + endTag.length));
    from = j + endTag.length;
  }
  if (!out.length) throw new Error(`区段缺失：${tag}`);
  return out;
}

const CACHE_SEGS = sliceAll(DIST_TEXT, 'core-cache');
const DM_SEGS = sliceAll(DIST_TEXT, 'core-data-manager');

const NAMES = [
  'storeGetAsync', 'storeSet', 'storeListAsync', 'storeDeleteAsync', 'storeSetAsync', 'httpGet',
  'SERIES_TEXT', 'ACL_CFC_TEXT',
  'itemHash', 'nameMap', 'ecidMap', 'koByZh',
  'DATA_VER', 'DATA_BASE_V3', 'DATA_REFRESH_EPOCH_KEY', 'DATA_REFRESH_EPOCH', '_forceDataRefresh', '_forceDataClearSucceeded', '_forceDataCacheWritesOk', '_manifestRefreshRequested', '_manifestNeedsCommit',
  'neededTables', '_fireTablesReady',
  'findSite', 'applyRuntimeDict', '_irAliasMap', '_irDupMap', '_irGlamMap', '_irSearchSlotByNative', '_irCandidatePolicy', '_zhxErr',
  '_replaceMap',
  '__zhxMark', 'document', 'window', 'console', 'setTimeout', 'clearTimeout',
];

function makeWorld(over = {}) {
  const rec = { xhr: [], set: [], deleted: [], timers: [], fires: [], dict: [], errs: [] };
  const store = Object.assign({ 'zhx.data.refresh.epoch': 'v3-only-1-force-refresh' }, over.store || {});
  if (over.refreshRequired) delete store['zhx.data.refresh.epoch'];
  const args = {
    storeGetAsync: (k) => Promise.resolve(store[k] === undefined ? null : store[k]),
    storeSet: (k, v) => { store[k] = v; rec.set.push([k, v]); },
    storeSetAsync: async (k, v) => { if (over.writeFail) return false; store[k] = String(v); rec.set.push([k, v]); return true; },
    storeListAsync: async () => over.listUnavailable ? null : Object.keys(store),
    storeDeleteAsync: async (k) => { rec.deleted.push(k); if (over.deleteFail) return false; delete store[k]; return true; },
    httpGet: (url) => { rec.xhr.push(url); return (over.http || (() => Promise.reject(new Error('net down'))))(url); },
    SERIES_TEXT: '', ACL_CFC_TEXT: '',
    itemHash: Object.create(null), nameMap: Object.create(null), ecidMap: Object.create(null), koByZh: Object.create(null),
    DATA_VER: '',
    DATA_REFRESH_EPOCH_KEY: 'zhx.data.refresh.epoch', DATA_REFRESH_EPOCH: 'v3-only-1-force-refresh',
    _manifestRefreshRequested: false, _manifestNeedsCommit: false,
    _forceDataRefresh: false, _forceDataClearSucceeded: false, _forceDataCacheWritesOk: true,
    DATA_BASE_V3: 'https://example.test/ff14/v3/',
    neededTables: () => over.need || ['items', 'dict'],
    _fireTablesReady: () => { rec.fires.push(1); },
    findSite: () => (over.site === null ? null : (over.site || { id: 'mirapri', indexes: ['nameMap', 'itemHash'], tables: ['items', 'dict'] })),
    applyRuntimeDict: (t) => { rec.dict.push(t); },
    _irAliasMap: null, _irDupMap: null, _irSearchSlotByNative: null, _irCandidatePolicy: 0,
    _replaceMap: (t, s) => { for (const k of Object.keys(t)) delete t[k]; if (s && typeof s === 'object') Object.assign(t, s); },
    _zhxErr: (where, e) => { rec.errs.push([String(where), String((e && e.message) || e)]); },
    __zhxMark: () => {},
    document: { readyState: 'complete' },
    window: { addEventListener: () => {} },
    console: { info: () => {}, warn: () => {}, log: () => {} },
    setTimeout: (fn) => { rec.timers.push(fn); return rec.timers.length; },
    clearTimeout: () => {},
  };
  const flushTimers = () => {
    let guard = 0;
    while (rec.timers.length && guard++ < 100) {
      const fn = rec.timers.shift();
      try { fn(); } catch (e) { rec.timerErr = String(e && e.message); }
    }
  };
  return { rec, args, store, flushTimers };
}

function buildDM(world) {
  const body = [...CACHE_SEGS, ...DM_SEGS].join('\n');
  const ret = [
    'return {',
    '  dataManager, ensureTables, itemDbReady,',
    '  _ensureTryV3, _applyV3, _v3Pairs, _prepareDataRefresh, _completeDataRefresh, _ensureMain, _ensureFinalize, _v3FetchFile, fetchManifest, loadManifest, readCachedManifest, fetchStationFiles, allFilesReady, dataInvalidate, _dlStats,',

    '  _peek: () => ({ nm: nameMap, ih: itemHash, em: ecidMap, kb: koByZh, ali: _irAliasMap, dup: _irDupMap, gl: _irGlamMap, slots: _irSearchSlotByNative, policy: _irCandidatePolicy, force: _forceDataRefresh, series: SERIES_TEXT, acl: ACL_CFC_TEXT }),',
    '};',
  ].join('\n');
  const fn = new Function(...NAMES, body + '\n' + ret);
  return fn(...NAMES.map((n) => world.args[n]));
}

// 准备：从 data/v3 读入 mirapri 全部文件 + shared dict（真 sha）
const siteFiles = {};
{
  const files = man.sites.mirapri.files;
  for (const [name, meta] of Object.entries(files)) {
    siteFiles[name] = { url: meta.url, sha256: meta.sha256, text: readFileSync(new URL(meta.url, V3_DIR), 'utf8') };
  }
}
const dictFile = { url: man.shared.dict.url, sha256: man.shared.dict.sha256, text: readFileSync(new URL(man.shared.dict.url, V3_DIR), 'utf8') };
const manText = JSON.stringify(man);

// B1: v3 成功路径（manifest + 全文件经网络拉取 → 应用 + 缓存）
{
  const w = makeWorld({
    http: (url) => {
      if (url.endsWith('manifest.json')) return Promise.resolve(manText);
      const site = man.sites.mirapri.files;
      for (const [name, meta] of Object.entries(site)) {
        if (url.endsWith(meta.url)) return Promise.resolve(siteFiles[name].text);
      }
      if (url.endsWith(dictFile.url)) return Promise.resolve(dictFile.text);
      return Promise.reject(new Error('404'));
    },
  });
  const dm = buildDM(w);
  const r = await dm._ensureTryV3();
  eq('B1 v3 成功返回 true', r, true);
  const pk = dm._peek();
  ok('B2 nameMap 已赋值且含预期键', !!pk.nm && Object.keys(pk.nm).length > 45000, `keys=${pk.nm ? Object.keys(pk.nm).length : 'null'}`);
  ok('B3 itemHash 已赋值', !!pk.ih && Object.keys(pk.ih).length > 30000);
  ok('B4 V3 文件成功映射运行时索引', !!pk.nm && !!pk.ih);
  eq('B4b v3 manifest trust enables candidate policy', pk.policy, 1);
  eq('B4c English dye mapping is present but candidate-disabled', pk.gl['Snow White Dye'], '0');
  ok('B5 dict 已应用', w.rec.dict.length === 1);
  const cacheKeys = w.rec.set.map(([k]) => k);
  ok('B6 manifest 已写缓存', cacheKeys.includes('zhx.v3.manifest'));
  ok('B7 站点文件内容寻址缓存已写入', cacheKeys.some((k) => k.startsWith('zhx.v3.f.mirapri.names.')) && cacheKeys.some((k) => k.startsWith('zhx.v3.f.mirapri.hash.')));
  ok('B8 dict 内容寻址缓存已写入', cacheKeys.some((k) => k.startsWith('zhx.v3.f.mirapri.dict.')));
}

// B1b: V3 names 可选第四列为部位组，旧缓存无分类不报错、不猜测。
{
  const world = makeWorld();
  const dm = buildDM(world);
  const items = { candidatePolicy: 1, names: '日文头盔\\t中文头盔\\t1\\t0\\n日文长袍\\t中文长袍\\t1\\t1\\n日文戒指\\t中文戒指\\t1\\t5\\n' };
  eq('B1b 带装备分类列的 V3 正常应用', dm._applyV3(items), true);
  eq('B1c 能识别头部类别', dm._peek().slots['日文头盔'], 0);
  eq('B1d 能识别身体类别', dm._peek().slots['日文长袍'], 1);
  eq('B1e 其余装备不需要存额外映射', dm._peek().slots['日文戒指'], undefined);
  eq('B1f 旧 V3 无分类列仍可应用', dm._applyV3({candidatePolicy: 1, names: '旧装备\\t中文旧装备\\t1\\n'}), true);
  eq('B1g 旧缓存不继承前一次部位数据', dm._peek().slots['日文头盔'], undefined);
}

// B2: 零网络快路径（缓存齐全 + manifest 新鲜 → 不发任何请求）
{
  const store = { 'zhx.v3.manifest': String(Date.now()) + '\n' + manText };
  for (const [name, f] of Object.entries(siteFiles)) store['zhx.v3.f.mirapri.' + name] = f.sha256 + '\n' + f.text;
  store['zhx.v3.f.mirapri.dict'] = dictFile.sha256 + '\n' + dictFile.text;
  const w = makeWorld({ store });
  const dm = buildDM(w);
  const r = await dm._ensureTryV3();
  eq('B9 缓存快路径返回 true', r, true);
  eq('B10 快路径零网络请求', w.rec.xhr.length, 0);
  ok('B11 快路径完成应用', !!dm._peek().nm);
}

// B3: manifest 获取失败 → false（回退）
{
  const w = makeWorld({ http: () => Promise.reject(new Error('404')) });
  const dm = buildDM(w);
  const r = await dm._ensureTryV3();
  eq('B12 manifest 404 → false', r, false);
  eq('B13 失败时不应用（nameMap 为空容器）', Object.keys(dm._peek().nm).length, 0);
}

// B4: schema 不兼容 → false
{
  const bad = JSON.stringify({ schema: 2, sites: { mirapri: { files: {} } } });
  const w = makeWorld({ http: () => Promise.resolve(bad) });
  const dm = buildDM(w);
  eq('B14 schema=2 → false', await dm._ensureTryV3(), false);
}

// B5: 站点不在 manifest → false
{
  const bad = JSON.stringify({ schema: 3, sites: { ec: { files: { names: { url: 'ec/names.tsv', sha256: 'x', bytes: 1 } } } } });
  const w = makeWorld({ http: () => Promise.resolve(bad), site: { id: 'mirapri' } });
  const dm = buildDM(w);
  eq('B15 站点缺失 → false', await dm._ensureTryV3(), false);
}

// B6: 文件 sha 不匹配 → false（不应用）
{
  const w = makeWorld({
    http: (url) => {
      if (url.endsWith('manifest.json')) return Promise.resolve(manText);
      return Promise.resolve('corrupted content that will not match sha');
    },
  });
  const dm = buildDM(w);
  eq('B16 文件 sha 不匹配 → false', await dm._ensureTryV3(), false);
  eq('B17 校验失败不更改既有索引', Object.keys(dm._peek().nm).length, 0);
}

// B7: 无站点（findSite null）→ false
{
  const w = makeWorld({ site: null });
  const dm = buildDM(w);
  eq('B18 未知站点 → false', await dm._ensureTryV3(), false);
}

// B8: _ensureMain 成功时只走当前 V3 manifest/files endpoint
{
  const w = makeWorld({
    http: (url) => {
      if (url.endsWith('manifest.json')) return Promise.resolve(manText);
      for (const [name, meta] of Object.entries(man.sites.mirapri.files)) {
        if (url.endsWith(meta.url)) return Promise.resolve(siteFiles[name].text);
      }
      if (url.endsWith(dictFile.url)) return Promise.resolve(dictFile.text);
      return Promise.reject(new Error('404'));
    },
  });
  const dm = buildDM(w);
  await dm._ensureMain();
  ok('B19 V3成功只使用manifest/files请求', !w.rec.xhr.some((u) => u.includes('/v2/')),
    `xhr=${w.rec.xhr.join(' | ')}`);
  ok('B20 _ensureMain 完成后索引就绪', !!dm._peek().nm);
}

// B9: V3 失败时不尝试旧路径；空索引仍完成就绪广播。
{
  const w = makeWorld({ http: () => Promise.reject(new Error('404')) });
  const dm = buildDM(w);
  await dm._ensureMain();
  await dm._ensureFinalize();
  ok('B21 V3 failure issues no retired version/table request', !w.rec.xhr.some((u) => u.includes('/v2/') || u.endsWith('version.json')),
    'xhr=' + w.rec.xhr.join(' | '));
  eq('B21b V3失败后索引保持空', Object.keys(dm._peek().nm).length, 0);
  eq('B21c V3失败仍广播就绪', w.rec.fires.length, 1);
}

// B10: _ensureFinalize announces V3-ready data and retains side-table text
{
  const w = makeWorld({});
  const dm = buildDM(w);
  dm._applyV3({ names: 'A\t甲\n', series: 'S1\t系列1\n' });
  const p = dm._ensureFinalize();
  w.flushTimers();
  await p;
  eq('B23 就绪广播仍发出', w.rec.fires.length, 1);
  eq('B24 series text keeps its V3 runtime prefix', dm._peek().series, '\nS1\t系列1\n');
}

// B11: empty-data finalize also releases ready waiters
{
  const w = makeWorld({});
  const dm = buildDM(w);
  const p = dm._ensureFinalize();
  w.flushTimers();
  await p;
  eq('B25 失败路径仍广播就绪', w.rec.fires.length, 1);
}

// B12: _v3Pairs 多值语义
{
  const w = makeWorld({});
  const dm = buildDM(w);
  const m = dm._v3Pairs('A\t甲\t乙\nA\t甲\t丙\nB\t丁\n', true);
  eq('B26 多值去重追加', JSON.stringify(m.A), JSON.stringify(['甲', '乙', '丙']));
  const single = dm._v3Pairs('A\t甲\nA\t乙\n', false);
  eq('B27 单值首行胜', single.A, '甲');
}

// B13: v3 glam 解析——'1'/'0'/缺失三态（v1.4.2 后续：候选过滤；应用级见 test-item-resolver）
{
  const w = makeWorld({});
  const dm = buildDM(w);
  dm._applyV3({ names: 'A\t甲乙\t1\nB\t乙丙\t0\nC\t丙丁\n' });
  const gl = dm._peek().gl || {};
  eq('B28 glam=1 解析', gl['A'], '1');
  eq('B29 glam=0 解析', gl['B'], '0');
  eq('B30 CRLF glam trim', dm._applyV3({ names: 'D\t丁戊\t 1 \r\n' }) && dm._peek().gl.D, '1');
  eq('B31 无 glam 列 → 不标记', Object.prototype.hasOwnProperty.call(gl, 'C'), false);
  const invalid = buildDM(makeWorld());
  eq('B31c candidatePolicy 1 rejects two-column names', invalid._applyV3({ names: 'Old\\t旧名\\n', candidatePolicy: 1 }), false);
  eq('B31d rejected v3 format does not confirm policy', invalid._peek().policy, 0);
  eq('B31e candidatePolicy 1 rejects unknown flag', invalid._applyV3({ names: 'A\\t甲\\t2\\n', candidatePolicy: 1 }), false);
  eq('B31b 无版本策略的旧manifest候选策略为0', dm._peek().policy, 0);
}

// B14: force-refresh epoch clears every data cache, while preserving unrelated user settings.
{
  const store = {
    'zhx.meta': 'meta', 'zhx.dt.items': 'old items', 'zhx.dt.legacy-table': 'old table',
    'zhx.v3.manifest': 'old manifest', 'zhx.v3.manifest.mirapri': 'old snapshot', 'zhx.v3.f.mirapri.names': 'old names',
    'zhx.v3.f.oldsite.oldfile': 'old site file', 'zhx.candidate.policy': 'old marker',
    'zhx.user.setting': 'keep me',
  };
  const w = makeWorld({ store, refreshRequired: true });
  const dm = buildDM(w);
  eq('B32 missing epoch requires refresh', await dm._prepareDataRefresh(), true);
  for (const key of ['zhx.meta', 'zhx.dt.items', 'zhx.dt.legacy-table', 'zhx.v3.manifest',
    'zhx.v3.manifest.mirapri', 'zhx.v3.f.mirapri.names', 'zhx.v3.f.oldsite.oldfile', 'zhx.candidate.policy']) {
    eq('B33 cleared cache ' + key, Object.hasOwn(w.store, key), false);
  }
  eq('B34 preserves unrelated setting', w.store['zhx.user.setting'], 'keep me');
  eq('B35 refresh epoch is kept until success', w.store['zhx.data.refresh.epoch'], undefined);
  eq('B36 successful refresh writes epoch', await dm._completeDataRefresh(), true);
  eq('B37 persisted epoch matches', w.store['zhx.data.refresh.epoch'], 'v3-only-1-force-refresh');
  eq('B38 next load needs no forced refresh', await dm._prepareDataRefresh(), false);
}

// B15: failed V3-only migration cannot reuse old V2 tables, and retries without writing epoch.
{
  const store = {
    'zhx.meta': JSON.stringify({ v: 'old', t: Date.now(), candidatePolicy: 1 }),
    'zhx.dt.items': 'oldfp\\n' + '90001\\t旧装备\\tOld Gear\\tオールドギア\\t옛 장비\\thold\\teold\\t\\t1\\n',
    'zhx.user.setting': 'preserve',
  };
  const w = makeWorld({ store, refreshRequired: true, deleteFail: true, need: ['items'], http: () => Promise.reject(new Error('offline')) });
  const dm = buildDM(w);
  await dm._ensureMain();
  eq('B39 V3强刷失败不应用旧V2缓存', Object.keys(dm._peek().nm).length, 0);
  eq('B40 V3强刷失败不写迁移epoch', w.store['zhx.data.refresh.epoch'], undefined);
  eq('B41 旧缓存删除失败时原数据仍不可用', w.store['zhx.dt.items'].startsWith('oldfp'), true);
  eq('B42 用户设置保留', w.store['zhx.user.setting'], 'preserve');
  ok('B43 下一次加载仍处于强制迁移态', dm._peek().force);
}

// B19: expired candidatePolicy=1 manifest and its verified files remain usable offline.
{
  const expired = String(Date.now() - 2 * 86400000) + '\n' + manText;
  const store = { 'zhx.v3.manifest': expired };
  for (const [name, f] of Object.entries(siteFiles)) store['zhx.v3.f.mirapri.' + name] = f.sha256 + '\n' + f.text;
  store['zhx.v3.f.mirapri.dict'] = dictFile.sha256 + '\n' + dictFile.text;
  const w = makeWorld({ store, http: () => Promise.reject(new Error('offline')) });
  const dm = buildDM(w);
  eq('B62 expired verified manifest falls back offline', await dm._ensureTryV3(), true);
  eq('B63 verified offline manifest retains candidate policy', dm._peek().policy, 1);
  eq('B64 old verifiable names still map for translation', dm._peek().nm['メイドホワイトブリム'], '女仆发带');
}

// B20a: wiki profiles use ecid/ko without requiring a names.tsv file.
{
  const wikiFiles = man.sites.wiki.files;
  const w = makeWorld({
    site: { id: 'wiki', indexes: ['ecidMap', 'koByZh'], tables: ['items', 'dict'] },
    http: (url) => {
      if (url.endsWith('manifest.json')) return Promise.resolve(manText);
      for (const [name, meta] of Object.entries(wikiFiles)) {
        if (url.endsWith(meta.url)) return Promise.resolve(readFileSync(new URL(meta.url, V3_DIR), 'utf8'));
      }
      if (url.endsWith(dictFile.url)) return Promise.resolve(dictFile.text);
      return Promise.reject(new Error('404'));
    },
  });
  const dm = buildDM(w);
  eq('B69 wiki v3 accepts its ecid/ko-only profile', await dm._ensureTryV3(), true);
  eq('B70 wiki policy is confirmed by manifest', dm._peek().policy, 1);
  eq('B71 wiki normal ECID index is populated', Object.keys(dm._peek().em).length > 20000, true);
}

// B21: a complete forced network refresh replaces wrong 9-column data and then uses cache without refresh.
{
  const dataRows = readFileSync(new URL('data/ff14-items.tsv', ROOT), 'utf8').split('\n');
  const badItem = dataRows.map((line) => line.split('\t')).find((p) => p[0] === '27242');
  const oldItems = 'key\tzh\ten\tja\tko\thash\tecid\talias\tglam\n'
    + ['27242', badItem[1], badItem[2], badItem[3], badItem[4], '', '', '', '1'].join('\t') + '\n';
  const w = makeWorld({
    refreshRequired: true,
    store: { 'zhx.meta': JSON.stringify({ v: 'old', t: Date.now(), candidatePolicy: 0 }), 'zhx.dt.items': 'oldfp\n' + oldItems,
      'zhx.v3.manifest': 'old manifest', 'zhx.v3.manifest.mirapri': 'old snapshot', 'zhx.v3.f.mirapri.names': 'old names', 'zhx.user.setting': 'keep' },
    http: (url) => {
      if (url.endsWith('manifest.json')) return Promise.resolve(manText);
      for (const [name, f] of Object.entries(man.sites.mirapri.files)) if (url.endsWith(f.url)) return Promise.resolve(siteFiles[name].text);
      if (url.endsWith(dictFile.url)) return Promise.resolve(dictFile.text);
      return Promise.reject(new Error('unexpected url: ' + url));
    },
  });
  const dm = buildDM(w);
  await dm._ensureMain();
  const firstRequests = w.rec.xhr.length;
  ok('B72 force refresh fetched fresh strategy data', firstRequests > 0);
  eq('B73 force refresh removed legacy V2 cache', w.store['zhx.dt.items'], undefined);
  eq('B74 v3 data has corrected 27242 flag', dm._peek().gl[badItem[3]], '0');
  eq('B75 corrected 27242 remains excluded by marker', dm._peek().gl[badItem[3]], '0');
  eq('B76 epoch is written after successful refresh', w.store['zhx.data.refresh.epoch'], 'v3-only-1-force-refresh');
  eq('B77 unrelated setting survives full cache clearing', w.store['zhx.user.setting'], 'keep');
  await dm._ensureMain();
  eq('B78 next load uses current cached strategy without refresh', w.rec.xhr.length, firstRequests);
}

// B22: failed forced loading leaves the epoch unset and forces the next page to retry.
{
  const w = makeWorld({ refreshRequired: true, http: () => Promise.reject(new Error('offline')) });
  const dm = buildDM(w);
  await dm._ensureMain();
  eq('B79 failed force refresh does not persist epoch', w.store['zhx.data.refresh.epoch'], undefined);
  ok('B80 failed force refresh remains active', dm._peek().force);
  const requests = w.rec.xhr.length;
  await dm._ensureMain();
  ok('B81 next page retries network after failed force load', w.rec.xhr.length > requests);
}

function v3CacheEntriesForTest(siteId) {
  const entries = {
    'zhx.v3.manifest': String(Date.now()) + String.fromCharCode(10) + manText,
    ['zhx.v3.manifest.' + siteId]: String(Date.now()) + String.fromCharCode(10) + manText,
  };
  for (const [name, f] of Object.entries(siteFiles))
    entries['zhx.v3.f.' + siteId + '.' + name + '.' + f.sha256] = f.sha256 + String.fromCharCode(10) + f.text;
  entries['zhx.v3.f.' + siteId + '.dict.' + dictFile.sha256] = dictFile.sha256 + String.fromCharCode(10) + dictFile.text;
  return entries;
}

// B23: Site B retains its committed manifest when Site A advances the shared daily manifest.
{
  const newMan = structuredClone(man);
  newMan.version = 'cross-site-new';
  newMan.sites.ec.files.names.sha256 = 'f'.repeat(64);
  const newText = JSON.stringify(newMan);
  const store = {
    'zhx.v3.manifest': '0' + String.fromCharCode(10) + manText,
    'zhx.v3.manifest.ec': String(Date.now()) + String.fromCharCode(10) + manText,
    'zhx.data.refresh.epoch': 'v3-only-1-force-refresh',
  };
  for (const [name, f] of Object.entries(man.sites.ec.files))
    store['zhx.v3.f.ec.' + name + '.' + f.sha256] = f.sha256 + String.fromCharCode(10) + readFileSync(new URL(f.url, V3_DIR), 'utf8');
  store['zhx.v3.f.ec.dict.' + dictFile.sha256] = dictFile.sha256 + String.fromCharCode(10) + dictFile.text;
  const a = makeWorld({
    store,
    site: { id: 'mirapri', indexes: ['nameMap', 'itemHash'], tables: ['items', 'dict'] },
    http: (url) => {
      if (url.endsWith('manifest.json')) return Promise.resolve(newText);
      for (const [name, f] of Object.entries(man.sites.mirapri.files))
        if (url.endsWith(f.url)) return Promise.resolve(siteFiles[name].text);
      if (url.endsWith(dictFile.url)) return Promise.resolve(dictFile.text);
      return Promise.reject(new Error('offline A: ' + url));
    },
  });
  const dmA = buildDM(a);
  eq('B23a Site A applies V3 update', await dmA._ensureTryV3(), true);
  eq('B23b Site A commits global manifest', JSON.parse(a.store['zhx.v3.manifest'].split(String.fromCharCode(10))[1]).version, 'cross-site-new');
  ok('B23c Site B snapshot survives Site A update', !!a.store['zhx.v3.manifest.ec']);

  const b = makeWorld({
    site: { id: 'ec', indexes: ['nameMap', 'itemHash'], tables: ['items', 'dict'] },
    store: { ...a.store },
    http: () => Promise.reject(new Error('offline B')),
  });
  const dmB = buildDM(b);
  eq('B23d Site B uses old verified snapshot offline', await dmB._ensureTryV3(), true);
  eq('B23e Site B keeps ordinary mapping', dmB._peek().nm['Snow White Dye'], '素雪白染剂');
  ok('B23f old-site fallback was recorded', dmB._dlStats.fallback >= 1);
}

// B24: Base V3 cache records remain readable and are upgraded to content-addressed keys.
{
  const store = { 'zhx.v3.manifest': String(Date.now()) + String.fromCharCode(10) + manText };
  for (const [name, f] of Object.entries(siteFiles))
    store['zhx.v3.f.mirapri.' + name] = f.sha256 + String.fromCharCode(10) + f.text;
  store['zhx.v3.f.mirapri.dict'] = dictFile.sha256 + String.fromCharCode(10) + dictFile.text;
  const w = makeWorld({ store, http: () => Promise.reject(new Error('offline')) });
  const dm = buildDM(w);
  eq('B24a compatible V3 base keys load offline', await dm._ensureTryV3(), true);
  eq('B24b file copied to content-addressed key', Object.hasOwn(w.store, 'zhx.v3.f.mirapri.names.' + siteFiles.names.sha256), true);
}

// B25: Forced migration ignores previously committed V3 snapshot and file cache.
{
  const store = { ...v3CacheEntriesForTest('mirapri'), 'zhx.user.setting': 'keep' };
  delete store['zhx.data.refresh.epoch'];
  const w = makeWorld({ store, refreshRequired: true, http: () => Promise.reject(new Error('offline')) });
  const dm = buildDM(w);
  await dm._ensureMain();
  eq('B25a failed migration leaves indexes empty', Object.keys(dm._peek().nm).length, 0);
  eq('B25b failed migration does not write epoch', w.store['zhx.data.refresh.epoch'], undefined);
  eq('B25c migration preserves user setting', w.store['zhx.user.setting'], 'keep');
  ok('B25d migration did not restore old site snapshot', !w.store['zhx.v3.manifest.mirapri']);
}


console.log(`\n${fail === 0 ? '✅' : '❌'} test-runtime-v3：${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
