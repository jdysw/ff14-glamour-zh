#!/usr/bin/env python3
# build/validate-data.py — 数据与词典文件结构校验（v1.4 Phase 17；CI / 提交前复查）
#
# 只做结构完整性检查（不评判内容 / 翻译质量），失败即非零退出：
#   data/ff14-items.tsv   表头 9 列、逐行列数一致、键非空、行数合理
#   data/ff14-series.txt  行数合理、逐行含 | 分隔
#   data/acl-cfc.txt      行数合理、逐行含 | 分隔
#   dict/dict-*.json×6    可解析、kind=kv、entries 为「字符串 → 字符串」
# 用法：python3 build/validate-data.py
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_COLS = ["key", "zh", "en", "ja", "ko", "hash", "ecid", "alias", "glam"]
ITEMS_MIN_ROWS = 10000
SERIES_MIN_LINES = 100
ACL_MIN_LINES = 10
MAX_DETAILS = 5

errors: list = []


def detail(items: list) -> str:
    head = [str(x) for x in items[:MAX_DETAILS]]
    suffix = f"（共 {len(items)} 处；仅列前 {len(head)}）" if len(items) > len(head) else ""
    return "；".join(head) + suffix


def read_text(rel: str):
    p = ROOT / rel
    if not p.exists():
        errors.append(f"缺文件：{rel}")
        return None
    try:
        return p.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        errors.append(f"{rel} 不是合法 UTF-8：{exc}")
        return None


def check_items() -> int:
    """校验物品总表；返回数据行数（失败路径记入 errors）"""
    text = read_text("data/ff14-items.tsv")
    if text is None:
        return 0
    lines = text.splitlines()
    if not lines:
        errors.append("data/ff14-items.tsv 为空")
        return 0
    header = lines[0].split("\t")
    if header != ITEMS_COLS:
        errors.append(f"items 表头不符：{header!r}")
        return 0
    bad_cols, bad_key = [], []
    for i, line in enumerate(lines[1:], start=2):
        cols = line.split("\t")
        if len(cols) != len(ITEMS_COLS):
            bad_cols.append(f"L{i}（{len(cols)} 列）")
        elif not cols[0]:
            bad_key.append(f"L{i}")
    if bad_cols:
        errors.append(f"items 列数异常 {len(bad_cols)} 处：{detail(bad_cols)}")
    if bad_key:
        errors.append(f"items 空键 {len(bad_key)} 处：{detail(bad_key)}")
    n = len(lines) - 1
    if n < ITEMS_MIN_ROWS:
        errors.append(f"items 行数异常偏低：{n} < {ITEMS_MIN_ROWS}")
    return n


def check_pairs(rel: str, min_lines: int) -> int:
    """校验「原文|译文」成对文本文件；返回有效行数"""
    text = read_text(rel)
    if text is None:
        return 0
    lines = [ln for ln in text.splitlines() if ln.strip()]
    n = len(lines)
    if n < min_lines:
        errors.append(f"{rel} 行数异常偏低：{n} < {min_lines}")
    bad = [ln[:40] for ln in lines if "|" not in ln]
    if bad:
        errors.append(f"{rel} 含 {len(bad)} 行缺少 | 分隔：{detail(bad)}")
    return n


def check_dicts() -> int:
    """校验 dict/dict-*.json；返回总条目数"""
    files = sorted((ROOT / "dict").glob("dict-*.json"))
    if len(files) != 6:
        errors.append(f"dict/dict-*.json 应为 6 个，实际 {len(files)}：{[f.name for f in files]}")
    total = 0
    for f in files:
        rel = f.relative_to(ROOT).as_posix()
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            errors.append(f"{rel} 解析失败：{exc}")
            continue
        if not isinstance(data, dict) or data.get("kind") != "kv":
            kind = data.get("kind") if isinstance(data, dict) else type(data).__name__
            errors.append(f"{rel} kind 应为 kv：{kind!r}")
            continue
        entries = data.get("entries")
        if not isinstance(entries, dict) or not entries:
            errors.append(f"{rel} entries 应为非空对象")
            continue
        bad = [k for k, v in entries.items() if not isinstance(v, str)]
        if bad:
            errors.append(f"{rel} 含 {len(bad)} 个非字符串译文：{detail(bad)}")
        total += len(entries)
    return total


def main() -> int:
    items = check_items()
    series = check_pairs("data/ff14-series.txt", SERIES_MIN_LINES)
    acl = check_pairs("data/acl-cfc.txt", ACL_MIN_LINES)
    dicts = check_dicts()
    if errors:
        print("✗ 数据校验失败：")
        for e in errors:
            print("  -", e)
        return 1
    print(f"✓ 数据校验通过：items {items} 行 · series {series} 行 · acl {acl} 行 · dict {dicts} 条")
    return 0


if __name__ == "__main__":
    sys.exit(main())
