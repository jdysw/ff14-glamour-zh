// tests/helpers/dict.mjs — 生成当前「运行时字典」合并产物（dict/*.json → dict.json）
// 与数据站发布产物一致（build/make_dict_json.py）；同进程内只生成一次。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, cachePath } from './paths.mjs';

let cached = null;

/** 生成并读取 dict.json 文本 */
export function ensureDictJson() {
  if (cached != null) return cached;
  const out = cachePath('dict.json');
  execFileSync('python3', [path.join(repoRoot, 'build', 'make_dict_json.py'), '--out', out], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  cached = fs.readFileSync(out, 'utf8');
  return cached;
}
