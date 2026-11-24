// 用法: node verify_dicts.js <src.js> [--dict-json <dict.json>]
// 比对嵌入词库和 JSON 源或发布产物。仅解析 AST，不执行待校验源码。
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('acorn');

const ROOT = fs.realpathSync(path.resolve(__dirname, '..', '..'));
const LAYERS = [
  ['common', 'DICT_COMMON'],
  ['main', 'DICT'],
  ...['ec', 'fc', 'ronka', 'acl', 'endcloset', 'miramiru'].map(key => [key, 'DICT_' + key.toUpperCase()]),
];
const NAMES = new Set(LAYERS.map(([, name]) => name));
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function insideRoot(file) {
  return file === ROOT || file.startsWith(ROOT + path.sep);
}

function readRepoFile(input) {
  const file = path.resolve(input);
  if (!insideRoot(file) || !insideRoot(fs.realpathSync(file))) {
    throw new Error('文件越界（仅允许仓库内路径）: ' + input);
  }
  return fs.readFileSync(file);
}

function stringLiteral(node) {
  return node.type === 'Literal' && typeof node.value === 'string';
}

function put(entries, key, value, label) {
  if (typeof key !== 'string' || !key.trim() || FORBIDDEN_KEYS.has(key)
      || Object.hasOwn(entries, key) || typeof value !== 'string') {
    throw new Error(label + ' 包含重复或无效词条: ' + JSON.stringify(key));
  }
  entries[key] = value;
}

function embeddedLayer(node, name) {
  if (node?.type !== 'ObjectExpression') throw new Error(name + ' 未使用对象字面量');
  const properties = node.properties;
  const spread = properties[0];
  const inherit = name !== 'DICT_COMMON';
  if (inherit && !(spread?.type === 'SpreadElement'
      && spread.argument.type === 'Identifier' && spread.argument.name === 'DICT_COMMON')) {
    throw new Error(name + ' 必须以 ...DICT_COMMON 开头');
  }
  const entries = Object.create(null);
  for (const property of inherit ? properties.slice(1) : properties) {
    if (property.type !== 'Property' || property.kind !== 'init' || property.computed
        || !stringLiteral(property.key) || !stringLiteral(property.value)) {
      throw new Error(name + ' 仅允许字符串词条');
    }
    put(entries, property.key.value, property.value.value, name);
  }
  return entries;
}

function embeddedLayers(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const layers = new Map();
  for (const statement of ast.body) {
    const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (node?.type !== 'VariableDeclaration' || node.kind !== 'const') continue;
    for (const { id, init } of node.declarations) {
      if (id.type === 'Identifier' && NAMES.has(id.name)) layers.set(id.name, embeddedLayer(init, id.name));
    }
  }
  return layers;
}

function readSource(key) {
  const file = 'dict-' + key + '.json';
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dictionaries', file), 'utf8'));
  const entries = Object.assign(Object.create(null), data.entries);
  for (const { zh, names } of data.terms || [])
    for (const aliases of Object.values(names))
      for (const alias of aliases) put(entries, alias, zh, file);
  return entries;
}

function diffObject(name, actual, expected, label) {
  const a = Object.keys(actual), b = Object.keys(expected);
  const onlyA = a.filter(key => !Object.hasOwn(expected, key));
  const onlyB = b.filter(key => !Object.hasOwn(actual, key));
  const changed = a.filter(key => Object.hasOwn(expected, key) && actual[key] !== expected[key]);
  const same = !onlyA.length && !onlyB.length && !changed.length;
  console.log(name, '字典', a.length, 'vs', b.length, same ? '✅ 完全一致' : '❌ 不一致');
  for (const key of onlyA.slice(0, 8)) console.log('  src 独有:', JSON.stringify(key));
  for (const key of onlyB.slice(0, 8)) console.log('  ' + label + ' 独有:', JSON.stringify(key));
  for (const key of changed.slice(0, 8))
    console.log('  值不同:', JSON.stringify(key), JSON.stringify(actual[key]), '→', JSON.stringify(expected[key]));
  return same;
}

function main(args) {
  const [source, flag, filename] = args;
  if (!source || !(args.length === 1 || (args.length === 3 && flag === '--dict-json' && filename))) {
    throw new Error('用法: node verify_dicts.js <src.js> [--dict-json <dict.json>]');
  }
  const layers = embeddedLayers(readRepoFile(source).toString('utf8'));
  const blob = filename ? readRepoFile(filename) : null;
  const runtime = blob ? JSON.parse(blob.toString('utf8')) : null;
  let allSame = true;
  for (const [key, name] of LAYERS) {
    const actual = layers.get(name);
    const expected = blob ? runtime?.[key] : readSource(key);
    if (!actual || !expected || typeof expected !== 'object' || Array.isArray(expected)) {
      console.error(name, '缺失或格式无效');
      allSame = false;
      continue;
    }
    if (!diffObject(name, actual, expected, blob ? 'dict.json' : 'json')) allSame = false;
  }
  if (blob) console.log(`（对照物: ${filename}  fp=${crypto.createHash('sha256').update(blob).digest('hex').slice(0, 12)}）`);
  console.log(allSame ? '\n=== 全部一致 ✅ ===' : '\n=== 存在差异 ⚠️ ===');
  return allSame ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
