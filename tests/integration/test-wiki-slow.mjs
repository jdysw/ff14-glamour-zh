// 慢渲染回归测试（Via/移动端场景）：
// 页面主体结构延迟 5.5s 注入——旧版固定 3 次重试（约 4s 内用尽）会永久放弃；
// 断言：新版脚本在阶梯重试窗口（15s）内最终完成反查区块注入（≥2 条基础链接，零网络依赖）。
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const FIXTURE = fixtureUrl('wiki-slow.html');

let s = readDist();
const n1 = "onHost(host, 'huijiwiki.com')";
const n2 = "  function neededTables() {\n    const h = location.hostname;";
if (s.split(n1).length - 1 < 1) throw new Error('n1 计数异常');
if (s.split(n2).length - 1 !== 1) throw new Error('n2 计数异常');
s = s.split(n1).join("(onHost(host, 'huijiwiki.com') || location.protocol === 'file:')");
s = s.replace(n2, "  function neededTables() {\n    if (window.__zhxTestTables) return window.__zhxTestTables;\n    const h = location.hostname;");
const GF = s;
console.log('测试副本已生成（wiki 分支 + neededTables hook）');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => { try { opt.onerror && opt.onerror(new Error('blocked-by-test')); } catch (e) {} };
})();`;
// 注：数据站请求一律失败——聚焦验证「无网络数据时，慢渲染 DOM 仍能注入基础链接」

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const t = await newPage(PORT, FIXTURE);
const c = t.cdp;
await sleep(500);

// 预置空数据路径（items 缓存存在 + meta 新鲜 → 快路径通过，避免网络等待干扰时序）
const itemsTsv = fs.readFileSync(itemsTsvPath, 'utf8');
await c.eval(`(() => { localStorage.setItem('gm:zhx.dt.items', ${JSON.stringify('testfp000001' + '\n' + itemsTsv)}); return 1; })()`);
await c.eval(`(() => { localStorage.setItem('gm:zhx.meta', JSON.stringify({ v: 'test', t: Date.now() })); return 1; })()`);
await c.eval("window.__zhxTestTables = ['items'];");
await c.eval(gmStub);
const readyStateAtInject = await c.eval('document.readyState');
console.log('注入时 readyState:', readyStateAtInject);
const tInject = Date.now();
await c.eval(wrap(GF));

// 轮询（最多 22s）：等待反查区块出现
let r = null;
for (let i = 0; i < 22; i++) {
  await sleep(1000);
  r = await c.eval(`(() => {
    const b = document.querySelector('.zhixia-reverse-block');
    if (!b) return null;
    return { n: b.querySelectorAll('li a').length, done: document.documentElement.dataset.zhixiaWikiDone || '' };
  })()`);
  if (r) break;
}
const elapsed = ((Date.now() - tInject) / 1000).toFixed(1);

let fail = 0;
if (!r) { console.log('❌ 慢渲染下反查区块未注入（等待超时 22s）'); fail++; }
else if (r.n < 2) { console.log('❌ 区块链接数不足 2（get ' + r.n + '）'); fail++; }
else { console.log(`✅ 慢渲染（主体 5.5s 后出现）下区块成功注入：链接数 ${r.n}，用时约 ${elapsed}s，done=${r.done}`); }
console.log('console:', c.consoleLines.filter((l) => l.includes('幻化') || l.includes('TEST')).join(' | ').slice(0, 500));
await closePage(PORT, t.target.id);
process.exit(fail ? 1 : 0);
