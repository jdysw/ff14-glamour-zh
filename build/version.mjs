#!/usr/bin/env node
// build/version.mjs — 版本单一源治理（v1.4 Phase 17）
//
// 单一版本源 = package.json 的 "version"。
// 其余 @version 位置一律由本脚本同步生成（禁止手改，防多套手工版本漂移）：
//   - build/userscript-header.txt（dist 元数据模板，rollup banner 输入）
//   - dist/ff14-glamour-zh.greasyfork.user.js（构建产物，只校验不同步）
//
// 用法：
//   node build/version.mjs           # 同步：package.json → header 模板（幂等）
//   node build/version.mjs --check   # 校验：package.json ≡ header ≡ dist（dist 存在时）
// 退出码：0 通过；1 不一致（打印明细）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG_FILE = 'package.json';
const SYNC_FILES = [
  'build/userscript-header.txt',
];
const DIST_FILE = 'dist/ff14-glamour-zh.greasyfork.user.js';

// @version 行：捕获前缀（对齐空白）与版本号；[ \t] 限定行内空白，避免跨行误配
const RE_ONE = /^(\/\/ @version[ \t]+)(\S+)([ \t]*)$/m;
const RE_ALL = /^(\/\/ @version[ \t]+)(\S+)([ \t]*)$/gm;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const CHECK = process.argv.includes('--check');

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

/** 读取某仓库内文件的 @version；要求恰一条，缺失/多条均视为损坏 */
function readVersion(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail(`文件不存在：${rel}`);
  const text = fs.readFileSync(abs, 'utf8');
  const count = (text.match(RE_ALL) || []).length;
  if (count !== 1) fail(`${rel} 的 @version 行应为 1 条，实际 ${count} 条`);
  const m = text.match(RE_ONE);
  return { text, prefix: m[1], suffix: m[3], ver: m[2] };
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, PKG_FILE), 'utf8'));
const VERSION = String(pkg.version || '');
if (!SEMVER_RE.test(VERSION)) fail(`package.json version 非法："${VERSION}"（应为 x.y.z）`);

if (CHECK) {
  const rows = [[PKG_FILE, VERSION]];
  for (const rel of SYNC_FILES) rows.push([rel, readVersion(rel).ver]);
  const distBuilt = fs.existsSync(path.join(ROOT, DIST_FILE));
  if (distBuilt) rows.push([DIST_FILE, readVersion(DIST_FILE).ver]);

  const bad = rows.filter(([, v]) => v !== VERSION);
  if (bad.length) {
    for (const [rel, v] of bad) console.error(`✗ 版本不一致：${rel} = ${v}（应为 ${VERSION}）`);
    fail(`存在 ${bad.length} 处版本漂移；请运行 node build/version.mjs 同步、重建产物后重试`);
  }
  console.log(`✓ 版本一致性校验通过（${rows.length} 源 ≡ ${VERSION}${distBuilt ? '' : '；dist 未构建，已跳过'}）`);
  process.exit(0);
}

// —— 同步模式：package.json → userscript header 模板（幂等）——
for (const rel of SYNC_FILES) {
  const { text, prefix, suffix, ver } = readVersion(rel);
  if (ver === VERSION) {
    console.log(`· ${rel}：已一致（${ver}）`);
    continue;
  }
  fs.writeFileSync(path.join(ROOT, rel), text.replace(RE_ONE, `${prefix}${VERSION}${suffix}`));
  console.log(`↑ ${rel}：${ver} → ${VERSION}`);
}
console.log(`✓ 版本同步完成（单一源 package.json = ${VERSION}）`);
