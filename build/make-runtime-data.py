#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Runtime Data v3 生成器：canonical data → 按站 runtime 文件 + manifest。

输入（canonical——人工维护，勿手改输出）：
    data/ff14-items.tsv   8 列：key|zh|en|ja|ko|hash|ecid|alias
    data/ff14-series.txt  日文系列名|国服中文名
    data/acl-cfc.txt      日文副本名|国服中文名

输出（默认 data/v3/——自动生成）：
    manifest.json          schema / version / generated / shared / sites（url+sha256+bytes）
    <site>/names.tsv       en/ja/ko 名（含染剂回退展开）→ zh
    <site>/hash.tsv        hash → zh（mirapri/ec/fc）
    <site>/alias.tsv       alias → zh 多值（全角分号拆分）
    <site>/dup.tsv         歧义键 → zh 多值（同键多译）
    <site>/series.txt      系列名（fc/collection）
    <site>/acl.txt         副本名（collection）
    wiki/ecid.tsv          zh → EC_ID
    wiki/ko.tsv            zh → 韩文名
    dict.json              词库（build/make_dict_json.py 生成；shared）

生成逻辑与运行时（src 内 buildTables / _irBuildAux）逐语义等价：
    首行胜 / '-' 行跳过 hash+ecid / 染剂「Xxx Dye → Xxx」补开 / alias 全角分号拆分。

用法:
    python3 build/make-runtime-data.py                 # 输出到 data/v3/
    python3 build/make-runtime-data.py --out site/ff14/v3
"""
import datetime
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANON_ITEMS = ROOT / 'data' / 'ff14-items.tsv'
CANON_SERIES = ROOT / 'data' / 'ff14-series.txt'
CANON_ACL = ROOT / 'data' / 'acl-cfc.txt'

# 站点文件清单（与 src SITE_REGISTRY 的 tables/indexes 对应）
SITE_FILES = {
    'mirapri':    ['names', 'hash', 'alias', 'dup'],
    'ec':         ['names', 'hash', 'alias', 'dup'],
    'fc':         ['names', 'hash', 'alias', 'dup', 'series'],
    'ronka':      ['names', 'alias', 'dup'],
    'collection': ['names', 'alias', 'dup', 'series', 'acl'],
    'wiki':       ['ecid', 'ko'],
}

SCHEMA = 3


def sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def parse_items(text: str):
    """解析物品总表，复刻运行时语义。返回 names/hash/alias/dup/ecid/ko 字典。"""
    names = {}   # 键（en/ja/ko）→ zh（首行胜；Python dict 保插入序）
    dye = []     # 染剂候选（成功写入且形如「Xxx Dye」）
    hashes = {}  # hash → zh（首行胜；'-' 行跳过）
    ecid = {}    # zh → EC_ID（'-' 行跳过）
    ko_by_zh = {}
    ali = {}     # alias → [zh...]（按行序，去重）

    lines = text.split('\n')
    for ln in lines:
        if not ln:
            continue
        c0 = ord(ln[0])
        if c0 != 45 and not (48 <= c0 <= 57):
            continue
        p = ln.split('\t')
        if len(p) < 5:
            continue
        zh = p[1] if len(p) > 1 else ''
        en = p[2] if len(p) > 2 else ''
        ja = p[3] if len(p) > 3 else ''
        ko = p[4] if len(p) > 4 else ''
        # _btHashRow（'-' 行跳过）
        if not ln.startswith('-'):
            h = p[5] if len(p) > 5 else ''
            if h and h not in hashes:
                hashes[h] = zh
            e = p[6] if len(p) > 6 else ''
            if e and zh not in ecid:
                ecid[zh] = e
        # _btNameRow（三名键首行胜 + 染剂收集；koByZh）
        for key in (en, ja, ko):
            if key and key not in names:
                names[key] = zh
                if len(key) > 4 and key.endswith(' Dye'):
                    dye.append(key)
        if zh and ko and zh not in ko_by_zh:
            ko_by_zh[zh] = ko

    # _btApplyTargets 染剂回退：「Xxx Dye → 中文名」补开「Xxx → 中文名」
    for key in dye:
        base = key[:-4]
        if base not in names:
            names[base] = names[key]

    # _irBuildAux 衍生注册表（须在 nameMap 首行胜就绪后扫描）
    dup = {}
    for ln in lines:
        if not ln:
            continue
        c0 = ord(ln[0])
        if c0 != 45 and not (48 <= c0 <= 57):
            continue
        p = ln.split('\t')
        if len(p) < 2 or not p[1]:
            continue
        zh = p[1]
        for ci in (2, 3, 4):
            if ci >= len(p):
                break
            k = p[ci]
            if not k:
                continue
            cur = names.get(k)
            if cur is None or cur == zh:
                continue
            d = dup.setdefault(k, [cur])
            if zh not in d:
                d.append(zh)
        if len(p) > 7 and p[7]:
            for part in p[7].split('；'):
                a = part.strip()
                if not a:
                    continue
                d = ali.setdefault(a, [])
                if zh not in d:
                    d.append(zh)

    return names, hashes, ali, dup, ecid, ko_by_zh


def build_files(names, hashes, ali, dup, ecid, ko_by_zh, series_text, acl_text):
    """生成 {文件名: bytes}（相对站点目录）。"""
    out = {}

    def join_pairs(pairs):
        return ''.join(f'{k}\t{v}\n' for k, v in pairs)

    out['names.tsv'] = join_pairs(names.items()).encode('utf-8')
    out['hash.tsv'] = join_pairs(hashes.items()).encode('utf-8')
    out['alias.tsv'] = ''.join(f'{k}\t' + '\t'.join(v) + '\n' for k, v in ali.items()).encode('utf-8')
    out['dup.tsv'] = ''.join(f'{k}\t' + '\t'.join(v) + '\n' for k, v in dup.items()).encode('utf-8')
    out['ecid.tsv'] = join_pairs(ecid.items()).encode('utf-8')
    out['ko.tsv'] = join_pairs(ko_by_zh.items()).encode('utf-8')
    out['series.txt'] = series_text.encode('utf-8')
    out['acl.txt'] = acl_text.encode('utf-8')
    out['dict.json'] = None   # 由 make_dict_json.py 生成（shared）
    return out


def main() -> int:
    out_dir = ROOT / 'data' / 'v3'
    args = sys.argv[1:]
    if len(args) >= 2 and args[0] == '--out':
        out_dir = Path(args[1])
        if not out_dir.is_absolute():
            out_dir = ROOT / out_dir

    for f in (CANON_ITEMS, CANON_SERIES, CANON_ACL):
        if not f.exists():
            print(f'✗ 缺失 canonical 源文件: {f}')
            return 1

    print('→ 解析 canonical 数据 ...')
    names, hashes, ali, dup, ecid, ko_by_zh = parse_items(CANON_ITEMS.read_text(encoding='utf-8'))
    series_text = CANON_SERIES.read_text(encoding='utf-8')
    acl_text = CANON_ACL.read_text(encoding='utf-8')
    print(f'  names={len(names)}  hash={len(hashes)}  alias={len(ali)}  dup={len(dup)}  ecid={len(ecid)}  ko={len(ko_by_zh)}')

    files = build_files(names, hashes, ali, dup, ecid, ko_by_zh, series_text, acl_text)

    # 词库（shared）：build/make_dict_json.py → dict.json
    dict_bytes = None
    tmp = out_dir / '.dict.json.tmp'
    tmp.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run([sys.executable, str(ROOT / 'build' / 'make_dict_json.py'), '--out', str(tmp)],
                       capture_output=True, text=True)
    if r.returncode == 0 and tmp.exists():
        dict_bytes = tmp.read_bytes()
        tmp.unlink()
    if dict_bytes is None:
        print('✗ dict.json 生成失败')
        print(r.stdout)
        print(r.stderr)
        return 1
    files['dict.json'] = dict_bytes

    # 写出站点文件 + manifest
    manifest = {
        'schema': SCHEMA,
        'version': '',
        'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'shared': {
            'dict': {'url': 'dict.json', 'sha256': sha256_hex(files['dict.json']), 'bytes': len(files['dict.json'])},
        },
        'sites': {},
    }
    ver_parts = []
    total_bytes = 0
    for site, want in SITE_FILES.items():
        site_dir = out_dir / site
        site_dir.mkdir(parents=True, exist_ok=True)
        site_manifest = {}
        for name in want:
            data = files.get(f'{name}.tsv')
            if data is None:
                if name == 'series':
                    data = files['series.txt']
                elif name == 'acl':
                    data = files['acl.txt']
                else:
                    data = files[f'{name}.tsv']
            s = sha256_hex(data)
            (site_dir / f'{name}.tsv' if name not in ('series', 'acl') else site_dir / f'{name}.txt').write_bytes(data)
            site_manifest[name] = {'url': f'{site}/{name}.tsv' if name not in ('series', 'acl') else f'{site}/{name}.txt',
                                   'sha256': s, 'bytes': len(data)}
            ver_parts.append(f'{site}/{name}:{s}')
            total_bytes += len(data)
        manifest['sites'][site] = {'files': site_manifest}

    # shared dict 落盘
    (out_dir / 'dict.json').write_bytes(files['dict.json'])
    ver_parts.append(f'shared/dict:{sha256_hex(files["dict.json"])}')

    manifest['version'] = hashlib.sha256('|'.join(ver_parts).encode('utf-8')).hexdigest()[:12]
    (out_dir / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')

    print(f'✓ 输出 {out_dir}')
    print(f'  version={manifest["version"]}  sites={len(manifest["sites"])}  站点文件总 {total_bytes} bytes（+ dict {len(files["dict.json"])}）')
    for site, sm in sorted(manifest['sites'].items()):
        parts = ' '.join(f'{n}:{f["bytes"]}' for n, f in sorted(sm['files'].items()))
        print(f'  [{site:10s}] {parts}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
