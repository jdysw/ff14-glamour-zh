// tests/run.mjs — 统一测试入口（v1.4 Phase 1）
// 用法：
//   npm test                                  # = --suite=unit,native,integration（离线，推荐）
//   node tests/run.mjs --suite=unit           # 纯 Node 单元测试（秒级，无需 Chrome）
//   node tests/run.mjs --suite=integration    # 离线夹具集成测试（自动确保 headless Chrome）
//   node tests/run.mjs --suite=live           # 真站连通测试（需要外网）
//   node tests/run.mjs --suite=build          # 构建重现与破坏性反例（无 Chrome）
//   node tests/run.mjs --suite=benchmark      # 基准测试（耗时较长）
//   node tests/run.mjs --suite=all            # unit + native + integration + live
//   node tests/run.mjs test-wiki test-ec      # 按精确名称选择（不再隐式扩展）
//   node tests/run.mjs --list                 # 列出全部测试
// 环境变量：ZHX_CDP_PORT（默认 9223）| ZHX_TEST_TIMEOUT_MS（默认 320000）| ZHX_TEST_QUIET=1（不实时透传）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureChrome, stopChrome } from './helpers/chrome.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Explicit suites keep local and CI selection identical.
const SUITES = {
  "unit": [
    "unit/test-pages-production.mjs",
    "unit/test-pages-dedupe.mjs",
    "unit/test-pages-assets.mjs",
    "unit/test-shared-candidates.mjs",
    "unit/test-v3-contract.mjs",
    "unit/test-dependency-direction.mjs",
    "unit/test-ec-category-compact.mjs",
    "unit/test-http.mjs",
    "unit/test-data-refresh.mjs",
    "unit/test-data-layer.mjs",
    "unit/test-runtime-v3.mjs",
    "unit/test-data-deploy.mjs",
    "unit/test-dictionary.mjs",
    "unit/test-item-resolver.mjs",
    "unit/test-rebuild-db-classification.mjs",
    "unit/test-chinese-search.mjs",
    "unit/test-chinese-search-ui.mjs",
    "unit/test-observer.mjs",
    "unit/test-targets.mjs",
    "unit/test-endcloset.mjs",
    "unit/test-coverage-audit.mjs",
    "unit/test-audit-localization.mjs",
    "unit/test-ec-manual-audit.mjs",
    "unit/test-ec-gearsets.mjs",
    "unit/test-ec-reset-filters.mjs",
    "unit/test-mirapri-manual-audit.mjs",
    "unit/test-manual-coverage-audit.mjs",
    "unit/test-search-diagnostics.mjs",
    "unit/test-live-coverage-report.mjs"
  ],
  "native": [
    "unit/test-native-ec.test.mjs",
    "unit/test-native-expanded.test.mjs",
    "unit/test-native-probe.test.mjs",
    "unit/test-native-search-ui.test.mjs",
    "unit/test-native-sites.test.mjs",
    "unit/test-native-source.test.mjs",
    "unit/test-native-targets.test.mjs"
  ],
  "integration": [
    "integration/test-wiki.mjs",
    "integration/test-wiki-slow.mjs",
    "integration/test-wiki-fallback.mjs",
    "integration/test-index-scope.mjs",
    "integration/test-ec.mjs",
    "integration/test-mirapri.mjs",
    "integration/test-chinese-search-submit.mjs",
    "integration/test-fc-search-candidates.mjs",
    "integration/test-ec-search-inline.mjs",
    "integration/test-probe.mjs",
    "integration/test-chinese-font.mjs",
    "integration/test-miramiru.mjs",
    "integration/test-miramiru-test-build.mjs",
    "integration/test-miramiru-audit.mjs",
    "integration/test-miramiru-filters.mjs",
    "integration/test-standalone-search.mjs",
    "integration/test-eden.mjs",
    "integration/test-xivc.mjs"
  ],
  "build": [
    "build/test-pipeline.mjs"
  ],
  "experimental": [
    "experimental/test-storage-audit.mjs",
    "experimental/test-v31-preview.mjs",
    "experimental/test-bench-report.mjs"
  ],
  "live": [
    "live/check-fc-banners.mjs",
    "live/e2e-real-dict.mjs",
    "live/test-acl-1.mjs",
    "live/test-acl-2.mjs",
    "live/test-dict-rt.mjs",
    "live/test-fc-pages.mjs",
    "live/test-fc.mjs",
    "live/test-kasuga.mjs",
    "live/test-miramiru-filters.mjs",
    "live/test-miramiru-static.mjs",
    "live/test-miramiru.mjs",
    "live/test-ronka.mjs"
  ],
  "benchmark": [
    "benchmark/bench-read-path.mjs",
    "benchmark/bench-lifecycle.mjs"
  ]
};
SUITES.wiki = SUITES.integration.filter(file => /test-wiki|test-index-scope/.test(file));
SUITES.sites = SUITES.integration.filter(file => !SUITES.wiki.includes(file));

const args = process.argv.slice(2);
const opts = { suites: [], names: [], list: false };
for (const a of args) {
  if (a.startsWith('--suite=')) opts.suites.push(...a.slice('--suite='.length).split(',').map((s) => s.trim()).filter(Boolean));
  else if (a === '--list') opts.list = true;
  else if (!a.startsWith('--')) opts.names.push(a);
}

function allFiles() {
  const out = [];
  for (const dir of ['unit', 'integration', 'live', 'benchmark', 'build', 'experimental']) {
    const d = path.join(__dirname, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).sort()) {
      if (f.endsWith('.mjs')) out.push(dir + '/' + f);
    }
  }
  return out;
}

let files;
if (opts.names.length) {
  const all = allFiles();
  for (const name of opts.names.filter(name => !name.includes('/'))) {
    const matches=all.filter(file=>path.basename(file,'.mjs')===name.replace(/\.mjs$/,''));
    if(matches.length>1){
      console.error('测试名不唯一，请指定完整路径：'+matches.join(', '));
      process.exit(2);
    }
  }
  const missing = opts.names.filter(name => !all.some(file =>
    file.replace(/\.mjs$/, '') === name.replace(/\.mjs$/, '') || path.basename(file, '.mjs') === name.replace(/\.mjs$/, '')));
  if (missing.length) {
    console.error('没有匹配的测试：' + missing.join(', '));
    process.exit(2);
  }
  files = all.filter((p) => opts.names.some((n) => p.replace(/\.mjs$/, '') === n.replace(/\.mjs$/, '') || path.basename(p, '.mjs') === n.replace(/\.mjs$/, '')));
  if (!files.length) {
    console.error('没有匹配的测试：' + opts.names.join(', '));
    process.exit(2);
  }
} else if (opts.suites.length) {
  const set = new Set();
  const expand = (s) => {
    if (s === 'all') return ['unit', 'native', 'integration', 'live'].flatMap(expand);
    if (!SUITES[s]) {
      console.error(`未知套件：${s}（可用：unit,native,integration,wiki,sites,build,experimental,live,benchmark,all）`);
      process.exit(2);
    }
    return SUITES[s];
  };
  for (const s of opts.suites) for (const f of expand(s)) set.add(f);
  files = [...set];
} else {
  files = [...SUITES.unit, ...SUITES.native, ...SUITES.integration];
}

if (opts.list) {
  console.log(`共 ${files.length} 项：`);
  for (const f of files) console.log('  ' + f);
  process.exit(0);
}

const TIMEOUT = Number(process.env.ZHX_TEST_TIMEOUT_MS || 320000);
const quiet = process.env.ZHX_TEST_QUIET === '1';
const logsDir = path.join(__dirname, '.cache', 'logs');
fs.mkdirSync(logsDir, { recursive: true });

function runOne(abs, logFile) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [abs], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
      env: {...process.env, PYTHONIOENCODING: process.env.PYTHONIOENCODING || 'utf-8'} });
    let buf = '';
    const onData = (d) => {
      const s = d.toString();
      buf += s;
      if (!quiet) process.stdout.write(s);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => {
      buf += `\n[runner] 超时 ${TIMEOUT}ms，强制结束\n`;
      try {
        child.kill('SIGKILL');
      } catch {
        /* noop */
      }
    }, TIMEOUT);
    child.on('error', (e) => {
      buf += `\n[runner] 子进程错误: ${e.message}\n`;
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        fs.writeFileSync(logFile, buf);
      } catch {
        /* noop */
      }
      resolve(code == null ? -1 : code);
    });
  });
}

// 需要 Chrome 的套件先确保 CDP 就绪（build-idempotent 为纯 Node，不需要）
const needsChrome = files.some((f) => /^(integration|live|benchmark)\//.test(f));
let chrome = null;
if (needsChrome) {
  try {
    chrome = await ensureChrome({});
    console.log(`Chrome CDP 就绪（端口 ${chrome.port}${chrome.spawned ? '，已自动拉起' : '，复用现有实例'}）`);
  } catch (e) {
    console.error('无法准备 headless Chrome：' + e.message);
    process.exit(2);
  }
}

const t0 = Date.now();
const results = [];
try {
  for (const rel of files) {
    const abs = path.join(__dirname, rel);
    process.stdout.write(`\n════════ ${rel} ════════\n`);
    if (!fs.existsSync(abs)) {
      console.log('⚠ 文件不存在，跳过');
      results.push({ rel, code: 127 });
      continue;
    }
    const logFile = path.join(logsDir, rel.replaceAll('/', '__') + '.log');
    const started = Date.now();
    const code = await runOne(abs, logFile);
    console.log(`── ${code === 0 ? '✅ 通过' : '❌ 失败'}（exit=${code}）`);
    results.push({ rel, code, durationMs: Date.now() - started });
  }
} finally {
  stopChrome(chrome);
}

const pass = results.filter((r) => r.code === 0).length;
const fail = results.length - pass;
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log('\n════════ 汇总 ════════');
console.log(`${results.length} 项 | 通过 ${pass} | 失败 ${fail} | 用时 ${secs}s | 日志 tests/.cache/logs/`);
if (fail) for (const r of results.filter((x) => x.code !== 0)) console.log(`  ❌ ${r.rel} (exit=${r.code})`);
try {
  fs.writeFileSync(path.join(logsDir, 'last-summary.json'), JSON.stringify({durationSeconds:Number(secs),results},null,2));
  fs.writeFileSync(
    path.join(logsDir, 'last-summary.txt'),
    `时间 ${new Date().toISOString()}\n${results.map((r) => `${r.code === 0 ? 'PASS' : 'FAIL'} ${r.rel}`).join('\n')}\n`,
  );
} catch {
  /* noop */
}
process.exit(fail ? 1 : 0);
