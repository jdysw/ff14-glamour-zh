#!/usr/bin/env node
// Cloudflare Pages 静态资源发布前防线：独立于浏览器侧 64 MiB 历史协议兼容上限。
import assert from 'node:assert/strict';
import { lstatSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PAGES_MAX_ASSET_BYTES = 25 * 1024 * 1024;

export function verifyPagesAssets(directory) {
  const root = path.resolve(directory);
  assert.ok(lstatSync(root).isDirectory(), 'Pages 部署根路径必须是真实目录');
  const files = [];
  const visit = (folder) => {
    for (const item of readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, item.name);
      const relative = path.relative(root, full).split(path.sep).join('/');
      // 不能通过符号链接将部署清单扩展到构建目录或仓库外部。
      assert.ok(!item.isSymbolicLink(), 'Pages 产物不允许符号链接：' + relative);
      if (item.isDirectory()) {
        visit(full);
        continue;
      }
      assert.ok(item.isFile(), 'Pages 产物存在非普通文件：' + relative);
      const size = statSync(full).size;
      assert.ok(size <= PAGES_MAX_ASSET_BYTES,
        `Cloudflare Pages 单文件不得超过 25 MiB：${relative}（${size} B）`);
      files.push({ path: relative, bytes: size });
    }
  };
  visit(root);
  assert.ok(files.length > 0, 'Pages 部署目录不允许为空');
  return { files: files.length, largest: files.reduce((a, b) => a.bytes >= b.bytes ? a : b) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--dir');
  const directory = index >= 0 ? process.argv[index + 1] : 'site';
  if (!directory) throw new Error('--dir 必须指定 Pages 目录');
  console.log('✅ Pages 静态资源大小校验：' + JSON.stringify(verifyPagesAssets(directory)));
}
