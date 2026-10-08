// verify_dicts.js —— 词典一致性校验（Phase 16：三种模式）
// 用法1（构建用）  : node verify_dicts.js <src.js>
//                    → 校验 src 内注入的 6 组词典 与 dict/*.json 源 逐条一致
// 用法2（构建用）  : node verify_dicts.js <src.js> --dict-json <dict.json>
//                    → 校验 src 内注入的 6 组词典 与「远程词库产物」（build/make_dict_json.py
//                      生成、数据站发布用）逐条一致（站点层按 common+本站增量合并语义比对）
// 用法3（兼容保留）: node verify_dicts.js <a.js> <b.js>
//                    → 深度对比两个脚本文件的 6 组注入词典是否等价
//                      （PATTERNS* 为模板内手写块，不参与本对比）
// 约束：仅接受仓库内路径（防路径穿越）；对词典体做受控文本扫描，不执行任何代码。
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ── 路径净化：结果必须位于仓库内 ──
function safeResolve(p, label) {
  const rp = path.resolve(p);
  if (rp !== REPO_ROOT && !rp.startsWith(REPO_ROOT + path.sep)) {
    throw new Error(`${label}越界（仅允许仓库内路径）: ${p}`);
  }
  return rp;
}

// ── 受控解析：本构建体系生成的纯 KV 对象字面量（不执行任何代码）──
// 支持 `{ ...DICT_COMMON, 'k': 'v', ... }`（单/双引号、\x 转义、\uXXXX）。
const ESC_MAP = { n: '\n', r: '\r', t: '\t' };

// 单个转义序列 → { ch, next }
function scanEscape(s, i) {
  const n = s[i + 1];
  if (ESC_MAP[n] !== undefined) return { ch: ESC_MAP[n], next: i + 2 };
  if (n === 'u') {
    const hex = s.slice(i + 2, i + 6);
    const code = hex.length === 4 ? Number.parseInt(hex, 16) : Number.NaN;
    const ch = Number.isNaN(code) ? 'u' : String.fromCodePoint(code);
    return { ch, next: i + 6 };
  }
  return { ch: n, next: i + 2 };
}

function scanString(s, i) {
  const q = s[i];
  if (q !== "'" && q !== '"') return null;
  i += 1;
  let out = '';
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const e = scanEscape(s, i);
      out += e.ch;
      i = e.next;
      continue;
    }
    if (c === q) return { str: out, next: i + 1 };
    out += c;
    i += 1;
  }
  return null;
}

// 跳过空白（空格/制表符）→ 新位置
function skipSpace(t, i) {
  while (t[i] === ' ' || t[i] === '\t') i += 1;
  return i;
}

// 单行 `'k': 'v',` → { k, v } 或 null（非引号开头/格式不符即 null）
function parseKvLine(t) {
  if (t[0] !== "'" && t[0] !== '"') return null;
  const k = scanString(t, 0);
  if (!k) return null;
  let i = skipSpace(t, k.next);
  if (t[i] !== ':') return null;
  i = skipSpace(t, i + 1);
  const v = scanString(t, i);
  if (!v) return null;
  let j = skipSpace(t, v.next);
  if (t[j] === ',') j = skipSpace(t, j + 1);
  if (j !== t.length) return null;
  return { k: k.str, v: v.str };
}

function parseKvBody(body) {
  const obj = {};
  for (const rawLine of body.split('\n')) {
    const kv = parseKvLine(rawLine.trim());
    if (kv) obj[kv.k] = kv.v;
  }
  return obj;
}

// ── 提取：定位 const NAME = {...} 块（兼容 Object.assign 历史形态）──
function extractDict(src, name) {
  const esc = name.replace(/[\\$]/g, String.raw`\$&`);
  const re = new RegExp(String.raw`const ${esc} = (?:Object\.assign\(\{\}, DICT_COMMON, )?\{`);
  const m = re.exec(src);
  if (!m) return { missing: true };
  const braceAt = m.index + m[0].length - 1;
  const closeAt = src.indexOf('\n  }', braceAt);
  if (closeAt < 0) return { missing: true };
  const body = src.slice(braceAt, closeAt + 4);
  let val = parseKvBody(body);
  if (name !== 'DICT_COMMON') {
    const c = extractDict(src, 'DICT_COMMON');
    if (c.value !== undefined) val = { ...c.value, ...val };
  }
  return { value: val };
}

function _logKeys(label, keys) {
  for (const k of keys.slice(0, 8)) console.log('  ' + label + '独有:', JSON.stringify(k));
}

function diffArray(name, va, vb, labelA, labelB) {
  const sa = (va || []).map(String).join('\u0001');
  const sb = (vb || []).map(String).join('\u0001');
  const eq = sa === sb;
  console.log(name, '数组', (va || []).length, 'vs', (vb || []).length, eq ? '✅ 完全一致' : '❌ 不一致');
  if (!eq) {
    const setA = new Set((va || []).map(String)), setB = new Set((vb || []).map(String));
    for (const x of setA) if (!setB.has(x)) console.log('  ' + labelA + '独有:', String(x).slice(0, 100));
    for (const x of setB) if (!setA.has(x)) console.log('  ' + labelB + '独有:', String(x).slice(0, 100));
  }
  return eq;
}

function diffObject(name, va, vb, labelA, labelB) {
  const ka = Object.keys(va || {}), kb = Object.keys(vb || {});
  const onlyA = ka.filter(k => !(k in vb));
  const onlyB = kb.filter(k => !(k in va));
  const diffV = ka.filter(k => (k in vb) && va[k] !== vb[k]);
  const eq = !onlyA.length && !onlyB.length && !diffV.length;
  console.log(name, '字典', ka.length, 'vs', kb.length, eq ? '✅ 完全一致' : '❌ 不一致');
  if (!eq) {
    _logKeys(labelA, onlyA);
    _logKeys(labelB, onlyB);
    for (const k of diffV.slice(0, 8)) console.log('  值不同:', JSON.stringify(k), JSON.stringify(va[k]), '→', JSON.stringify(vb[k]));
  }
  return eq;
}

function diffOne(name, va, vb, labelA, labelB) {
  // 返回 true=一致；打印差异
  return (Array.isArray(va) || Array.isArray(vb))
    ? diffArray(name, va, vb, labelA, labelB)
    : diffObject(name, va, vb, labelA, labelB);
}

const fileA = process.argv[2];
if (!fileA) { console.log('用法: node verify_dicts.js <src.js> [--dict-json <dict.json> | b.js]'); process.exit(1); }
const a = fs.readFileSync(safeResolve(fileA, '文件A'), 'utf8');

let allEq = true;
const dictJsonIdx = process.argv.indexOf('--dict-json');

if (dictJsonIdx >= 0) {
  // ── 模式2：src vs 远程词库产物（dict.json；与 make_dict_json.py 输出/数据站发布物一致）──
  const djPath = process.argv[dictJsonIdx + 1];
  if (!djPath) { console.log('用法: node verify_dicts.js <src.js> --dict-json <dict.json>'); process.exit(1); }
  const djBuf = fs.readFileSync(safeResolve(djPath, 'dict.json'));
  const dj = JSON.parse(djBuf.toString('utf8'));
  const fp = crypto.createHash('sha256').update(djBuf).digest('hex').slice(0, 12);
  const common = dj.common || {};
  const MAP = [
    ['DICT_COMMON', 'common'],
    ['DICT',        'main'],
    ['DICT_EC',     'ec'],
    ['DICT_FC',     'fc'],
    ['DICT_RONKA',  'ronka'],
    ['DICT_ACL',    'acl'],
  ];
  for (const [n, key] of MAP) {
    const d = extractDict(a, n);
    if (d.value === undefined) { console.log(n, '提取失败', d.missing ? '(src 中缺失)' : ''); allEq = false; continue; }
    // 期望值：站点层 = common + 本站增量（与运行时合并 / dict.json 语义一致）
    const expect = (n === 'DICT_COMMON') ? { ...common } : { ...common, ...dj[key] };
    if (!diffOne(n, d.value, expect, 'src', 'dict.json')) allEq = false;
  }
  console.log(`（对照物: ${djPath}  fp=${fp}）`);
  console.log(allEq ? '\n=== 全部一致 ✅ ===' : '\n=== 存在差异 ⚠️ ===');
  if (!allEq) process.exitCode = 1;
} else if (process.argv[3]) {
  // ── 模式3：双文件对比（6 组注入词典；PATTERNS* 为手写块，不参与）──
  const b = fs.readFileSync(safeResolve(process.argv[3], '文件B'), 'utf8');
  const NAMES = ['DICT_COMMON', 'DICT', 'DICT_EC', 'DICT_FC', 'DICT_RONKA', 'DICT_ACL'];
  for (const n of NAMES) {
    const da = extractDict(a, n), db = extractDict(b, n);
    if (da.value === undefined || db.value === undefined) {
      console.log(n, '提取失败', da.missing ? 'A缺失' : '', db.missing ? 'B缺失' : '');
      allEq = false; continue;
    }
    if (!diffOne(n, da.value, db.value, 'A', 'B')) allEq = false;
  }
  console.log(allEq ? '\n=== 全部等价 ✅ ===' : '\n=== 存在差异 ⚠️ ===');
} else {
  // ── 模式1：src vs dict/*.json（7 组注入词典）──
  const dictDir = path.join(REPO_ROOT, 'dict');
  const MAP = [
    ['DICT_COMMON', 'dict-common.json'],
    ['DICT',        'dict-main.json'],
    ['DICT_EC',     'dict-ec.json'],
    ['DICT_FC',     'dict-fc.json'],
    ['DICT_RONKA',  'dict-ronka.json'],
    ['DICT_ACL',    'dict-acl.json'],
    ['DICT_ENDCLOSET', 'dict-endcloset.json'],
  ];
  const commonData = JSON.parse(fs.readFileSync(path.join(dictDir, 'dict-common.json'), 'utf8'));
  for (const [n, fn] of MAP) {
    const fp = path.join(dictDir, fn);
    if (!fs.existsSync(fp)) { console.log('⚠️', fn, '缺失'); allEq = false; continue; }
    const entries = JSON.parse(fs.readFileSync(fp, 'utf8')).entries;
    // 期望值：站点层 = common + 本站增量（与运行时/注入的合并语义一致）
    const expect = (n === 'DICT_COMMON') ? entries : { ...commonData.entries, ...entries };
    const d = extractDict(a, n);
    if (d.value === undefined) {
      console.log(n, '提取失败', d.missing ? '(src 中缺失)' : '');
      allEq = false; continue;
    }
    if (!diffOne(n, d.value, expect, 'src', 'json')) allEq = false;
  }
  console.log('（PATTERNS_EC / PATTERNS 为源码内手写块，非 dict 注入，跳过）');
  console.log(allEq ? '\n=== 全部一致 ✅ ===' : '\n=== 存在差异 ⚠️ ===');
  if (!allEq) process.exitCode = 1;
}
