// tests/unit/test-runtime-v3.mjs — Phase 12：Runtime Data v3（生成器产物 + 运行时加载/回退）
//
// 目的：
//   A. 校验 build/make-runtime-data.py 的产物（data/v3/）：manifest 结构、
//      逐文件 sha256/bytes、names 去重与染剂回退、站点清单、Phase 13 语言裁剪
//      （各站 names/dup 仅含其翻译链语言：ja 表无韩文、en 表无韩文/假名、ko 表无假名）。
//   B. 用桩装配 data-manager 段，钉死 v3 加载路径：成功应用（含缓存写入）、
//      零网络快路径、manifest 404 / schema 不兼容 / 文件 sha 不匹配 → 回退，
//      _ensureMain 接入（v3 成功不走 v2）、_ensureFinalize 跳过 buildTables。
//
// 机制：同 test-data-manager.mjs——从 dist 提取区段以桩装配，不依赖 Chrome / 外网。
//
// 运行：node tests/unit/test-runtime-v3.mjs
import { readDist } from '../helpers/paths.mjs';
import { readFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
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

// data/v3/ 是生成产物（.gitignore）；未预生成时动态生成到临时目录
let V3_DIR = new URL('data/v3/', ROOT);
if (!existsSync(new URL('manifest.json', V3_DIR))) {
  const tmp = mkdtempSync(join(tmpdir(), 'zhx-v3-'));
  execFileSync('python3', ['build/make-runtime-data.py', '--out', tmp],
    { cwd: fileURLToPath(ROOT), stdio: 'pipe' });
  V3_DIR = new URL('file://' + tmp + '/');
}

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
  'ITEM_DB_TEXT', 'SERIES_TEXT', 'ACL_CFC_TEXT',
  'itemHash', 'nameMap', 'ecidMap', 'koByZh',
  'DATA_VER', 'DATA_BASE', 'DATA_BASE_V3', 'DATA_FILES', 'DATA_REFRESH_EPOCH_KEY', 'DATA_REFRESH_EPOCH', '_forceDataRefresh', '_forceDataClearSucceeded', '_forceDataCacheWritesOk',
  'applyTable', 'neededTables', '_siteIndexes', 'buildTables', '_fireTablesReady',
  'findSite', 'applyRuntimeDict', '_irAliasMap', '_irDupMap', '_irGlamMap', '_irCandidatePolicy', '_zhxErr',
  '_replaceMap',
  // 注意：_ensureTryFast / _ensureFetchAll / _waitPageLoad 在提取段内有真实定义，
  // 它们会遮蔽同名参数——因此不列入桩清单（其网络访问仍经下面的 httpGet 桩记录）。
  '__zhxMark', 'document', 'window', 'console', 'setTimeout', 'clearTimeout',
];

function makeWorld(over = {}) {
  const rec = { xhr: [], set: [], deleted: [], applied: [], timers: [], fires: [], builds: 0, tryFast: 0, fetchAll: 0, waitLoad: 0, dict: [], errs: [] };
  const store = Object.assign({ 'zhx.data.refresh.epoch': 'candidate-policy-1-force-refresh' }, over.store || {});
  if (over.refreshRequired) delete store['zhx.data.refresh.epoch'];
  const args = {
    storeGetAsync: (k) => Promise.resolve(store[k] === undefined ? null : store[k]),
    storeSet: (k, v) => { store[k] = v; rec.set.push([k, v]); },
    storeSetAsync: async (k, v) => { if (over.writeFail) return false; store[k] = String(v); rec.set.push([k, v]); return true; },
    storeListAsync: async () => over.listUnavailable ? null : Object.keys(store),
    storeDeleteAsync: async (k) => { rec.deleted.push(k); if (over.deleteFail) return false; delete store[k]; return true; },
    httpGet: (url) => { rec.xhr.push(url); return (over.http || (() => Promise.reject(new Error('net down'))))(url); },
    ITEM_DB_TEXT: '', SERIES_TEXT: '', ACL_CFC_TEXT: '',
    itemHash: Object.create(null), nameMap: Object.create(null), ecidMap: Object.create(null), koByZh: Object.create(null),
    DATA_VER: '',
    DATA_REFRESH_EPOCH_KEY: 'zhx.data.refresh.epoch', DATA_REFRESH_EPOCH: 'candidate-policy-1-force-refresh',
    _forceDataRefresh: false, _forceDataClearSucceeded: false, _forceDataCacheWritesOk: true,
    DATA_BASE: 'https://example.test/ff14/v2/',
    DATA_BASE_V3: 'https://example.test/ff14/v3/',
    DATA_FILES: { items: 'items.tsv', series: 'series.txt', acl: 'acl.txt', dict: 'dict.json' },
    applyTable: (name, txt) => { rec.applied.push([name, txt]); },
    neededTables: () => over.need || ['items', 'dict'],
    _siteIndexes: () => over.scope || { nameMap: {}, itemHash: {} },
    buildTables: (scope, cb) => { rec.builds++; try { cb(); } catch (e) {} },
    _fireTablesReady: () => { rec.fires.push(1); },
    findSite: () => (over.site === null ? null : (over.site || { id: 'mirapri', indexes: ['nameMap', 'itemHash'], tables: ['items', 'dict'] })),
    applyRuntimeDict: (t) => { rec.dict.push(t); },
    _irAliasMap: null, _irDupMap: null, _irCandidatePolicy: 0,
    _replaceMap: (t, s) => { for (const k of Object.keys(t)) delete t[k]; if (s && typeof s === 'object') Object.assign(t, s); },
    _zhxErr: (where, e) => { rec.errs.push([String(where), String((e && e.message) || e)]); },
    _ensureTryFast: async () => { rec.tryFast++; return over.fast === null ? null : (over.fast || { local: {} }); },
    _ensureFetchAll: async () => { rec.fetchAll++; },
    _waitPageLoad: async () => { rec.waitLoad++; },
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
    '  _ensureTryV3, _applyV3, _v3Pairs, _prepareDataRefresh, _completeDataRefresh, _ensureFetchAll, _ensureFetchTable, _ensureTryFast, _ensureMain, _ensureFinalize,',
    '  _peek: () => ({ nm: nameMap, ih: itemHash, em: ecidMap, kb: koByZh, ali: _irAliasMap, dup: _irDupMap, gl: _irGlamMap, policy: _irCandidatePolicy, force: _forceDataRefresh, series: SERIES_TEXT, acl: ACL_CFC_TEXT, v3: _v3Applied }),',
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
  ok('B4 _v3Applied 置位', pk.v3 === true);
  eq('B4b v3 manifest trust enables candidate policy', pk.policy, 1);
  ok('B5 dict 已应用', w.rec.dict.length === 1);
  const cacheKeys = w.rec.set.map(([k]) => k);
  ok('B6 manifest 已写缓存', cacheKeys.includes('zhx.v3.manifest'));
  ok('B7 站点文件已写缓存', cacheKeys.includes('zhx.v3.f.mirapri.names') && cacheKeys.includes('zhx.v3.f.mirapri.hash'));
  ok('B8 dict 已写缓存', cacheKeys.includes('zhx.v3.f.mirapri.dict'));
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
  ok('B11 快路径完成应用', dm._peek().v3 === true && !!dm._peek().nm);
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
  eq('B17 不应用（v3Applied=false）', dm._peek().v3, false);
}

// B7: 无站点（findSite null）→ false
{
  const w = makeWorld({ site: null });
  const dm = buildDM(w);
  eq('B18 未知站点 → false', await dm._ensureTryV3(), false);
}

// B8: _ensureMain——v3 成功时不走 v2 链
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
  ok('B19 v3 成功时不发 v2 请求', !w.rec.xhr.some((u) => u.includes('/v2/')),
    `xhr=${w.rec.xhr.join(' | ')}`);
  ok('B20 _ensureMain 完成后索引就绪', !!dm._peek().nm);
}

// B9: _ensureMain——v3 失败时回退 v2 链（注意：_ensureTryFast/_ensureFetchAll 在
// 提取段内有真实定义，会遮蔽同名桩参数——以「发出 v2 请求」观测回退行为本身）
{
  const w = makeWorld({ http: () => Promise.reject(new Error('404')) });
  const dm = buildDM(w);
  await dm._ensureMain();
  ok('B21 v3 失败时回退 v2 链（发出 v2 数据请求）', w.rec.xhr.some((u) => u.includes('/v2/')),
    `tryFast=${w.rec.tryFast} xhr=${w.rec.xhr.join(' | ')} v3=${dm._peek().v3}`);
}

// B10: _ensureFinalize——_v3Applied=true 跳过 buildTables
{
  const w = makeWorld({});
  const dm = buildDM(w);
  dm._applyV3({ names: 'A\t甲\n', series: 'S1\t系列1\n' });
  const p = dm._ensureFinalize();
  w.flushTimers();
  await p;
  eq('B22 v3 就绪时 buildTables 被跳过', w.rec.builds, 0);
  eq('B23 就绪广播仍发出', w.rec.fires.length, 1);
  eq('B24 series 前缀换行（与 v2 语义一致）', dm._peek().series, '\nS1\t系列1\n');
}

// B11: _ensureFinalize——普通路径仍走 buildTables
{
  const w = makeWorld({});
  const dm = buildDM(w);
  const p = dm._ensureFinalize();
  w.flushTimers();
  await p;
  eq('B25 非 v3 路径 buildTables 被调用', w.rec.builds, 1);
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
    'zhx.v3.manifest': 'old manifest', 'zhx.v3.f.mirapri.names': 'old names',
    'zhx.v3.f.oldsite.oldfile': 'old site file', 'zhx.candidate.policy': 'old marker',
    'zhx.user.setting': 'keep me',
  };
  const w = makeWorld({ store, refreshRequired: true });
  const dm = buildDM(w);
  eq('B32 missing epoch requires refresh', await dm._prepareDataRefresh(), true);
  for (const key of ['zhx.meta', 'zhx.dt.items', 'zhx.dt.legacy-table', 'zhx.v3.manifest',
    'zhx.v3.f.mirapri.names', 'zhx.v3.f.oldsite.oldfile', 'zhx.candidate.policy']) {
    eq('B33 cleared cache ' + key, Object.hasOwn(w.store, key), false);
  }
  eq('B34 preserves unrelated setting', w.store['zhx.user.setting'], 'keep me');
  eq('B35 refresh epoch is kept until success', w.store['zhx.data.refresh.epoch'], undefined);
  eq('B36 successful refresh writes epoch', await dm._completeDataRefresh(), true);
  eq('B37 persisted epoch matches', w.store['zhx.data.refresh.epoch'], 'candidate-policy-1-force-refresh');
  eq('B38 next load needs no forced refresh', await dm._prepareDataRefresh(), false);
}

// B15: key-list API fallback enumerates known old site caches; deletion failure never enables cache reads.
{
  const store = {
    'zhx.dt.items': 'legacy',
    'zhx.v3.f.fc.names': 'legacy names',
    'zhx.v3.f.endcloset.acl': 'legacy acl',
    'zhx.profile.setting': 'preserve',
  };
  const w = makeWorld({ store, refreshRequired: true, listUnavailable: true, deleteFail: true,
    http: () => Promise.reject(new Error('offline')) });
  const dm = buildDM(w);
  await dm._prepareDataRefresh();
  const legacy = '27242\\t阿马罗装备的修复素材\\tAmaro Barding Repair Materials\\tアマロ修理素材\\t\\t\\t\\t\\t1\\n'.repeat(8);
  const got = await dm._ensureFetchTable('items', { items: 'newfp' }, {
    items: { fp: 'oldfp', tx: legacy },
  }, 1, true);
  eq('B39 forced fetch fails without serving old 9-column data', got, 0);
  eq('B40 deletion failure does not apply legacy table', w.rec.applied.length, 0);
  eq('B41 cache keys remain because delete failed', w.store['zhx.v3.f.fc.names'], 'legacy names');
  eq('B42 unrelated setting remains untouched', w.store['zhx.profile.setting'], 'preserve');
  eq('B43 failure never writes refresh epoch', w.store['zhx.data.refresh.epoch'], undefined);
  eq('B44 failed refresh stays forced', dm._peek().force, true);
  eq('B45 incomplete cleanup cannot mark epoch', await dm._completeDataRefresh(), false);
}


// B17: only explicit v2 metadata policy trusts cached flags; version claims cannot bless fallback data.
{
  const badLine = '27242\t阿马罗装备的修复素材\tAmaro Barding Repair Materials\tアマロ修理素材\t\t\t\t\t1\n';
  const cached = badLine.repeat(8);
  const w = makeWorld({
    store: {
      'zhx.meta': JSON.stringify({ v: 'old', t: Date.now() }),
      'zhx.dt.items': 'oldfp\n' + cached,
      'zhx.dt.dict': 'dictfp\n' + 'x'.repeat(200),
    },
  });
  const dm = buildDM(w);
  const fast = await dm._ensureTryFast(['items', 'dict']);
  eq('B46 old metadata may use cache for translation', fast, null);
  eq('B47 old metadata cannot trust wrong nine-column flag', dm._peek().policy, 0);
  ok('B48 old nine-column table was applied for translation', w.rec.applied.some(([name, text]) => name === 'items' && text === cached));
  eq('B49 wrong flag remains untrusted', dm._peek().policy, 0);
}
{
  const badLine = '27242\t阿马罗装备的修复素材\tAmaro Barding Repair Materials\tアマロ修理素材\t\t\t\t\t1\n';
  const cached = badLine.repeat(8);
  const w = makeWorld({
    http: (url) => url.endsWith('version.json')
      ? Promise.resolve(JSON.stringify({ v: 'new', candidatePolicy: 1, files: { items: 'newfp' } }))
      : Promise.reject(new Error('offline')),
  });
  const dm = buildDM(w);
  const okFetch = await dm._ensureFetchAll(['items'], { items: { fp: 'oldfp', tx: cached } });
  eq('B50 offline fallback remains available for lookup', okFetch, true);
  eq('B51 server policy is not copied onto old fallback data', dm._peek().policy, 0);
  eq('B52 fallback flags remain untrusted', dm._peek().policy, 0);
  eq('B53 persisted metadata records actual policy 0', JSON.parse(w.store['zhx.meta']).candidatePolicy, 0);
}

// B18: a v2 cache with candidatePolicy=1 stays available offline for names and candidates.
{
  const row = '7551\t光之鸟甲\tBarding of Light\tバード・オブ・ライト\t\t\t\t\t1\n';
  const items = 'key\tzh\ten\tja\tko\thash\tecid\talias\tglam\n' + row.repeat(8);
  const store = {
    'zhx.meta': JSON.stringify({ v: 'current', t: Date.now(), candidatePolicy: 1 }),
    'zhx.dt.items': 'itemsfp\n' + items,
    'zhx.dt.dict': 'dictfp\n' + 'd'.repeat(200),
  };
  const w = makeWorld({ store });
  const dm = buildDM(w);
  eq('B54 current-policy v2 cache takes fast path', await dm._ensureTryFast(['items', 'dict']), null);
  eq('B55 current-policy v2 cache enables candidates', dm._peek().policy, 1);
  eq('B56 current-policy v2 cache trusts barding marker', dm._peek().policy, 1);
}

// B19: forced v2 updates require a real nine-column table before setting policy or epoch.
{
  const validItems = ('key\tzh\ten\tja\tko\thash\tecid\talias\tglam\n'
    + '90001\t可用装备\tValid Gear\tテスト装備\t\t\t\t\t1\n').repeat(8);
  const w = makeWorld({
    refreshRequired: true,
    need: ['items'],
    http: (url) => {
      if (url.includes('/v3/')) return Promise.reject(new Error('no v3'));
      if (url.endsWith('version.json')) return Promise.resolve(JSON.stringify({ v: 'new', candidatePolicy: 1, files: { items: 'fp1' } }));
      if (url.endsWith('items.tsv')) return Promise.resolve(validItems);
      return Promise.reject(new Error('unexpected url'));
    },
  });
  const dm = buildDM(w);
  await dm._ensureMain();
  eq('B57 forced v2 loads trusted nine-column table', dm._peek().policy, 1);
  eq('B58 forced v2 persists candidate policy metadata', JSON.parse(w.store['zhx.meta']).candidatePolicy, 1);
  eq('B59 forced v2 marks refresh complete', w.store['zhx.data.refresh.epoch'], 'candidate-policy-1-force-refresh');
}
{
  const malformedItems = ('27242\t阿马罗装备的修复素材\tAmaro Barding Repair Materials\tアマロ修理素材\t\t\t\t\n').repeat(8);
  const w = makeWorld({
    refreshRequired: true,
    need: ['items'],
    http: (url) => {
      if (url.includes('/v3/')) return Promise.reject(new Error('no v3'));
      if (url.endsWith('version.json')) return Promise.resolve(JSON.stringify({ v: 'new', candidatePolicy: 1, files: { items: 'fp2' } }));
      if (url.endsWith('items.tsv')) return Promise.resolve(malformedItems);
      return Promise.reject(new Error('unexpected url'));
    },
  });
  const dm = buildDM(w);
  await dm._ensureMain();
  eq('B60 server policy cannot trust malformed v2 table', dm._peek().policy, 0);
  eq('B61 malformed v2 table cannot mark refresh complete', w.store['zhx.data.refresh.epoch'], undefined);
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

// B20: an expired old manifest can still serve translation, but never candidates.
{
  const oldMan = { ...man, candidatePolicy: 0 };
  const store = { 'zhx.v3.manifest': '0\n' + JSON.stringify(oldMan) };
  for (const [name, f] of Object.entries(siteFiles)) store['zhx.v3.f.mirapri.' + name] = f.sha256 + '\n' + f.text;
  store['zhx.v3.f.mirapri.dict'] = dictFile.sha256 + '\n' + dictFile.text;
  const w = makeWorld({ store, http: () => Promise.reject(new Error('offline')) });
  const dm = buildDM(w);
  eq('B65 old manifest is available for translations offline', await dm._ensureTryV3(), true);
  eq('B66 old manifest cannot establish candidate policy', dm._peek().policy, 0);
  ok('B67 old manifest still fills ordinary name map', !!dm._peek().nm['メイドホワイトブリム']);
  eq('B68 old manifest policy remains translation-only', dm._peek().policy, 0);
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
      'zhx.v3.manifest': 'old manifest', 'zhx.v3.f.mirapri.names': 'old names', 'zhx.user.setting': 'keep' },
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
  eq('B73 force refresh replaced wrong 9-column cache', w.store['zhx.dt.items'], undefined);
  eq('B74 v3 data has corrected 27242 flag', dm._peek().gl[badItem[3]], '0');
  eq('B75 corrected 27242 remains excluded by marker', dm._peek().gl[badItem[3]], '0');
  eq('B76 epoch is written after successful refresh', w.store['zhx.data.refresh.epoch'], 'candidate-policy-1-force-refresh');
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

console.log(`\n${fail === 0 ? '✅' : '❌'} test-runtime-v3：${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
