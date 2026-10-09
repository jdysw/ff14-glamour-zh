// tests/integration/test-mirapri.mjs — Phase 20：mirapri 站夹具回归（离线）
// 背景：云端 IP 访问 mirapri.com 被 Cloudflare 拦截（直连/代理均挑战），真站 live 不可达；
//       与 wiki 同策略——以夹具页 + __zhxTestSite='mirapri' 冻结本站在核心链路的行为。
// 覆盖：PATTERNS 文本（全身を切り取る→裁切全身）/ title=原文 keep / 搜索框 placeholder /
//       document.title / 物品链（a.eorzeadb_link → 中文名 + 灰机链接；纯文本 item 包装）/
//       染剂 tag / bfcache pageshow 补跑（经 __zhxDiagRecord().dom.calls 差值断言）。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();
const FIXTURE = fixtureUrl('mirapri-page.html');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.__reqLog = [];
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) { window.__setFail = (window.__setFail || 0) + 1; } };
  window.GM_xmlhttpRequest = (opt) => {
    window.__reqLog.push(opt.url);
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const ZH = '特罗亚精准缠头巾';
const WIKI = 'https://ff14.huijiwiki.com/wiki/物品:' + encodeURIComponent(ZH);

const dump = `(() => {
  const nav = [...document.querySelectorAll('nav span')].find((s) => (s.textContent || '').indexOf('裁切全身') >= 0);
  const navOrig = [...document.querySelectorAll('nav span')].find((s) => s.getAttribute('title') && s.getAttribute('title').indexOf('全身') >= 0);
  const hint = document.querySelector('.hint');
  const ph = document.querySelector('input[placeholder]');
  const a = document.querySelector('a.eorzeadb_link');
  const pl = document.querySelector('[class*="has-text-rarity-"]');
  const dye = document.querySelector('div.tag');
  return {
    navText: nav ? nav.textContent.trim() : null,
    navTitle: navOrig ? navOrig.getAttribute('title') : null,
    hint: hint ? hint.textContent.trim() : null,
    ph: ph ? ph.getAttribute('placeholder') : null,
    link: a ? { text: (a.textContent || '').trim(), href: a.getAttribute('href'), marked: a.classList.contains('zhixia-item-zh') } : null,
    plain: pl ? { text: (pl.textContent || '').trim(), tag: pl.tagName, href: pl.getAttribute ? pl.getAttribute('href') : null } : null,
    dye: dye ? dye.textContent.trim() : null,
    title: document.title,
    calls: (() => { try { return window.__zhxDiagRecord().dom.calls; } catch (e) { return -1; } })(),
    reqCount: (window.__reqLog || []).length,
  };
})()`;

const itemsTsv = fs.readFileSync(itemsTsvPath, 'utf8');
const FP = 'testfp000001';
// 预置写入经 CDP callFunctionOn 传参执行（数据不走代码拼接；CodeQL: js/bad-code-sanitization）
const SET_ITEM_FN = 'function (k, v) { localStorage.setItem(k, v); return 1; }';
const seedItem = (c, k, txt) => c.callFn(SET_ITEM_FN, [k, FP + '\n' + txt]);

const t = await newPage(PORT, FIXTURE);
const c = t.cdp;
await sleep(800);
await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.indexOf('gm:') === 0) localStorage.removeItem(k); localStorage.setItem('gm:zhx.candidate.policy', '1'); return 1; })()`);
console.log('预置 items:', await seedItem(c, 'gm:zhx.dt.items', itemsTsv));
console.log('预置 meta:', await c.callFn('function (v) { localStorage.setItem("gm:zhx.meta", v); return 1; }', [JSON.stringify({ v: 'test', t: Date.now() })]));
// v3 探测节流：预置空 v3 manifest（本站不在其中 → v3 静默跳过）→ 零网络成立
console.log('预置 v3 缓存:', await c.callFn('function (v) { localStorage.setItem("gm:zhx.v3.manifest", v); return 1; }', [String(Date.now()) + '\n' + JSON.stringify({ schema: 3, sites: {} })]));
await c.eval("window.__zhxTestSite = 'mirapri';");
await c.eval("window.__zhxTestTables = ['items'];");
await c.eval('window.__zhxDiagOn = true;');   // Phase 19：无面板测量开关（bfcache 差值断言用）
await c.eval(gmStub);
await c.eval(wrap(GF));
await sleep(9000);
const r = await c.eval(dump);
console.log('\n--- 结果 ---');
console.log(JSON.stringify(r, null, 1));

console.log('\n--- 断言 ---');
const testErr = c.consoleLines.some((l) => l.includes('[TEST-INJECT]'));
const checks = [
  ['① PATTERNS 文本 → 裁切全身', r.navText === '裁切全身', String(r.navText)],
  ['② title=原文 keep（hover 提示）', r.navTitle === '全身を切り取る', String(r.navTitle)],
  ['③ Loading... → 加载中…', !!r.hint && r.hint.indexOf('加载中') === 0, String(r.hint)],
  ['④ 占位符 → 输入装备名等', r.ph === '输入装备名等', String(r.ph)],
  ['⑤ 物品链接 → 中文名', r.link && r.link.text === ZH, r.link ? r.link.text : 'null'],
  ['⑥ 物品链接 href → 灰机 wiki', r.link && r.link.href === WIKI, r.link ? r.link.href : 'null'],
  ['⑦ 物品链接已标记 zhixia-item-zh', r.link && r.link.marked === true],
  ['⑧ 纯文本 item → 包装为 a + 中文 + wiki', r.plain && r.plain.tag === 'A' && r.plain.text === ZH && r.plain.href === WIKI, JSON.stringify(r.plain)],
  ['⑨ 染剂 → ⬤ 深渊蓝染剂', r.dye === '⬤ 深渊蓝染剂', String(r.dye)],
  ['⑩ document.title 已汉化', r.title.indexOf('幻化截图投稿') >= 0, r.title],
  ['⑪ 零网络（缓存路径）', r.reqCount === 0, JSON.stringify(r.reqCount)],
  ['⑫ 无 [TEST-INJECT] 错误', !testErr],
];
let pass = 0;
for (const [name, okf, extra] of checks) {
  console.log((okf ? '✅' : '❌') + ' ' + name + (okf || !extra ? '' : '  实际: ' + extra));
  if (okf) pass++;
}

// ── bfcache：pageshow 补跑断言（persisted:false 不触发；persisted:true 触发一次补跑）──
console.log('\n--- bfcache（pageshow）---');
const calls0 = await c.eval(`window.__zhxDiagRecord ? window.__zhxDiagRecord().dom.calls : -1`);
await c.eval(`(() => { window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false })); return 1; })()`);
await sleep(900);
const calls1 = await c.eval(`window.__zhxDiagRecord ? window.__zhxDiagRecord().dom.calls : -1`);
await c.eval(`(() => { window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); return 1; })()`);
await sleep(1500);
const calls2 = await c.eval(`window.__zhxDiagRecord ? window.__zhxDiagRecord().dom.calls : -1`);
console.log(`dom.calls: 初始=${calls0}  persisted:false 后=${calls1}  persisted:true 后=${calls2}`);
const bf1 = calls0 > 0 && calls1 === calls0;
const bf2 = calls2 > calls1;
checks.push(['⑬ persisted:false 不触发补跑', bf1, `${calls0} → ${calls1}`]);
checks.push(['⑭ persisted:true 触发补跑（dom.calls+）', bf2, `${calls1} → ${calls2}`]);
console.log((bf1 ? '✅' : '❌') + ` persisted:false 不触发补跑（${calls0} → ${calls1}）`);
console.log((bf2 ? '✅' : '❌') + ` persisted:true 触发补跑（${calls1} → ${calls2}）`);
if (bf1) pass++;
if (bf2) pass++;

console.log(`\n${pass}/${checks.length} 通过`);
console.log('\nconsole:', c.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join(' | ').slice(0, 900));
await closePage(PORT, t.target.id);
process.exit(pass === checks.length ? 0 : 1);
