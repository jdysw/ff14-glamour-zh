#!/usr/bin/env python3
# 系列名推导（最终版）
# 候选两类：① 相邻公共前缀以 ・ 结尾 → 取完整段(≥3字) ② 相邻公共前缀 ≥8 字
# 分组（≥2 条）求中文公共前缀（≥2 字）→ data/ff14-series.txt
import re, bisect

SRC = '/home/ubuntu/zhixia-glamour/data/ff14-jp2zh.txt'
OUT = '/home/ubuntu/zhixia-glamour/data/ff14-series.txt'

rows = []
for line in open(SRC, encoding='utf-8'):
    line = line.rstrip('\n')
    if '|' not in line:
        continue
    jp, zh = line.split('|', 1)
    jp2 = re.sub(r'\+\d$', '', jp).strip()
    zh2 = re.sub(r'\+\d$', '', zh).strip()
    if jp2 and zh2 and not jp2.startswith('†'):
        rows.append((jp2, zh2))

zh_map = {}
for jp, zh in rows:
    zh_map.setdefault(jp, zh)
sorted_jp = sorted(zh_map.keys())
print('条目:', len(sorted_jp))

cand = set()
for i in range(len(sorted_jp) - 1):
    a, b = sorted_jp[i], sorted_jp[i + 1]
    k = 0
    lim = min(len(a), len(b))
    while k < lim and a[k] == b[k]:
        k += 1
    if k == 0:
        continue
    p = a[:k]
    if p.endswith('・'):
        pj = p[:-1]
        if len(pj) >= 2 and re.search(r'[\u3040-\u30ff\u4e00-\u9fff]$', pj):
            cand.add(pj)
    elif len(p) >= 5 and not re.search(r'[（(]$', p):
        cand.add(p)

print('候选:', len(cand))

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
    if len(cp) >= 2 and not cp.endswith(('（', '(', '・', '·')):
        series[p] = cp

# 去冗余：长前缀优先；若短前缀被长前缀支配（p2.startswith(p) 且 cp2.startswith(cp)）则删
items = sorted(series.items(), key=lambda x: -len(x[0]))
final = {}
for p, cp in items:
    dom = any(p2.startswith(p) and cp2.startswith(cp) and p2 != p for p2, cp2 in final.items())
    if not dom:
        final[p] = cp

print('终稿:', len(final))
with open(OUT, 'w', encoding='utf-8') as f:
    for p, cp in sorted(final.items()):
        f.write(p + '|' + cp + '\n')

print()
print('=== 关键目标 ===')
for key in ['ファントムヴィジョン・ディフェンダー', 'ファントムヴィジョン', 'トレードウィンズ', 'トゥール', 'カーウェン', 'トルナ', 'ゼロムナリー', '夜桜', '夜帳']:
    hits = [(p, cp) for p, cp in final.items() if p == key or (key.startswith(p) and len(p) >= 3)]
    best = max(hits, key=lambda x: len(x[0])) if hits else None
    print(' ', key, '=>', best)
