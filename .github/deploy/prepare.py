#!/usr/bin/env python3
"""组装 Cloudflare Pages 部署目录（site/）：数据文件 + 词库 + version.json + index.html。

数据文件指纹 = sha256 前 12 位；词库（dict.json）由 build/make_dict_json.py 生成。
与 ~/zhixia-data/update-data.py 的产物结构保持一致。
在仓库根运行：python3 .github/deploy/prepare.py
"""
import datetime
import hashlib
import json
import re
import shutil
import subprocess
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
    # 词库：dict/*.json → dict.json（v1.2.0 起运行时更新，改词无需发新脚本版本）
    r = subprocess.run(
        [sys.executable, str(ROOT / 'build' / 'make_dict_json.py'), '--out', str(v2 / 'dict.json')],
        capture_output=True, text=True)
    if r.returncode != 0:
        print('✗ dict.json 生成失败'); print(r.stdout); print(r.stderr)
        return 1
    m = re.search(r'fp=([0-9a-f]{12})', r.stdout)
    if not m:
        print('✗ 未取得 dict 指纹:', r.stdout.strip())
        return 1
    files['dict'] = m.group(1)
    print(f'  [dict   ] <- build/make_dict_json.py  fp={files["dict"]}  ({(v2 / "dict.json").stat().st_size} bytes)')
    ver = {'v': datetime.date.today().strftime('%Y%m%d'), 'files': files}
    (v2 / 'version.json').write_text(json.dumps(ver, indent=1), encoding='utf-8')
    print('  version.json 已生成')
    shutil.copy2(Path(__file__).resolve().parent / 'index.html', OUT / 'index.html')
    # 响应头规则：让 CF 压缩 items.tsv（text/tab-separated-values 不在 CF 压缩白名单，
    # 6.7MB → 约 1.76MB）——与本地备用通道 ~/zhixia-data/_headers 保持一致
    shutil.copy2(Path(__file__).resolve().parent / '_headers', OUT / '_headers')
    print('✓ site/ 组装完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
