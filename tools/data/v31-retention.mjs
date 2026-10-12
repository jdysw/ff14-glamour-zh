#!/usr/bin/env node
// V3.1 追加式对象保留演练：先合并旧/新不可变对象，再切换最新清单。
// 不触碰 site/，也不自动部署；仅用于验证未来发布与回滚方案的可行性。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_POLICIES } from '../../src/core/site-policy.js';
import { verifyPagesAssets } from './verify-pages-assets.mjs';
import { validV31Manifest } from './v31-contract.mjs';

import { validateIsolatedOutput } from './v31-output-guard.mjs';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const resourceRefs = manifest => [
  ...SITE_POLICIES.flatMap(site => Object.values(manifest.sites[site.id].files)),
  manifest.shared.dict,
];

function readSnapshot(directory) {
  verifyPagesAssets(directory);
  const bytes = readFileSync(path.join(directory, 'manifest.v31.json'));
  const manifest = JSON.parse(bytes.toString('utf8'));
  assert.ok(validV31Manifest(manifest), '输入不是合法 V3.1 清单');
  const objects = new Map();
  for (const ref of resourceRefs(manifest)) {
    const payload = readFileSync(path.join(directory, ref.url));
    assert.equal(payload.byteLength, ref.bytes, '输入对象大小异常：' + ref.url);
    assert.equal(digest(payload), ref.sha256, '输入对象指纹异常：' + ref.url);
    if (!objects.has(ref.url)) objects.set(ref.url, payload);
  }
  const archive = 'manifests/' + manifest.source.version + '-'
    + manifest.source.manifestSha256.slice(0, 12) + '.json';
  return { bytes, manifest, objects, archive };
}

export function createV31RetainedStore(previewDirectories, targetDirectory) {
  assert.ok(Array.isArray(previewDirectories) && previewDirectories.length >= 2,
    '必须提供至少两个按发布时间排列的完整预览快照');
  const inputs = previewDirectories.map(source => path.resolve(source));
  const target = validateIsolatedOutput(inputs, targetDirectory);
  // 全部输入通过验证后才创建输出；故障时不发布半份最新清单。
  const snapshots = inputs.map(readSnapshot);
  const unique = new Map();
  const archives = new Map();
  for (const snapshot of snapshots) {
    for (const [url, bytes] of snapshot.objects) {
      const previous = unique.get(url);
      if (previous) assert.ok(previous.equals(bytes), '相同内容地址不能有不同内容：' + url);
      else unique.set(url, bytes);
    }
    const previousArchive = archives.get(snapshot.archive);
    if (previousArchive) assert.ok(previousArchive.equals(snapshot.bytes),
      '同一来源版本归档不能覆盖不同清单');
    else archives.set(snapshot.archive, snapshot.bytes);
  }
  mkdirSync(target, { recursive: true });
  for (const [url, bytes] of [...unique, ...archives]) {
    const filename = path.join(target, url);
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, bytes, { flag: 'wx' });
  }
  const latest = snapshots.at(-1);
  // 生产迁移时，应在上传所有对象和归档后才更新当前清单指针。
  writeFileSync(path.join(target, 'manifest.v31.json'), latest.bytes, { flag: 'wx' });
  verifyPagesAssets(target);
  return {
    snapshots: snapshots.length, archivedManifests: archives.size,
    uniqueObjects: unique.size, latestSourceVersion: latest.manifest.source.version,
    objectBytes: [...unique.values()].reduce((sum, bytes) => sum + bytes.length, 0),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const output = outIndex < 0 ? null : args[outIndex + 1];
  const inputIndex = args.indexOf('--inputs');
  const previews = inputIndex < 0 ? [] : (args[inputIndex + 1] || '').split(',').filter(Boolean);
  assert.ok(output && previews.length >= 2,
    '用法：--inputs <旧预览目录>,<新预览目录> --out <隔离保留目录>');
  console.log('✅ V3.1 旧对象保留演练：' + JSON.stringify(createV31RetainedStore(previews, output)));
}
