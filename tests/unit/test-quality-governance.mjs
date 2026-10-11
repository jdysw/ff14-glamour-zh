// 第四阶段质量治理契约：阻止旧预览工作流、无效覆盖率与自动发版回归。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../helpers/paths.mjs';

const at = (name) => path.join(repoRoot, name);
for (const abandoned of [
  '.github/workflows/pr44-ec-preview.yml',
  'tools/build-pr44-preview.mjs',
  'preview/ff14-glamour-zh-pr44-ec-test.user.js',
  'preview/ff14-glamour-zh-pr44-endcloset-test.user.js',
]) {
  assert.equal(fs.existsSync(at(abandoned)), false, '已合并的 PR44 不得继续携带预览发布产物：' + abandoned);
}

const sonar = fs.readFileSync(at('sonar-project.properties'), 'utf8');
assert.match(sonar, /^sonar\.javascript\.lcov\.reportPaths=tests\/\.cache\/coverage\/lcov\.info$/m,
  'Sonar 必须读取真实运行的源码 LCOV');
assert.doesNotMatch(sonar, /^sonar\.coverage\.exclusions=\*\*\/\*$/m,
  '禁止重新排除全部源码覆盖率');

const runner = fs.readFileSync(at('tools/coverage/run-native-coverage.mjs'), 'utf8');
assert.match(runner, /--experimental-test-coverage/,
  '必须用真实 Node V8 覆盖率采集，而非硬编码占比');
assert.match(runner, /test-native-source\.test\.mjs/,
  '必须实际加载生产 ESM 模块');

const testWorkflow = fs.readFileSync(at('.github/workflows/test.yml'), 'utf8');
assert.match(testWorkflow, /name: Native Source Coverage/,
  '完整 CI 必须单独执行真实覆盖率测试');

const release = fs.readFileSync(at('.github/workflows/release.yml'), 'utf8');
assert.match(release, /workflow_dispatch:/, '发行版仍需维护者手动触发');
assert.doesNotMatch(release, /^\s+push:\s*$/m, '合并 main 不允许自动发布版本');

console.log('✅ 旧预览删除、真实源码覆盖率与手动发布门禁验证通过');
