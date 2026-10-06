// wiki 反查块「移动皮肤/类名变体」回退测试 v1（v1.3.1 getSlot 多路回退）：
//  D1 类名变体（含 name-category 子串）→ 注入成功
//  D2 类名完全不符（仅文本可辨）→ 兜底扫描注入成功
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, fixturePath, cachePath, cacheUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);

let s = readDist();
const n1 = "onHost(host, 'huijiwiki.com')";
const n2 = "  function neededTables() {\n    const h = location.hostname;";
if (s.split(n1).length - 1 < 1) throw new Error('n1 计数异常: ' + (s.split(n1).length - 1));
if (s.split(n2).length - 1 !== 1) throw new Error('n2 计数异常: ' + (s.split(n2).length - 1));
s = s.split(n1).join("(onHost(host, 'huijiwiki.com') || location.protocol === 'file:')");
s = s.replace(n2, "  function neededTables() {\n    if (window.__zhxTestTables) return window.__zhxTestTables;\n    const h = location.hostname;");
fs.writeFileSync(cachePath('gf-wiki-fallback.user.js'), s);
const GF = s;
console.log('测试副本已生成（wiki 分支 + neededTables hook）');

// 变体夹具：D1 类名变体 / D2 无类名（文本可辨）
const base = fs.readFileSync(fixturePath('wiki-item.html'), 'utf8');
const anchor = 'class="infobox-item--name-category"';
if (base.split(anchor).length - 1 !== 1) throw new Error('夹具锚点计数异常: ' + (base.split(anchor).length - 1));
fs.writeFileSync(cachePath('wiki-item-d1.html'), base.replace(anchor, 'class="infobox-item--name-category-vnext"'));
fs.writeFileSync(cachePath('wiki-item-d2.html'), base.replace(anchor, 'class="zhx-mobile-cat"'));
console.log('变体夹具已生成（d1/d2）');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => { try { opt.onerror && opt.onerror(new Error('blocked')); } catch (e) {} };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const dump = `(() => {
  const b = document.querySelector('.zhixia-reverse-block');
  const links = b ? [...b.querySelectorAll('li a')].map((a) => a.textContent) : null;
  return { has: !!b, n: links ? links.length : 0, links, done: document.documentElement.dataset.zhixiaWikiDone || '' };
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

console.log('\n════════ 汇总 ════════');
console.log(`通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
