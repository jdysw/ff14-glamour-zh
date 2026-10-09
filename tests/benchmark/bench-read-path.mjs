// bench-read-path.mjs — V3 缓存读取路径细分基准（ec：V3 site files + shared dict）
// 记录可用的 V3 诊断点、GM 存储读取耗时、缓存命中数和数据索引规模。
// 预置生成器产出的真实 V3 manifest 与内容寻址文件缓存；网络请求由 stub 拒绝。
// CPU 节流 1x/4x/8x；每档默认 3 轮
// 用内建诊断记录，不从 dist 文本提取或改写运行时代码。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { distFile, fixtureUrl } from '../helpers/paths.mjs';
import { seedV3Browser } from '../helpers/v3-cache.mjs';
import { writeReport } from './report.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const ROUNDS = Number(process.env.ZHX_BENCH_ROUNDS || 3);
const FIXTURE = fixtureUrl('ec-page.html');
const DIST = distFile;

const GF = fs.readFileSync(DIST, 'utf8');
const variant = 'v3-cache';

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  window.__gmAcc = 0;
  window.__gmReq = 0;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { const t = performance.now(); try { const v = localStorage.getItem(P + k); window.__gmAcc += performance.now() - t; return v == null ? d : v; } catch (e) { window.__gmAcc += performance.now() - t; return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => {
    window.__gmReq++;
    try { opt.onerror && opt.onerror(new Error('unexpected network request in V3 cache benchmark')); } catch (e) {}
  };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const clear = `(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`;

const runOne = async (rate, round) => {
  const t = await newPage(PORT, FIXTURE);
  const c = t.cdp;
  try {
    await sleep(400);
    await c.send('Emulation.setCPUThrottlingRate', { rate });
    await c.eval(clear);
    await c.eval(`window.__zhxTestSite = 'ec'; window.__zhxTestTables = ['items','dict']; window.__zhxTestIndexes = ['nameMap','itemHash']; window.__zhxDiagOn = true;`);
    await seedV3Browser(c, 'ec');
    await c.eval(gmStub);
    // 注入 V3 缓存命中基准副本
    await c.eval(`window.__zhxT = {};\n` + wrap(GF));
    // 轮询等待就绪
    let ok = false;
    for (let i = 0; i < 400; i++) {
      await sleep(150);
      const st = await c.eval("(typeof window.__zhxDiagRecord === 'function') && !!(window.__zhxDiagRecord().marks || {}).fireDone");
      if (st) { ok = true; break; }
    }
    const z = await c.eval(`(() => { const d = window.__zhxDiagRecord(); return { boot: d.boot, ...(d.marks || {}), gmAcc: window.__gmAcc || 0, gmReq: window.__gmReq || 0, data: d.data, dl: d.dl, dict: d.dict }; })()`);
    if (!ok || !z.fireDone || z.gmReq !== 0 || !z.dl || z.dl.cache < 5) throw new Error('未就绪或没有完整 V3 缓存命中: ' + JSON.stringify(z));
    console.log('  [' + rate + 'x #' + round + '] boot=' + z.boot + 'ms finalize=' + z.finalize + ' ready=' + z.ready + ' fireDone=' + z.fireDone + ' | localStorage=' + z.gmAcc.toFixed(1) + 'ms cache=' + z.dl.cache + ' net=' + z.dl.net + ' names=' + z.data.names + ' dict=' + z.dict.chars);
    return z;
  } finally {
    try { await closePage(PORT, t.target.id); } catch (e) {}
  }
};

const rates = [1, 4, 8];
const med = (arr) => { const a = [...arr].filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };

const all = {};
for (const rate of rates) {
  console.log('\n════ ' + variant + ' @ ' + rate + 'x ════');
  all[rate] = [];
  for (let r = 1; r <= ROUNDS; r++) {
    try { all[rate].push(await runOne(rate, r)); } catch (e) { console.log('  [' + rate + 'x #' + r + '] 失败: ' + e.message); }
  }
}

console.log('\n════════ ' + variant + ' 汇总（中位数）════════');
console.log('档位 | boot | finalize | ready | fireDone | localStorage ms | V3 cache | net | name keys | dict chars');
const report = { rates: {} };
for (const rate of rates) {
  const runs = all[rate];
  if (!runs.length) { console.log(rate + 'x | 无数据'); report.rates[rate] = null; continue; }
  const field = (k) => med(runs.map((z) => z[k]));
  const f = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
  const row = {
    boot: field('boot'),
    finalize: field('finalize'),
    ready: field('ready'),
    fireDone: field('fireDone'),
    localStorageMs: field('gmAcc'),
    cacheHits: med(runs.map((z) => z.dl.cache)),
    networkRequests: med(runs.map((z) => z.dl.net)),
    nameKeys: med(runs.map((z) => z.data.names)),
    dictChars: med(runs.map((z) => z.dict.chars)),
    runs: runs.length,
  };
  report.rates[rate] = row;
  console.log(rate + 'x | ' + f(row.boot) + ' | ' + f(row.finalize) + ' | ' + f(row.ready) + ' | ' + f(row.fireDone)
    + ' | ' + f(row.localStorageMs) + ' | ' + f(row.cacheHits) + ' | ' + f(row.networkRequests)
    + ' | ' + f(row.nameKeys) + ' | ' + f(row.dictChars));
}
writeReport('read-path-ec', report, { save: process.argv.includes('--save'), args: ['rates=' + rates.join('/'), 'rounds=' + ROUNDS] });
