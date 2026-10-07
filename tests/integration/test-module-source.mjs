// tests/integration/test-module-source.mjs — Phase 22：Canonical Module Source 契约
//
// 目标：冻结「模块源码就是源码，Rollup 只是打包器」这一最终架构。
//   A. Legacy 单文件源不存在
//   B. main/core/sites 模块树存在且非空
//   C. build.sh 不再调用单文件切分 / 自动接口 / 顺序写回生成链
//   D. build/verify-module-source.mjs 本身通过
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../helpers/paths.mjs';

let fail = 0;
let total = 0;
const ok = (name, cond, extra = '') => {
  total++;
  if (cond) console.log('  ✅ ' + name);
  else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
};

const srcDir = path.join(repoRoot, 'src');
const main = path.join(srcDir, 'main.js');
const legacy = path.join(srcDir, 'ff14-glamour-zh.external.user.js');
const coreDir = path.join(srcDir, 'core');
const sitesDir = path.join(srcDir, 'sites');
const build = fs.readFileSync(path.join(repoRoot, 'build.sh'), 'utf8');

console.log('── A：Canonical 源码入口 ──');
ok('A1 src/main.js 存在', fs.existsSync(main));
ok('A2 Legacy 单文件源已删除', !fs.existsSync(legacy));

console.log('── B：模块源码树 ──');
const core = fs.readdirSync(coreDir).filter((f) => f.endsWith('.js'));
const sites = fs.readdirSync(sitesDir).filter((f) => f.endsWith('.js'));
ok('B1 src/core 存在且含模块', fs.existsSync(coreDir) && core.length > 0, String(core.length));
ok('B2 src/sites 存在且含模块', fs.existsSync(sitesDir) && sites.length > 0, String(sites.length));
ok('B3 main.js 引用 core/site-registry', fs.readFileSync(main, 'utf8').includes('./core/site-registry.js'));

console.log('── C：正常构建不再反向生成模块 ──');
for (const token of [
  'build/migrate/gen-modules.py',
  'build/migrate/add-interfaces.mjs',
  'build/migrate/order-modules.mjs',
  'build/migrate/reindex-assign.py',
  'build/migrate/module-map.mjs',
  'build/migrate/verify-modules.py',
  'build/module-assign.json',
]) {
  ok('C-' + token + ' 未进入 build.sh', !build.includes(token));
}
ok('C8 build.sh 入口为 src/main.js', build.includes('src/main.js') && build.includes('rollup -c build/rollup.config.mjs'));

console.log('── D：源码门禁 ──');
let code = -1;
try {
  execFileSync(process.execPath, ['build/verify-module-source.mjs'], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  code = 0;
} catch (e) {
  code = e.status ?? -1;
}
ok('D1 verify-module-source 通过', code === 0, 'exit=' + code);

console.log(fail ? ('\n失败 ' + fail + ' 项') : ('\n模块源码契约通过 ' + total + '/' + total));
process.exit(fail ? 1 : 0);
