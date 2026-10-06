// tests/helpers/paths.mjs — 仓库内路径解析（所有测试统一从这里取路径，不依赖开发者私人目录）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 仓库根目录 */
export const repoRoot = path.resolve(__dirname, '..', '..');

/** 待测产物 / 数据 */
export const distFile = path.join(repoRoot, 'dist', 'ff14-glamour-zh.greasyfork.user.js');
export const srcFile = path.join(repoRoot, 'src', 'ff14-glamour-zh.external.user.js');
export const dataDirPath = path.join(repoRoot, 'data');
export const itemsTsvPath = path.join(dataDirPath, 'ff14-items.tsv');

/** 夹具（fixtures）目录与 file:// URL 工具 */
export const fixturesDir = path.join(__dirname, '..', 'fixtures');
export const fixturesUrlPrefix = pathToFileURL(fixturesDir + path.sep).href; // 末尾带 /
export const fixturePath = (name) => path.join(fixturesDir, name);
export const fixtureUrl = (name) => pathToFileURL(path.join(fixturesDir, name)).href;

/** 测试缓存目录（.gitignore 已排除；测试生成的注入副本、日志等一律写这里） */
export const cacheDir = path.join(__dirname, '..', '.cache');
export function cachePath(name) {
  fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, name);
}
export const cacheUrl = (name) => pathToFileURL(cachePath(name)).href;

/** 读取待测 GF 版脚本文本（统一入口；支持 GF 环境变量覆盖；缺产物时给出明确指引） */
export function readDist(file = process.env.GF || distFile) {
  if (!fs.existsSync(file)) {
    throw new Error('未找到构建产物：' + file + '\n请先运行：npm run build');
  }
  return fs.readFileSync(file, 'utf8');
}
