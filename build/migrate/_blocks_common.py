#!/usr/bin/env python3
# _blocks_common.py —— gen-modules.py / verify-modules.py / reindex-assign.py 共用
# 说明: 块区间解析（行尾容器剔除 + 块起点前「注释带」归属）与仓库路径净化的唯一实现，
#       消除多份实现的漂移风险；被同目录工具 import（sys.path[0] = 脚本目录）。
import os


def repo_path(base, p, label):
    """仅接受仓库内路径（防路径穿越；CLI 参数/文件内容不可信）"""
    ap = os.path.realpath(p)
    if ap != base and not ap.startswith(base + os.sep):
        raise SystemExit(f'{label}越界（仅允许仓库内路径）: {p}')
    return ap


def end_limit_of(lines):
    """文件尾容器收尾（IIFE 的 `})();` 与尾部空行）→ 不进入任何模块的起始行界"""
    end_limit = len(lines)
    while end_limit > 1:
        s = lines[end_limit - 1].strip()
        if s == '' or s == '})();':
            end_limit -= 1
        else:
            break
    return end_limit


def _band_start(lines, start):
    """向上扫「连续注释/空行」带 → 带起点 g（1-indexed）"""
    i = start - 1
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
    return i + 1


def cut_point(lines, start):
    """块起点前的「注释带」归属：
    带内含 `@zhixia:*-end` 行 e → 从 e+1 起切给本块（段尾注释随上一段）；
    否则整带归本块（文档注释在声明上方）。"""
    gap_end = start - 1
    g = _band_start(lines, start)
    if g > gap_end:
        return start
    for j in range(gap_end, g - 1, -1):
        if '@zhixia:' in lines[j - 1] and '-end' in lines[j - 1]:
            return j + 1
    return g


def build_regions(blocks, lines):
    """全部块的 1-indexed 闭区间 {i: (s, e)}（含边界校验）"""
    end_limit = end_limit_of(lines)
    cuts = [cut_point(lines, b['start']) for b in blocks]
    regions = {}
    for i in range(len(blocks)):
        s = cuts[i]
        e = (cuts[i + 1] - 1) if i + 1 < len(blocks) else end_limit
        if not (isinstance(s, int) and isinstance(e, int) and 23 <= s <= e <= end_limit):
            raise SystemExit(f'块区间异常：#{i} [{s}, {e}]（块地图与源文件不匹配）')
        regions[i] = (s, e)
    return regions, end_limit
