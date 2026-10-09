#!/usr/bin/env python3
# 组装 Cloudflare Pages V3-only 部署目录（site/）。
# 每次清空生成目录，避免旧部署或本地残留的 V2 文件进入产物。
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'site'


def clear_output() -> None:
    root = ROOT.resolve()
    if OUT != ROOT / 'site' or OUT.parent.resolve() != root:
        raise RuntimeError(f'拒绝清理仓库外的部署目录: {OUT}')
    if OUT.is_symlink():
        raise RuntimeError(f'拒绝清理符号链接部署目录: {OUT}')
    if OUT.exists() and not OUT.is_dir():
        raise RuntimeError(f'部署输出路径不是目录: {OUT}')
    if OUT.exists():
        shutil.rmtree(OUT)


def main() -> int:
    clear_output()
    runtime_out = OUT / 'ff14' / 'v3'
    runtime_out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        [sys.executable, str(ROOT / 'build' / 'make-runtime-data.py'), '--out', str(runtime_out)],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        print('✗ Runtime Data v3 生成失败')
        print(r.stdout)
        print(r.stderr)
        return 1
    print('  [v3] <- build/make-runtime-data.py')
    deploy = Path(__file__).resolve().parent
    for name in ('index.html', '404.html', '_headers', '_routes.json'):
        shutil.copy2(deploy / name, OUT / name)
    print('✓ site/ V3-only 组装完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
