// tests/benchmark/bench-v3-load.mjs — Phase 13：Runtime Data v3 客户端 parse/build 基准
//
// 口径（Node 复刻运行时语义，纯 CPU、无网络无 Chrome）：
//   v2：items.tsv（全量合表）→ buildTables 等价（三键首行胜 + 染剂回退 + hash/ecid/ko）
//       + _irBuildAux 等价（全表二遍扫 dup/alias）——即 v2 实际要做的全部解析/构建。
//   v3：按站文件（Phase 13 语言裁剪后）→ _v3Pairs 等价解析（键值直读，无二次计算）。
// 另做格式对比：同一份 mirapri names 数据以 TSV / JSON-对象 / JSON-数组 存储时的
//   字节数（raw/gzip）与解析耗时——验证「TSV + 边缘压缩（CF Brotli）」是否仍为
//   综合最优（计划书 12.3/13：不得盲目 JSON 化，须比较网络/解析/内存/复杂度后择优）。
//
// 说明：gzip 数值代表网络可压缩量级（CF 实际用 Brotli，通常比 gzip 再小 10~20%）；
//   内存为 heapUsed 增量粗测（Node 无强制 GC，仅供参考量级）。
//
// 运行：node tests/benchmark/bench-v3-load.mjs
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const ROOT = new URL('../../', import.meta.url);
const V3 = new URL('data/v3/', ROOT);

const now = () => performance.now();
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const mb = (n) => (n / 1048576).toFixed(2);

function bench(fn, runs = 5) {
  fn(); // 热身
  const ts = [];
  let mem = 0;
  for (let i = 0; i < runs; i++) {
    const m0 = process.memoryUsage().heapUsed;
    const t0 = now();
    fn();
    ts.push(now() - t0);
    mem = Math.max(mem, process.memoryUsage().heapUsed - m0);
  }
  return { ms: median(ts), mem };
}

// ── v2 复刻：buildTables 语义（单遍）+ _irBuildAux 语义（二遍） ──
function buildV2(text) {
  const names = {}; const dye = [];
  const hashes = {}; const ecid = {}; const ko = {};
  const lines = text.split('\n');
  for (const ln of lines) {
    if (!ln) continue;
    const c0 = ln.charCodeAt(0);
    if (c0 !== 45 && (c0 < 48 || c0 > 57)) continue;
    const p = ln.split('\t');
    if (p.length < 5) continue;
    const zh = p[1]; const en = p[2]; const ja = p[3]; const koK = p[4];
    if (!ln.startsWith('-')) {
      const h = p.length > 5 ? p[5] : '';
      if (h && !(h in hashes)) hashes[h] = zh;
      const e = p.length > 6 ? p[6] : '';
      if (e && !(zh in ecid)) ecid[zh] = e;
    }
    for (const k of [en, ja, koK]) {
      if (k && !(k in names)) {
        names[k] = zh;
        if (k.length > 4 && k.endsWith(' Dye')) dye.push(k);
      }
    }
    if (zh && koK && !(zh in ko)) ko[zh] = koK;
  }
  for (const k of dye) {
    const b = k.slice(0, -4);
    if (!(b in names)) names[b] = names[k];
  }
  return { names, hashes, ecid, ko, lines };
}

function irBuildAuxV2(lines, names) {
  const dup = {}; const ali = {};
  for (const ln of lines) {
    if (!ln) continue;
    const c0 = ln.charCodeAt(0);
    if (c0 !== 45 && (c0 < 48 || c0 > 57)) continue;
    const p = ln.split('\t');
    if (p.length < 2 || !p[1]) continue;
    const zh = p[1];
    for (let ci = 2; ci <= 4; ci++) {
      if (ci >= p.length) break;
      const k = p[ci];
      if (!k) continue;
      const cur = names[k];
      if (cur === undefined || cur === zh) continue;
      const d = dup[k] || (dup[k] = [cur]);
      if (!d.includes(zh)) d.push(zh);
    }
    if (p.length > 7 && p[7]) {
      for (const part of p[7].split('；')) {
        const a = part.trim();
        if (!a) continue;
        const d = ali[a] || (ali[a] = []);
        if (!d.includes(zh)) d.push(zh);
      }
    }
  }
  return { dup, ali };
}

// ── v3 复刻：_v3Pairs 等价解析 ──
function parseV3Pairs(txt, multi) {
  const m = Object.create(null);
  for (const ln of String(txt).split('\n')) {
    if (!ln) continue;
    const p = ln.split('\t');
    if (!p[0]) continue;
    if (multi) {
      const d = m[p[0]] || (m[p[0]] = []);
      for (let i = 1; i < p.length; i++) { if (p[i] && !d.includes(p[i])) d.push(p[i]); }
    } else if (p[1] !== undefined && m[p[0]] === undefined) {
      m[p[0]] = p[1];
    }
  }
  return m;
}

function loadV3Raw(site, withFiles) {
  const want = withFiles || ['names', 'hash', 'alias', 'dup'];
  const out = {};
  for (const name of want) {
    const txt = readFileSync(new URL(`${site}/${name}.tsv`, V3), 'utf8');
    out[name] = parseV3Pairs(txt, name === 'alias' || name === 'dup');
  }
  return out;
}

// ══════════ 主体 ══════════
console.log('══════ Phase 13 基准：v2 vs v3 客户端 parse/build ══════\n');

const v2Text = readFileSync(new URL('data/ff14-items.tsv', ROOT), 'utf8');
const v2Bytes = Buffer.byteLength(v2Text);
console.log(`[v2] items.tsv: ${mb(v2Bytes)} MB raw / ${mb(gzipSync(v2Text).length)} MB gzip`);

const rV2 = bench(() => {
  const st = buildV2(v2Text);
  return st;
});
const rV2ir = bench(() => {
  const st = buildV2(v2Text);
  irBuildAuxV2(st.lines, st.names);
});
{
  const st = buildV2(v2Text);
  const ir = irBuildAuxV2(st.lines, st.names);
  console.log(`  产出: names=${Object.keys(st.names).length} hash=${Object.keys(st.hashes).length} ecid=${Object.keys(st.ecid).length} ko=${Object.keys(st.ko).length} dup=${Object.keys(ir.dup).length} alias=${Object.keys(ir.ali).length}`);
}
console.log(`  parse+build（单遍）: 中位 ${rV2.ms.toFixed(1)} ms | heap Δ≈${mb(rV2.mem)} MB`);
console.log(`  parse+build+_irBuildAux（两遍，v2 实际全链）: 中位 ${rV2ir.ms.toFixed(1)} ms | heap Δ≈${mb(rV2ir.mem)} MB\n`);

// v3：mirapri 按站文件（全链 = 四文件解析）
const v3Bytes = ['names', 'hash', 'alias', 'dup']
  .map((n) => readFileSync(new URL(`mirapri/${n}.tsv`, V3)).length)
  .reduce((a, b) => a + b, 0);
const v3Gzip = ['names', 'hash', 'alias', 'dup']
  .map((n) => gzipSync(readFileSync(new URL(`mirapri/${n}.tsv`, V3))).length)
  .reduce((a, b) => a + b, 0);
console.log(`[v3] mirapri 按站文件（names+hash+alias+dup）: ${mb(v3Bytes)} MB raw / ${mb(v3Gzip)} MB gzip（Phase 13 裁剪后）`);

const rV3 = bench(() => loadV3Raw('mirapri'));
{
  const st = loadV3Raw('mirapri');
  console.log(`  产出: names=${Object.keys(st.names).length} hash=${Object.keys(st.hash).length} dup=${Object.keys(st.dup).length} alias=${Object.keys(st.alias).length}`);
}
console.log(`  load（全链）: 中位 ${rV3.ms.toFixed(1)} ms | heap Δ≈${mb(rV3.mem)} MB\n`);

// ── 格式对比：mirapri names 数据 ──
console.log('── 格式对比（同一份 mirapri names 数据）──');
const namesTxt = readFileSync(new URL('mirapri/names.tsv', V3), 'utf8');
const obj = {};
for (const ln of namesTxt.split('\n')) {
  if (!ln) continue;
  const i = ln.indexOf('\t');
  if (i <= 0) continue;
  obj[ln.slice(0, i)] = ln.slice(i + 1);
}
const arr = Object.entries(obj);
const jsonObj = JSON.stringify(obj);
const jsonArr = JSON.stringify(arr);

const rTsv = bench(() => parseV3Pairs(namesTxt));
const rObj = bench(() => JSON.parse(jsonObj));
const rArr = bench(() => JSON.parse(jsonArr));

const row = (label, txt, ms) =>
  console.log(`  ${label.padEnd(10)} raw ${mb(Buffer.byteLength(txt)).padStart(6)} MB | gzip ${mb(gzipSync(txt).length).padStart(6)} MB | parse ${ms.toFixed(1).padStart(6)} ms`);
row('TSV', namesTxt, rTsv.ms);
row('JSON-obj', jsonObj, rObj.ms);
row('JSON-arr', jsonArr, rArr.ms);

console.log('\n（gzip ≈ 网络可压缩量级，CF 实际 Brotli 通常再小 10~20%；parse 为中位）');
