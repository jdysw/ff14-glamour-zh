// ronka 站端到端测试：GM 模拟（localStorage 持久）+ GF 版注入
// 覆盖：① 首访（真实下载数据 + 翻译 + 缓存写入）② 缓存命中（零网络）
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();

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

const koCount = `(document.body.innerText.match(/[\\uac00-\\ud7af]/g) || []).length`;

// ============ Test 1：首访 ============
console.log('===== Test 1：ronka 首访（清缓存 + 真实下载）=====');
const t1 = await newPage(PORT, 'about:blank');
const c1 = t1.cdp;
await c1.send('Page.navigate', { url: 'https://lookbook.ronkacloset.com/' });
await sleep(6000);
// 清空该域 gm: 存储，确保首访状态
const cleared = await c1.eval(`(() => { let n = 0; for (const k of Object.keys(localStorage)) { if (k.startsWith('gm:')) { localStorage.removeItem(k); n++; } } return n; })()`);
console.log('清理旧存储键数:', cleared);
await c1.eval(gmStub);
const before = await c1.eval(`({ ko: ${koCount}, spaLen: document.body.innerText.length })`);
console.log('注入前: 韩文字符', before.ko, '/ 文本长度', before.spaLen);
const t0 = Date.now();
await c1.eval(wrap(GF));
// 轮询等待数据完成（写入 dt.ronka 或 meta）
let done = false;
for (let i = 0; i < 40; i++) {
  await sleep(1500);
  const st = await c1.eval(`({ dt: !!localStorage.getItem('gm:zhx.dt.items'), meta: !!localStorage.getItem('gm:zhx.meta') })`).catch(() => ({}));
  if (st.dt || st.meta) { done = true; break; }
}
console.log('数据流程完成:', done, `（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
await sleep(4000); // 留时间 observer 翻译
const r1 = await c1.eval(`(() => {
  const reqUrls = (window.__reqLog || []);
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('gm:'));
  return {
    reqCount: reqUrls.length,
    reqUrls: reqUrls,
    stKeys: keys.map((k) => k + ' (' + localStorage.getItem(k).length + ' chars)'),
    ko: ${koCount},
    setFail: window.__setFail || 0,
    links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && !h.startsWith('http') && !h.startsWith('/_next') && !h.startsWith('/favicon') && !h.startsWith('/logo') && !h.startsWith('/manifest')).slice(0, 40),
  };
})()`);
console.log('\n--- 结果 ---');
console.log(JSON.stringify(r1, null, 1).slice(0, 2400));
console.log('\n--- console（脚本/TEST）---');
console.log(c1.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join('\n').slice(0, 1200));
await closePage(PORT, t1.target.id);

// ============ Test 2：缓存命中（同 profile 同域，不清理） ============
console.log('\n===== Test 2：ronka 缓存命中（零网络断言）=====');
const t2 = await newPage(PORT, 'about:blank');
const c2 = t2.cdp;
await c2.send('Page.navigate', { url: 'https://lookbook.ronkacloset.com/about' });
await sleep(6000);
await c2.eval(gmStub);
await c2.eval(wrap(GF));
let done2 = false;
for (let i = 0; i < 20; i++) {
  await sleep(1500);
  const st = await c2.eval(`!!(window.__gmReadyLog || []).length || document.body.innerText.length > 0`).catch(() => false);
  // 直接等固定时长即可
  if (i >= 5) { done2 = true; break; }
}
const r2 = await c2.eval(`(() => ({
  reqCount: (window.__reqLog || []).length,
  reqUrls: (window.__reqLog || []),
  stKeys: Object.keys(localStorage).filter((k) => k.startsWith('gm:')).length,
}))()`);
console.log('第二页请求数:', r2.reqCount, '（期望 0）');
console.log('请求列表:', JSON.stringify(r2.reqUrls));
console.log('存储键数:', r2.stKeys);
console.log('\n--- console 2（脚本）---');
console.log(c2.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化'))).join('\n').slice(0, 800));
await closePage(PORT, t2.target.id);
console.log('\n测试完成');
