#!/usr/bin/env node
// 在真实 Wrangler Pages 本地服务上检测原 V3 URL 返回 200 且正文 SHA 不变。
// 禁止模拟 200 重写：只有实际 HTTP 响应成功才通过本测试。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_POLICIES } from '../../src/core/site-policy.js';
import { requiredV3Files } from '../../src/core/v3-contract.js';
import { verifyPagesDedupe } from './dedupe-pages.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function verifyPagesHttp(siteDirectory, origin) {
  const site = path.resolve(siteDirectory);
  verifyPagesDedupe(site);
  const url = new URL(origin);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
    'HTTP 回归只允许连接本地 Pages 开发服务');
  const manifest = JSON.parse(readFileSync(path.join(site, 'ff14/v3/manifest.json'), 'utf8'));
  const metas = DATA_POLICIES.flatMap(policy =>
    requiredV3Files(policy).map(name => manifest.sites[policy.id].files[name]));
  metas.push(manifest.shared.dict);
  const paths = ['manifest.json', ...metas.map(meta => meta.url)];
  let checks = 0;
  for (const name of paths) {
    const requestUrl = new URL('/ff14/v3/' + name, url);
    const response = await fetch(requestUrl, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, 'Pages 旧路径必须响应 200：' + name);
    assert.ok(!response.headers.has('location'), '禁止向客户端返回可见跳转：' + name);
    const bytes = Buffer.from(await response.arrayBuffer());
    const meta = metas.find(row => row.url === name);
    const expected = meta
      ? { size: meta.bytes, sha256: meta.sha256 }
      : { size: readFileSync(path.join(site, 'ff14/v3/manifest.json')).length,
        sha256: digest(readFileSync(path.join(site, 'ff14/v3/manifest.json'))) };
    assert.equal(bytes.length, expected.size, 'HTTP 响应长度必须与原 manifest 一致：' + name);
    assert.equal(digest(bytes), expected.sha256, 'HTTP 实际响应必须与原数据逐字节一致：' + name);
    checks++;
  }
  return { checks };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = name => {
    const i = args.indexOf(name);
    return i < 0 ? null : args[i + 1];
  };
  const site = at('--site') || 'site';
  const origin = at('--origin');
  assert.ok(origin, '用法：--site <Pages目录> --origin <http://127.0.0.1:端口>');
  console.log('✅ Pages 本地 HTTP 旧路径透明去重：' + JSON.stringify(await verifyPagesHttp(site, origin)));
}
