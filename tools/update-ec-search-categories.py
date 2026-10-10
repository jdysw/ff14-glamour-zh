#!/usr/bin/env python3
"""Regenerate EC's independent bird-barding and facewear smart-search lists.

Use the *actual game sheets*, never substring guesses:
  ItemAction Action=1013 -> chocobo barding, including Shaffron / Harness.
  Glasses.csv Style>=0 -> base facewear names from separate Glasses sheet.
  Chinese Glasses.csv uses the same numeric row key as English.

The four source files may be downloaded from the FFXIV datamining upstream:
  xivapi/ffxiv-datamining/csv/en/{Item.csv,ItemAction.csv,Glasses.csv}
  thewakingsands/ffxiv-datamining-cn/Glasses.csv

Run:
  python3 tools/update-ec-search-categories.py --item ... --actions ... --glasses-en ... --glasses-zh ...
Add --check to verify the checked-in snapshot without modifying files.
"""
import argparse
import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/core/chinese-search.js"
BEGIN = "// BEGIN GENERATED EC SEARCH CATEGORIES — tools/update-ec-search-categories.py"
END = "// END GENERATED EC SEARCH CATEGORIES"


def csv_entries(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)


def classify(item, actions, glasses_en, glasses_zh):
    barding_actions = {row["#"] for row in csv_entries(actions)
                       if row.get("Action") == "1013"}
    birdings = {row["Name"] for row in csv_entries(item)
                if row.get("ItemAction") in barding_actions and row.get("Name")}
    zh_names = {row["key"]: row.get("13", "") for row in csv_entries(glasses_zh)
                if row.get("key", "").isdigit()}
    styles = {}
    for row in csv_entries(glasses_en):
        style = row.get("Style", "")
        if not style.isdigit() or not row.get("Name"):
            continue
        if style not in styles:
            zh = zh_names.get(row["#"], "")
            if zh:
                styles[style] = {"native": row["Name"], "zh": zh}
    if len(birdings) < 90 or len(styles) < 50:
        raise ValueError("Source data incomplete: expected >=90 bardings and >=50 facewear styles")
    return sorted(birdings, key=str.casefold), sorted(styles.values(), key=lambda r: r["native"].casefold())


def render(bardings, faces):
    js = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return ("// EC specialty candidates are game-data classifications, never fuzzy name guesses.\n"
            "// Bird bardings: en/Item.csv -> ItemAction.csv Action=1013 (includes Shaffron/Harness).\n"
            "// Facewear: en/Glasses.csv Style unique -> CN/Glasses.csv same record ID.\n"
            "// Facewear is an independent game sheet, NOT a subset of helmet equipment.\n"
            + "const EC_BARDING_NATIVES = new Set(" + js(bardings) + ");\n"
            + "const EC_FACEWEAR_ROWS = Object.freeze(" + js(faces) + ");\n")


def main():
    parser = argparse.ArgumentParser()
    for name in ("item", "actions", "glasses_en", "glasses_zh"):
        parser.add_argument("--" + name.replace("_", "-"), required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    bardings, faces = classify(args.item, args.actions, args.glasses_en, args.glasses_zh)
    old = SOURCE.read_text(encoding="utf-8")
    start = old.index(BEGIN) + len(BEGIN) + 1
    end = old.index(END, start)
    updated = old[:start] + render(bardings, faces) + old[end:]
    if args.check:
        match_b = re.search(r"const EC_BARDING_NATIVES = new Set\((\[.*\])\);", old)
        match_f = re.search(r"const EC_FACEWEAR_ROWS = Object.freeze\((\[.*\])\);", old)
        if not match_b or not match_f:
            raise SystemExit("Missing category lists in current source")
        actual_b = json.loads(match_b[1])
        actual_f = json.loads(match_f[1])
        if set(actual_b) != set(bardings) or sorted(actual_f, key=lambda x: x["native"]) != sorted(faces, key=lambda x: x["native"]):
            raise SystemExit("EC category snapshot is stale: regenerate without --check")
    else:
        SOURCE.write_text(updated, encoding="utf-8")
    print(f"EC classifications: {len(bardings)} bardings, {len(faces)} facewear styles.")


if __name__ == "__main__":
    main()
