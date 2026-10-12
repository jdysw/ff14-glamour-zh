#!/usr/bin/env node
// 校验由相同生成来源派生的跨站资源：在更改存储协议前锁定逐字节等价性。
// 此处只读取生成产物，不通过共享路径替换生产 V3 文件。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyV3Publish } from './verify-publish-contract.mjs';

// 名称与 hash 是第一阶段实测中最主要的重复项；其余组防止后续构建语义漂移。
// 如将来某站变更语言键或生成语义，必须经过审查后同步调整本清单。
export const SHARED_CANDIDATE_GROUPS = Object.freeze([
  { type: 'names', sites: ['fc', 'collection'] },
  { type: 'hash', sites: ['ec', 'fc', 'mirapri'] },
  { type: 'series', sites: ['fc', 'collection'] },
  { type: 'alias', sites: ['mirapri', 'ec', 'fc', 'ronka', 'collection', 'endcloset'] },
  { type: 'dup', sites: ['mirapri', 'fc', 'collection'] },
]);

export function checkSharedCandidates(manifest) {
  const groups = [];
  for (const { type, sites } of SHARED_CANDIDATE_GROUPS) {
    const records = sites.map(site => {
      const meta = manifest?.sites?.[site]?.files?.[type];
      assert.ok(meta, `缺少共享候选资源：${site}/${type}`);
      return { site, url: meta.url, bytes: meta.bytes, sha256: meta.sha256 };
    });
    const reference = records[0];
    for (const entry of records.slice(1)) {
      assert.equal(entry.sha256, reference.sha256,
        `${type}: ${entry.site} 与 ${reference.site} 的 SHA 不同，不能安全去重`);
      assert.equal(entry.bytes, reference.bytes,
        `${type}: ${entry.site} 与 ${reference.site} 的字节长度不同`);
    }
    groups.push({ type, sites, sha256: reference.sha256, bytesPerCopy: reference.bytes,
      reclaimableBytes: reference.bytes * (sites.length - 1) });
  }
  return groups;
}

export function verifySharedCandidates(directory) {
  const base = path.resolve(directory);
  // 先使用与部署共用的安全契约校验所有资源的真实字节和哈希。
  verifyV3Publish(base);
  const manifest = JSON.parse(readFileSync(path.join(base, 'manifest.json'), 'utf8'));
  return checkSharedCandidates(manifest);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--dir');
  const directory = index >= 0 ? process.argv[index + 1] : 'site/ff14/v3';
  if (!directory) throw new Error('--dir 必须指定生成目录');
  const groups = verifySharedCandidates(directory);
  console.log('✅ V3 共享候选数据逐文件等价：' + JSON.stringify(groups));
}
