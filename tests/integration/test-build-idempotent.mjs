// tests/integration/test-build-idempotent.mjs — 构建幂等测试
// build.sh 连续二跑：canonical module source 与 dist 逐字节一致（sha256 相同）+ node --check dist 通过。
// 背景：词典模块由 build/inject_dicts.py 全量再生；重复构建不得累积内容漂移。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { repoRoot, distFile, srcFile, dictionaryFile } from '../helpers/paths.mjs';

const sha = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function buildOnce(round) {
  console.log(`第 ${round} 次构建…`);
  try {
    execFileSync('bash', ['build.sh'], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    console.error(`第 ${round} 次构建失败（exit=${e.status}）：`);
    console.error(String(e.stdout || '').slice(-2000));
    console.error(String(e.stderr || '').slice(-2000));
    process.exit(1);
  }
}

buildOnce(1);
const d1 = sha(distFile);
const s1 = sha(srcFile);
const k1 = sha(dictionaryFile);

buildOnce(2);
const d2 = sha(distFile);
const s2 = sha(srcFile);
const k2 = sha(dictionaryFile);

let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`);
  }
};

ok('dist 二跑幂等（sha256 一致）', d1 === d2, `${d1.slice(0, 12)} vs ${d2.slice(0, 12)}`);
ok('main.js 二跑幂等（sha256 一致）', s1 === s2, `${s1.slice(0, 12)} vs ${s2.slice(0, 12)}`);
ok('dictionary.js 二跑幂等（sha256 一致）', k1 === k2, `${k1.slice(0, 12)} vs ${k2.slice(0, 12)}`);

try {
  execFileSync(process.execPath, ['--check', distFile], { stdio: ['ignore', 'pipe', 'pipe'] });
  ok('node --check dist 通过', true);
} catch (e) {
  ok('node --check dist 通过', false, String(e.stderr || '').slice(0, 200));
}

console.log(fail ? `\n失败 ${fail} 项` : '\n构建幂等测试通过 4/4');
process.exit(fail ? 1 : 0);
