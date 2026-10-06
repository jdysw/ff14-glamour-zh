#!/usr/bin/env python3
# gen-modules.py —— Phase 15 搬移工具（2/3）：按分配表把单文件切成模块草案
# 用法: python3 build/migrate/gen-modules.py [输出目录] [块地图文件]
# 规则:
#   * 行区间 = [块.start .. 下一块.start - 1]（末块到文件尾）；「块+其后间隙」归前块。
#   * 仅覆盖块区间；跳过文件头部 1..22 行（metadata 已外置为 build/userscript-header.txt）。
#   * 输出为「纯内容草案」（无 import/export；接口在后续步骤添加）。
# 块地图默认 /tmp/block-map.json；Windows 等无 /tmp 的环境可用环境变量
# ZHX_BLOCK_MAP 或第 2 个位置参数指定（须与 verify-modules.py 取同一份）。
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(BASE, 'src', 'ff14-glamour-zh.external.user.js')
ASSIGN = os.path.join(BASE, 'build', 'migrate', 'module-assign.json')

out_root = sys.argv[1] if len(sys.argv) > 1 else '/tmp/modules-v1'
block_map_file = (sys.argv[2] if len(sys.argv) > 2
                  else os.environ.get('ZHX_BLOCK_MAP') or '/tmp/block-map.json')

blocks = json.load(open(block_map_file, encoding='utf-8'))
assign = json.load(open(ASSIGN, encoding='utf-8'))
lines = open(SRC, encoding='utf-8').read().split('\n')
total = len(lines)

# 文件尾容器收尾（IIFE 的 `})();` 与尾部空行）：从末块区间中剔除，不进入任何模块
end_limit = total
while end_limit > 1:
    s = lines[end_limit - 1].strip()
    if s == '' or s == '})();':
        end_limit -= 1
    else:
        break

# 块起点前的「注释带」归属：
#   向上扫「连续注释/空行」带 [g .. start-1]；
#   若带内含 `@zhixia:*-end` 行 e：从 e+1 起切给本块（段尾注释随上一段）；
#   否则整带归本块（文档注释在声明上方）。
def cut_point(start):
    gap_end = start - 1
    i = gap_end
    in_block = False
    while i >= 23:
        st = lines[i - 1].strip()
        if st == '':
            i -= 1
            continue
        if in_block:
            if '/*' in st:
                in_block = False
            i -= 1
            continue
        if st.startswith('//'):
            i -= 1
            continue
        if st.endswith('*/'):
            if '/*' not in st:
                in_block = True
            i -= 1
            continue
        break
    g = i + 1
    if g > gap_end:
        return start
    for j in range(gap_end, g - 1, -1):
        if '@zhixia:' in lines[j - 1] and '-end' in lines[j - 1]:
            return j + 1
    return g

# 行区间（1-indexed, inclusive）：块 i 的区间 = [cuts[i], cuts[i+1]-1]
cuts = [cut_point(b['start']) for b in blocks]
regions = {}
for i in range(len(blocks)):
    s = cuts[i]
    e = (cuts[i + 1] - 1) if i + 1 < len(blocks) else end_limit
    regions[i] = (s, e)

# 覆盖性检查：所有块区间并集应当恰覆盖 [23, end_limit]
cover = {}
for i in range(len(blocks)):
    for ln in range(regions[i][0], regions[i][1] + 1):
        if ln in cover:
            print(f'!! 行 {ln} 被多个块区间覆盖', file=sys.stderr)
        cover[ln] = i
missing = [ln for ln in range(23, end_limit + 1) if ln not in cover]
if missing:
    print(f'!! 未覆盖行: {missing[:20]}（共 {len(missing)}）', file=sys.stderr)

# 生成
os.makedirs(out_root, exist_ok=True)
count = 0
for mod, idxs in assign.items():
    if mod.startswith('comment'):
        continue
    chunks = []
    for i in idxs:
        s, e = regions[i]
        chunks.append('\n'.join(lines[s - 1:e]))
    rel = mod + '.js'
    dest = os.path.join(out_root, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'w', encoding='utf-8') as f:
        f.write('\n'.join(chunks) + '\n')
    count += 1
    nl = sum(len(c.split('\n')) for c in chunks)
    print(f'{mod:28s} <- {len(idxs):3d} 块 / {nl:5d} 行')
print(f'\n生成 {count} 个模块草案 → {out_root}')
