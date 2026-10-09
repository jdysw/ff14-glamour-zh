// wiki 反查块夹具测试 v2：
//  A 数据不可用（阻断数据站）→ 优雅降级 2 项
//  B 数据预置（缓存命中）→ 4 项齐 + 零网络
// v1.4 Phase 3：测试 hook 已内建于 src（__zhxTestSite 指定站点 / __zhxTestTables 覆写表清单）
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl, cachePath } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const FIXTURE = fixtureUrl('wiki-item.html');

const s = readDist();
fs.writeFileSync(cachePath('gf-wiki-test.user.js'), s);
const GF = s;
console.log('测试副本已生成（hook 已内建于 src）');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.__reqLog = [];
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? (k === 'zhx.data.refresh.epoch' ? 'candidate-policy-1-force-refresh' : d) : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) { window.__setFail = (window.__setFail || 0) + 1; } };
  window.GM_xmlhttpRequest = (opt) => {
    window.__reqLog.push(opt.url);
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const dumpBlock = `(() => {
  const b = document.querySelector('.zhixia-reverse-block');
  const lis = b ? [...b.querySelectorAll('li a')].map((a) => ({ t: a.textContent, h: a.getAttribute('href') })) : null;
  let otherLinks = null;
  for (const bl of document.querySelectorAll('.ff14-content-box-block')) {
    const tt = bl.querySelector('.ff14-content-box-block--title');
    if (tt && tt.textContent.trim() === '其他站点链接') {
      otherLinks = [...bl.querySelectorAll('li a')].map((a) => a.getAttribute('href'));
    }
  }
  return { blockLinks: lis, hr: b ? !!b.querySelector('hr') : null, otherLinks, done: document.documentElement.dataset.zhixiaWikiDone || '', reqUrls: (window.__reqLog || []) };
})()`;

// ============ 场景 A：数据不可用 ============
console.log('\n===== 场景 A：数据不可用（阻断数据站）=====');
const t1 = await newPage(PORT, FIXTURE);
const c1 = t1.cdp;
await c1.send('Network.enable');
await c1.send('Network.setBlockedURLs', { urls: ['*zhixia-data.pages.dev*'] });
await sleep(800);
await c1.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
await c1.eval("window.__zhxTestSite = 'wiki';");
await c1.eval("window.__zhxTestTables = ['items'];");
await c1.eval(gmStub);
await c1.eval(wrap(GF));
await sleep(6000);
const rA = await c1.eval(dumpBlock);
console.log(JSON.stringify(rA, null, 1));
console.log('console A:', c1.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join(' | ').slice(0, 700));
// 场景 A 断言（Phase 20）：数据不可用 → 优雅降级（区块保留可用条目、不含依赖本地数据的条目、不阻塞）
let aFail = 0;
const aLinks = rA.blockLinks || [];
const aHasDataDep = aLinks.some((x) => x.h.indexOf('eorzeacollection') >= 0 || x.h.indexOf('lookbook.ronkacloset') >= 0);
if (rA.blockLinks !== null && aLinks.length >= 1 && aLinks.length <= 3 && !aHasDataDep) { console.log('✅ A1 降级形态：链接 ' + aLinks.length + ' 条、不含依赖数据的条目'); } else { console.log('❌ A1 降级形态不符', JSON.stringify(aLinks)); aFail++; }
const aErr = c1.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
if (!aErr) { console.log('✅ A2 无 [TEST-INJECT] 错误'); } else { console.log('❌ A2 存在注入错误'); aFail++; }
if (rA.reqUrls.length >= 1) { console.log('✅ A3 尝试过数据下载且未阻塞'); } else { console.log('❌ A3 未尝试数据下载'); aFail++; }
console.log(aFail ? '场景 A 失败 ' + aFail + ' 项' : '场景 A 通过 3/3');
await closePage(PORT, t1.target.id);

// ============ 场景 B：预置数据、零网络 ============
console.log('\n===== 场景 B：预置 items 缓存（零网络路径）=====');
const itemsTsv = fs.readFileSync(itemsTsvPath, 'utf8');
const FP = 'testfp000001';
const setCache = (cdp, key, value) => cdp.callFn('function (k, v) { localStorage.setItem(k, v); return 1; }', [key, value]);
const t2 = await newPage(PORT, FIXTURE);
const c2 = t2.cdp;
await sleep(800);
const p1 = await setCache(c2, 'gm:zhx.dt.items', FP + '\n' + itemsTsv);
const p3 = await c2.eval(`(() => { localStorage.setItem('gm:zhx.meta', JSON.stringify({ v: 'test', t: Date.now(), candidatePolicy: 1 })); return 1; })()`);
// v3 探测节流（v1.4 Phase 12）：预置 v3 manifest 缓存（本站不在其中 → 静默跳过；24h 内不再探测）
const p4 = await setCache(c2, 'gm:zhx.v3.manifest', String(Date.now()) + '\n' + JSON.stringify({ schema: 3, candidatePolicy: 1, sites: {} }));
console.log('预置完成:', p1, p3, p4);
await c2.eval("window.__zhxTestSite = 'wiki';");
await c2.eval("window.__zhxTestTables = ['items'];" );
await c2.eval(gmStub);
await c2.eval(wrap(GF));
await sleep(6000);
const rB = await c2.eval(dumpBlock);
console.log(JSON.stringify(rB, null, 1));
console.log('console B:', c2.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join(' | ').slice(0, 900));
// 场景 B 断言：装备页四站齐 + 区块含标题下分隔线（hr，与「其他站点链接」同款）
let bFail = 0;
if (!rB.blockLinks || rB.blockLinks.length !== 4) { console.log('❌ B1 反查区块应含 4 条链接'); bFail++; } else { console.log('✅ B1 反查区块 4 条链接'); }
if (rB.hr !== true) { console.log('❌ B2 区块应含标题下分隔线（hr）'); bFail++; } else { console.log('✅ B2 区块含标题下分隔线（hr）'); }
console.log(bFail ? '场景 B 失败 ' + bFail + ' 项' : '场景 B 通过 2/2');
await closePage(PORT, t2.target.id);

// ============ 场景 C：非装备页（不应注入区块）============
console.log('\n===== 场景 C：非装备页（消耗品——不应出现反查块）=====');
const FIXTURE_NON = fixtureUrl('wiki-nonitem.html');
const t3 = await newPage(PORT, FIXTURE_NON);
const c3 = t3.cdp;
await sleep(800);
await setCache(c3, 'gm:zhx.dt.items', FP + '\n' + itemsTsv);
await c3.eval(`(() => { localStorage.setItem('gm:zhx.meta', JSON.stringify({ v: 'test', t: Date.now(), candidatePolicy: 1 })); return 1; })()`);
await setCache(c3, 'gm:zhx.v3.manifest', String(Date.now()) + '\n' + JSON.stringify({ schema: 3, candidatePolicy: 1, sites: {} }));
await c3.eval("window.__zhxTestSite = 'wiki';");
await c3.eval("window.__zhxTestTables = ['items'];");
await c3.eval(gmStub);
await c3.eval(wrap(GF));
await sleep(6000);
const rC = await c3.eval(dumpBlock);
console.log(JSON.stringify(rC, null, 1));
console.log('console C:', c3.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join(' | ').slice(0, 700));
// 场景 C 断言：非装备页不得注入反查区块、不得改动「其他站点链接」
let cFail = 0;
if (rC.blockLinks !== null) { console.log('❌ C1 非装备页不应注入反查区块'); cFail++; } else { console.log('✅ C1 非装备页未注入反查区块'); }
const olC = rC.otherLinks || [];
if (!olC.some((h) => /risingstones/.test(h))) { console.log('❌ C2 光之收藏家链接被误删'); cFail++; } else { console.log('✅ C2 「其他站点链接」保持原样'); }
console.log(cFail ? '场景 C 失败 ' + cFail + ' 项' : '场景 C 通过 2/2');
await closePage(PORT, t3.target.id);
process.exit(aFail + bFail + cFail ? 1 : 0);
