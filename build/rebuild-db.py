#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""rebuild-db.py —— FF14 物品数据表重建/更新（跟随游戏版本）

数据模型（8 列，一物品一行）:
    key | zh | en | ja | ko | hash | ecid | alias

规则:
  · 权威为主: 中/英/日/韩名以四语 datamining Item.csv 为准（新物品自动纳入，
    名称更新自动跟进）
  · 现有为补: hash（光之收藏家链接标识）/ EC_ID（Eorzea Collection 物品 ID）
    按物品（key）从现有表继承；历史遗留别名（变体名，如「奥黛套装」）随行保留
  · 并集保留: 被移出游戏的旧物品仍留在表中（翻译兜底）；旧物品的名不因权威
    缺少而丢失
  · 特殊行: key 为「-」的行（旧表独有、权威缺失的历史物品）原样继承

用法:
    python3 build/rebuild-db.py                     # 下载最新 CSV 并重建（写回 data/ff14-items.tsv）
    python3 build/rebuild-db.py --csv-dir DIR       # 使用本地已下载的 CSV（离线）
    python3 build/rebuild-db.py --refresh           # 强制重新下载
    python3 build/rebuild-db.py --out FILE          # 输出到指定文件（默认 data/ff14-items.tsv）
"""
import csv
import os
import re
import shutil
import sys
import time
import urllib.request
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_ITEMS = os.path.join(ROOT, 'data', 'ff14-items.tsv')
CACHE = os.path.join(HERE, '.cache', 'datamining')

SOURCES = {
    'cn': 'https://cdn.jsdelivr.net/gh/thewakingsands/ff14-datamining-cn@master/Item.csv',
    'en': 'https://cdn.jsdelivr.net/gh/xivapi/ff14-datamining@master/csv/en/Item.csv',
    'ja': 'https://cdn.jsdelivr.net/gh/xivapi/ff14-datamining@master/csv/ja/Item.csv',
    'ko': 'https://cdn.jsdelivr.net/gh/Ra-Workspace/ffxiv-datamining-ko@master/csv/Item.csv',
}
MIN_SIZE = 5 * 1024 * 1024   # 每个 CSV 至少 >5MB，小于视为下载损坏


# ───────────────────────── 工具 ─────────────────────────

def parse_args():
    import argparse
    ap = argparse.ArgumentParser(description='FF14 物品数据表重建')
    ap.add_argument('--csv-dir', help='本地 CSV 目录（含 cn/en/ja/ko-Item.csv）')
    ap.add_argument('--refresh', action='store_true', help='强制重新下载')
    ap.add_argument('--src', default=None, help='现有数据表路径（默认与 --out 相同）')
    ap.add_argument('--out', default=DEFAULT_ITEMS, help='输出文件路径')
    return ap.parse_args()


def fetch(url, dest, refresh=False):
    """下载一个 CSV（带缓存；jsdelivr CDN）。"""
    if os.path.exists(dest) and not refresh and os.path.getsize(dest) >= MIN_SIZE:
        print(f'  {os.path.basename(dest)} 已缓存（{os.path.getsize(dest)/1048576:.1f} MB）')
        return dest
    tmp = dest + '.part'
    last = None
    for attempt in range(1, 4):
        try:
            print(f'  下载 {os.path.basename(dest)}（第 {attempt} 次）…', flush=True)
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (zhixia-db-refresh)'})
            with urllib.request.urlopen(req, timeout=180) as r, open(tmp, 'wb') as f:
                shutil.copyfileobj(r, f)
            size = os.path.getsize(tmp)
            if size < MIN_SIZE:
                raise RuntimeError(f'文件过小（{size} B），疑下载损坏')
            os.replace(tmp, dest)
            print(f'  {os.path.basename(dest)} 完成（{size/1048576:.1f} MB）')
            return dest
        except Exception as e:
            last = e
            print(f'  失败: {e}')
            time.sleep(3)
    raise RuntimeError(f'下载失败: {url} —— {last}')


def load_csv(path):
    """datamining CSV → {key: Name}（从表头行找 Name 列）。"""
    out = {}
    with open(path, encoding='utf-8-sig', newline='') as f:
        rd = csv.reader(f)
        name_idx = None
        for row in rd:
            if not row:
                continue
            if name_idx is None:
                if row[0] == '#':
                    try:
                        name_idx = row.index('Name')
                    except ValueError:
                        pass
                continue
            if not row[0].isdigit():
                continue
            if len(row) > name_idx and row[name_idx].strip():
                out[int(row[0])] = row[name_idx].strip()
    return out


def load_items_tsv(path):
    """现有 items.tsv → ({key:int → [8 列]}, [特殊行('-' 开头)]）"""
    old = {}
    extra = []
    if not os.path.exists(path):
        raise SystemExit(f'找不到现有数据表: {path}')
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line or line.startswith('key\t'):
                continue
            p = line.split('\t')
            while len(p) < 8:
                p.append('')
            if p[0] == '-':
                extra.append(p)
            elif p[0].isdigit():
                old[int(p[0])] = p
    return old, extra


# ───────────────────────── 主流程 ─────────────────────────

def main():
    args = parse_args()
    t0 = time.time()

    # 1) 获取四语 CSV
    print('══ 1. 权威源 ══')
    csv_paths = {}
    os.makedirs(CACHE, exist_ok=True)
    for lang in ('cn', 'en', 'ja', 'ko'):
        if args.csv_dir:
            p = os.path.join(args.csv_dir, f'{lang}-Item.csv')
            if not os.path.exists(p):
                raise SystemExit(f'本地 CSV 不存在: {p}')
            csv_paths[lang] = p
            print(f'  {lang}: 本地 {p}')
        else:
            csv_paths[lang] = fetch(SOURCES[lang], os.path.join(CACHE, f'{lang}-Item.csv'),
                                    refresh=args.refresh)

    cn = load_csv(csv_paths['cn'])
    en = load_csv(csv_paths['en'])
    ja = load_csv(csv_paths['ja'])
    ko = load_csv(csv_paths['ko'])
    print(f'  cn {len(cn):,} | en {len(en):,} | ja {len(ja):,} | ko {len(ko):,}')

    # 2) 现有表（补充列继承）
    print('══ 2. 现有表（继承 hash/EC_ID/别名）══')
    old, extra = load_items_tsv(args.src or args.out)
    print(f'  现有 {len(old):,} 个物品 | 特殊行 {len(extra)} 条')

    # 3) 并集构建
    print('══ 3. 重建 ══')
    all_keys = set(cn) | set(en) | set(ja) | set(ko) | set(old)
    rows = []
    n_new = n_kept = n_gone = n_upd_name = 0
    for k in sorted(all_keys):
        o = old.get(k)
        z = cn.get(k) or (o[1] if o else '')
        if not z:
            continue                      # 无中文名 → 不纳入（翻译场景以中文为准）
        e = en.get(k) or (o[2] if o else '')
        j = ja.get(k) or (o[3] if o else '')
        k2 = ko.get(k) or (o[4] if o else '')
        h = o[5] if o else ''            # hash 继承
        ec = o[6] if o else ''           # EC_ID 继承
        al = o[7] if o else ''           # 别名继承
        if o is None:
            n_new += 1
        elif k not in cn and k not in en and k not in ja and k not in ko:
            n_kept += 1                   # 权威已无 → 旧物品保留
        if o and o[1] and cn.get(k) and o[1] != cn[k]:
            n_upd_name += 1               # 权威更新了译名
        rows.append((k, z, e, j, k2, h, ec, al))

    # 4) 写出
    out_tmp = args.out + '.tmp'
    with open(out_tmp, 'w', encoding='utf-8') as f:
        f.write('key\tzh\ten\tja\tko\thash\tecid\talias\n')
        for (k, z, e, j, k2, h, ec, al) in rows:
            f.write(f'{k}\t{z}\t{e}\t{j}\t{k2}\t{h}\t{ec}\t{al}\n')
        for p in extra:                   # 特殊行原样继承（如历史神典石）
            f.write('\t'.join(p) + '\n')
    os.replace(out_tmp, args.out)

    size_mb = os.path.getsize(args.out) / 1048576
    print(f'  → {args.out}（{len(rows):,} 行 + 特殊 {len(extra)} 行，{size_mb:.2f} MB）')
    print(f'  新增 {n_new:,} | 保留(已移除) {n_kept:,} | 译名更新 {n_upd_name:,}')
    print(f'══ 完成（{time.time()-t0:.0f}s）══')


if __name__ == '__main__':
    main()
