// Pages 平台部署约束独立于运行时 V3 manifest 的兼容性上限。
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, truncateSync, symlinkSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyPagesAssets, PAGES_MAX_ASSET_BYTES } from '../../tools/data/verify-pages-assets.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'zhx-pages-assets-'));
try {
  assert.throws(() => verifyPagesAssets(root), /不允许为空/);
  mkdirSync(path.join(root, 'ff14', 'v3'), { recursive: true });
  const asset = path.join(root, 'ff14', 'v3', 'payload.tsv');
  writeFileSync(asset, '短数据');
  let info = verifyPagesAssets(root);
  assert.equal(info.files, 1);
  assert.equal(info.largest.path, 'ff14/v3/payload.tsv');
  // 使用稀疏文件测试平台边界，避免单元测试实际分配 25 MiB 内存。
  truncateSync(asset, PAGES_MAX_ASSET_BYTES);
  assert.equal(verifyPagesAssets(root).largest.bytes, PAGES_MAX_ASSET_BYTES);
  truncateSync(asset, PAGES_MAX_ASSET_BYTES + 1);
  assert.throws(() => verifyPagesAssets(root), /不得超过 25 MiB/,
    '严格拒绝 Cloudflare Pages 的单资源大小超限');
  truncateSync(asset, 0);
  const link = path.join(root, 'ff14', 'v3', 'external.tsv');
  symlinkSync(asset, link);
  assert.throws(() => verifyPagesAssets(root), /不允许符号链接/,
    '即使链接指向产物目录内部，也必须拒绝');
  console.log('✅ Pages 资源上限、非空目录与符号链接安全校验通过');
} finally {
  rmSync(root, { recursive: true, force: true });
}
