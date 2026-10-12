#!/usr/bin/env node
// 从已验证的生产 V3 生成隔离 V3.1 预览：共享相同内容的文件，完全不触碰 V3 正式输出。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_POLICIES } from '../../src/core/site-policy.js';
import { requiredV3Files } from '../../src/core/v3-contract.js';
import { verifyV3Publish } from './verify-publish-contract.mjs';
import { verifyPagesAssets } from './verify-pages-assets.mjs';
import { validV31Manifest, v31FileMeta } from './v31-contract.mjs';
import { validateIsolatedOutput } from './v31-output-guard.mjs';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function sourceManifest(directory) {
  verifyV3Publish(directory);
  const bytes = readFileSync(path.join(directory, 'manifest.json'));
  return { manifest: JSON.parse(bytes.toString('utf8')), sha256: digest(bytes) };
}

// 只保留一份相同 SHA 和扩展名的字节对象；名称既是内容指纹也是严格下载白名单。
export function createV31Preview(v3Directory, previewDirectory) {
  const source = path.resolve(v3Directory);
  const target = validateIsolatedOutput([source], previewDirectory);
  const original = sourceManifest(source);
  const v3 = original.manifest;
  const objects = new Map();
  const put = (legacyMeta, type) => {
    const ref = v31FileMeta(legacyMeta, type);
    assert.ok(ref, '资源无法映射到 V3.1 内容指纹：' + type);
    const bytes = readFileSync(path.join(source, legacyMeta.url));
    assert.equal(bytes.byteLength, ref.bytes, '预览字节数不匹配：' + legacyMeta.url);
    assert.equal(digest(bytes), ref.sha256, '预览摘要不匹配：' + legacyMeta.url);
    if (!objects.has(ref.url)) objects.set(ref.url, bytes);
    return ref;
  };
  const sites = {};
  for (const site of SITE_POLICIES) {
    const files = {};
    for (const name of requiredV3Files(site)) {
      files[name] = put(v3.sites[site.id].files[name], name);
    }
    sites[site.id] = { files };
  }
  const preview = {
    schema: 31,
    source: { version: v3.version, manifestSha256: original.sha256 },
    sites,
    shared: { dict: put(v3.shared.dict, 'dict') },
  };
  assert.ok(validV31Manifest(preview), '生成的 V3.1 预览不符合契约');
  mkdirSync(target, { recursive: true });
  for (const [relative, bytes] of objects) {
    const filename = path.join(target, relative);
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, bytes, { flag: 'wx' });
  }
  writeFileSync(path.join(target, 'manifest.v31.json'), JSON.stringify(preview, null, 2) + '\n', { flag: 'wx' });
  return verifyV31Preview(source, target);
}

function readObject(previewDir, filename) {
  return readFileSync(path.join(previewDir, filename));
}

// 比对 V3 每个原始文件与 V3.1 对象字节，阻止虚假去重、悬空引用和遗漏资源。
export function verifyV31Preview(v3Directory, previewDirectory) {
  const source = path.resolve(v3Directory);
  const target = path.resolve(previewDirectory);
  const legacy = sourceManifest(source);
  verifyPagesAssets(target);
  const preview = JSON.parse(readFileSync(path.join(target, 'manifest.v31.json'), 'utf8'));
  assert.ok(validV31Manifest(preview), 'V3.1 预览清单结构非法');
  assert.equal(preview.source.version, legacy.manifest.version, '预览源版本不符');
  assert.equal(preview.source.manifestSha256, legacy.sha256, '预览源清单指纹不符');
  const expected = new Set();
  let logicalBytes = 0;
  const compare = (oldMeta, newMeta, type) => {
    const expectedMeta = v31FileMeta(oldMeta, type);
    assert.deepEqual(newMeta, expectedMeta, '预览不能改变原始数据元信息：' + oldMeta.url);
    const original = readFileSync(path.join(source, oldMeta.url));
    const object = readObject(target, newMeta.url);
    assert.ok(original.equals(object), '共享对象与 V3 文件内容不一致：' + oldMeta.url);
    assert.equal(digest(object), newMeta.sha256, '共享对象指纹不一致：' + newMeta.url);
    expected.add(newMeta.url);
    logicalBytes += original.length;
  };
  for (const site of SITE_POLICIES) {
    for (const name of requiredV3Files(site)) {
      compare(legacy.manifest.sites[site.id].files[name], preview.sites[site.id].files[name], name);
    }
  }
  compare(legacy.manifest.shared.dict, preview.shared.dict, 'dict');
  const files = [];
  const visit = folder => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const absolute = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else files.push(path.relative(target, absolute).split(path.sep).join('/'));
    }
  };
  visit(target);
  assert.deepEqual(files.sort(), ['manifest.v31.json', ...expected].sort(),
    '预览目录禁止出现额外、悬空或旧版本未知对象');
  const uniqueBytes = [...expected].reduce((sum, name) => sum + readObject(target, name).length, 0);
  return {
    schema: 31, sourceVersion: preview.source.version,
    logicalFiles: [...SITE_POLICIES].reduce((n, site) => n + requiredV3Files(site).length, 1),
    uniqueObjects: expected.size, logicalBytes, uniqueBytes,
    reclaimableBytes: logicalBytes - uniqueBytes,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--dir');
  const targetIndex = args.indexOf('--out');
  const directory = index >= 0 ? args[index + 1] : 'site/ff14/v3';
  const target = targetIndex >= 0 ? args[targetIndex + 1] : null;
  assert.ok(directory && target, '用法：--dir <V3 数据目录> --out <隔离预览目录>');
  console.log('✅ V3.1 隔离预览：' + JSON.stringify(createV31Preview(directory, target)));
}
