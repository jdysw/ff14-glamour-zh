// 通过真实 V3 七站文件形状和可控 HTTP 响应验证线上探针；严格保留 SHA/字节/路径断言。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SITE_POLICIES } from '../../src/core/site-policy.js';
import { RUNTIME_DICT_LAYERS } from '../../src/core/dict-contract.js';
import { requiredV3Files } from '../../src/core/v3-contract.js';
import { verifyProductionV3, verifyProductionWithRetry } from '../../tools/data/verify-pages-production.mjs';

const origin = 'https://zhixia-data.pages.dev/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assets = new Map();
const sites = {};
for (const site of SITE_POLICIES) {
  const files = {};
  for (const name of requiredV3Files(site)) {
    const ext = ['series', 'acl'].includes(name) ? 'txt' : 'tsv';
    const url = site.id + '/' + name + '.' + ext;
    const bytes = Buffer.from(name === 'alias' ? '别称\t公共译名\n'
      : site.id + '\t' + name + '\t译名\n', 'utf8');
    assets.set(url, bytes);
    files[name] = { url, sha256: hash(bytes), bytes: bytes.length };
  }
  sites[site.id] = { files };
}
const dictionary = Buffer.from(JSON.stringify(
  Object.fromEntries(RUNTIME_DICT_LAYERS.map(name => [name, {}]))), 'utf8');
assets.set('dict.json', dictionary);
const manifest = {
  schema: 3, candidatePolicy: 1, version: 'abcd1234abcd', sites,
  shared: { dict: { url: 'dict.json', sha256: hash(dictionary), bytes: dictionary.length } },
};
assets.set('manifest.json', Buffer.from(JSON.stringify(manifest)));
const requests = [];
let override = null;
const transport = async (url, opts) => {
  requests.push(url);
  assert.equal(opts.redirect, 'manual', '必须阻止 fetch 自动跟随 302');
  const path = new URL(url).pathname.replace(/^\/ff14\/v3\//, '');
  if (override) {
    const result = override(path);
    if (result) return result;
  }
  const bytes = assets.get(path);
  return bytes ? new Response(bytes, { status: 200 })
    : new Response('Missing', { status: 404 });
};

const result = await verifyProductionV3(origin, transport);
assert.equal(result.httpPaths, assets.size);
assert.equal(result.files, assets.size - 1);
assert.equal(result.version, manifest.version);
assert.equal(requests.length, assets.size);
assert.ok(requests.some(url => url.endsWith('/collection/names.tsv')),
  '跨站重复文件的原 URL 也必须真实请求');
assert.ok(requests.some(url => url.endsWith('/fc/names.tsv')));

override = path => path === 'fc/names.tsv' ? new Response('损坏', { status: 200 }) : null;
await assert.rejects(verifyProductionV3(origin, transport), /字节长度不符|SHA-256 不符/,
  '返回 HTTP 200 但内容损坏必须明确报错');
override = path => path === 'ec/hash.tsv' ? new Response('Not Found', { status: 404 }) : null;
await assert.rejects(verifyProductionV3(origin, transport), /未返回 HTTP 200/,
  '线上旧 URL 的 404 必须使检查失败');
override = path => path === 'mirapri/alias.tsv'
  ? new Response(null, { status: 302, headers: { Location: '/ff14/v3/ec/alias.tsv' } })
  : null;
await assert.rejects(verifyProductionV3(origin, transport), /未返回 HTTP 200/,
  '浏览器可见跳转不能冒充 Pages 内部 200 代理');

override = path => path === 'dict.json' ? new Response('{"bad":true}', { status: 200 }) : null;
await assert.rejects(verifyProductionV3(origin, transport), /线上词典字节长度不符|线上词典 SHA-256 不符/,
  '非法词典字节必须拒绝');
override = null;
await assert.rejects(verifyProductionV3('http://zhixia-data.pages.dev/', transport), /HTTPS/);
await assert.rejects(verifyProductionV3('https://evil.example/', transport), /仅允许/);
await assert.rejects(verifyProductionV3('https://zhixia-data.pages.dev.evil.test/', transport), /仅允许/);
await assert.rejects(verifyProductionV3('https://user:pw@zhixia-data.pages.dev/', transport), /凭据/);

let tries = 0;
const flaky = async (url, opts) => {
  if (tries++ === 0) return new Response('not ready', { status: 404 });
  return transport(url, opts);
};
const recovered = await verifyProductionWithRetry(origin, flaky, 1, 0);
assert.equal(recovered.httpPaths, assets.size, '短暂 CDN 不一致后应完整重新校验所有路径');
console.log('✅ 生产 V3 HTTP 探针：28 条路径、损坏正文、404、302、词典、HTTPS/主机白名单与重试通过');
