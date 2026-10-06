// tests/unit/test-core.mjs — Phase 4：冻结 Core 基础设施行为（golden tests）
//
// 目的：把 storage / http / cache / dom / runtime / constants 六个基础设施模块的
//       当前行为用断言钉死。后续模块化（Phase 15）与任何重构必须保持这些行为不变，
//       除非有明确的独立业务变更。
//
// 机制：从构建产物（dist）中按 @zhixia:core-* 标记区段"提取"代码，在 Node 里
//       以假宿主环境（GM 存储 / GM XHR / fetch 桩）装配运行。不依赖 Chrome / 外网。
//       runtime 与 cache 各含 2 处标记区段，按出现顺序全部提取。
//
// 注意：
//   - 存储键（zhx.meta / zhx.dt.*）与缓存序列化格式（指纹 + 换行 + 文本）是跨版本
//     兼容契约（用户本地已缓存数 MB 数据）——此处冻结。
//   - 计划书 Phase 4-HTTP 清单的「HTTPS 限制」现以数据源契约形式冻结
//     （DATA_BASE / DATA_FILES 均为 https），运行层无额外 scheme 校验（现状即规格）。
//   - 提取锚随 src 结构变化会失配并明确报错——届时按新结构更新锚点即可（有意的哨兵）。
//   - 假宿主桩必须在 buildCore(env) 之前设置：装配参数为「值捕获」，装配后再替换
//     env 上的桩不会生效（曾致「unsettled top-level await」找不到原因）。
//
// 运行：node tests/unit/test-core.mjs   （或 npm run test:unit）
import { readDist } from '../helpers/paths.mjs';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};
const eq = (name, actual, expected) => ok(name, actual === expected,
  `实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`);

const DIST_TEXT = readDist();

// ─────────────────────────────────────────────────────────────
// 提取装置：按 @zhixia:core-* 标记切出区段（同名多段按顺序全部取出）
// ─────────────────────────────────────────────────────────────
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
  if (!out.length) throw new Error(`区段缺失：${tag}（src 结构可能已变化）`);
  return out;
}

const SEG = {
  runtime: ['core-runtime', 2],
  constants: ['core-constants', 1],
  storage: ['core-storage', 1],
  http: ['core-http', 1],
  cache: ['core-cache', 2],
  cacheReg: ['core-cache-registry', 1],
  dom: ['core-dom', 1],
  observer: ['core-observer', 1],
};

const ARG_NAMES = ['window', 'document', 'console', 'performance', 'GM', 'GM_getValue', 'GM_setValue',
  'GM_xmlhttpRequest', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', 'requestIdleCallback',
  'MutationObserver'];

const RETURN_STMT = `return { _storeNorm, storeGetAsync, storeSet, httpGet, _readCachedTable, _writeCachedTable,
  safe, dedupeByAncestor, observeLocal, __zhxBootAt, __cacheReg: _cacheReg, cacheGuard,
  C: { DAY_MS, META_KEY, DT_PREFIX, DATA_BASE, DATA_FILES, DATA_REMOTE } };`;

function buildCore(env) {
  const parts = [];
  for (const [tag] of Object.values(SEG)) parts.push(...sliceAll(DIST_TEXT, tag));
  try {
    const fn = new Function(...ARG_NAMES, parts.join('\n') + '\n' + RETURN_STMT);
    return fn(...ARG_NAMES.map((n) => env[n]));
  } catch (e) {
    throw new Error('Core 装配失败：' + e.message);
  }
}

/** 基准假环境：GM 存储 + GM XHR 桩（各测试用例按需覆盖后再装配新实例） */
function makeEnv(over = {}) {
  const rec = { store: new Map(), setCalls: [], xhrCalls: [], fetchCalls: [], idles: [], timers: [], warns: [], aborts: 0 };
  const env = {
    window: {},
    document: null,
    console: { warn: (...a) => rec.warns.push(a) },
    performance: { now: () => 123.45 },
    GM: undefined,
    GM_getValue: (k, d) => (rec.store.has(k) ? rec.store.get(k) : d),
    GM_setValue: (k, v) => { rec.setCalls.push([k, v]); rec.store.set(k, String(v)); },
    GM_xmlhttpRequest: (opt) => { rec.xhrCalls.push(opt); },
    fetch: undefined,
    AbortController: undefined,
    setTimeout: (fn) => { rec.timers.push(fn); fn(); return rec.timers.length; },
    clearTimeout: () => {},
    requestIdleCallback: (fn) => { rec.idles.push(fn); fn(); return rec.idles.length; },
    MutationObserver: undefined,
    rec,
  };
  Object.assign(env, over);
  return env;
}

// ═════════════════════════ 开始 ═════════════════════════════════

console.log('\n── 区段哨兵（标记与装配） ──');
{
  const counts = {};
  for (const [tag, n] of Object.values(SEG)) {
    counts[tag] = DIST_TEXT.split(`/* @zhixia:${tag}-start */`).length - 1;
    eq(`${tag} 区段数（start）`, counts[tag], n);
    eq(`${tag} 区段数（end）`, DIST_TEXT.split(`/* @zhixia:${tag}-end */`).length - 1, n);
  }
  // 本文件提取的 8 类共 10 对；其他段（dictionary / translator / item-resolver 等）由各自测试覆盖
  const coreTot = DIST_TEXT.split('@zhixia:core-').length - 1;
  ok('core-* 标记成对且 ≥ 本文件提取的 10 对', coreTot % 2 === 0 && coreTot >= 20, `实际=${coreTot}`);
  const api = buildCore(makeEnv());
  for (const f of ['_storeNorm', 'storeGetAsync', 'storeSet', 'httpGet', '_readCachedTable', '_writeCachedTable', 'safe', 'dedupeByAncestor', 'observeLocal']) {
    eq(`${f} 装配后可调用`, typeof api[f], 'function');
  }
  eq('__zhxBootAt 取 performance.now 值', api.__zhxBootAt, 123.45);
}

console.log('\n── storage：GM 存储读写封装 ──');
{
  {
    const env = makeEnv({
      GM_getValue: (k, d) => ({ s: 'STR', n: 42, z: 0, e: '', f: false, nz: null }[k] ?? d),
    });
    const api = buildCore(env);
    eq('字符串原样', await api.storeGetAsync('s'), 'STR');
    eq('数字 → 字符串', await api.storeGetAsync('n'), '42');
    eq('0 → "0"', await api.storeGetAsync('z'), '0');
    eq('空串原样', await api.storeGetAsync('e'), '');
    eq('false → "false"', await api.storeGetAsync('f'), 'false');
    eq('null → null', await api.storeGetAsync('nz'), null);
    eq('缺失 → fallback null', await api.storeGetAsync('missing'), null);
  }
  {
    const env = makeEnv({ GM_getValue: () => Promise.resolve('P') });
    const api = buildCore(env);
    eq('Promise 兼容（resolve）', await api.storeGetAsync('k'), 'P');
  }
  {
    const env = makeEnv({ GM_getValue: () => Promise.reject(new Error('x')) });
    const api = buildCore(env);
    eq('Promise 兼容（reject → null）', await api.storeGetAsync('k'), null);
  }
  {
    const env = makeEnv({ GM_getValue: () => { throw new Error('boom'); } });
    const api = buildCore(env);
    eq('同步抛错 → null', await api.storeGetAsync('k'), null);
  }
  {
    const env = makeEnv({ GM_getValue: undefined, GM: { getValue: () => Promise.resolve('GV') } });
    const api = buildCore(env);
    eq('GM.getValue 路径', await api.storeGetAsync('k'), 'GV');
  }
  {
    const env = makeEnv({ GM_getValue: undefined, GM: { getValue: () => Promise.reject(new Error('x')) } });
    const api = buildCore(env);
    eq('GM.getValue reject → null', await api.storeGetAsync('k'), null);
  }
  {
    const env = makeEnv({ GM_getValue: undefined, GM: undefined });
    const api = buildCore(env);
    eq('无任何 GM → null', await api.storeGetAsync('k'), null);
  }
  {
    const env = makeEnv();
    const api = buildCore(env);
    api.storeSet('kk', 'vv');
    eq('storeSet 键透传', env.rec.setCalls[0]?.[0], 'kk');
    eq('storeSet 值透传', env.rec.setCalls[0]?.[1], 'vv');
  }
  {
    const env = makeEnv({ GM_setValue: () => { throw new Error('boom'); } });
    const api = buildCore(env);
    let threw = false;
    try { api.storeSet('k', 'v'); } catch (e) { threw = true; }
    ok('storeSet 写入异常不抛出', !threw);
  }
  {
    let gvCalls = 0;
    const env = makeEnv({ GM_setValue: undefined, GM: { setValue: () => { gvCalls++; return Promise.resolve(); } } });
    const api = buildCore(env);
    api.storeSet('k', 'v');
    eq('GM.setValue 路径被调', gvCalls, 1);
  }
  {
    const env = makeEnv({ GM_setValue: undefined, GM: undefined });
    const api = buildCore(env);
    let threw = false;
    try { api.storeSet('k', 'v'); } catch (e) { threw = true; }
    ok('无存储可用时静默', !threw);
  }
}

console.log('\n── http：GM XHR 优先 + fetch 兜底 ──');
{
  {
    const env = makeEnv();
    let resolved = null;
    env.GM_xmlhttpRequest = (opt) => {
      env.rec.xhrCalls.push(opt);
      opt.onload({ status: 200, responseText: 'GM-BODY' });
    };
    const api = buildCore(env);
    resolved = await api.httpGet('https://example.com/a', 1234);
    const o = env.rec.xhrCalls[0];
    eq('GM_xhr method', o?.method, 'GET');
    eq('GM_xhr url', o?.url, 'https://example.com/a');
    eq('GM_xhr 自定义 timeout', o?.timeout, 1234);
    eq('GM_xhr 200 → resolve', resolved, 'GM-BODY');
  }
  {
    const env = makeEnv();
    env.GM_xmlhttpRequest = (opt) => { env.rec.xhrCalls.push(opt); opt.onload({ status: 201, responseText: 'C' }); };
    const api = buildCore(env);
    eq('GM_xhr 201 → resolve', await api.httpGet('https://e.com', 0), 'C');
  }
  {
    const env = makeEnv();
    env.GM_xmlhttpRequest = (opt) => { env.rec.xhrCalls.push(opt); opt.onload({ status: 404, responseText: '' }); };
    const api = buildCore(env);
    let msg = null;
    try { await api.httpGet('https://e.com', 0); } catch (e) { msg = e.message; }
    eq('GM_xhr 404 → reject', msg, 'HTTP 404');
  }
  {
    const env = makeEnv();
    env.GM_xmlhttpRequest = (opt) => { env.rec.xhrCalls.push(opt); opt.onerror(); };
    const api = buildCore(env);
    let msg = null;
    try { await api.httpGet('https://e.com', 0); } catch (e) { msg = e.message; }
    eq('GM_xhr onerror → reject', msg, 'network');
  }
  {
    const env = makeEnv();
    env.GM_xmlhttpRequest = (opt) => { env.rec.xhrCalls.push(opt); opt.ontimeout(); };
    const api = buildCore(env);
    let msg = null;
    try { await api.httpGet('https://e.com', 0); } catch (e) { msg = e.message; }
    eq('GM_xhr ontimeout → reject', msg, 'timeout');
  }
  {
    const env = makeEnv();
    env.GM_xmlhttpRequest = (opt) => { env.rec.xhrCalls.push(opt); opt.onload({ status: 200, responseText: 'G' }); };
    env.fetch = () => { env.rec.fetchCalls.push(1); throw new Error('不应走到 fetch'); };
    const api = buildCore(env);
    const v = await api.httpGet('https://e.com', 0);
    eq('GM + fetch 并存 → 走 GM', v, 'G');
    eq('fetch 未被调用', env.rec.fetchCalls.length, 0);
  }
  {
    const env = makeEnv();
    env.GM_xmlhttpRequest = undefined;
    env.fetch = (url, opt) => { env.rec.fetchCalls.push({ url, opt }); return Promise.resolve({ ok: true, text: () => Promise.resolve('F-BODY') }); };
    const api = buildCore(env);
    eq('fetch 200 → resolve', await api.httpGet('https://e.com/x', 0), 'F-BODY');
    eq('fetch 收到 url', env.rec.fetchCalls[0]?.url, 'https://e.com/x');
  }
  {
    const env = makeEnv();
    env.GM_xmlhttpRequest = undefined;
    env.fetch = () => Promise.resolve({ ok: false, status: 404 });
    const api = buildCore(env);
    let msg = null;
    try { await api.httpGet('https://e.com', 0); } catch (e) { msg = e.message; }
    eq('fetch 404 → reject', msg, 'HTTP 404');
  }
  {
    const env = makeEnv();
    env.GM_xmlhttpRequest = undefined;
    env.fetch = () => Promise.reject(new Error('net'));
    const api = buildCore(env);
    let hasErr = false;
    try { await api.httpGet('https://e.com', 0); } catch (e) { hasErr = e instanceof Error; }
    ok('fetch 网络错 → Error 化 reject', hasErr);
  }
  {
    const env = makeEnv();
    env.GM_xmlhttpRequest = undefined;
    let aborted = 0;
    env.AbortController = function () { this.signal = { tag: 'sig' }; this.abort = () => { aborted++; env.rec.aborts++; }; };
    env.fetch = (url, opt) => { env.rec.fetchCalls.push({ url, opt }); return new Promise(() => {}); }; // 永不 settle
    const api = buildCore(env);
    api.httpGet('https://e.com/slow', 5).catch(() => {});
    await new Promise((r) => setImmediate(r));
    eq('fetch 超时触发 abort', aborted, 1);
    eq('fetch 收到 abort signal', env.rec.fetchCalls[0]?.opt?.signal?.tag, 'sig');
  }
  {
    const env = makeEnv({ GM_xmlhttpRequest: undefined, fetch: undefined });
    const api = buildCore(env);
    let msg = null;
    try { await api.httpGet('https://e.com', 0); } catch (e) { msg = e.message; }
    eq('无传输 → reject', msg, 'no http transport');
  }
  {
    const env = makeEnv();
    env.GM_xmlhttpRequest = (opt) => { env.rec.xhrCalls.push(opt); };
    const api = buildCore(env);
    const p = api.httpGet('https://e.com', 0);
    eq('默认 timeout 20000', env.rec.xhrCalls[0]?.timeout, 20000);
    p.catch(() => {});
  }
}

console.log('\n── cache：键 / 序列化格式 / 延迟写入 ──');
{
  const api = buildCore(makeEnv());
  eq('DAY_MS', api.C.DAY_MS, 86400000);
  eq('META_KEY', api.C.META_KEY, 'zhx.meta');
  eq('DT_PREFIX', api.C.DT_PREFIX, 'zhx.dt.');
  eq('DATA_BASE（https 契约）', api.C.DATA_BASE, 'https://zhixia-data.pages.dev/ff14/v2/');
  eq('DATA_FILES.items', api.C.DATA_FILES.items, 'items.tsv');
  eq('DATA_FILES.series', api.C.DATA_FILES.series, 'series.txt');
  eq('DATA_FILES.acl', api.C.DATA_FILES.acl, 'acl.txt');
  eq('DATA_FILES.dict', api.C.DATA_FILES.dict, 'dict.json');
  eq('DATA_REMOTE', api.C.DATA_REMOTE, true);
  ok('DATA_BASE 为 https', api.C.DATA_BASE.startsWith('https://'));
}
{
  const env = makeEnv();
  const fp = 'FP0001';
  const tx = 'X'.repeat(101);
  env.rec.store.set('zhx.dt.items', fp + '\n' + tx);
  const api = buildCore(env);
  const c = await api._readCachedTable('items');
  eq('读：fp 解析', c?.fp, fp);
  eq('读：tx 解析', c?.tx, tx);
  eq('读：tx 长度 101 通过（>100）', c?.tx.length, 101);
}
{
  const env = makeEnv();
  env.rec.store.set('zhx.dt.items', 'FP\n' + 'X'.repeat(100));
  const api = buildCore(env);
  eq('读：tx 长度 100 拒绝（>100 才收）', await api._readCachedTable('items'), null);
}
{
  const env = makeEnv();
  env.rec.store.set('zhx.dt.items', 'NONEWLINE-VALUE');
  const api = buildCore(env);
  eq('读：无换行 → null', await api._readCachedTable('items'), null);
}
{
  const env = makeEnv();
  env.rec.store.set('zhx.dt.items', '\nSHORT');
  const api = buildCore(env);
  eq('读：空指纹 → null', await api._readCachedTable('items'), null);
}
{
  const env = makeEnv();
  const api = buildCore(env);
  eq('读：缺失 → null', await api._readCachedTable('items'), null);
}
{
  const env = makeEnv();
  const api = buildCore(env);
  api._writeCachedTable('items', 'FP9', 'BODY'.repeat(50));
  const call = env.rec.setCalls[0];
  eq('写：requestIdleCallback 路径被调', env.rec.idles.length, 1);
  eq('写：键 zhx.dt.items', call?.[0], 'zhx.dt.items');
  eq('写：值 = 指纹 + 换行 + 文本', call?.[1], 'FP9' + '\n' + 'BODY'.repeat(50));
}
{
  const env = makeEnv({ requestIdleCallback: undefined });
  const api = buildCore(env);
  api._writeCachedTable('items', 'FP9', 'BODY'.repeat(50));
  eq('写：无 idle 时 setTimeout 路径', env.rec.timers.length, 1);
  eq('写：setTimeout 路径也写入', env.rec.setCalls[0]?.[1], 'FP9' + '\n' + 'BODY'.repeat(50));
}
{
  const env = makeEnv();
  const api = buildCore(env);
  api._writeCachedTable('items', '', 'BODY'.repeat(50));
  api._writeCachedTable('items', 'FP', '');
  eq('写：空指纹 / 空文本不写', env.rec.setCalls.length, 0);
}

console.log('\n── dom / runtime：去重 / 错误边界 ──');
{
  const api = buildCore(makeEnv());
  eq('dedupe：空数组', JSON.stringify(api.dedupeByAncestor([])), '[]');
  // v1.4 Phase 7 升级：按祖先链去重（节点用 parentNode 关系表达层级）
  const A = { nodeType: 1, parentNode: null };
  const B = { nodeType: 1, parentNode: A };
  const C = { nodeType: 3 };
  const r1 = api.dedupeByAncestor([A, B]);
  eq('dedupe：后代被去重（父在前）', r1.length, 1);
  eq('dedupe：保留祖先', r1[0] === A, true);
  const r1b = api.dedupeByAncestor([B, A]);
  eq('dedupe：后代被去重（父在后同样只留祖先）', r1b.length === 1 && r1b[0] === A, true);
  const r2 = api.dedupeByAncestor([B, C]);
  eq('dedupe：独立节点保留', r2.length, 2);
  const r3 = api.dedupeByAncestor([C]);
  eq('dedupe：文本节点直接保留', r3.length, 1);
  const r4 = api.dedupeByAncestor([B, B, C]);
  eq('dedupe：同节点重复入队只保留一次', r4.length, 2);
}
{
  const env = makeEnv();
  const api = buildCore(env);
  const f = api.safe((a, b) => a + b, 'tag1');
  eq('safe：正常调用返回结果', f(1, 2), 3);
  const g = api.safe(() => { throw new Error('x'); }, 'tag2');
  let threw = false;
  try { g(); } catch (e) { threw = true; }
  ok('safe：异常不出栈', !threw);
  eq('safe：异常被 console.warn 记录', env.rec.warns.length, 1);
  eq('safe：tag 进入警告前缀', String(env.rec.warns[0]?.[0] || '').startsWith('tag2'), true);
  eq('safe：返回 undefined', g(), undefined);
}
{
  const api = buildCore(makeEnv({ performance: undefined }));
  eq('runtime：无 performance 时 __zhxBootAt=0', api.__zhxBootAt, 0);
}

console.log('\n── cache registry：登记与容量防线（Phase 14）──');
{
  const api = buildCore(makeEnv());
  eq('登记条目 = 8', api.__cacheReg.size, 8);
  const kinds = {};
  for (const [, e] of api.__cacheReg) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  eq('lookup / derived / translate = 3 / 3 / 2', `${kinds.lookup}/${kinds.derived}/${kinds.translate}`, '3/3/2');
  const m = new Map([['a', 1], ['b', 2]]);
  ok('cacheGuard：未达上限不动', api.cacheGuard(m, 3) === false && m.size === 2);
  ok('cacheGuard：达上限清空', api.cacheGuard(m, 2) === true && m.size === 0);
}

// ═════════════════════════ 汇总 ═════════════════════════════════
console.log(`\n════════ ${pass + fail} 项 | 通过 ${pass} | 失败 ${fail} ════════`);
process.exit(fail ? 1 : 0);
