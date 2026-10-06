// tests/unit/test-site-registry.mjs — Phase 3：统一 Site Registry（golden tests）
//
// 目的：把「六站配置源」的行为钉死——host 匹配（含子域/防前缀绕过）、表与索引清单、
//       未知 host 不启动、测试钩子。后续阶段重构必须保持这些行为不变。
//
// 机制：从构建产物（dist）按标记提取 Site Registry 区段，在 Node 里装配成可调用装置
//       （区段自足：只依赖 location.hostname 与 window 钩子）。不依赖 Chrome / 外网。
//
// 注意：提取锚（@zhixia:site-registry-start/end）随 src 结构变化会失配并明确报错——
//       届时按新结构更新即可（这是有意的哨兵）。改动区段内的 host 判定逻辑时，必须先看本文件。
//
// 金标准来源：tables/indexes 值自 v1.3 的 SITE_TABLES / _siteIndexes() 逐字冻结（v1.4 Phase 3 合并）。
//
// 运行：node tests/unit/test-site-registry.mjs   （或 npm run test:unit）
import { readDist } from '../helpers/paths.mjs';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};
const eq = (name, actual, expected) => ok(name, actual === expected,
  `实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`);
const section = (t) => console.log(`\n── ${t} ──`);

const DIST_TEXT = readDist();

// ─────────────────────────────────────────────────────────────
// A. 提取区段并装配（stub：location / window）
// ─────────────────────────────────────────────────────────────
const START = '/* @zhixia:site-registry-start */';
const END = '/* @zhixia:site-registry-end */';

section('A：区段提取与装配');
const nStart = DIST_TEXT.split(START).length - 1;
const nEnd = DIST_TEXT.split(END).length - 1;
ok('A1 区段锚点唯一（start/end 各 1 处）', nStart === 1 && nEnd === 1, `start=${nStart} end=${nEnd}`);

// Phase 9：适配器 boot/pageshow 会触达站点函数与 safe——全部以桩注入（记录调用）
const STUB_NAMES = [
  'startMirapri', 'startItems', 'startEC', 'startWiki', 'startFC', 'startRonka', 'startACL',
  'translatePage', 'applyItemZh', 'translateECPage', 'bindECPieceTiles', 'translateFCPage',
  'translateFCTitle', 'fixFCMenu', 'bindFCBanners', 'translateRonkaPage', 'translateRonkaTitle',
  'translateACLPage', 'translateACLTitle', 'injectWikiButton',
];

function buildDevice(dataRemote) {
  const stubs = { calls: [], ready: [] };
  const stubDefs = 'function safe(fn) { return fn; }\n'
    + STUB_NAMES.map((n) => `function ${n}() { __stubCalls.push('${n}'); }`).join('\n');
  const body = DIST_TEXT.slice(DIST_TEXT.indexOf(START) + START.length, DIST_TEXT.indexOf(END));
  const factory = new Function('location', 'window', 'DATA_REMOTE', 'onTablesReady', '__stubCalls',
    stubDefs + '\n' + body + '\nreturn { findSite, neededTables, _siteIndexes, SITE_REGISTRY, createSiteAdapter };');
  let host = '';
  const locStub = { get hostname() { return host; } };
  const winStub = {};
  const device = factory(locStub, winStub, dataRemote, (fn) => stubs.ready.push(fn), stubs.calls);
  return {
    ...device,
    stubs,
    setHost: (h) => { host = h; },
    win: winStub,
  };
}

let api = null;
try {
  api = buildDevice(true);
  ok('A2 区段可在 Node 装配（自足、无外部引用）', true);
} catch (e) {
  ok('A2 区段可在 Node 装配（自足、无外部引用）', false, e.message);
}

if (!api) {
  console.log(`\n${pass}/${pass + fail} 通过（装配失败，后续断言跳过）`);
  process.exit(1);
}

const { findSite, neededTables, _siteIndexes, SITE_REGISTRY, setHost, win } = api;

ok('A3 SITE_REGISTRY 为数组且 6 站', Array.isArray(SITE_REGISTRY) && SITE_REGISTRY.length === 6,
  `len=${SITE_REGISTRY && SITE_REGISTRY.length}`);
const ids = SITE_REGISTRY.map((s) => s.id).join(',');
eq('A4 站点顺序（即匹配优先级）', ids, 'mirapri,ec,wiki,fc,ronka,collection');
{
  const bad = SITE_REGISTRY.filter((s) =>
    !Array.isArray(s.hosts) || !s.hosts.length ||
    !Array.isArray(s.tables) || !s.tables.length ||
    !Array.isArray(s.indexes) || !s.indexes.length ||
    typeof s.boot !== 'function' || typeof s.pageshow !== 'function');
  ok('A5 每站 hosts/tables/indexes 非空数组 + boot/pageshow 为函数', bad.length === 0,
    bad.map((s) => s.id).join(','));
}

// ─────────────────────────────────────────────────────────────
// B. host → 站点匹配（含子域；tables/indexes 金标准见 D 组）
// ─────────────────────────────────────────────────────────────
// [host, 期望 id, 期望 tables, 期望 indexes]
const CASES = [
  ['mirapri.com', 'mirapri', ['items', 'dict'], ['nameMap', 'itemHash']],
  ['www.mirapri.com', 'mirapri', ['items', 'dict'], ['nameMap', 'itemHash']],
  ['ffxiv.eorzeacollection.com', 'ec', ['items', 'dict'], ['nameMap', 'itemHash']],
  ['ff14.huijiwiki.com', 'wiki', ['items', 'dict'], ['ecidMap', 'koByZh']],
  ['ff14-fc.com', 'fc', ['items', 'series', 'dict'], ['nameMap', 'itemHash']],
  ['lookbook.ronkacloset.com', 'ronka', ['items', 'dict'], ['nameMap']],
  ['www.ffxivcollection.com', 'collection', ['items', 'series', 'acl', 'dict'], ['nameMap']],
];

section('B：host → 站点匹配（含子域）');
for (const [h, id] of CASES) {
  setHost(h);
  const got = findSite();
  eq(`B ${h} → ${id}`, got ? got.id : null, id);
}

// ─────────────────────────────────────────────────────────────
// C. 防绕过与未知 host（不启动）
// ─────────────────────────────────────────────────────────────
section('C：防绕过与未知 host');
for (const h of ['evilmirapri.com', 'mirapri.com.evil.com', 'amirapri.com', 'xff14-fc.com', 'example.com', 'localhost', '']) {
  setHost(h);
  eq(`C "${h}" → null（不启动）`, findSite(), null);
}

// ─────────────────────────────────────────────────────────────
// D. 表 / 索引配置金标准（逐站）
// ─────────────────────────────────────────────────────────────
section('D：表与索引配置金标准');
for (const [h, id, tables, indexes] of CASES) {
  setHost(h);
  eq(`D ${id} neededTables()`, JSON.stringify(neededTables()), JSON.stringify(tables));
  eq(`D ${id} _siteIndexes()`, JSON.stringify(_siteIndexes()), JSON.stringify(indexes));
}
setHost('example.com');
ok('D 未知 host neededTables()=[]', Array.isArray(neededTables()) && neededTables().length === 0);
eq('D 未知 host _siteIndexes()=null', _siteIndexes(), null);

// ─────────────────────────────────────────────────────────────
// E. 测试钩子（集成测试用；生产环境不设置）
// ─────────────────────────────────────────────────────────────
section('E：测试钩子');
setHost('mirapri.com');
win.__zhxTestSite = 'wiki';
eq('E1 __zhxTestSite 覆写（mirapri.com → wiki）', findSite() ? findSite().id : null, 'wiki');
delete win.__zhxTestSite;
eq('E2 清除后回落真实 host', findSite() ? findSite().id : null, 'mirapri');
win.__zhxTestTables = ['items'];
eq('E3 __zhxTestTables 覆写', JSON.stringify(neededTables()), JSON.stringify(['items']));
delete win.__zhxTestTables;
win.__zhxTestIndexes = ['nameMap'];
eq('E4 __zhxTestIndexes 覆写', JSON.stringify(_siteIndexes()), JSON.stringify(['nameMap']));
delete win.__zhxTestIndexes;
eq('E5 清除后回落真实站点', JSON.stringify(_siteIndexes()), JSON.stringify(['nameMap', 'itemHash']));

// ─────────────────────────────────────────────────────────────
// F. dist 文本哨兵（旧双表已消灭、无残留旧模式）
// ─────────────────────────────────────────────────────────────
section('F：文本哨兵');
const onHostCalls = DIST_TEXT.split('onHost(').length - 1;
eq('F1 onHost( 全文仅 1 处（findSite 内）', onHostCalls, 1);
eq('F2 SITE_TABLES 残留', DIST_TEXT.split('SITE_TABLES').length - 1, 0);
eq('F3 旧分发模式 if (onHost(host, 残留', DIST_TEXT.split('if (onHost(host,').length - 1, 0);
{
  const body = DIST_TEXT.slice(DIST_TEXT.indexOf(START), DIST_TEXT.indexOf(END));
  const missing = CASES.map(([h]) => h.split('.').slice(-2).join('.')).filter((d) => !body.includes(`'${d}'`));
  ok('F4 六域名均在区段内（hosts 配置）', missing.length === 0, missing.join(','));
}
eq('F5 function findSite() 定义', DIST_TEXT.split('function findSite()').length - 1, 1);

// ─────────────────────────────────────────────────────────────
// G. Site Adapter（v1.4 Phase 9：统一接口）
// ─────────────────────────────────────────────────────────────
section('G：Site Adapter 统一接口');
{
  const g = buildDevice(true);
  const bad = g.SITE_REGISTRY.filter((s) =>
    typeof s.boot !== 'function' || typeof s.pageshow !== 'function' ||
    typeof s.processRoot !== 'function' || typeof s.destroy !== 'function');
  ok('G1 六站接口齐全（boot/pageshow/processRoot/destroy）', bad.length === 0, bad.map((s) => s.id).join(','));
  eq('G2 六站 processRoot 均为函数（缺省 noop）', g.SITE_REGISTRY.every((s) => typeof s.processRoot === 'function'), true);

  const ronka = g.SITE_REGISTRY.find((s) => s.id === 'ronka');
  ronka.boot();
  ok('G3 boot() 调 start（startRonka）', g.stubs.calls.includes('startRonka'), JSON.stringify(g.stubs.calls));
  eq('G4 DATA_REMOTE=true：boot() 注册 1 条 onDataReady', g.stubs.ready.length, 1);
  g.stubs.ready[0]();
  ok('G5 补扫回调执行（translateRonkaPage + translateRonkaTitle）',
    g.stubs.calls.includes('translateRonkaPage') && g.stubs.calls.includes('translateRonkaTitle'),
    JSON.stringify(g.stubs.calls));
  const before = g.stubs.calls.length;
  ronka.pageshow();
  ok('G6 pageshow() 调 onPageShow（补跑）', g.stubs.calls.length > before, `before=${before} after=${g.stubs.calls.length}`);
  ronka.processRoot(null);
  ok('G7 processRoot 可调用（经 safe 包装）', g.stubs.calls.includes('translateRonkaPage'), JSON.stringify(g.stubs.calls));

  const g2 = buildDevice(false);
  g2.SITE_REGISTRY.find((s) => s.id === 'ronka').boot();
  eq('G8 DATA_REMOTE=false：不注册补扫', g2.stubs.ready.length, 0);
}

console.log('\n════════ 汇总 ════════');
console.log(`通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
