// tests/integration/test-dict-single-source.mjs — Phase 16：词典单一源契约
//
// 断言「dict/*.json = 词典唯一权威源」的完整链路：
//   A. src 内嵌词典 ≡ dict/*.json（verify 模式1，读侧零副本）
//   B. 6 个词典块均带「自动生成」标识（防手改信号；块上方的 inject 维护行）
//   C. 篡改防护（源单一性的反证）：副本改动词典值 → verify 必失败；
//      经 inject 再生 → 恢复一致（手改被 JSON 覆盖）。
//   D. 远程词库产物：make_dict_json 生成 + verify --dict-json（内嵌 ≡ 数据站发布物）。
//   E. build.sh 含上述两步（构建链不缺环）。
// 全部写 tests/.cache/，不污染工作区。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, dictionaryFile, cachePath } from '../helpers/paths.mjs';

let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`);
  }
};

function run(bin, args) {
  try {
    const out = execFileSync(bin, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: String(out) };
  } catch (e) {
    return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

const SRC_REL = 'src/core/dictionary.js';
const tail = (s, n = 300) => s.slice(-n).replace(/\n+/g, ' ⏎ ');

console.log('── A：src ≡ dict/*.json（verify 模式1）──');
const a = run('node', ['build/verify_dicts.js', SRC_REL]);
ok('A1 verify 模式1 通过（src 内嵌与 JSON 源逐条一致）', a.code === 0, a.code !== 0 ? tail(a.out) : '');

console.log('── B：六个词典块带「自动生成」标识 ──');
const src = fs.readFileSync(dictionaryFile, 'utf8');
const srcLines = src.split('\n');
const BLOCKS = [
  ['DICT_COMMON', 'dict-common.json'],
  ['DICT', 'dict-main.json'],
  ['DICT_EC', 'dict-ec.json'],
  ['DICT_FC', 'dict-fc.json'],
  ['DICT_RONKA', 'dict-ronka.json'],
  ['DICT_ACL', 'dict-acl.json'],
];
const missingBanner = [];
for (const [name, fn] of BLOCKS) {
  const i = srcLines.findIndex((l) => l.startsWith(`  const ${name} = `));
  const prev = i > 0 ? srcLines[i - 1] : '';
  if (i < 0 || !prev.includes('自动生成') || !prev.includes('inject_dicts.py') || !prev.includes(fn)) {
    missingBanner.push(name);
  }
}
ok('B1 6 个词典块上方均带 inject 维护的标识行', missingBanner.length === 0, `缺: ${missingBanner.join(', ')}`);
const bannerCount = srcLines.filter((l) => /^  \/\/ ⚠️ 自动生成.*inject_dicts\.py/.test(l)).length;
ok('B2 标识行恰为 6 条（无散落/重复）', bannerCount === 6, `实际 ${bannerCount}`);

console.log('── C：篡改防护（改副本 → 必失败；inject 再生 → 必恢复）──');
const dir = cachePath('dict-single-source');
fs.mkdirSync(dir, { recursive: true });
const copyPath = path.join(dir, 'tamper.user.js');
fs.copyFileSync(dictionaryFile, copyPath);

// 选一条「无引号/反斜杠」的简单条目做篡改（避免 JS 字符串转义干扰）
const fcData = JSON.parse(fs.readFileSync(path.join(repoRoot, 'dict', 'dict-fc.json'), 'utf8'));
const simple = Object.entries(fcData.entries).find(
  ([k, v]) => /^[^'\\\n]{1,20}$/.test(k) && /^[^'\\\n]{1,20}$/.test(v),
);
ok('C0 找到可用于篡改的简单词条', !!simple);
if (simple) {
  const [k, v] = simple;
  const needle = `'${k}': '${v}',`;
  const copy = fs.readFileSync(copyPath, 'utf8');
  ok('C1 篡改目标在副本中命中', copy.includes(needle), JSON.stringify(needle));
  fs.writeFileSync(copyPath, copy.replace(needle, `'${k}': '${v}【篡改】',`));

  const c2 = run('node', ['build/verify_dicts.js', 'tests/.cache/dict-single-source/tamper.user.js']);
  ok('C2 篡改副本 → verify 必失败（exit≠0）', c2.code !== 0);

  const c3 = run('python3', ['build/inject_dicts.py', 'tests/.cache/dict-single-source/tamper.user.js']);
  ok('C3 inject 再生副本成功（JSON 全量覆盖）', c3.code === 0, c3.code !== 0 ? tail(c3.out) : '');

  const c4 = run('node', ['build/verify_dicts.js', 'tests/.cache/dict-single-source/tamper.user.js']);
  ok('C4 再生后 verify 恢复通过（篡改被覆盖）', c4.code === 0, c4.code !== 0 ? tail(c4.out) : '');
  ok('C5 篡改标记已消（副本内无「【篡改】」）', !fs.readFileSync(copyPath, 'utf8').includes('【篡改】'));
}

console.log('── D：远程词库产物（内嵌 ≡ dict.json）──');
const djPath = path.join(dir, 'dict.json');
const d1 = run('python3', ['build/make_dict_json.py', '--out', djPath]);
ok('D1 make_dict_json 生成成功', d1.code === 0, d1.code !== 0 ? tail(d1.out) : '');
const d2 = run('node', ['build/verify_dicts.js', SRC_REL, '--dict-json', 'tests/.cache/dict-single-source/dict.json']);
ok('D2 verify --dict-json 通过（src 内嵌 ≡ 远程产物）', d2.code === 0, d2.code !== 0 ? tail(d2.out) : '');
try {
  const keys = Object.keys(JSON.parse(fs.readFileSync(djPath, 'utf8'))).sort().join(',');
  ok('D3 dict.json 结构完整（六层）', keys === 'acl,common,ec,fc,main,ronka', keys);
} catch (e) {
  ok('D3 dict.json 结构完整（六层）', false, String(e).slice(0, 120));
}

console.log('── E：构建链含两步（不缺环）──');
const bs = fs.readFileSync(path.join(repoRoot, 'build.sh'), 'utf8');
ok('E1 build.sh 含 make_dict_json 生成步骤', bs.includes('make_dict_json.py'));
ok('E2 build.sh 含 --dict-json 校验步骤', bs.includes('--dict-json'));

console.log(fail ? `\n失败 ${fail} 项` : '\n词典单一源契约通过 12/12');
process.exit(fail ? 1 : 0);
