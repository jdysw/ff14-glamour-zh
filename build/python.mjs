import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Validate the executable: Windows App Execution Aliases can exit successfully
// without actually running Python. PYTHON_BIN remains the explicit override.
export function findPython() {
  const candidates = [process.env.PYTHON_BIN, 'python3', 'python'];
  if (process.platform === 'win32') {
    const launcher = spawnSync('py', ['-3', '-c', 'import sys; print(sys.executable)'], { encoding: 'utf8', windowsHide: true });
    if (launcher.status === 0) candidates.push(launcher.stdout.trim());
  }
  for (const command of candidates.filter(Boolean)) {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (result.status === 0 && /^Python 3\./.test((result.stdout || '') + (result.stderr || ''))) return command;
  }
  throw new Error('Python 3 is required. Set PYTHON_BIN to its executable path.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = spawnSync(findPython(), process.argv.slice(2), { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
