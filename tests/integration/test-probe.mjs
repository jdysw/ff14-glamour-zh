// 运行探测模块冒烟测试 v1（v1.3.1 zhx_probe）：
//  E1 带 zhx_probe=1 → 面板出现 + 报告含关键段（含 wiki 专项）
//  E2 不带参数 → 无面板、无 dump、marks 未记录（零影响）
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, fixtureUrl, cachePath } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);

const s = readDist();
fs.writeFileSync(cachePath('gf-probe-test.user.js'), s);
const GF = s;
console.log('测试副本已生成（hook 已内建于 src）');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? (k === 'zhx.data.refresh.epoch' ? 'candidate-policy-1-force-refresh' : d) : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => { try { opt.onerror && opt.onerror(new Error('blocked')); } catch (e) {} };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' —— ' + extra : ''}`); }
};

// ============ E1：带参数 ============
console.log('\n════ 场景 E1：zhx_probe=1 ════');
{
  const t = await newPage(PORT, fixtureUrl('wiki-item.html') + '?zhx_probe=1');
  const c = t.cdp;
  await sleep(700);
  await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
  await c.eval("window.__zhxTestSite = 'wiki';");
  await c.eval("window.__zhxTestTables = [];");
  await c.eval(gmStub);
  await c.eval(wrap(GF));
  await sleep(6500);
  const r = await c.eval(`(() => {
    const box = document.getElementById('zhx-probe-box');
    const ta = document.getElementById('zhx-probe-text');
    return { box: !!box, dumpType: typeof window.__zhxProbeDump, text: ta ? ta.value : null };
  })()`);
  console.log('面板:', r.box, '| dump:', r.dumpType);
  console.log('报告节选:');
  console.log((r.text || '').split('\n').slice(0, 14).join('\n'));
  const txt = r.text || '';
  check('面板已显示', r.box === true);
  check('__zhxProbeDump 已暴露', r.dumpType === 'function');
  check('报告含 ZHX-PROBE 头', txt.includes('ZHX-PROBE'));
  check('报告含 site 行', txt.includes('site: '));
  check('报告含 marks 行', txt.includes('marks: '));
  check('报告含 data 行', txt.includes('data: '));
  check('报告含 errs 行（Phase 18）', txt.includes('errs: '));
  check('报告含 obs / resolver 统计行', txt.includes('obs: ') && txt.includes('resolver: '));
  check('报告含 wiki 段', txt.includes('wiki: '));
  check('wiki 段含 slot 判定', txt.includes('"slot":'));
  check('wiki 段 slot 命中头部防具', txt.includes('头部防具/headPiece'));
  check('wiki 段含注入完成标志字段', txt.includes('"done":'));
  check('报告含 dom / dl 统计（Phase 19）', txt.includes('dom: ') && txt.includes('dl: '));
  check('报告含 cache / dict 行（Phase 19）', txt.includes('cache: ') && txt.includes('dict: '));
  await closePage(PORT, t.target.id);
}

// ============ E2：无参数 ============
console.log('\n════ 场景 E2：无参数（零影响）════');
{
  const t = await newPage(PORT, fixtureUrl('wiki-item.html'));
  const c = t.cdp;
  await sleep(700);
  await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
  await c.eval("window.__zhxTestSite = 'wiki';");
  await c.eval("window.__zhxTestTables = [];");
  await c.eval(gmStub);
  await c.eval(wrap(GF));
  await sleep(5000);
  const r = await c.eval(`(() => ({
    box: !!document.getElementById('zhx-probe-box'),
    dump: typeof window.__zhxProbeDump,
    marks: JSON.stringify(window.__zhxMarks || {}),
    errs: window.__zhxErrs === undefined ? 'none' : 'present'
  }))()`);
  console.log(JSON.stringify(r));
  check('无面板', r.box === false);
  check('未暴露 dump', r.dump === 'undefined');
  check('marks 未记录（探测短路）', r.marks === '{}');
  check('errs 未注册', r.errs === 'none');
  await closePage(PORT, t.target.id);
}

// ============ E3：测量开关（__zhxDiagOn，无面板）============
console.log('\n════ 场景 E3：__zhxDiagOn（无面板测量）════');
{
  const t = await newPage(PORT, fixtureUrl('wiki-item.html'));
  const c = t.cdp;
  await sleep(700);
  await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
  await c.eval("window.__zhxTestSite = 'wiki';");
  await c.eval("window.__zhxTestTables = [];");
  await c.eval('window.__zhxDiagOn = true;');
  await c.eval(gmStub);
  await c.eval(wrap(GF));
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    ready = await c.eval("(typeof window.__zhxDiagRecord === 'function') && !!(window.__zhxDiagRecord().marks || {}).fireDone");
    if (ready) break;
  }
  const r = await c.eval(`(() => {
    const box = !!document.getElementById('zhx-probe-box');
    const dump = typeof window.__zhxProbeDump;
    const rec = typeof window.__zhxDiagRecord === 'function' ? window.__zhxDiagRecord() : null;
    return { box, dump, rec };
  })()`);
  console.log('面板:', r.box, '| dump:', r.dump, '| marks:', JSON.stringify(r.rec && r.rec.marks));
  check('无面板（测量开关不带 UI）', r.box === false);
  check('未暴露 ProbeDump（探测未启用）', r.dump === 'undefined');
  check('__zhxDiagRecord 已暴露', typeof r.rec === 'object' && r.rec !== null);
  check('时间线已记录（含 fireDone）', !!(r.rec && r.rec.marks && r.rec.marks.fireDone));
  check('统计面（obs/dom/dl/cache/data）齐备', !!(r.rec && r.rec.obs && r.rec.dom && r.rec.dl && r.rec.cache && r.rec.data));
  check('boot 字段为数值', typeof r.rec.boot === 'number');
  await closePage(PORT, t.target.id);
}

console.log('\n════════ 汇总 ════════');
console.log(`通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
