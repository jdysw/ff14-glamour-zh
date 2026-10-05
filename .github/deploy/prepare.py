#!/usr/bin/env python3
"""组装 Cloudflare Pages 部署目录（site/）：数据文件 + version.json + index.html。

与 ~/zhixia-data/update-data.py 的产物结构保持一致（sha256 前 12 位指纹）。
在仓库根运行：python3 .github/deploy/prepare.py
"""
import datetime
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # 仓库根
OUT = ROOT / 'site'

MAP = {
    'items':  ('data/ff14-items.tsv',  'items.tsv'),
    'series': ('data/ff14-series.txt', 'series.txt'),
    'acl':    ('data/acl-cfc.txt',     'acl.txt'),
}


def fp(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()[:12]


def main() -> int:
    v2 = OUT / 'ff14' / 'v2'
    v2.mkdir(parents=True, exist_ok=True)
    files = {}
    for key, (src, dst) in MAP.items():
        s = ROOT / src
        if not s.exists():
            print(f'✗ 缺失源文件: {s}')
            return 1
        shutil.copy2(s, v2 / dst)
        files[key] = fp(v2 / dst)
        print(f'  [{key:7s}] <- {src:22s} fp={files[key]}  ({s.stat().st_size} bytes)')
    ver = {'v': datetime.date.today().strftime('%Y%m%d'), 'files': files}
    (v2 / 'version.json').write_text(json.dumps(ver, indent=1), encoding='utf-8')
    print('  version.json 已生成')
    shutil.copy2(Path(__file__).resolve().parent / 'index.html', OUT / 'index.html')
    print('✓ site/ 组装完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
