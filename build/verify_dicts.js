// verify_dicts.js —— 深度对比两版脚本的 5 个词典是否等价
const fs = require('fs');

function extractDict(src, name) {
  const esc = name.replace(/[$]/g, '\\$');
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

const a = fs.readFileSync(process.argv[2], 'utf8');
const b = fs.readFileSync(process.argv[3], 'utf8');
const NAMES = ['DICT_COMMON', 'DICT', 'DICT_EC', 'PATTERNS_EC', 'PATTERNS', 'DICT_FC', 'DICT_RONKA', 'DICT_ACL'];
let allEq = true;

for (const n of NAMES) {
  const da = extractDict(a, n), db = extractDict(b, n);
  const va = da.value, vb = db.value;
  if (va === undefined || vb === undefined) {
    console.log(n, '提取失败', da.missing ? 'A缺失' : '', db.missing ? 'B缺失' : '', da.error || '', db.error || '');
    allEq = false; continue;
  }
  if (Array.isArray(va)) {
    const sa = va.map(String).join('\u0001');
    const sb = vb.map(String).join('\u0001');
    const eq = sa === sb;
    console.log(n, '数组', va.length, 'vs', vb.length, eq ? '✅ 完全一致' : '❌ 不一致');
    if (!eq) {
      allEq = false;
      const setA = new Set(va.map(String)), setB = new Set(vb.map(String));
      for (const x of setA) if (!setB.has(x)) console.log('  A独有:', String(x).slice(0, 100));
      for (const x of setB) if (!setA.has(x)) console.log('  B独有:', String(x).slice(0, 100));
    }
  } else {
    const ka = Object.keys(va), kb = Object.keys(vb);
    const onlyA = ka.filter(k => !(k in vb));
    const onlyB = kb.filter(k => !(k in va));
    const diffV = ka.filter(k => (k in vb) && va[k] !== vb[k]);
    const eq = !onlyA.length && !onlyB.length && !diffV.length;
    console.log(n, '字典', ka.length, 'vs', kb.length, eq ? '✅ 完全一致' : '❌ 不一致');
    if (!eq) {
      allEq = false;
      for (const k of onlyA.slice(0, 8)) console.log('  A独有:', JSON.stringify(k));
      for (const k of onlyB.slice(0, 8)) console.log('  B独有:', JSON.stringify(k));
      for (const k of diffV.slice(0, 8)) console.log('  值不同:', JSON.stringify(k), JSON.stringify(va[k]), '→', JSON.stringify(vb[k]));
    }
  }
}
console.log(allEq ? '\n=== 全部等价 ✅ ===' : '\n=== 存在差异 ⚠️ ===');
