import { findPython } from '../../build/python.mjs';
// Classification data contract for build/rebuild-db.py.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = execFileSync(findPython(), ['tests/unit/test-rebuild-db-classification.py'], { cwd: root, encoding: 'utf8' });
process.stdout.write(out);
