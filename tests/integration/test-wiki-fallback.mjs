// wiki 反查块「移动皮肤/类名变体/双份结构」回退测试 v2：
//  D1 类名变体（含 name-category 子串）→ 注入成功
//  D2 类名完全不符（仅文本可辨）→ 兜底扫描注入成功
//  D3 双份结构·移动视口 400px（hide-m 副本被 CSS 隐藏）→ 注入落在可见副本（hide-pc）
//  D4 双份结构·桌面视口 1280px（hide-pc 副本被 CSS 隐藏）→ 注入落在可见副本（hide-m）
// v1.4 Phase 3：测试 hook 已内建于 src（__zhxTestSite 指定站点 / __zhxTestTables 覆写表清单）
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, fixturePath, fixtureUrl, cachePath, cacheUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);

const s = readDist();
fs.writeFileSync(cachePath('gf-wiki-fallback.user.js'), s);
const GF = s;
console.log('测试副本已生成（hook 已内建于 src）');

// 变体夹具：D1 类名变体 / D2 无类名（文本可辨）
const base = fs.readFileSync(fixturePath('wiki-item.html'), 'utf8');
const anchor = 'class="infobox-item--name-category"';
if (base.split(anchor).length - 1 !== 1) throw new Error('夹具锚点计数异常: ' + (base.split(anchor).length - 1));
fs.writeFileSync(cachePath('wiki-item-d1.html'), base.replace(anchor, 'class="infobox-item--name-category-vnext"'));
fs.writeFileSync(cachePath('wiki-item-d2.html'), base.replace(anchor, 'class="zhx-mobile-cat"'));
console.log('变体夹具已生成（d1/d2；d3/d4 用固定夹具 wiki-item-dual.html）');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? (k === 'zhx.data.refresh.epoch' ? 'candidate-policy-1-force-refresh' : d) : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => { try { opt.onerror && opt.onerror(new Error('blocked')); } catch (e) {} };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const dump = `(() => {
  const b = document.querySelector('.zhixia-reverse-block');
  const links = b ? [...b.querySelectorAll('li a')].map((a) => a.textContent) : null;
  return { has: !!b, n: links ? links.length : 0, links, done: document.documentElement.dataset.zhixiaWikiDone || '' };
})()`;

// D3/D4：双份结构（hide-m/hide-pc）下检查注入落在哪一份副本
// hasStar 排除反查块自身的链接（反查块里也有「光之收藏家」条目）
const dumpDual = `(() => {
  const b = document.querySelector('.zhixia-reverse-block');
  const links = b ? [...b.querySelectorAll('li a')].map((a) => a.textContent) : [];
  const copyA = document.getElementById('zhx-copy-a');
  const copyB = document.getElementById('zhx-copy-b');
  const hasStar = (cop) => !!cop && [...cop.querySelectorAll('a')].some((a) => {
    const h = a.getAttribute('href') || '';
    return h.includes('risingstones') && !a.closest('.zhixia-reverse-block');
  });
  return {
    has: !!b, n: links.length,
    dispA: copyA ? getComputedStyle(copyA).display : null,
    dispB: copyB ? getComputedStyle(copyB).display : null,
    inA: !!(b && copyA && copyA.contains(b)),
    inB: !!(b && copyB && copyB.contains(b)),
    aStar: hasStar(copyA), bStar: hasStar(copyB),
    hasHr: b ? !!b.querySelector('hr') : false,
    done: document.documentElement.dataset.zhixiaWikiDone || ''
  };
})()`;

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' —— ' + extra : ''}`); }
};

for (const [tag, file] of [['D1 类名变体', 'wiki-item-d1.html'], ['D2 无类名（兜底扫描）', 'wiki-item-d2.html']]) {
  console.log(`\n════ 场景 ${tag} ════`);
  const t = await newPage(PORT, cacheUrl(file));
  const c = t.cdp;
  await sleep(700);
  await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
  await c.eval("window.__zhxTestSite = 'wiki';");
  await c.eval("window.__zhxTestTables = [];");
  await c.eval(gmStub);
  await c.eval(wrap(GF));
  await sleep(6000);
  const r = await c.eval(dump);
  console.log(JSON.stringify(r));
  console.log('console:', c.consoleLines.filter((l) => l.includes('幻化') || l.includes('TEST')).join(' | ').slice(0, 400));
  check('反查块已注入', r.has === true, JSON.stringify(r));
  check('至少 2 项链接（光之收藏家 + 日服）', r.n >= 2, 'n=' + r.n);
  check('光之收藏家存在', !!r.links && r.links.some((x) => x.includes('光之收藏家')));
  check('done 标志', r.done === '1', r.done);
  await closePage(PORT, t.target.id);
}

// ============ 场景 D3/D4：同内容双份渲染（hide-m / hide-pc，2026-10 真机复盘）============
// 背景：移动版把「各语言名称/其他站点链接」渲染两份——hide-m（手机端隐藏）/ hide-pc（电脑端隐藏）。
// 修复前按文档顺序取第一份 → 手机端插进隐藏副本 → DOM 在但肉眼不可见（真机实测 bug）。
// 修复：blockByTitle 优先返回「当前端可见」的副本（_visible）。
// 视口模拟说明：用 newPage 的 width/height 选项（即 mobile:false + 精确布局宽度）。
//   勿用 mobile:true 手动覆写——夹具无 viewport meta 时会被切到移动默认视口 980px，干扰媒体查询。
async function dualFlow(tag, width, height) {
  console.log(`\n════ 场景 ${tag} ════`);
  const t = await newPage(PORT, fixtureUrl('wiki-item-dual.html'), { width, height });
  const c = t.cdp;
  await sleep(700);
  const mq = await c.eval("matchMedia('(max-width: 720px)').matches");
  const ca = await c.eval("getComputedStyle(document.getElementById('zhx-copy-a')).display");
  const cb = await c.eval("getComputedStyle(document.getElementById('zhx-copy-b')).display");
  console.log('viewport:', width + 'px', '| mq720 =', mq, '| copyA =', ca, '| copyB =', cb);
  await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
  await c.eval("window.__zhxTestSite = 'wiki';");
  await c.eval("window.__zhxTestTables = [];");
  await c.eval(gmStub);
  await c.eval(wrap(GF));
  await sleep(6000);
  const r = await c.eval(dumpDual);
  console.log(JSON.stringify(r));
  console.log('console:', c.consoleLines.filter((l) => l.includes('幻化') || l.includes('TEST')).join(' | ').slice(0, 300));
  await closePage(PORT, t.target.id);
  return r;
}

console.log('\n════ 场景 D3 双份结构·移动视口（应跳过 hide-m 副本）════');
{
  const r = await dualFlow('D3', 400, 705);
  check('前置：copyA 隐藏 / copyB 可见', r.dispA === 'none' && r.dispB !== 'none', 'dispA=' + r.dispA + ' dispB=' + r.dispB);
  check('反查块落在移动端可见副本（zhx-copy-b）', r.inB === true, JSON.stringify(r));
  check('未落入移动端隐藏副本（zhx-copy-a）', r.inA === false, JSON.stringify(r));
  check('可见副本内「光之收藏家」已移除', r.bStar === false, 'bStar=' + r.bStar);
  check('隐藏副本条目未被误删（保留）', r.aStar === true, 'aStar=' + r.aStar);
  check('区块含 hr 且链接 ≥2', r.hasHr === true && r.n >= 2, 'n=' + r.n + ' hr=' + r.hasHr);
}
console.log('\n════ 场景 D4 双份结构·桌面视口（应跳过 hide-pc 副本）════');
{
  const r = await dualFlow('D4', 1280, 900);
  check('前置：copyB 隐藏 / copyA 可见', r.dispB === 'none' && r.dispA !== 'none', 'dispA=' + r.dispA + ' dispB=' + r.dispB);
  check('反查块落在桌面端可见副本（zhx-copy-a）', r.inA === true, JSON.stringify(r));
  check('未落入桌面端隐藏副本（zhx-copy-b）', r.inB === false, JSON.stringify(r));
  check('可见副本内「光之收藏家」已移除', r.aStar === false, 'aStar=' + r.aStar);
  check('隐藏副本条目未被误删（保留）', r.bStar === true, 'bStar=' + r.bStar);
  check('区块含 hr 且链接 ≥2', r.hasHr === true && r.n >= 2, 'n=' + r.n + ' hr=' + r.hasHr);
}

console.log('\n════════ 汇总 ════════');
console.log(`通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
