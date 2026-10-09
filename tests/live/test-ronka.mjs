// ronka 站端到端测试：GM 模拟（localStorage 持久）+ GF 版注入（Phase 20：断言强化）
// 覆盖：① 首访（真实下载数据 + 翻译 + 缓存写入）② 缓存命中（零网络断言）
//       ③ 动态内容观察器翻译（SPA 型追加节点）
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';
import { CLEAN_BODY_TEXT } from '../helpers/clean-text.mjs';

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

const koCount = `(() => { let n = 0; const T = ${CLEAN_BODY_TEXT}; for (const ch of T) { const c = ch.codePointAt(0); if (c >= 0xAC00 && c <= 0xD7AF) n++; } return n; })()`;

const checks = [];
const push = (name, okf, extra = '') => {
  checks.push([name, okf]);
  console.log((okf ? '✅' : '❌') + ' ' + name + (okf || !extra ? '' : '  实际: ' + extra));
};

// ============ Test 1：首访 ============
console.log('===== Test 1：ronka 首访（清缓存 + 真实下载）=====');
const t1 = await newPage(PORT, 'about:blank');
const c1 = t1.cdp;
await c1.send('Page.navigate', { url: 'https://lookbook.ronkacloset.com/' });
await sleep(6000);
// 清空该域 gm: 存储，确保首访状态
const cleared = await c1.eval(`(() => { let n = 0; for (const k of Object.keys(localStorage)) { if (k.indexOf('gm:') === 0) { localStorage.removeItem(k); n++; } } return n; })()`);
console.log('清理旧存储键数:', cleared);
await c1.eval(gmStub);
const before = await c1.eval(`({ ko: ${koCount}, spaLen: document.body.innerText.length })`);
console.log('注入前: 韩文字符', before.ko, '/ 文本长度', before.spaLen);
const t0 = Date.now();
await c1.eval(wrap(GF));
let done = false;
for (let i = 0; i < 40; i++) {
  await sleep(1500);
  const st = await c1.eval("({ v3n: Object.keys(localStorage).some((k) => k.startsWith('gm:zhx.v3.f.ronka.names.')), manifest: !!localStorage.getItem('gm:zhx.v3.manifest') })").catch(() => ({}));
  if (st && (st.v3n && st.manifest)) { done = true; console.log(`数据流程完成（${((Date.now() - t0) / 1000).toFixed(1)}s）:`, JSON.stringify(st)); break; }
}
if (!done) console.log('⚠️ 数据等待超时');
await sleep(4000); // 留时间 observer 翻译
const r1 = await c1.eval(`(() => {
  const reqUrls = (window.__reqLog || []);
  const keys = Object.keys(localStorage).filter((k) => k.indexOf('gm:') === 0);
  return {
    reqCount: reqUrls.length,
    reqUrls: reqUrls,
    stKeys: keys.map((k) => k + ' (' + String(localStorage.getItem(k)).length + ' chars)'),
    ko: ${koCount},
    setFail: window.__setFail || 0,
    v3: {
      names: String(localStorage.getItem('gm:zhx.v3.f.ronka.names') || '').length,
      dict: String(localStorage.getItem('gm:zhx.v3.f.ronka.dict') || '').length,
    },
  };
})()`);
console.log('\n--- Test1 结果 ---');
console.log(JSON.stringify(r1, null, 1).slice(0, 2400));
console.log('\n--- Test1 断言 ---');
push('① v3 数据键齐（names/alias/dup/dict）', ['gm:zhx.v3.f.ronka.names', 'gm:zhx.v3.f.ronka.alias', 'gm:zhx.v3.f.ronka.dup', 'gm:zhx.v3.f.ronka.dict'].every((k) => r1.stKeys.some((s) => s.indexOf(k) === 0)), JSON.stringify(r1.stKeys));
push('② names 体量 ≥ 50k chars', r1.v3.names >= 50000, String(r1.v3.names));
push('③ 缓存写入无失败（setFail=0）', r1.setFail === 0, String(r1.setFail));
push('④ 韩文残留下降（注入后 < 注入前）', r1.ko < before.ko, `前 ${before.ko} → 后 ${r1.ko}`);
push('⑤ 下载请求 ≥ 4 且含 ronka 数据文件', r1.reqCount >= 4 && r1.reqUrls.some((u) => u.indexOf('/ronka/') >= 0), `reqCount=${r1.reqCount}`);
push('⑥ 无 [TEST-INJECT] 错误', !c1.consoleLines.some((l) => l.includes('[TEST-INJECT]')));
await closePage(PORT, t1.target.id);

// ============ Test 2：缓存命中（同 profile 同域，不清理） ============
console.log('\n===== Test 2：ronka 缓存命中（零网络断言）=====');
const t2 = await newPage(PORT, 'about:blank');
const c2 = t2.cdp;
await c2.send('Page.navigate', { url: 'https://lookbook.ronkacloset.com/about' });
await sleep(6000);
await c2.eval(gmStub);
await c2.eval(wrap(GF));
await sleep(9000);
const r2 = await c2.eval(`(() => ({
  reqCount: (window.__reqLog || []).length,
  reqUrls: (window.__reqLog || []),
  keyCount: Object.keys(localStorage).filter((k) => k.indexOf('gm:') === 0).length,
  ko: ${koCount},
}))()`);
console.log('第二页请求数:', r2.reqCount, '（期望 0）');
console.log('请求列表:', JSON.stringify(r2.reqUrls));
console.log('存储键数:', r2.keyCount, '｜韩文残留:', r2.ko);
console.log('\n--- Test2 断言 ---');
push('⑦ 零网络（缓存命中）', r2.reqCount === 0, JSON.stringify(r2.reqUrls));
push('⑧ 缓存键仍齐（≥ 4）', r2.keyCount >= 4, String(r2.keyCount));

// ============ Test 3：动态内容（SPA 型追加节点 → observer 翻译） ============
console.log('\n===== Test 3：动态内容观察器翻译 =====');
await c2.eval(`(() => {
  const p = document.createElement('p');
  p.id = 'zhx-dyn-test';
  p.textContent = '계승자의 두건';
  document.body.appendChild(p);
  return 1;
})()`);
await sleep(2500);
const r3 = await c2.eval(`(() => {
  const p = document.getElementById('zhx-dyn-test');
  const t = p ? (p.textContent || '') : null;
  let ko = 0; if (t) for (const ch of t) { const c = ch.codePointAt(0); if (c >= 0xAC00 && c <= 0xD7AF) ko++; }
  const out = { text: t, koInNode: ko, reqCount: (window.__reqLog || []).length };
  if (p) p.remove();
  return out;
})()`);
console.log('追加节点翻译后:', JSON.stringify(r3));
push('⑨ 动态追加节点被翻译（非韩文）', r3.text !== null && r3.text !== '계승자의 두건' && r3.koInNode === 0, JSON.stringify(r3));
push('⑩ 动态翻译零额外网络', r3.reqCount === 0, String(r3.reqCount));
push('⑪ 无 [TEST-INJECT] 错误（含动态段）', !c2.consoleLines.some((l) => l.includes('[TEST-INJECT]')));
console.log('\n--- console 2（脚本）---');
console.log(c2.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化'))).join('\n').slice(0, 800));
await closePage(PORT, t2.target.id);

const pass = checks.filter(([, okf]) => okf).length;
console.log(`\n══════ 总计: ${pass}/${checks.length} 通过 ══════`);
process.exit(pass === checks.length ? 0 : 1);
