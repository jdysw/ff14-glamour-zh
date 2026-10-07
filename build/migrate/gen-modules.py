#!/usr/bin/env python3
# gen-modules.py —— Phase 15 搬移工具（2/3）：按分配表把单文件切成模块草案
# 用法: python3 build/migrate/gen-modules.py [输出目录] [块地图文件]
# 规则:
#   * 行区间 = [块.start .. 下一块.start - 1]（末块到文件尾）；「块+其后间隙」归前块。
#   * 仅覆盖块区间；跳过文件头部 1..22 行（metadata 已外置为 build/userscript-header.txt）。
#   * 输出为「纯内容草案」（无 import/export；接口在后续步骤添加）。
# 块地图默认 <仓库>/.cache/block-map.json；可用环境变量 ZHX_BLOCK_MAP
# 或第 2 个位置参数指定（须与 verify-modules.py 取同一份）。
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _blocks_common import build_regions, repo_path  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(BASE, 'src', 'ff14-glamour-zh.external.user.js')
ASSIGN = os.path.join(BASE, 'build', 'migrate', 'module-assign.json')

out_root = repo_path(BASE, sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, '.cache', 'modules-v1'), '输出目录')
block_map_file = repo_path(BASE, sys.argv[2] if len(sys.argv) > 2
                  else os.environ.get('ZHX_BLOCK_MAP') or os.path.join(BASE, '.cache', 'block-map.json'), '块地图')

blocks = json.load(open(block_map_file, encoding='utf-8'))
assign = json.load(open(ASSIGN, encoding='utf-8'))
lines = open(SRC, encoding='utf-8').read().split('\n')

# 块区间（1-indexed 闭区间；共用实现：行尾容器剔除 + 注释带归属）
regions, end_limit = build_regions(blocks, lines)

# 覆盖性检查：所有块区间并集应当恰覆盖 [23, end_limit]
cover = {}
for i in range(len(blocks)):
    s, e = regions[i]
    if not (isinstance(s, int) and isinstance(e, int) and 23 <= s <= e <= end_limit):
        sys.exit(f'块区间异常（#{i}：{s}..{e}）')
    for ln in range(s, e + 1):
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
        if not (isinstance(s, int) and isinstance(e, int) and 23 <= s <= e <= end_limit):
            sys.exit(f'块区间异常（{mod} #{i}）')
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
