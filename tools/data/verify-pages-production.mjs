#!/usr/bin/env node
// 部署后校验真实 Pages 域名的 V3 数据完整性；不能以部署成功代替 28 条 HTTP 验证。
// 所有资源仍使用旧路径，不修改用户脚本、manifest 或缓存协议。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SITE_POLICIES } from '../../src/core/site-policy.js';
import { requiredV3Files, validV3Manifest } from '../../src/core/v3-contract.js';
import { validRuntimeDictionary } from '../../src/core/dict-contract.js';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const utf8 = new TextDecoder('utf-8', { fatal: true });
const DEFAULT_ORIGIN = 'https://zhixia-data.pages.dev/';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function acceptedOrigin(value) {
  const origin = new URL(value);
  assert.equal(origin.protocol, 'https:', '线上校验必须使用 HTTPS');
  assert.ok(!origin.username && !origin.password && !origin.search && !origin.hash,
    '校验地址不能带凭据、查询参数或片段');
  assert.equal(origin.pathname, '/', '校验地址必须是站点根目录');
  // 只能校验我们的正式数据站或 Cloudflare Pages 部署预览域名。
  assert.ok(origin.hostname === 'zhixia-data.pages.dev'
    || /^[a-z0-9-]+\.zhixia-data\.pages\.dev$/.test(origin.hostname),
  '仅允许 zhixia-data.pages.dev 或同项目独立部署域名');
  return origin;
}

async function httpBytes(origin, relativePath, transport) {
  const url = new URL('/ff14/v3/' + relativePath, origin).href;
  const response = await transport(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(25000),
    headers: { accept: '*/*' },
  });
  assert.equal(response.status, 200, '线上 V3 路径未返回 HTTP 200：' + url);
  assert.ok(!response.headers?.get?.('location'),
    '线上 V3 路径出现了浏览器可见跳转：' + url);
  return Buffer.from(await response.arrayBuffer());
}

export async function verifyProductionV3(originValue = DEFAULT_ORIGIN, transport = fetch) {
  const origin = acceptedOrigin(originValue);
  const manifestBytes = await httpBytes(origin, 'manifest.json', transport);
  const manifest = JSON.parse(utf8.decode(manifestBytes));
  assert.ok(validV3Manifest(manifest), '线上 manifest 不符合原 V3 严格路径契约');
  assert.equal(manifest.candidatePolicy, 1, '线上 manifest 缺少当前装备候选策略');
  assert.match(manifest.version, /^[a-f0-9]{12}$/, '线上 manifest.version 格式不正确');
  assert.deepEqual(Object.keys(manifest.sites).sort(), SITE_POLICIES.map(x => x.id).sort(),
    '线上必须完整提供当前契约的全部站点数据声明');
  assert.ok(manifest.shared?.dict, '线上必须提供 dict.json');

  let files = 0;
  let bytesChecked = 0;
  for (const site of SITE_POLICIES) {
    for (const name of requiredV3Files(site)) {
      const meta = manifest.sites[site.id].files[name];
      const bytes = await httpBytes(origin, meta.url, transport);
      assert.equal(bytes.length, meta.bytes, '线上文件字节长度不符：' + meta.url);
      assert.equal(sha256(bytes), meta.sha256.toLowerCase(),
        '线上文件 SHA-256 不符：' + meta.url);
      utf8.decode(bytes);
      files++;
      bytesChecked += bytes.length;
    }
  }
  const dict = manifest.shared.dict;
  const dictBytes = await httpBytes(origin, dict.url, transport);
  assert.equal(dictBytes.length, dict.bytes, '线上词典字节长度不符');
  assert.equal(sha256(dictBytes), dict.sha256.toLowerCase(), '线上词典 SHA-256 不符');
  assert.ok(validRuntimeDictionary(JSON.parse(utf8.decode(dictBytes)), true),
    '线上词典的完整分层结构不正确');
  files++;
  bytesChecked += dictBytes.length;

  return { origin: origin.origin, version: manifest.version,
    httpPaths: files + 1, files, bytesChecked };
}

export async function verifyProductionWithRetry(origin, transport = fetch, retries = 4,
  delayMs = 5000) {
  assert.ok(Number.isInteger(retries) && retries >= 0 && retries <= 10,
    '重试次数超出范围');
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await verifyProductionV3(origin, transport);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        console.error('线上 V3 校验暂未通过（' + (attempt + 1) + '/' + (retries + 1)
          + '）：' + error.message);
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.indexOf('--origin');
  const origin = arg < 0 ? DEFAULT_ORIGIN : process.argv[arg + 1];
  assert.ok(origin, '--origin 必须指定合法的 Pages HTTPS 域名');
  const result = await verifyProductionWithRetry(origin);
  console.log('✅ 线上 Pages V3 文件完整性：' + JSON.stringify(result));
}
