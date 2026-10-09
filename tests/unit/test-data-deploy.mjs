import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ff14-data-deploy-'));
const deploy = path.join(root, '.github', 'deploy');
const copyNames = ['prepare.py', 'index.html', '404.html', '_headers', '_routes.json'];

try {
  const deployDir = path.join(temp, '.github', 'deploy');
  const buildDir = path.join(temp, 'build');
  const out = path.join(temp, 'site');
  fs.mkdirSync(deployDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });
  for (const name of copyNames) fs.copyFileSync(path.join(deploy, name), path.join(deployDir, name));
  fs.cpSync(path.join(root, 'functions'), path.join(temp, 'functions'), { recursive: true });

  fs.writeFileSync(path.join(buildDir, 'make-runtime-data.py'), [
    'import pathlib, sys',
    'out = pathlib.Path(sys.argv[sys.argv.index("--out") + 1])',
    'out.mkdir(parents=True, exist_ok=True)',
    '(out / "manifest.json").write_text("{}")',
    '',
  ].join('\n'));

  const stale = path.join(out, 'ff14', 'v2', 'items.tsv');
  fs.mkdirSync(path.dirname(stale), { recursive: true });
  fs.writeFileSync(stale, 'stale V2 payload');

  const prep = spawnSync(process.env.PYTHON || 'python3', [path.join(deployDir, 'prepare.py')], {
    cwd: temp,
    encoding: 'utf8',
  });
  assert.equal(prep.status, 0, prep.stdout + prep.stderr);
  assert.equal(fs.existsSync(path.join(out, 'ff14', 'v3', 'manifest.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'ff14', 'v2')), false, 'prepare must remove stale V2 assets');
  assert.equal(fs.existsSync(path.join(out, '_worker.js')), false, 'deployment uses path-scoped Pages Functions');
  for (const name of ['404.html', '_headers', '_routes.json', 'index.html']) {
    assert.equal(fs.existsSync(path.join(out, name)), true, name + ' copied to deployment root');
  }

  const routes = JSON.parse(fs.readFileSync(path.join(out, '_routes.json'), 'utf8'));
  assert.deepEqual(routes.include, ['/ff14/v2', '/ff14/v2/*']);
  assert.deepEqual(routes.exclude, []);
  const endpoint = path.join(temp, 'functions', 'ff14', 'v2', 'index.js');
  const catchAll = path.join(temp, 'functions', 'ff14', 'v2', '[[path]].js');
  const handlers = [
    (await import(pathToFileURL(endpoint))).onRequest,
    (await import(pathToFileURL(catchAll))).onRequest,
  ];
  for (const handle of handlers) {
    const response = await handle({ request: new Request('https://data.example/ff14/v2') });
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  console.log('通过：V2 路由返回 410，部署产物仅含 V3，重复组装清理旧 V2 文件。');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
