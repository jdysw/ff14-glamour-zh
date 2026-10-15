import { findPython } from '../../build/python.mjs';
// 对照 Python V3 生成器和生产站点策略，防止任一侧独立演进时悄悄漏表。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SITE_POLICIES } from '../../src/core/site-policy.js';
import { requiredV3Files, validV3FileMeta, validV3Manifest } from '../../src/core/v3-contract.js';
import { RUNTIME_DICT_LAYERS, validRuntimeDictionary } from '../../src/core/dict-contract.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const python = [
  'import json,importlib.util',
  "spec=importlib.util.spec_from_file_location('v3gen', 'build/make-runtime-data.py')",
  'generator=importlib.util.module_from_spec(spec)',
  'spec.loader.exec_module(generator)',
  'print(json.dumps(generator.SITE_FILES, ensure_ascii=False))',
].join(';');
const published = JSON.parse(execFileSync(findPython(), ['-c', python], { cwd: root, encoding: 'utf8' }));
assert.equal(SITE_POLICIES.length, 8);
assert.deepEqual(Object.keys(published).sort(), SITE_POLICIES.map(site => site.id).sort(),
  'Python 发布器与 JavaScript 应用层必须服务相同七站');
for (const site of SITE_POLICIES) {
  assert.deepEqual([...requiredV3Files(site)].sort(), [...published[site.id]].sort(),
    site.id + ' 必需 V3 数据文件与生成器输出必须严格一致');
}

const sha = 'a'.repeat(64);
const meta = (url, bytes = 123) => ({ url, sha256: sha, bytes });
const valid = {
  schema: 3, candidatePolicy: 1, version: 'contract-test',
  sites: {
    mirapri: { files: {
      names: meta('mirapri/names.tsv'),
      hash: meta('mirapri/hash.tsv'),
      alias: meta('mirapri/alias.tsv'),
      dup: meta('mirapri/dup.tsv'),
    } },
  },
  shared: { dict: meta('dict.json') },
};
const copy = () => structuredClone(valid);
assert.equal(validV3Manifest(valid), true);
assert.equal(validV3FileMeta(meta('mirapri/names.tsv'), 'mirapri/names.tsv'), true);
assert.equal(validV3FileMeta({ url: 'mirapri/names.tsv', sha256: sha }, 'mirapri/names.tsv'), false,
  '当前清单必须声明 bytes');

// 这些变体必须在网络下载之前拒绝，不得进入文件缓存。
const badUrls = [
  '../names.tsv', '../../dict.json', 'https://evil.invalid/a.tsv',
  '//evil.invalid/a.tsv', 'mirapri/../ec/names.tsv',
  'mirapri/names.tsv?version=2', 'mirapri/names.tsv#hash',
  'ec/names.tsv', 'mirapri/names.txt',
];
for (const url of badUrls) {
  const altered = copy();
  altered.sites.mirapri.files.names.url = url;
  assert.equal(validV3Manifest(altered), false, '拒绝非生成器约定的 URL：' + url);
}
for (const bytes of [-1, 1.25, Number.MAX_SAFE_INTEGER, '100', NaN, Infinity]) {
  const altered = copy();
  altered.sites.mirapri.files.names.bytes = bytes;
  assert.equal(validV3Manifest(altered), false, '拒绝异常文件字节数：' + String(bytes));
}
for (const mutate of [
  obj => { obj.sites.mirapri.files.names.sha256 = 'not-a-sha256'; },
  obj => { obj.sites.mirapri.files.unknown = meta('mirapri/unknown.tsv'); },
  obj => { obj.sites.mirapri.files.ecid = meta('mirapri/ecid.tsv'); },
  obj => { delete obj.sites.mirapri.files.dup; },
  obj => { obj.sites.untrusted = obj.sites.mirapri; },
  obj => { obj.shared.dict.url = '/dict.json'; },
  obj => { obj.shared.extra = meta('untrusted.json'); },
  obj => { obj.shared = []; },
  obj => { obj.shared = null; },
  obj => { obj.shared = { dict: null }; },
  obj => { obj.shared = { dict: 'dict.json' }; },
  obj => { obj.candidatePolicy = 99; },
  obj => { obj.candidatePolicy = 0; },
  obj => { delete obj.shared; },
  obj => { delete obj.sites.mirapri.files.names.bytes; },
  obj => { obj.schema = 4; },
  obj => { obj.sites = []; },
  obj => { obj.sites = {}; },
]) {
  const altered = copy(); mutate(altered);
  assert.equal(validV3Manifest(altered), false, '拒绝异常结构：' + JSON.stringify(altered).slice(0,140));
}
// 缓存与发布端均要求当前八层词典，拒绝缺层历史数据。
const fullDict = Object.fromEntries(RUNTIME_DICT_LAYERS.map(layer => [layer, { 示例: '译文' }]));
assert.equal(validRuntimeDictionary(fullDict, true), true);
assert.equal(validRuntimeDictionary({ main: { 示例: '译文' } }), false);
assert.equal(validRuntimeDictionary({ main: { 示例: '译文' } }, true), false);
for (const invalid of [
  { main: JSON.parse('{"__proto__":{"polluted":"yes"}}') },
  { main: { constructor: '危险键' } },
  { main: { 示例: ['错误类型'] } },
  { main: null },
  { invalidLayer: { 示例: '不允许' } },
]) assert.equal(validRuntimeDictionary(invalid), false, '非法词库必须拒绝');
console.log('✅ Python → V3 Manifest → JavaScript 站点需求及严格 URL/字节元数据契约通过');
