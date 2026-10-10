#!/usr/bin/env python3
"""Audit EC Gearsets coverage opportunities in the existing official item TSV.

Read-only source analyzer: never invent EC /gearset URLs. Run:
    python3 tools/audit-ec-gearsets.py --report docs/ec-gearsets-coverage-report.md
"""
import argparse
from collections import defaultdict
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = re.compile(r"^(.+?) (Attire|Armor|Set|Outfit|Uniform|Costume|Gear)(?: (\([^()]+\)|\[[^\[\]]+\]))?$")
ROLE = re.compile(r"^(.+?) of (Fending|Maiming|Striking|Scouting|Aiming|Casting|Healing|Crafting|Gathering)$")
OFFICIAL_END = re.compile(r"(?:套装|装束)$")


def official_rows(path):
    rows = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        p = line.split("\t")
        if len(p) < 3:
            continue
        zh, en = p[1:3]
        if en and zh and en not in rows:
            rows[en] = zh
    return rows


def sample(rows, count=20):
    return "\n".join(f"- `{en}` → {zh}" for en, zh in rows[:count]) or "- 无"


def report(rows):
    packages = []
    groups = defaultdict(list)
    rejected = []
    suffixes = defaultdict(list)
    for en, zh in rows.items():
        match = PACKAGE.fullmatch(en)
        if not match:
            continue
        base, kind, variant = match.groups()
        suffixes[kind].append((en, zh))
        if not OFFICIAL_END.search(zh):
            rejected.append((en, zh))
            continue
        packages.append((en, zh))
        groups[base].append((en, zh, kind, variant))
    paired = {key: v for key, v in groups.items() if sum(bool(p[3]) for p in v) >= 2}
    single_variant = [(en, zh) for group in groups.values() for en, zh, _, variant in group
                      if variant and len([p for p in group if p[3]]) == 1]
    standalone = [(en, zh) for group in groups.values() for en, zh, _, variant in group
                  if not variant]
    role_items = [(en, zh) for en, zh in rows.items() if ROLE.fullmatch(en)]
    item_traces = [
        (en, zh) for en, zh in rows.items()
        if not PACKAGE.fullmatch(en) and not ROLE.fullmatch(en)
        and any(en.startswith(base + " ") for base in list(groups)[:400])
    ]
    lines = [
        "# EC Gearsets 命名结构数据覆盖审计",
        "",
        "该报告由 `data/ff14-items.tsv` 自动统计，**只是国服物品数据，不代表 EC 实际存在所有对应套装**。",
        "最终页面存在性应根据 EC 官方页面或其真实链接另行核验。",
        "",
        "## 规模与风险",
        "",
        f"- 国服装备英中对照记录：{len(rows):,}",
        f"- 生产／战斗职能 `of Role` 装备条目：{len(role_items):,}",
        f"- 英文套装包命名（所有物品）：{sum(len(x) for x in suffixes.values()):,}",
        f"- 其中中文译名以「套装」「装束」结尾：{len(packages):,}",
        f"- 同一英文系列含 ≥2 个括号变体：{len(paired):,} 个系列",
        f"- 只有一个括号变体的正式套装物品：{len(single_variant):,}",
        f"- 不带括号变体的正式套装物品：{len(standalone):,}",
        f"- 套装包英文后缀命中但中文不以「套装」「装束」结尾：{len(rejected):,}",
        "",
        "## 按英文包类型分类",
        "",
        "| 英文类型 | 物品条数 |", "| --- | ---: |",
    ]
    lines += [f"| {kind} | {len(values):,} |" for kind, values in sorted(suffixes.items())]
    lines += [
        "",
        "## 单变体（当前搜索规则未涵盖的候选）",
        "", sample(single_variant, 35),
        "",
        "## 单套装包（当前搜索规则未涵盖的候选）",
        "", sample(standalone, 55),
        "",
        "## 包物品已存在，但中文标题不以「套装／装束」结尾",
        "", sample(rejected, 45),
        "",
        "## 多变体系列示例",
        "",
    ]
    for base, variants in list(sorted(paired.items()))[:40]:
        lines.append(f"- **{base}**: " + "; ".join(f"{v[0]} → {v[1]}" for v in variants[:4]))
    lines += [
        "",
        "## 风险控制建议",
        "",
        "- 索引候选来自已有国服物品库；不能据此构造未经验证的 EC 详情页 URL。",
        "- 区分「套装中文译名覆盖」「搜索关键词转换」「EC 实际存在性」三个独立指标。",
        "- 单套装包不能被 ≥2 括号款式算法涵盖，应通过确切物品对应或实页证据进入检索。",
        "- 含特别款式、不规则标题、套装包名称与页面标题不同的套装需测试回归。",
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    rows = official_rows(ROOT / "data" / "ff14-items.tsv")
    out = args.report if args.report.is_absolute() else ROOT / args.report
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report(rows), encoding="utf-8")
    print(f"Generated {out} ({len(rows):,} official rows)")


if __name__ == "__main__":
    main()
