#!/usr/bin/env python3
# 从 ff14-jp2zh.txt 自动推导「系列名前缀」表 → data/ff14-series.txt
# 原理：多个条目共享的日文前缀 ↔ 共享的中文前缀（如 トレードウィンズ→贸易风）
import re
from collections import defaultdict

SRC = '/home/ubuntu/zhixia-glamour/data/ff14-jp2zh.txt'
OUT = '/home/ubuntu/zhixia-glamour/data/ff14-series.txt'

rows = []
for line in open(SRC, encoding='utf-8'):
    line = line.rstrip('\n')
    if '|' not in line:
        continue
    jp, zh = line.split('|', 1)
    rows.append((jp, zh))

print('总条目:', len(rows))

# 1) 生成候选前缀：对每条，取「・ 分割的第一段」和「逐字符前缀(6..24)」
cand = defaultdict(lambda: defaultdict(int))  # jp_prefix -> zh_prefix -> count

for jp, zh in rows:
    jp2 = jp.rstrip('+0123456789')
    zh2 = zh.rstrip('+0123456789')
    # ・分隔：取第一段（含后续同名系列如 ファントムヴィジョン・ディフェンダー 无后续・）
    if '・' in jp2:
        seg = jp2.split('・')[0]
        # 中文对应：按 中文前缀 里找 "seg 的译名" —— 未知，先记录 pair 供后续对齐
        cand[seg][''] += 1
    # 逐字符前缀
    for L in range(len(jp2), 5, -1):
        p = jp2[:L]
        if re.search(r'[\u3040-\u30ff\u4e00-\u9fff]$', p) and not p.endswith('・'):
            cand[p][zh2[:max(2, int(L * 0.6))]] += 1
            break  # 只取最长候选，减少噪音

# 2) 核心对齐：对「同一日文前缀」的多条目，用最长公共中文前缀
pairs = defaultdict(list)
for jp, zh in rows:
    jp2 = jp.rstrip('+0123456789').rstrip('+0123456789')
    zh2 = zh.rstrip('+0123456789')
    if jp2.endswith('・'):
        continue
    # 找「去尾部部件词」后的前缀：要求 ≥2 条目共享
    pairs[jp2].append(zh2)

# 直接按全名对齐不可行，改：按「日文公共前缀」聚类
sorted_jp = sorted(set(jp.rstrip('+0123456789').rstrip('+0123456789') for jp, _ in rows))
zh_of = {}
for jp, zh in rows:
    zh_of.setdefault(jp.rstrip('+0123456789').rstrip('+0123456789'), zh.rstrip('+0123456789'))

series = {}
from itertools import groupby
# 相邻公共前缀法
for jp in sorted_jp:
    for L in range(min(len(jp), 28), 5, -1):
        p = jp[:L]
        group = [x for x in sorted_jp if x.startswith(p)]
        if len(group) >= 2 and not p.endswith('・'):
            # 中文公共前缀
            zhs = [zh_of[g] for g in group]
            # 找公共中文前缀
            cp = zhs[0]
            for z in zhs[1:]:
                k = 0
                while k < min(len(cp), len(z)) and cp[k] == z[k]:
                    k += 1
                cp = cp[:k]
            cp = cp.rstrip('・· ')
            if len(cp) >= 2 and len(p) >= 6 and p not in series:
                # 只保留“最长”的（更长的段优先）
                series[p] = cp
            break

# 3) 去冗余：若 A 是 B 的前缀且值也相应前缀，删除 A（保留长）
out = {}
items = sorted(series.items(), key=lambda x: -len(x[0]))
for p, cp in items:
    domin = False
    for p2, cp2 in out.items():
        if p != p2 and p2.startswith(p) and cp2.startswith(cp):
            domin = True
            break
    if not domin:
        out[p] = cp

print('系列名条目:', len(out))
for p, cp in sorted(out.items())[:40]:
    print(' ', p, '→', cp)

with open(OUT, 'w', encoding='utf-8') as f:
    for p, cp in sorted(out.items()):
        f.write(p + '|' + cp + '\n')
print('写出', OUT)
