// 架构回归：站点数据需求与启动适配器分层，禁止重新引入反向依赖。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { repoRoot } from '../helpers/paths.mjs';

function read(relative) {
  return fs.readFileSync(path.join(repoRoot, relative), 'utf8');
}
function imports(relative) {
  const ast = parse(read(relative), { ecmaVersion: 'latest', sourceType: 'module' });
  return ast.body.filter(node => node.type === 'ImportDeclaration').map(node => node.source.value);
}

const policy = 'src/core/site-policy.js';
const data = 'src/core/data-manager.js';
const site = 'src/core/site-registry.js';
assert.deepEqual(imports(policy), [], '纯站点策略不能反向导入任何业务模块');
const v3Contract = 'src/core/v3-contract.js';
assert.deepEqual(imports(v3Contract), ['./site-policy.js'],
  'V3 校验契约只允许读取站点配置，不能触达网络、存储或翻译模块');
assert.ok(imports(data).includes('./v3-contract.js'),
  '数据下载和缓存层必须使用同一个 V3 URL/摘要契约');
assert.ok(!imports(site).includes('./v3-contract.js'),
  '站点适配器仅通过数据层订阅，不能跨层解析 manifest');

assert.ok(imports(data).includes('./site-policy.js'), '数据管理器必须依赖纯策略');
assert.ok(!imports(data).includes('./site-registry.js'), '数据管理器不可依赖站点启动适配器');
assert.ok(imports(site).includes('./site-policy.js'), '站点适配器应共享纯策略配置');
assert.ok(imports(site).includes('./data-manager.js'), '站点启动层仍可按需订阅数据就绪回调');

// 站点配置只能存在一个真实来源，避免数据站和启动器出现配置漂移。
const policySrc = read(policy);
const registrySrc = read(site);
assert.equal((policySrc.match(/\bid: '/g) || []).length, 7, '七站均应在纯策略中声明');
assert.equal((registrySrc.match(/\bid: '/g) || []).length, 7, '七个启动适配器均应存在');
assert.doesNotMatch(registrySrc, /id:\s*'[^']+'\s*,\s*hosts:/, '不能在适配器中重复声明域名');
assert.doesNotMatch(registrySrc, /id:\s*'[^']+'\s*,\s*tables:/, '不能在适配器中重复声明数据表');

const order = JSON.parse(read('build/module-order.json')).order;
assert.ok(order.includes('core/site-policy'), '纯策略必须进入确定性构建顺序契约');
assert.ok(order.includes('core/v3-contract'), '纯 V3 契约必须进入 ESM 构建');
assert.ok(order.indexOf('core/site-policy') < order.indexOf('core/v3-contract'));
assert.ok(order.indexOf('core/v3-contract') < order.indexOf('core/data-manager'));

assert.ok(order.indexOf('core/site-policy') < order.indexOf('core/data-manager'));
assert.ok(order.indexOf('core/site-policy') < order.indexOf('core/site-registry'));

// 测试直接消费规范模块，避免因 Rollup 拼接顺序变化导致伪失败。
for (const file of ['tests/unit/test-site-registry.mjs', 'tests/unit/test-observer.mjs',
  'tests/unit/test-dictionary.mjs', 'tests/unit/test-item-resolver.mjs',
  'tests/unit/test-core.mjs', 'tests/unit/test-cache.mjs',
  'tests/unit/test-storage.mjs', 'tests/unit/test-targets.mjs']) {
  const body = read(file);
  assert.doesNotMatch(body, /\breadDist\s*\(/, file + ' 不应再提取构建产物');
  // 允许直接文件路径 src/core/name.js 或 path.join(root, 'src/core', name)，两者均读取真实源码。
  assert.match(body, /src\/core(?:\/|['"])/, file + ' 应直接加载源码');
}

// 解析器区段必须闭合在其所属模块内，不得跨越多个无关模块。
const resolverSource = read(data);
assert.match(resolverSource, /\/\* @zhixia:core-item-resolver-start \*\//);
assert.match(resolverSource, /\/\* @zhixia:core-item-resolver-end \*\//);
assert.doesNotMatch(read('src/main.js'), /@zhixia:core-item-resolver-(start|end)/);

console.log('✅ 数据策略、模块依赖方向、站点配置单一来源及源码测试隔离检查通过');
