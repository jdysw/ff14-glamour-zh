import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function executable(command) {
  if (!command) return null;
  const names = process.platform === 'win32' && !path.extname(command) ? [command + '.exe'] : [command];
  const directories = path.isAbsolute(command) ? [''] : (process.env.PATH || '').split(path.delimiter).filter(path.isAbsolute);
  for (const directory of directories) {
    for (const name of names) {
      const candidate = path.resolve(directory, name);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        if (fs.statSync(candidate).isFile()) return fs.realpathSync(candidate);
      } catch { /* Try the next installed executable. */ }
    }
  }
  return null;
}

// Validate the executable: Windows App Execution Aliases can exit successfully
// without actually running Python. PYTHON_BIN remains the explicit override.
export function findPython() {
  const candidates = [process.env.PYTHON_BIN, 'python3', 'python'];
  if (process.platform === 'win32') {
    const launcherPath = executable('py');
    if (launcherPath) {
      const launcher = spawnSync(launcherPath, ['-3', '-c', 'import sys; print(sys.executable)'], { encoding: 'utf8', windowsHide: true });
      if (launcher.status === 0) candidates.push(launcher.stdout.trim());
    }
  }
  for (const candidate of candidates) {
    const command = executable(candidate);
    if (!command) continue;
    const result = spawnSync(command, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (result.status === 0 && ((result.stdout || '') + (result.stderr || '')).startsWith('Python 3.')) return command;
  }
  throw new Error('Python 3 is required. Set PYTHON_BIN to its executable path.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = spawnSync(findPython(), process.argv.slice(2), { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
