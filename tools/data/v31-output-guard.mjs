// V3.1 独立预览与保留库共用的路径防护，避免经符号链接写入生产站点。
import assert from 'node:assert/strict';
import { existsSync, lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGES_ROOT = path.resolve(fileURLToPath(new URL('../../site', import.meta.url)));
const within = (candidate, root) => candidate === root || candidate.startsWith(root + path.sep);

// 与路径字符串检查不同，还要拒绝父目录中的符号链接，防止别名绕过 site/ 隔离。
function rejectLinkedAncestors(target) {
  for (let entry = target; ; entry = path.dirname(entry)) {
    try {
      assert.ok(!lstatSync(entry).isSymbolicLink(), '预览路径不得经过符号链接：' + entry);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (entry === path.dirname(entry)) break;
  }
}

export function validateIsolatedOutput(sources, directory) {
  const target = path.resolve(directory);
  assert.ok(!within(target, PAGES_ROOT), '预览产物不得位于站点 site/ 部署目录');
  for (const source of sources) {
    const input = path.resolve(source);
    assert.ok(!within(target, input) && !within(input, target),
      '预览目录不得与任意输入目录重叠');
  }
  rejectLinkedAncestors(target);
  if (existsSync(target)) {
    assert.ok(lstatSync(target).isDirectory(), '预览目录必须是普通目录');
    assert.equal(readdirSync(target).length, 0, '预览输出目录必须为空');
  }
  return target;
}
