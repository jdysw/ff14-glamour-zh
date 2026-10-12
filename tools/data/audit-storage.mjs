#!/usr/bin/env node
// V3 数据存储基准：只读取已生成的数据包，不修改生产文件。
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { verifyV3Publish } from './verify-publish-contract.mjs';

export function auditStorage(directory) {
  const base = path.resolve(directory);
  // 先验证发布契约再计量，避免用不完整或伪造的产物得出优化结论。
  const verified = verifyV3Publish(base);
  const manifest = JSON.parse(readFileSync(path.join(base, 'manifest.json'), 'utf8'));
  const rows = [];
  const append = (site, meta) => {
    const bytes = readFileSync(path.join(base, meta.url));
    rows.push({
      site, path: meta.url, sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      gzipBytes: gzipSync(bytes, { level: 9, mtime: 0 }).length,
      brotliBytes: brotliCompressSync(bytes, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
      }).length,
    });
  };
  for (const [site, entry] of Object.entries(manifest.sites)) {
    for (const meta of Object.values(entry.files)) append(site, meta);
  }
  append('shared', manifest.shared.dict);
  rows.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const groupByHash = new Map();
  for (const row of rows) {
    const group = groupByHash.get(row.sha256) || [];
    group.push(row);
    groupByHash.set(row.sha256, group);
  }
  const duplicates = [...groupByHash.values()].filter(group => group.length > 1)
    .map(group => ({
      sha256: group[0].sha256,
      bytesPerCopy: group[0].bytes,
      copies: group.length,
      reclaimableBytes: (group.length - 1) * group[0].bytes,
      paths: group.map(row => row.path),
    }))
    .sort((a, b) => b.reclaimableBytes - a.reclaimableBytes || a.sha256.localeCompare(b.sha256));
  const sum = (list, key) => list.reduce((total, row) => total + row[key], 0);
  const unique = [...groupByHash.values()].map(group => group[0]);
  const sites = Object.fromEntries([...new Set(rows.map(row => row.site))].sort()
    .map(site => {
      const files = rows.filter(row => row.site === site);
      return [site, {
        requests: files.length, rawBytes: sum(files, 'bytes'),
        gzipBytes: sum(files, 'gzipBytes'), brotliBytes: sum(files, 'brotliBytes'),
      }];
    }));
  return {
    schema: 1, sourceManifestVersion: verified.version,
    // 原始总量是逻辑文件字节之和；不等同于 Cloudflare 实际计费存储量。
    total: {
      files: rows.length, uniqueBlobs: groupByHash.size,
      rawBytes: sum(rows, 'bytes'),
      gzipBytes: sum(rows, 'gzipBytes'),
      brotliBytes: sum(rows, 'brotliBytes'),
      uniqueRawBytes: sum(unique, 'bytes'),
      duplicateRawBytes: sum(rows, 'bytes') - sum(unique, 'bytes'),
    },
    sites, duplicates, files: rows,
  };
}

const main = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (main) {
  const args = process.argv.slice(2);
  const dirPos = args.indexOf('--dir');
  const outputPos = args.indexOf('--out');
  const directory = dirPos >= 0 ? args[dirPos + 1] : 'site/ff14/v3';
  if (!directory) throw new Error('--dir 需要指定已生成的数据目录');
  const report = auditStorage(directory);
  const serialized = JSON.stringify(report, null, 2) + '\n';
  if (outputPos >= 0) {
    if (!args[outputPos + 1]) throw new Error('--out 需要指定报告路径');
    writeFileSync(args[outputPos + 1], serialized, 'utf8');
  } else process.stdout.write(serialized);
}
