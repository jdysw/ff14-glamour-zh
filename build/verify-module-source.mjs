#!/usr/bin/env node
// verify-module-source.mjs — Phase 22：模块源码唯一性门禁
//
// 正常构建的代码源码只能来自：
//   src/main.js
//   src/core/*.js
//   src/sites/*.js
//
// build/migrate/* 可以作为历史迁移工具保留，但不得重新进入 build.sh 主链。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacy = path.join(root, 'src', 'ff14-glamour-zh.external.user.js');
const main = path.join(root, 'src', 'main.js');
const coreDir = path.join(root, 'src', 'core');
const sitesDir = path.join(root, 'src', 'sites');
const buildFile = path.join(root, 'build.sh');

function fail(msg) {
  console.error('❌ ' + msg);
  process.exit(1);
}

if (fs.existsSync(legacy)) fail('Legacy 单文件源码仍存在：src/ff14-glamour-zh.external.user.js');
if (!fs.existsSync(main)) fail('缺少模块入口：src/main.js');
if (!fs.existsSync(coreDir)) fail('缺少 Core 模块目录：src/core');
if (!fs.existsSync(sitesDir)) fail('缺少 Site 模块目录：src/sites');

const core = fs.readdirSync(coreDir).filter((f) => f.endsWith('.js')).sort();
const sites = fs.readdirSync(sitesDir).filter((f) => f.endsWith('.js')).sort();
if (!core.length) fail('src/core 没有 JavaScript 模块');
if (!sites.length) fail('src/sites 没有 JavaScript 模块');

const build = fs.readFileSync(buildFile, 'utf8');
const forbidden = [
  'build/migrate/gen-modules.py',
  'build/migrate/add-interfaces.mjs',
  'build/migrate/order-modules.mjs',
  'build/migrate/reindex-assign.py',
  'build/migrate/module-map.mjs',
  'build/migrate/verify-modules.py',
  'build/module-assign.json',
];
const used = forbidden.filter((x) => build.includes(x));
if (used.length) fail('build.sh 仍调用 Legacy 模块生成链：' + used.join(', '));

const sourceFiles = [
  main,
  ...core.map((f) => path.join(coreDir, f)),
  ...sites.map((f) => path.join(sitesDir, f)),
];
const dupLegacyMarkers = sourceFiles.filter((f) => {
  const t = fs.readFileSync(f, 'utf8');
  return t.includes('gen-modules.py') || t.includes('module-assign.json');
});
if (dupLegacyMarkers.length) {
  fail('Canonical 模块源码仍包含 Legacy 生成链标识：' +
    dupLegacyMarkers.map((f) => path.relative(root, f)).join(', '));
}

console.log('✅ 模块源码唯一性通过');
console.log('   main: 1');
console.log('   core: ' + core.length);
console.log('   sites: ' + sites.length);
console.log('   legacy single-file: absent');
console.log('   build-time module generation: disabled');
