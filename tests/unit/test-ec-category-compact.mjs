// EC 分类压缩快照回归：验证全部官方原生名与旧版完全相同。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../helpers/paths.mjs';

const source = fs.readFileSync(path.join(repoRoot, 'src/core/chinese-search.js'), 'utf8');
const beginTag = '// BEGIN GENERATED EC SEARCH CATEGORIES';
const endTag = '// END GENERATED EC SEARCH CATEGORIES';
const from = source.indexOf('\n', source.indexOf(beginTag)) + 1;
const to = source.indexOf(endTag, from);
assert.ok(from > 0 && to > from, '分类快照的生成标记必须存在');
const fragment = source.slice(from, to);
assert.match(fragment, /decodeEcNativeNames/, '必须使用紧凑离线分类快照');
const data = new Function(fragment + '\nreturn { barding: [...EC_BARDING_NATIVES], facewear: EC_FACEWEAR_ROWS, ears: [...EC_ACCESSORY_SLOT_NATIVES.ears], neck: [...EC_ACCESSORY_SLOT_NATIVES.neck], wrists: [...EC_ACCESSORY_SLOT_NATIVES.wrists], rings: [...EC_ACCESSORY_SLOT_NATIVES.rings] };')();

// 以压缩前全部数据的独立指纹锁定语义，不只是检查数量或少量示例。
function fingerprint(items) {
  let result = 0xcbf29ce484222325n;
  const encoded = JSON.stringify(items);
  for (let index = 0; index < encoded.length; index++) {
    result ^= BigInt(encoded.charCodeAt(index));
    result = (result * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return result.toString(16).padStart(16, '0');
}
const expected = {
  barding: [104, 'ed453ca5afc841c4'],
  facewear: [61, 'af8095c893182113'],
  ears: [1317, 'fcb8cacc45f1c99c'],
  neck: [1249, 'a6cf36f665a36d21'],
  wrists: [1245, '9ed6dcedc56e5e1f'],
  rings: [1294, '7805312bbf0fcafb'],
};
for (const [kind, [count, signature]] of Object.entries(expected)) {
  assert.equal(data[kind].length, count, kind + ' 的分类数量不能改变');
  assert.equal(fingerprint(data[kind]), signature, kind + ' 的完整内容及原始顺序不能改变');
}
assert.equal(new Set(data.rings).size, data.rings.length);
assert.equal(data.facewear[0].native, 'Antique Monocle');
assert.ok(data.barding.includes('Abigail Barding'));
assert.ok(fragment.length < 100000, '分类快照文本必须低于 100 KB');

// 用不同中文字符和补充平面字符验证 Python 生成器与 JS 解码器互操作。
const python = [
  'import importlib.util, json',
  'from pathlib import Path',
  'spec = importlib.util.spec_from_file_location("ecgen", str(Path("tools/update-ec-search-categories.py")))',
  'module = importlib.util.module_from_spec(spec)',
  'spec.loader.exec_module(module)',
  'names = ["A装甲", "A装甲长袍", "A装甲长裤", "😀小熊", "😀小熊帽"]',
  'result = module.render(names, [{"native":"单眼镜", "zh":"单眼镜"}], {"ears": names})',
  'print(json.dumps({"names":names, "code":result}, ensure_ascii=False))',
].join('\n');
const run = spawnSync('python3', ['-c', python], { cwd: repoRoot, encoding: 'utf8' });
assert.equal(run.status, 0, run.stderr || 'Python 分类生成器必须能够执行');
const sample = JSON.parse(run.stdout.trim());
const roundtrip = new Function(sample.code + '\nreturn { barding: [...EC_BARDING_NATIVES], ears: [...EC_ACCESSORY_SLOT_NATIVES.ears] };')();
assert.deepEqual(roundtrip.barding, sample.names, 'Python 和 JS 的 UTF-16 前缀长度必须一致');
assert.deepEqual(roundtrip.ears, sample.names);

// 不依赖在线 CSV：将已验证的解码数据交回 Python 生成器，确保输出可复现。
const verifyPython = [
  'import importlib.util, json, sys',
  'from pathlib import Path',
  'spec = importlib.util.spec_from_file_location("ecgen", str(Path("tools/update-ec-search-categories.py")))',
  'module = importlib.util.module_from_spec(spec)',
  'spec.loader.exec_module(module)',
  'source = json.load(sys.stdin)',
  'print(module.render(source["barding"], source["facewear"], {kind:source[kind] for kind in ("ears", "neck", "wrists", "rings")}), end="")',
].join('\n');
const generated = spawnSync('python3', ['-c', verifyPython], {
  cwd: repoRoot,
  input: JSON.stringify(data),
  encoding: 'utf8',
  maxBuffer: 1024 * 1024,
});
assert.equal(generated.status, 0, generated.stderr || 'Python 快照生成器必须成功执行');
assert.equal(generated.stdout, fragment, '仓库快照须与 Python 生成器产物逐字节一致');

console.log('✅ EC 分类快照完整指纹、体积和 Python/JS 编码兼容性测试通过');
