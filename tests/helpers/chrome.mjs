// tests/helpers/chrome.mjs — 确保 headless Chrome 调试端口可用（缺则自动拉起）
// 端口默认 9223（9222 为 VNC 环境，勿动）；环境变量覆盖：ZHX_CDP_PORT / ZHX_CHROME_BIN
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { cacheDir } from './paths.mjs';

export const DEFAULT_PORT = Number(process.env.ZHX_CDP_PORT || 9223);

/** CDP 端口是否已有可用实例 */
export async function cdpAlive(port = DEFAULT_PORT) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

function which(cmd) {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext);
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return p;
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

function findChrome() {
  const explicit = process.env.ZHX_CHROME_BIN;
  if (explicit && fs.existsSync(explicit)) return explicit;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const p = which(name);
    if (p) return p;
  }
  const absolutes = [
    '/opt/google/chrome/chrome',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of absolutes) if (fs.existsSync(p)) return p;
  return null;
}

/**
 * 确保 CDP 端口可用；已有实例则复用（不管理其生命周期），否则拉起 headless Chrome。
 * @returns {Promise<{port:number, spawned:boolean, child?:import('node:child_process').ChildProcess, stop():void}>}
 */
export async function ensureChrome({ port = DEFAULT_PORT } = {}) {
  if (await cdpAlive(port)) {
    return { port, spawned: false, stop() {} };
  }
  const bin = findChrome();
  if (!bin) {
    throw new Error('未找到 Chrome/Chromium。请安装后重试，或用 ZHX_CHROME_BIN 指定可执行文件路径。');
  }
  const profileDir = path.join(cacheDir, 'chrome-profile-' + port);
  fs.mkdirSync(profileDir, { recursive: true });
  const args = [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-gpu',
    '--noerrdialogs',
  ];
  if (process.platform === 'linux') {
    args.push('--ozone-platform=headless', '--ozone-override-screen-size=800,600', '--use-angle=swiftshader-webgl', '--disable-dev-shm-usage');
    // CI 容器沙箱常受限（宿主禁 userns 等）→ 追加兼容旗标；仅 CI 生效，本机行为不变
    if (process.env.CI) args.push('--no-sandbox');
  }
  args.push('about:blank');

  // 冷启动加固（PR#16 审查轮）：两轮各 ~40s 等待 + stderr 捕获，缓解 CI 冷启动抖动
  const stderrChunks = [];
  const WAIT_STEPS = 160; // 160 × 250ms ≈ 40s / 轮
  for (let round = 1; round <= 2; round++) {
    let dead = false;
    const child = spawn(bin, args, { detached: false, stdio: ['ignore', 'ignore', 'pipe'] });
    child.on('error', (e) => {
      dead = true;
      stderrChunks.push('[spawn] ' + e.message);
    });
    if (child.stderr) {
      child.stderr.on('data', (d) => {
        if (stderrChunks.length < 80) stderrChunks.push(String(d));
      });
    }
    for (let i = 0; i < WAIT_STEPS && !dead; i++) {
      await sleep(250);
      if (await cdpAlive(port)) {
        return {
          port,
          spawned: true,
          child,
          stop() {
            try {
              child.kill('SIGTERM');
            } catch {
              /* noop */
            }
          },
        };
      }
      if (i === 40 || i === 110) console.error(`[chrome] 第 ${round} 轮等待 CDP 端口 ${port}…（已 ${Math.round(((i + 1) * 250) / 1000)}s）`);
    }
    try {
      child.kill('SIGKILL');
    } catch {
      /* noop */
    }
    if (round < 2) {
      console.error(`[chrome] 第 ${round} 轮未就绪，1s 后重试…`);
      await sleep(1000);
    }
  }
  try {
    fs.writeFileSync(path.join(cacheDir, 'chrome-stderr.log'), stderrChunks.join(''));
  } catch {
    /* noop */
  }
  const tail = stderrChunks.join('').trim().slice(-600);
  throw new Error(`Chrome 已拉起但 CDP 端口 ${port} 未就绪（两轮等待超时）` + (tail ? `；chrome stderr 摘要：${tail}` : ''));
}

/** runner 结束兜底：仅停止"由本进程拉起"的实例 */
export function stopChrome(handle) {
  if (handle && handle.spawned) handle.stop();
}
