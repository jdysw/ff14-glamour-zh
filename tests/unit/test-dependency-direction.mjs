// 回归检查模块真实依赖方向；构建器为稳定 Rollup 顺序而生成的边不算业务依赖。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { repoRoot } from '../helpers/paths.mjs';

const sourceRoot = path.join(repoRoot, 'src');
const files = ['main.js'];
for (const dir of ['core', 'sites']) {
  for (const name of fs.readdirSync(path.join(sourceRoot, dir)).filter(n => n.endsWith('.js'))) {
    files.push(dir + '/' + name);
  }
}
const graph = new Map();

for (const rel of files.sort()) {
  const text = fs.readFileSync(path.join(sourceRoot, rel), 'utf8');
  const lines = text.split('\n');
  const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const dependencies = [];
  for (const node of ast.body.filter(node => node.type === 'ImportDeclaration')) {
    const imported = String(node.source.value);
    if (!imported.startsWith('.')) continue;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), imported));
    // 仅排除明确标记的历史顺序链接。其余 import，无论是否有绑定，都算真实依赖。
    const precedingLine = lines[node.loc.start.line - 2] || '';
    if (precedingLine.includes('@phase15-order-link:')) continue;
    if (!target.endsWith('.js')) throw new Error('模块导入缺少 .js 后缀：' + rel + ' → ' + imported);
    dependencies.push(target);
  }
  graph.set(rel, [...new Set(dependencies)]);
}
for (const [owner, deps] of graph) {
  for (const dep of deps) assert.ok(graph.has(dep), owner + ' 引用了不存在的模块 ' + dep);
}

// 不能把过渡顺序 import 计入业务环，否则会把无害的模块布局误报成数万条循环。
const runtime = graph.get('core/runtime.js');
assert.deepEqual(runtime, [], '通用运行时不应导入任何数据、站点或缓存模块');
assert.deepEqual(graph.get('core/site-policy.js'), [], '站点纯配置不能引入业务依赖');
const cache = graph.get('core/cache.js');
assert.ok(!cache.includes('core/item-resolver.js'), '缓存层不能依赖名称解析器');
assert.ok(!cache.some(dep => dep.startsWith('sites/')), '核心缓存不得反向依赖站点模块');
assert.ok(!graph.get('core/item-resolver.js').some(dep => dep.startsWith('sites/')),
  '通用物品解析器不能反向依赖 EC 等站点的文案处理代码');
assert.ok(graph.get('sites/eorzea-collection.js').includes('core/item-resolver.js'),
  'EC 站点仍须通过核心解析器执行装备名查询');
assert.ok(!graph.get('core/data-manager.js').includes('core/site-registry.js'),
  '数据管理器不可再依赖含七站启动行为的注册表');
assert.ok(!graph.has('core/translator.js'), '无人调用的过渡翻译分发器已退役');
for (const [owner, deps] of graph) {
  assert.ok(!deps.includes('core/translator.js'), owner + ' 不能引入已退役的接口');
}

// Tarjan 强连通分量用于报告当前尚存的真实耦合，不把它们伪装成全部完成。
let tick = 0;
const order = new Map();
const low = new Map();
const stack = [];
const onStack = new Set();
const components = [];
function visit(name) {
  order.set(name, tick);
  low.set(name, tick++);
  stack.push(name);
  onStack.add(name);
  for (const dep of graph.get(name) || []) {
    if (!order.has(dep)) {
      visit(dep);
      low.set(name, Math.min(low.get(name), low.get(dep)));
    } else if (onStack.has(dep)) {
      low.set(name, Math.min(low.get(name), order.get(dep)));
    }
  }
  if (low.get(name) === order.get(name)) {
    const component = [];
    let node;
    do {
      node = stack.pop();
      onStack.delete(node);
      component.push(node);
    } while (node !== name);
    components.push(component.sort());
  }
}
for (const file of graph.keys()) if (!order.has(file)) visit(file);
const cycles = components.filter(c => c.length > 1 || graph.get(c[0]).includes(c[0]));
console.log('✅ 生产依赖方向约束通过');
console.log('模块数：' + files.length + '；有效业务依赖边数：' +
  [...graph.values()].reduce((total, deps) => total + deps.length, 0));
console.log('当前仍有的业务循环强连通分量：' + cycles.length);
for (const component of cycles) console.log('  · ' + component.join(' / '));
