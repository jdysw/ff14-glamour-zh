#!/usr/bin/env node
// 数据站发布前强制核验完整 V3 产物：同一份纯路径契约 + 实际磁盘字节 SHA-256。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_POLICIES } from '../../src/core/site-policy.js';
import { validRuntimeDictionary } from '../../src/core/dict-contract.js';
import { requiredV3Files, validV3Manifest } from '../../src/core/v3-contract.js';

export function verifyV3Publish(directory) {
  const base = path.resolve(directory);
  const manifest = JSON.parse(readFileSync(path.join(base, 'manifest.json'), 'utf8'));
  assert.ok(validV3Manifest(manifest), 'manifest 不满足客户端所接受的 V3 契约');
  assert.equal(manifest.candidatePolicy, 1, '新发布必须包含当前装备候选策略');
  assert.match(manifest.version, /^[a-f0-9]{12}$/, '生成版本必须是 12 位十六进制');
  assert.deepEqual(Object.keys(manifest.sites).sort(), DATA_POLICIES.map(site => site.id).sort(),
    '数据站必须输出七站完整文件清单');

  let fileCount = 0;
  let totalBytes = 0;
  function check(meta) {
    assert.ok(Number.isSafeInteger(meta.bytes) && meta.bytes >= 0,
      '新的数据包必须显式声明真实字节长度');
    // URL 已通过纯契约的严格相对路径校验，不存在目录穿越。
    const buffer = readFileSync(path.join(base, meta.url));
    assert.equal(buffer.byteLength, meta.bytes, meta.url + ' 字节数不匹配');
    const digest = createHash('sha256').update(buffer).digest('hex');
    assert.equal(digest, meta.sha256.toLowerCase(), meta.url + ' SHA-256 不匹配');
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    fileCount++;
    totalBytes += buffer.byteLength;
  }
  for (const site of DATA_POLICIES) {
    const files = manifest.sites[site.id].files;
    assert.deepEqual(Object.keys(files).sort(), requiredV3Files(site).sort(),
      site.id + ' 数据文件必须与当前脚本的查询需求完全一致');
    for (const meta of Object.values(files)) check(meta);
  }
  assert.ok(manifest.shared?.dict, '必须提供共享词典');
  check(manifest.shared.dict);
  const dictionary = JSON.parse(readFileSync(path.join(base, 'dict.json'), 'utf8'));
  assert.ok(validRuntimeDictionary(dictionary),
    '共享词典必须包含当前八层、字符串译文且不能包含原型特殊键');
  return { sites: DATA_POLICIES.length, files: fileCount, bytes: totalBytes, version: manifest.version };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.indexOf('--dir');
  const folder = arg >= 0 ? process.argv[arg + 1] : 'site/ff14/v3';
  if (!folder) throw new Error('--dir 必须指定数据生成目录');
  const result = verifyV3Publish(folder);
  console.log('✅ V3 发布前全量校验：' + JSON.stringify(result));
}
