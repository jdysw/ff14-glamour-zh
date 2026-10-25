// Bundle the ESM entry and retain every reachable site's behavior.
// Dead exports are omitted; userscript metadata remains at the top.
// metadata：build/userscript-header.txt 经 banner 置于文件最顶部
// 环境变量 ZHX_OUT 可重定向产物路径（阶段验证/对照用）。
// npm run build invokes build/build.mjs on every supported platform.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const headerFile = path.join(__dirname, 'userscript-header.txt');

// 归一化头部尾换行：连续结尾换行折叠为一个（等价原 /\n+$/ 替换；纯循环无回溯）
const mergeTrailingLF = (s) => {
  let i = s.length;
  while (i > 0 && s[i - 1] === '\n') i -= 1;
  return i === s.length ? s : s.slice(0, i) + '\n';
};

export default {
  input: path.join(repoRoot, 'src', 'main.js'),
  treeshake: true,
  output: {
    file: process.env.ZHX_OUT || path.join(repoRoot, 'dist', 'ff14-glamour-zh.greasyfork.user.js'),
    format: 'iife',
    strict: true,
    banner: () => mergeTrailingLF(fs.readFileSync(headerFile, 'utf8')),
  },
};
