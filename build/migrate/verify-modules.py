#!/usr/bin/env python3
# verify-modules.py —— Phase 15 搬移工具（3/3）：校验模块草案（零丢失、零改动）
# 用法: python3 build/migrate/verify-modules.py [模块目录] [块地图文件]
# 校验:
#   A. 完整性：原文件 23..尾 的每一行恰好被一个模块覆盖（不重不漏）。
#   B. 保真性：每个模块文件逐行等于原文件对应行号的内容（顺序一致）。
# 块地图默认 <仓库>/.cache/block-map.json；可用环境变量 ZHX_BLOCK_MAP
# 或第 2 个位置参数指定（须与 gen-modules.py 取同一份）。
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _blocks_common import build_regions, repo_path  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(BASE, 'src', 'ff14-glamour-zh.external.user.js')
ASSIGN = os.path.join(BASE, 'build', 'migrate', 'module-assign.json')
mod_root = repo_path(BASE, sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, '.cache', 'modules-v1'), '模块目录')
block_map_file = repo_path(BASE, sys.argv[2] if len(sys.argv) > 2
                  else os.environ.get('ZHX_BLOCK_MAP') or os.path.join(BASE, '.cache', 'block-map.json'), '块地图')

blocks = json.load(open(block_map_file, encoding='utf-8'))
assign = json.load(open(ASSIGN, encoding='utf-8'))
src_lines = open(SRC, encoding='utf-8').read().split('\n')

# 块区间（与 gen-modules.py 共用实现：行尾容器剔除 + 注释带归属）
regions, end_limit = build_regions(blocks, src_lines)

# A. 完整性
cover = {}
dup = []
for mod, idxs in assign.items():
    if mod.startswith('comment'):
        continue
    for i in idxs:
        s, e = regions[i]
        if not (isinstance(s, int) and isinstance(e, int) and 23 <= s <= e <= end_limit):
            sys.exit(f'块区间异常（{mod} #{i}：{s}..{e}）')
        for ln in range(s, e + 1):
            if ln in cover:
                dup.append((ln, cover[ln], mod))
            cover[ln] = mod
missing = [ln for ln in range(23, end_limit + 1) if ln not in cover]
print(f'A1 覆盖行数: {len(cover)} / 应覆盖 {end_limit - 22}')
print(f'A2 重复覆盖: {len(dup)} 行' + (f' 例: {dup[:5]}' if dup else ''))
print(f'A3 遗漏行: {len(missing)} 行' + (f' 例: {missing[:10]}' if missing else ''))

# B. 保真
fails = 0
checked = 0
for mod, idxs in assign.items():
    if mod.startswith('comment'):
        continue
    path = os.path.join(mod_root, mod + '.js')
    if not os.path.exists(path):
        print(f'B!! 缺少模块文件: {path}')
        fails += 1
        continue
    mod_lines = open(path, encoding='utf-8').read().split('\n')
    expect = []
    for i in idxs:
        s, e = regions[i]
        expect.extend(src_lines[s - 1:e])
    got = mod_lines[:-1] if mod_lines and mod_lines[-1] == '' else mod_lines
    checked += 1
    if got != expect:
        fails += 1
        # 找第一处差异
        for j in range(max(len(got), len(expect))):
            g = got[j] if j < len(got) else '<EOF>'
            x = expect[j] if j < len(expect) else '<EOF>'
            if g != x:
                print(f'B!! {mod}: 第 {j+1} 行不一致')
                print(f'    期望: {x[:100]}')
                print(f'    实际: {g[:100]}')
                break
    else:
        continue

print(f'B 保真: {checked - fails}/{checked} 模块逐行一致' + ('  ✓ 全部通过' if fails == 0 else ''))
sys.exit(0 if (not dup and not missing and fails == 0) else 1)
