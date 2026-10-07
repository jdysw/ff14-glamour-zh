// tests/integration/test-version-consistency.mjs — Phase 17：版本单一源契约
//
// 断言「package.json = 唯一版本源」的完整链路：
//   A. 四源（package / src / header / dist）各含合法 x.y.z 版本
//   B. 四源两两一致（package version = userscript @version = release tag 依据）
//   C. 各文件 @version 行恰 1 条（防散落 / 重复）
//   D. 治理工具在位：build/version.mjs --check 通过；build.sh 含同步 + 校验两步
//   E. 发布 / CI 链契约：release.yml 从 package.json 取版本；
//      test.yml 含「构建 + 数据校验 + 测试」三步。
// 全部只读，不污染工作区。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, srcFile, distFile } from '../helpers/paths.mjs';

let fail = 0;
let total = 0;
const ok = (name, cond, extra = '') => {
  total++;
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`);
  }
};

const SEMVER = /^\d+\.\d+\.\d+$/;
const RE_ONE = /^\/\/ @version[ \t]+(\S+)/m;
const RE_ALL = /^\/\/ @version[ \t]+\S+/gm;

const read = (p) => fs.readFileSync(p, 'utf8');

/** 读某文件的 @version：{ count 行数, ver 版本 } */
function readVersion(p) {
  const text = read(p);
  return { count: (text.match(RE_ALL) || []).length, ver: (text.match(RE_ONE) || [])[1] || null };
}

const pkgPath = path.join(repoRoot, 'package.json');
const headerPath = path.join(repoRoot, 'build', 'userscript-header.txt');
const rel = (p) => path.relative(repoRoot, p).split(path.sep).join('/');

const pkgVer = JSON.parse(read(pkgPath)).version;
const src = readVersion(srcFile);
const header = readVersion(headerPath);
const dist = fs.existsSync(distFile) ? readVersion(distFile) : null;

console.log('── A：四源可解析 ──');
ok('A1 package.json 版本为 x.y.z', SEMVER.test(pkgVer), String(pkgVer));
ok('A2 src 模板 @version 为 x.y.z', !!src.ver && SEMVER.test(src.ver), String(src.ver));
ok('A3 header 模板 @version 为 x.y.z', !!header.ver && SEMVER.test(header.ver), String(header.ver));
ok('A4 dist 产物存在且 @version 为 x.y.z', !!dist && !!dist.ver && SEMVER.test(dist.ver), dist ? String(dist.ver) : 'dist 不存在（请先 npm run build）');

console.log('── B：四源一致（单一版本源）──');
ok('B1 src ≡ package.json', src.ver === pkgVer, `${src.ver} vs ${pkgVer}`);
ok('B2 header ≡ package.json', header.ver === pkgVer, `${header.ver} vs ${pkgVer}`);
ok('B3 dist ≡ package.json', !!dist && dist.ver === pkgVer, dist ? `${dist.ver} vs ${pkgVer}` : 'dist 不存在');

console.log('── C：@version 行唯一性 ──');
const counts = `src=${src.count} header=${header.count} dist=${dist ? dist.count : '-'}`;
ok('C1 src / header / dist 各恰 1 条 @version 行', src.count === 1 && header.count === 1 && !!dist && dist.count === 1, counts);

console.log('── D：治理工具在位 ──');
let d1 = { code: -1, out: '' };
try {
  d1 = { code: 0, out: String(execFileSync('node', ['build/version.mjs', '--check'], { cwd: repoRoot })) };
} catch (e) {
  d1 = { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') };
}
ok('D1 build/version.mjs --check 通过', d1.code === 0, d1.code !== 0 ? d1.out.slice(-200).replace(/\n+/g, ' ⏎ ') : '');
const bs = read(path.join(repoRoot, 'build.sh'));
ok('D2 build.sh 含版本同步 + 版本校验两步', bs.includes('node build/version.mjs') && bs.includes('node build/version.mjs --check'));

console.log('── E：发布 / CI 链契约 ──');
const ry = read(path.join(repoRoot, '.github', 'workflows', 'release.yml'));
ok('E1 release.yml 从 package.json 取版本（不再 sed src 提取）', ry.includes("require('./package.json').version") && !ry.includes('sed -n'));
ok('E2 release.yml 含 npm ci + 发布前一致性门', ry.includes('npm ci') && ry.includes('npm run version:check'));
const ty = read(path.join(repoRoot, '.github', 'workflows', 'test.yml'));
ok('E3 test.yml 含「构建 + 数据校验 + 测试」三步', ty.includes('npm run build') && ty.includes('validate:data') && ty.includes('npm test'));

console.log(fail ? `\n失败 ${fail} 项` : `\n版本单一源契约通过 ${total}/${total}`);
process.exit(fail ? 1 : 0);
