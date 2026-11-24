#!/usr/bin/env python3
"""词库打包：data/dictionaries/*.json → dict.json（紧凑单文件）+ sha256 前 12 位指纹。

输出结构（与站点层一致）：
    {"common":{...},"main":{...},"ec":{...},"fc":{...},"ronka":{...},"acl":{...}}

用于数据站发布（由 make-runtime-data.py 调用）；脚本运行时拉取合并，
改词无需发新脚本版本（v1.2.0 起）。

用法:
    python3 build/data/make_dict_json.py --out <路径>   # 写入文件并打印「fp=xxxxxxxxxxxx」
    python3 build/data/make_dict_json.py                # 仅打印指纹
"""
import hashlib
import json
import sys
from pathlib import Path
from dictionary_source import load_entries

DICT_DIR = Path(__file__).resolve().parents[2] / 'data' / 'dictionaries'

FILES = [
    ('common', 'dict-common.json'),
    ('main', 'dict-main.json'),
    ('ec', 'dict-ec.json'),
    ('fc', 'dict-fc.json'),
    ('ronka', 'dict-ronka.json'),
    ('acl', 'dict-acl.json'),
    ('endcloset', 'dict-endcloset.json'),
    ('miramiru', 'dict-miramiru.json'),
]


def build_dictionary():
    return {key: load_entries(DICT_DIR / fn) for key, fn in FILES}


def encode_dictionary(layers):
    return json.dumps(layers, ensure_ascii=False, separators=(',', ':'))


def build_dict_json():
    text = encode_dictionary(build_dictionary())
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
