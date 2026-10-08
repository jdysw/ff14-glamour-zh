#!/usr/bin/env python3
"""词库打包：dict/*.json → dict.json（紧凑单文件）+ sha256 前 12 位指纹。

输出结构（与站点层一致）：
    {"common":{...},"main":{...},"ec":{...},"fc":{...},"ronka":{...},"acl":{...}}

用于数据站发布（prepare.py / update-data.py 调用）；脚本运行时拉取合并，
改词无需发新脚本版本（v1.2.0 起）。

用法:
    python3 build/make_dict_json.py --out <路径>   # 写入文件并打印「fp=xxxxxxxxxxxx」
    python3 build/make_dict_json.py                # 仅打印指纹
"""
import hashlib
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_DIR = os.path.join(BASE, 'dict')

FILES = [
    ('common', 'dict-common.json'),
    ('main', 'dict-main.json'),
    ('ec', 'dict-ec.json'),
    ('fc', 'dict-fc.json'),
    ('ronka', 'dict-ronka.json'),
    ('acl', 'dict-acl.json'),
    ('endcloset', 'dict-endcloset.json'),
]


def build_dict_json():
    merged = {}
    for key, fn in FILES:
        with open(os.path.join(DICT_DIR, fn), encoding='utf-8') as f:
            data = json.load(f)
        merged[key] = data.get('entries', {})
    text = json.dumps(merged, ensure_ascii=False, separators=(',', ':'))
    fp = hashlib.sha256(text.encode('utf-8')).hexdigest()[:12]
    return text, fp


def main():
    out = None
    args = sys.argv[1:]
    if len(args) >= 2 and args[0] == '--out':
        out = args[1]
    text, fp = build_dict_json()
    if out:
        with open(out, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f'dict.json -> {out} ({len(text.encode("utf-8"))} bytes) fp={fp}')
    else:
        print(f'fp={fp}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
