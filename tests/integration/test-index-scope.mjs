// v1.3 索引裁剪 + 染剂顺手收集 测试
// 场景 A：真表 + __zhxTestIndexes=['nameMap']（裁剪）→ 仅建 nameMap，其余三索引为 null + 真表抽查映射
// 场景 B：小表 + 全建（null scope）→ 四索引正确 + 染剂补开精确断言（含「base 被占用不补」）
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, itemsTsvPath, fixtureUrl, cachePath } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const FIXTURE = fixtureUrl('ec-page.html');

// ── 生成测试副本：EC 分支放宽 file:// + neededTables hook + __zhxDebug 暴露 ──
let s = readDist();
const n1 = "onHost(host, 'eorzeacollection.com')";
const n2 = "  function neededTables() {\n    const h = location.hostname;";
const n3 = "      itemHash = t.itemHash; ecidMap = t.ecidMap; nameMap = t.nameMap; koByZh = t.koByZh;";
if (s.split(n1).length - 1 < 1) throw new Error('n1 缺失');
if (s.split(n2).length - 1 !== 1) throw new Error('n2 计数异常: ' + (s.split(n2).length - 1));
if (s.split(n3).length - 1 !== 1) throw new Error('n3 计数异常: ' + (s.split(n3).length - 1));
s = s.split(n1).join("(onHost(host, 'eorzeacollection.com') || location.protocol === 'file:')");
s = s.replace(n2, "  function neededTables() {\n    if (window.__zhxTestTables) return window.__zhxTestTables;\n    const h = location.hostname;");
s = s.replace(n3, n3 + "\n      window.__zhxDebug = { itemHash: t.itemHash, ecidMap: t.ecidMap, nameMap: t.nameMap, koByZh: t.koByZh, dyeCount: t.dye.length };");
fs.writeFileSync(cachePath('gf-idx-test.user.js'), s);
const GF = s;
console.log('测试副本已生成（EC 分支 + neededTables hook + __zhxDebug 暴露）');

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => {
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const FP = 'testfp000001';
const preset = (k, txt) => `(() => { localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(FP + '\n' + txt)}); return 1; })()`;
const clear = `(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); } };

/* ══════════ 场景 A：真表 + 裁剪 ['nameMap'] ══════════ */
console.log('╔══ 场景 A：真表 + __zhxTestIndexes=[nameMap]（裁剪）══╗');
{
  const itemsTsv = fs.readFileSync(itemsTsvPath, 'utf8');
  let probeZh = null;
  for (const ln of itemsTsv.split('\n')) { const p = ln.split('\t'); if (p[2] === 'Snow White Dye') { probeZh = p[1]; break; } }
  console.log('  真表抽查目标: Snow White Dye →', probeZh);

  const t = await newPage(PORT, FIXTURE);
  const c = t.cdp;
  await sleep(800);
  await c.eval(clear);
  await c.eval("window.__zhxTestIndexes = ['nameMap'];");
  await c.eval(preset('gm:zhx.dt.items', itemsTsv));
  await c.eval(`(() => { localStorage.setItem('gm:zhx.meta', JSON.stringify({ v: 'test', t: Date.now() })); return 1; })()`);
  await c.eval("window.__zhxTestTables = ['items'];");
  await c.eval(gmStub);
  await c.eval(wrap(GF));
  await sleep(9000);
  const r = await c.eval(`(() => {
    const d = window.__zhxDebug || null;
    return {
      has: !!d,
      nmKeys: d && d.nameMap ? Object.keys(d.nameMap).length : -1,
      ihNull: d ? d.itemHash === null : null,
      emNull: d ? d.ecidMap === null : null,
      kzNull: d ? d.koByZh === null : null,
      probe: d && d.nameMap ? d.nameMap['Snow White Dye'] : null,
    };
  })()`);
  console.log('  结果:', JSON.stringify(r));
  ok('A1 __zhxDebug 已暴露（构建完成）', r.has === true);
  ok('A2 nameMap 已建成（键 > 80000）', r.nmKeys > 80000, `实际 ${r.nmKeys}`);
  ok('A3 itemHash 被裁剪（null）', r.ihNull === true);
  ok('A4 ecidMap 被裁剪（null）', r.emNull === true);
  ok('A5 koByZh 被裁剪（null）', r.kzNull === true);
  ok('A6 真表抽查映射正确', r.probe === probeZh, `${JSON.stringify(r.probe)} vs ${probeZh}`);
  await closePage(PORT, t.target.id);
}

/* ══════════ 场景 B：小表 + 全建 + 染剂补开精确断言 ══════════ */
console.log('╔══ 场景 B：小表 + 全建（含染剂补开断言）══╗');
{
  const rows = [
    '10001\t白色染料\tSnow White Dye\tスノウホワイト\t스노우 화이트\th111\ta111\tx',
    '10002\t蓝色染料\tCeleste Dye\tセレスト\t셀레스트\th222\ta222\tx',
    '10003\t试作缠头巾\tProto Turban\tプロトターバン\t프로토 터번\th333\ta333\tx',
    '10004\t深红染料.B\tTrial Red Dye\tトライアルレッド\t트라이얼 레드\th444\ta444\tx',
    '10005\t深红\tDeep Red\tディープレッド\t딥 레드\th555\ta555\tx',
    '10006\t乌黑\tUnoccupied Black Dye\tウンオキュパイド\t언오큐파이드\th666\ta666\tx',
    '10007\t深红染料.C\tDeep Red Dye\tディープレッドC\t딥 레드C\th777\ta777\tx',
  ];
  const mini = 'key\tzh\ten\tja\tko\thash\tecid\talias\n' + rows.join('\n') + '\n';

  const t = await newPage(PORT, FIXTURE);
  const c = t.cdp;
  await sleep(800);
  await c.eval(clear);
  await c.eval(preset('gm:zhx.dt.items', mini));
  await c.eval(`(() => { localStorage.setItem('gm:zhx.meta', JSON.stringify({ v: 'test', t: Date.now() })); return 1; })()`);
  await c.eval("window.__zhxTestTables = ['items'];");
  await c.eval(gmStub);
  await c.eval(wrap(GF));
  await sleep(9000);
  const r = await c.eval(`(() => {
    const d = window.__zhxDebug || null;
    if (!d) return { has: false };
    const nm = d.nameMap || {};
    return {
      has: true,
      ih: d.itemHash ? d.itemHash['h111'] : 'NULL',
      em: d.ecidMap ? d.ecidMap['白色染料'] : 'NULL',
      kz: d.koByZh ? d.koByZh['白色染料'] : 'NULL',
      sw: nm['Snow White Dye'], swBase: nm['Snow White'],
      tr: nm['Trial Red Dye'], trBase: nm['Trial Red'],
      dr: nm['Deep Red'], drDye: nm['Deep Red Dye'],
      ubBase: nm['Unoccupied Black'],
      ja: nm['スノウホワイト'], ko: nm['스노우 화이트'],
      dyeCount: d.dyeCount,
    };
  })()`);
  console.log('  结果:', JSON.stringify(r, null, 1));
  ok('B1 __zhxDebug 已暴露', r.has === true);
  ok('B2 itemHash 命中', r.ih === '白色染料', `${r.ih}`);
  ok('B3 ecidMap 命中', r.em === 'a111', `${r.em}`);
  ok('B4 koByZh 命中', r.kz === '스노우 화이트', `${r.kz}`);
  ok('B5 nameMap en 命中', r.sw === '白色染料', `${r.sw}`);
  ok('B6 染剂补开：Snow White', r.swBase === '白色染料', `${r.swBase}`);
  ok('B7 染剂补开：Trial Red', r.trBase === '深红染料.B', `${r.trBase}`);
  ok('B8 base 被占用不补（Deep Red 保持独立值）', r.dr === '深红', `${r.dr}`);
  ok('B9 Dye 原键保留', r.drDye === '深红染料.C', `${r.drDye}`);
  ok('B10 染剂补开：Unoccupied Black', r.ubBase === '乌黑', `${r.ubBase}`);
  ok('B11 ja 命中', r.ja === '白色染料', `${r.ja}`);
  ok('B12 ko 命中', r.ko === '白色染料', `${r.ko}`);
  ok('B13 dyeCount=5（顺手收集数）', r.dyeCount === 5, `${r.dyeCount}`);
  await closePage(PORT, t.target.id);
}

console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail === 0 ? 0 : 1);
