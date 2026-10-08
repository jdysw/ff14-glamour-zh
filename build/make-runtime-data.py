#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Runtime Data v3 生成器：canonical data → 按站 runtime 文件 + manifest。

输入（canonical——人工维护，勿手改输出）：
    data/ff14-items.tsv   9 列：key|zh|en|ja|ko|hash|ecid|alias|glam
    data/ff14-series.txt  日文系列名|国服中文名
    data/acl-cfc.txt      日文副本名|国服中文名

输出（默认 data/v3/——自动生成）：
    manifest.json          schema / version / generated / shared / sites（url+sha256+bytes）
    <site>/names.tsv       该站语言的名称键 → zh → glam（1/0/空；含染剂回退展开）
    <site>/hash.tsv        hash → zh（mirapri/ec/fc）
    <site>/alias.tsv       alias → zh 多值（全角分号拆分；中文键，全站一致）
    <site>/dup.tsv         歧义键 → zh 多值（同键多译；按站语言）
    <site>/series.txt      系列名（fc/collection）
    <site>/acl.txt         副本名（collection）
    wiki/ecid.tsv          zh → EC_ID
    wiki/ko.tsv            zh → 韩文名
    dict.json              词库（build/make_dict_json.py 生成；shared）

生成逻辑与运行时（src 内 buildTables / _irBuildAux）逐语义等价：
    首行胜 / '-' 行跳过 hash+ecid / 染剂「Xxx Dye → Xxx」补开 / alias 全角分号拆分。

语言裁剪（v1.4 Phase 13）：各站只输出其翻译链实际查询的语言键——
    mirapri / fc / collection = ja，ec = en，ronka = ko，wiki 不使用 names；
    dup 同步按站语言输出；alias 为中文键（全站一致）。
    实测：跨语言键碰撞仅 1 键且同值、dup 键无跨语言共享（裁剪等价）。

用法:
    python3 build/make-runtime-data.py                 # 输出到 data/v3/
    python3 build/make-runtime-data.py --out site/ff14/v3
"""
import datetime
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANON_ITEMS = ROOT / 'data' / 'ff14-items.tsv'
CANON_SERIES = ROOT / 'data' / 'ff14-series.txt'
CANON_ACL = ROOT / 'data' / 'acl-cfc.txt'

SCHEMA = 3
LANGS = ('en', 'ja', 'ko')
DICT_JSON = 'dict.json'

# 站点文件清单（与 src SITE_REGISTRY 的 indexes 对应）
SITE_FILES = {
    'mirapri':    ['names', 'hash', 'alias', 'dup'],
    'ec':         ['names', 'hash', 'alias', 'dup'],
    'fc':         ['names', 'hash', 'alias', 'dup', 'series'],
    'ronka':      ['names', 'alias', 'dup'],
    'collection': ['names', 'alias', 'dup', 'series', 'acl'],
    'endcloset':  ['names', 'alias', 'dup'],
    'wiki':       ['ecid', 'ko'],
}

# Phase 13：每站 names / dup 的语言键（各站翻译链实际查询语言）
SITE_LANGS = {
    'mirapri': ['ja'],
    'ec': ['en'],
    'fc': ['ja'],
    'ronka': ['ko'],
    'collection': ['ja'],
    'endcloset': ['ko'],
    'wiki': [],
}


def sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _row_parts(ln: str):
    """数据行过滤（首字符为 '-' 或数字；与运行时扫描规则一致）；非数据行返回 None。"""
    if not ln:
        return None
    c0 = ord(ln[0])
    if c0 != 45 and not (48 <= c0 <= 57):
        return None
    return ln.split('\t')


def _lookup_any(names, k):
    """跨语言取键值（首行胜值；裁剪等价性依赖跨语言键同值——实测仅 1 键且同值）。"""
    for lang in LANGS:
        v = names[lang].get(k)
        if v is not None:
            return v
    return None


def _scan_hash_row(ln, p, hashes, ecid):
    """hash / EC_ID 列（'-' 行跳过）。"""
    if ln.startswith('-'):
        return
    zh = p[1]
    h = p[5] if len(p) > 5 else ''
    if h and h not in hashes:
        hashes[h] = zh
    e = p[6] if len(p) > 6 else ''
    if e and zh not in ecid:
        ecid[zh] = e


def _scan_main_line(ln, names, glams, dyes, hashes, ecid, ko_by_zh):
    """第一遍单行：名称键首行胜 + 染剂收集 + hash/ecid + koByZh。"""
    p = _row_parts(ln)
    if p is None or len(p) < 5:
        return
    zh, en, ja, ko = p[1], p[2], p[3], p[4]
    g = p[8] if len(p) > 8 else ''
    _scan_hash_row(ln, p, hashes, ecid)
    for lang, key in zip(LANGS, (en, ja, ko)):
        if key and key not in names[lang]:
            names[lang][key] = zh
            glams[lang][key] = g
            if len(key) > 4 and key.endswith(' Dye'):
                dyes[lang].append(key)
    if zh and ko and zh not in ko_by_zh:
        ko_by_zh[zh] = ko


def _reg_dup(k, zh, names, dup):
    """登记重名键（仅同键多译；与运行时 _irRegDup 等价）。"""
    if not k:
        return
    cur = _lookup_any(names, k)
    if cur is None or cur == zh:
        return
    d = dup.get(k)
    if d is None:
        d = dup[k] = [cur]
    if zh not in d:
        d.append(zh)


def _reg_alias(a, zh, ali):
    """登记别名（1 别名 → 多 zh，按行序）。"""
    if not a:
        return
    d = ali.get(a)
    if d is None:
        d = ali[a] = []
    if zh not in d:
        d.append(zh)


def _scan_aux_line(ln, names, dup_by_lang, ali):
    """第二遍单行：衍生注册表（重名/别名）——须在名称首行胜就绪后扫描。"""
    p = _row_parts(ln)
    if p is None or len(p) < 2 or not p[1]:
        return
    zh = p[1]
    for ci in (2, 3, 4):
        if ci >= len(p):
            break
        _reg_dup(p[ci], zh, names, dup_by_lang[LANGS[ci - 2]])
    if len(p) > 7 and p[7]:
        for part in p[7].split('；'):
            _reg_alias(part.strip(), zh, ali)


def _dye_backfill(names, glams, dyes):
    """染剂回退（_btApplyTargets）：「Xxx Dye → 中文名」补开「Xxx → 中文名」。"""
    for lang in LANGS:
        for key in dyes[lang]:
            base = key[:-4]
            if base not in names[lang]:
                names[lang][base] = names[lang][key]
                glams[lang][base] = glams[lang].get(key, '')


def parse_items(text: str):
    """解析物品总表，复刻运行时语义。

    返回 (names, glams, hashes, ali, dup_by_lang, ecid, ko_by_zh)——
    names/dup 按语言分表（Phase 13 裁剪用）。
    """
    names = {lang: {} for lang in LANGS}   # 各语言键 → zh（首行胜；Python dict 保插入序）
    glams = {lang: {} for lang in LANGS}   # 各语言键 → glam（与 names 同键同步）
    dyes = {lang: [] for lang in LANGS}    # 染剂候选（成功写入且形如「Xxx Dye」）
    hashes = {}  # hash → zh（首行胜；'-' 行跳过）
    ecid = {}    # zh → EC_ID（'-' 行跳过）
    ko_by_zh = {}
    ali = {}     # alias → [zh...]（按行序，去重）
    dup_by_lang = {lang: {} for lang in LANGS}   # 语言键 → [zh...]（同键多译）

    lines = text.split('\n')
    for ln in lines:
        _scan_main_line(ln, names, glams, dyes, hashes, ecid, ko_by_zh)
    _dye_backfill(names, glams, dyes)
    for ln in lines:
        _scan_aux_line(ln, names, dup_by_lang, ali)
    return names, glams, hashes, ali, dup_by_lang, ecid, ko_by_zh


def _join_pairs(pairs):
    return ''.join(f'{k}\t{v}\n' for k, v in pairs)


def _join_triples(pairs):
    return ''.join(f'{k}\t{v}\t{g}\n' for k, v, g in pairs)


def _join_multi(pairs):
    return ''.join(f'{k}\t' + '\t'.join(v) + '\n' for k, v in pairs)


def build_files(names, glams, hashes, ali, dup_by_lang, ecid, ko_by_zh, series_text, acl_text):
    """生成 {(site, 文件名): bytes}——含按站语言裁剪。"""
    out = {}

    for site, want in SITE_FILES.items():
        langs = SITE_LANGS[site]
        for name in want:
            if name == 'names':
                pairs = [(k, v, glams[lang].get(k, '')) for lang in langs for k, v in names[lang].items()]
                out[(site, 'names.tsv')] = _join_triples(pairs).encode('utf-8')
            elif name == 'dup':
                pairs = [kv for lang in langs for kv in dup_by_lang[lang].items()]
                out[(site, 'dup.tsv')] = _join_multi(pairs).encode('utf-8')
            elif name == 'hash':
                out[(site, 'hash.tsv')] = _join_pairs(hashes.items()).encode('utf-8')
            elif name == 'alias':
                out[(site, 'alias.tsv')] = _join_multi(ali.items()).encode('utf-8')
            elif name == 'ecid':
                out[(site, 'ecid.tsv')] = _join_pairs(ecid.items()).encode('utf-8')
            elif name == 'ko':
                out[(site, 'ko.tsv')] = _join_pairs(ko_by_zh.items()).encode('utf-8')
            elif name == 'series':
                out[(site, 'series.txt')] = series_text.encode('utf-8')
            else:  # acl
                out[(site, 'acl.txt')] = acl_text.encode('utf-8')
    return out


def _parse_args(argv):
    out_dir = ROOT / 'data' / 'v3'
    if len(argv) >= 2 and argv[0] == '--out':
        out_dir = Path(argv[1])
        if not out_dir.is_absolute():
            out_dir = ROOT / out_dir
    return out_dir


def _gen_dict_bytes(out_dir):
    """词库（shared）：build/make_dict_json.py → dict.json 字节；失败返回 None。"""
    tmp = out_dir / f'.{DICT_JSON}.tmp'
    tmp.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run([sys.executable, str(ROOT / 'build' / 'make_dict_json.py'), '--out', str(tmp)],
                       capture_output=True, text=True)
    if r.returncode == 0 and tmp.exists():
        data = tmp.read_bytes()
        tmp.unlink()
        return data
    print('✗ dict.json 生成失败')
    print(r.stdout)
    print(r.stderr)
    return None


def _write_sites(out_dir, files):
    """写出站点文件；返回 (sites_manifest, ver_parts, total_bytes)。"""
    sites = {}
    ver_parts = []
    total_bytes = 0
    for site, want in SITE_FILES.items():
        site_dir = out_dir / site
        site_dir.mkdir(parents=True, exist_ok=True)
        sm = {}
        for name in want:
            fname = f'{name}.txt' if name in ('series', 'acl') else f'{name}.tsv'
            data = files[(site, fname)]
            s = sha256_hex(data)
            (site_dir / fname).write_bytes(data)
            sm[name] = {'url': f'{site}/{fname}', 'sha256': s, 'bytes': len(data)}
            ver_parts.append(f'{site}/{name}:{s}')
            total_bytes += len(data)
        sites[site] = {'files': sm}
    return sites, ver_parts, total_bytes


def main() -> int:
    out_dir = _parse_args(sys.argv[1:])
    for f in (CANON_ITEMS, CANON_SERIES, CANON_ACL):
        if not f.exists():
            print(f'✗ 缺失 canonical 源文件: {f}')
            return 1

    print('→ 解析 canonical 数据 ...')
    names, glams, hashes, ali, dup_by_lang, ecid, ko_by_zh = parse_items(CANON_ITEMS.read_text(encoding='utf-8'))
    series_text = CANON_SERIES.read_text(encoding='utf-8')
    acl_text = CANON_ACL.read_text(encoding='utf-8')
    dup_total = sum(len(dup_by_lang[l]) for l in LANGS)
    print(f'  names(en/ja/ko)={len(names["en"])}/{len(names["ja"])}/{len(names["ko"])}  '
          f'hash={len(hashes)}  alias={len(ali)}  dup={dup_total}  ecid={len(ecid)}  ko={len(ko_by_zh)}')

    files = build_files(names, glams, hashes, ali, dup_by_lang, ecid, ko_by_zh, series_text, acl_text)

    dict_bytes = _gen_dict_bytes(out_dir)
    if dict_bytes is None:
        return 1

    sites, ver_parts, total_bytes = _write_sites(out_dir, files)

    # shared dict 落盘
    (out_dir / DICT_JSON).write_bytes(dict_bytes)
    ver_parts.append(f'shared/dict:{sha256_hex(dict_bytes)}')

    manifest = {
        'schema': SCHEMA,
        'version': hashlib.sha256('|'.join(ver_parts).encode('utf-8')).hexdigest()[:12],
        'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'shared': {
            'dict': {'url': DICT_JSON, 'sha256': sha256_hex(dict_bytes), 'bytes': len(dict_bytes)},
        },
        'sites': sites,
    }
    (out_dir / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')

    print(f'✓ 输出 {out_dir}')
    print(f'  version={manifest["version"]}  sites={len(sites)}  站点文件总 {total_bytes} bytes（+ dict {len(dict_bytes)}）')
    for site, sm in sorted(sites.items()):
        parts = ' '.join(f'{n}:{f["bytes"]}' for n, f in sorted(sm['files'].items()))
        print(f'  [{site:10s}] {parts}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
