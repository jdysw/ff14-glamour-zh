import { validRuntimeDictionary } from './dict-contract.js';

// 「键\t值...」文本 → 映射（多值模式收集为数组；行内/键首列已由生成器去重）
export function _v3Pairs(txt, multi) {
  const m = Object.create(null);
  // 多值收集拆为局部函数（仅降复杂度；判定与产物不变）
  const collectMulti = (d, parts) => {
    for (let i = 1; i < parts.length; i++) { if (parts[i] && !d.includes(parts[i])) d.push(parts[i]); }
  };
  for (const ln of String(txt).split('\n')) {
    if (!ln) continue;
    const p = ln.split('\t');
    if (!p[0]) continue;
    if (multi) {
      if (!m[p[0]]) m[p[0]] = [];
      collectMulti(m[p[0]], p);
    } else if (p[1] !== undefined && m[p[0]] === undefined) {
      m[p[0]] = p[1];
    }
  }
  return m;
}

// names 同时驱动多语解析、候选策略和展示分组。一次拆行构建三张表，
// 保留每个索引原有的首行/严格校验规则，避免大文件重复 split。
function _v3Names(txt) {
  const names = Object.create(null);
  const glam = Object.create(null);
  const slots = Object.create(null);
  let sawRow = false;
  for (const ln of String(txt || '').split('\n')) {
    if (!ln) continue;
    const p = ln.split('\t');
    if (!p[0]) continue;
    if (p.length !== 4 || !['0', '1'].includes(p[2].trim()) || !/^[0-5]$/.test(p[3].trim())) return null;
    sawRow = true;
    if (names[p[0]] === undefined) {
      names[p[0]] = p[1];
      glam[p[0]] = p[2].trim();
      slots[p[0]] = Number(p[3].trim());
    }
  }
  return sawRow ? { names, glam, slots } : null;
}

export function validateV3Payload(files) {
  if (files.candidatePolicy !== 1) return null;
  if (files.dict && !validRuntimeDictionary(JSON.parse(files.dict))) return null;
  if (files.identity) return files.identity;
  return typeof files.names === 'string'
    ? _v3Names(files.names)
    : { names: Object.create(null), glam: Object.create(null), slots: Object.create(null) };
}
