#!/usr/bin/env python3
# 高效版：排序 + 相邻公共前缀 → 系列名候选；再按组求中文公共前缀
import re, sys
from collections import defaultdict

SRC = '/home/ubuntu/zhixia-glamour/data/ff14-jp2zh.txt'
OUT = '/home/ubuntu/zhixia-glamour/data/ff14-series.txt'

rows = []
for line in open(SRC, encoding='utf-8'):
    line = line.rstrip('\n')
    if '|' not in line:
        continue
    jp, zh = line.split('|', 1)
    # 去掉强化后缀 +1 +2
    jp2 = re.sub(r'\+\d$', '', jp).strip()
    zh2 = re.sub(r'\+\d$', '', zh).strip()
    if jp2 and zh2:
        rows.append((jp2, zh2))
print('总条目:', len(rows), flush=True)

# jp -> [zh...]（同一 jp 多 zh 时取第一条）
zh_map = {}
for jp, zh in rows:
    zh_map.setdefault(jp, zh)

sorted_jp = sorted(zh_map.keys())

# 步骤1：相邻公共前缀 → 候选系列名（≥6 字符，不以 ・ 结尾）
cand = set()
for i in range(len(sorted_jp) - 1):
    a, b = sorted_jp[i], sorted_jp[i + 1]
    k = 0
    lim = min(len(a), len(b))
    while k < lim and a[k] == b[k]:
        k += 1
    if k >= 6:
        p = a[:k]
        # 去掉结尾的 ・
        while p.endswith('・'):
            p = p[:-1]
        if len(p) >= 6:
            cand.add(p)
print('候选前缀:', len(cand), flush=True)

# 步骤2：对每个候选，找「以它开头的所有条目」的中文公共前缀
# 用二分定位区间
import bisect
series = {}
for p in sorted(cand, key=len, reverse=True):
    lo = bisect.bisect_left(sorted_jp, p)
    hi = bisect.bisect_left(sorted_jp, p + '\uffff')
    group = sorted_jp[lo:hi]
    if len(group) < 2:
        continue
    zhs = [zh_map[g] for g in group]
    cp = zhs[0]
    for z in zhs[1:]:
        k = 0
        lim = min(len(cp), len(z))
        while k < lim and cp[k] == z[k]:
            k += 1
        cp = cp[:k]
        if len(cp) < 2:
            break
    cp = cp.strip('·・ ')
    if len(cp) >= 2:
        series[p] = cp

print('系列名候选(含重叠):', len(series), flush=True)

# 步骤3：去冗余（长优先，短的若被长的支配则删）
items = sorted(series.items(), key=lambda x: -len(x[0]))
final = {}
for p, cp in items:
    dominated = False
    for p2, cp2 in final.items():
        if p2.startswith(p) and cp2.startswith(cp) and p2 != p:
            dominated = True
            break
    if not dominated:
        final[p] = cp

print('去冗余后:', len(final), flush=True)
with open(OUT, 'w', encoding='utf-8') as f:
    for p, cp in sorted(final.items()):
        f.write(p + '|' + cp + '\n')
print('写出', OUT, flush=True)
for p, cp in list(sorted(final.items()))[:40]:
    print(' ', p, '→', cp)
