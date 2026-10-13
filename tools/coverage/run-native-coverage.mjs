#!/usr/bin/env node
// 对直接导入的生产 ESM 模块进行真实 V8 覆盖率采集，生成 Sonar 可读的 LCOV。
// 不伪造未加载文件的命中数，旧版 new Function 测试不能冒充源码覆盖率。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'tests/.cache/coverage');
const report = path.join(directory, 'lcov.info');
mkdirSync(directory, { recursive: true });

const result = spawnSync(process.execPath, [
  '--test',
  '--experimental-test-coverage',
  // 同时展示原生 test/spec 失败详情，LCOV 仍写入独立报告，不再隐藏错误堆栈。
  '--test-reporter=spec',
  '--test-reporter-destination=stdout',
  '--test-reporter=lcov',
  '--test-reporter-destination=' + report,
  'tests/unit/test-native-source.test.mjs',
  'tests/unit/test-native-expanded.test.mjs',
], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
if (!existsSync(report)) throw new Error('V8 未生成 LCOV 覆盖率报告');

const lcov = readFileSync(report, 'utf8');
const records = lcov.split('end_of_record');
const required = [
  'src/core/site-policy.js',
  'src/core/cache-primitives.js',
  'src/core/runtime.js',
  'src/core/http.js',
  'src/core/storage.js',
  'src/core/dom.js',
  'src/core/v3-contract.js',
  'src/core/dict-contract.js',
  'src/core/data-manager.js',
];
for (const source of required) {
  const section = records.find(part => part.split('\n').some(line => line.replaceAll('\\', '/').trim() === 'SF:' + source));
  if (!section) throw new Error('LCOV 缺少真实生产源码：' + source);
  const lines = [...section.matchAll(/^DA:\d+,(\d+)/gm)];
  if (!lines.length || !lines.some(([, hit]) => Number(hit) > 0)) {
    throw new Error('LCOV 对生产源码没有实际执行命中：' + source);
  }
  const covered = lines.filter(([, hit]) => Number(hit) > 0).length;
  console.log('源码覆盖率：' + source + ' — 已执行 ' + covered + '/' + lines.length + ' 行');
}
console.log('✅ 真实 V8 LCOV 已生成：tests/.cache/coverage/lcov.info');
