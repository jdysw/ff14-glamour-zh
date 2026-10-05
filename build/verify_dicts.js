// verify_dicts.js —— 词典一致性校验
// 用法1（当前构建用）: node verify_dicts.js <src.js>
//                      → 校验 src 内注入的 6 组词典 与 dict/*.json 源 逐条一致
// 用法2（兼容保留）  : node verify_dicts.js <a.js> <b.js>
//                      → 深度对比两个脚本文件的 8 组词典（含 PATTERNS*）是否等价
const fs = require('fs');
const path = require('path');

function extractDict(src, name) {
  const esc = name.replace(/[\\$]/g, '\\$&');
  // 支持两种形态：const NAME = {...}  或  const NAME = Object.assign({}, DICT_COMMON, {...})
  const re = new RegExp('const ' + esc + ' = (?:(Object\\.assign\\(\\{\\}, DICT_COMMON, ))?(\\{|\\[)([\\s\\S]*?)\\n  (\\}|\\])');
  const m = src.match(re);
  if (!m) return { missing: true };
  const body = m[2] + m[3] + '\n' + m[4];
  let val;
  try {
    val = new Function('return (' + body.replace(/;\s*$/, '') + ')')();
  } catch (e) {
    return { error: String(e).slice(0, 120) };
  }
  // 站点层：合并 DICT_COMMON（模拟运行时 Object.assign）
  if (m[1] && name !== 'DICT_COMMON') {
    const c = extractDict(src, 'DICT_COMMON');
    if (c.value !== undefined) val = Object.assign({}, c.value, val);
  }
  return { value: val };
}

function diffOne(name, va, vb, labelA, labelB) {
  // 返回 true=一致；打印差异
  if (Array.isArray(va) || Array.isArray(vb)) {
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
  const ka = Object.keys(va || {}), kb = Object.keys(vb || {});
  const onlyA = ka.filter(k => !(k in vb));
  const onlyB = kb.filter(k => !(k in va));
  const diffV = ka.filter(k => (k in vb) && va[k] !== vb[k]);
  const eq = !onlyA.length && !onlyB.length && !diffV.length;
  console.log(name, '字典', ka.length, 'vs', kb.length, eq ? '✅ 完全一致' : '❌ 不一致');
  if (!eq) {
    for (const k of onlyA.slice(0, 8)) console.log('  ' + labelA + '独有:', JSON.stringify(k));
    for (const k of onlyB.slice(0, 8)) console.log('  ' + labelB + '独有:', JSON.stringify(k));
    for (const k of diffV.slice(0, 8)) console.log('  值不同:', JSON.stringify(k), JSON.stringify(va[k]), '→', JSON.stringify(vb[k]));
  }
  return eq;
}

const fileA = process.argv[2];
if (!fileA) { console.log('用法: node verify_dicts.js <src.js> [b.js]'); process.exit(1); }
const a = fs.readFileSync(fileA, 'utf8');

let allEq = true;

if (process.argv[3]) {
  // ── 模式2：双文件对比（8 组词典，含手写的 PATTERNS*）──
  const b = fs.readFileSync(process.argv[3], 'utf8');
  const NAMES = ['DICT_COMMON', 'DICT', 'DICT_EC', 'PATTERNS_EC', 'PATTERNS', 'DICT_FC', 'DICT_RONKA', 'DICT_ACL'];
  for (const n of NAMES) {
    const da = extractDict(a, n), db = extractDict(b, n);
    if (da.value === undefined || db.value === undefined) {
      console.log(n, '提取失败', da.missing ? 'A缺失' : '', db.missing ? 'B缺失' : '', da.error || '', db.error || '');
      allEq = false; continue;
    }
    if (!diffOne(n, da.value, db.value, 'A', 'B')) allEq = false;
  }
  console.log(allEq ? '\n=== 全部等价 ✅ ===' : '\n=== 存在差异 ⚠️ ===');
} else {
  // ── 模式1：src vs dict/*.json（6 组注入词典）──
  const dictDir = path.join(path.dirname(path.resolve(fileA)), '..', 'dict');
  const MAP = [
    ['DICT_COMMON', 'dict-common.json'],
    ['DICT',        'dict-main.json'],
    ['DICT_EC',     'dict-ec.json'],
    ['DICT_FC',     'dict-fc.json'],
    ['DICT_RONKA',  'dict-ronka.json'],
    ['DICT_ACL',    'dict-acl.json'],
  ];
  const commonData = JSON.parse(fs.readFileSync(path.join(dictDir, 'dict-common.json'), 'utf8'));
  for (const [n, fn] of MAP) {
    const fp = path.join(dictDir, fn);
    if (!fs.existsSync(fp)) { console.log('⚠️', fn, '缺失'); allEq = false; continue; }
    const entries = JSON.parse(fs.readFileSync(fp, 'utf8')).entries;
    // 期望值：站点层 = common + 本站增量（与运行时/注入的 Object.assign 语义一致）
    const expect = (n === 'DICT_COMMON') ? entries : Object.assign({}, commonData.entries, entries);
    const d = extractDict(a, n);
    if (d.value === undefined) {
      console.log(n, '提取失败', d.missing ? '(src 中缺失)' : '', d.error || '');
      allEq = false; continue;
    }
    if (!diffOne(n, d.value, expect, 'src', 'json')) allEq = false;
  }
  console.log('（PATTERNS_EC / PATTERNS 为源码内手写块，非 dict 注入，跳过）');
  console.log(allEq ? '\n=== 全部一致 ✅ ===' : '\n=== 存在差异 ⚠️ ===');
  if (!allEq) process.exitCode = 1;
}
