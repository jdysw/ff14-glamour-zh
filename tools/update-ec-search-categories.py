#!/usr/bin/env python3
"""Regenerate EC's bird-barding, facewear and four accessory-slot smart-search lists.

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
    birdings = set()
    # Official EquipSlotCategory IDs: 9=ears, 10=neck, 11=wrists, 12=rings.
    # Use exact native names, intersected with V3 glam eligibility at runtime.
    slot_ids = {"9": "ears", "10": "neck", "11": "wrists", "12": "rings"}
    accessory_slots = {kind: set() for kind in slot_ids.values()}
    for row in csv_entries(item):
        native = row.get("Name", "")
        if not native:
            continue
        if row.get("ItemAction") in barding_actions:
            birdings.add(native)
        slot = slot_ids.get(row.get("EquipSlotCategory"))
        if slot:
            accessory_slots[slot].add(native)
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
    if len(birdings) < 90 or len(styles) < 50 or any(len(v) < 50 for v in accessory_slots.values()):
        raise ValueError("Source data incomplete: expected bardings, facewear, and four accessory slot groups")
    return (sorted(birdings, key=str.casefold),
            sorted(styles.values(), key=lambda r: r["native"].casefold()),
            {kind: sorted(names, key=str.casefold) for kind, names in accessory_slots.items()})


def render(bardings, faces, accessory_slots):
    js = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    slot_js = ",".join(js(kind) + ":new Set(" + js(names) + ")"
                       for kind, names in accessory_slots.items())
    return ("// EC specialty candidates are game-data classifications, never fuzzy name guesses.\n"
            "// Bird bardings: en/Item.csv -> ItemAction.csv Action=1013 (includes Shaffron/Harness).\n"
            "// Facewear: en/Glasses.csv Style unique -> CN/Glasses.csv same record ID.\n"
            "// Accessory slots: en/Item.csv EquipSlotCategory 9/10/11/12.\n"
            "// Facewear is an independent game sheet, NOT a subset of helmet equipment.\n"
            + "const EC_BARDING_NATIVES = new Set(" + js(bardings) + ");\n"
            + "const EC_FACEWEAR_ROWS = Object.freeze(" + js(faces) + ");\n"
            + "const EC_ACCESSORY_SLOT_NATIVES = Object.freeze({" + slot_js + "});\n")


def main():
    parser = argparse.ArgumentParser()
    for name in ("item", "actions", "glasses_en", "glasses_zh"):
        parser.add_argument("--" + name.replace("_", "-"), required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    bardings, faces, accessories = classify(args.item, args.actions, args.glasses_en, args.glasses_zh)
    old = SOURCE.read_text(encoding="utf-8")
    start = old.index(BEGIN) + len(BEGIN) + 1
    end = old.index(END, start)
    generated = render(bardings, faces, accessories)
    if args.check:
        if old[start:end] != generated:
            raise SystemExit("EC category snapshot is stale: regenerate without --check")
    else:
        SOURCE.write_text(old[:start] + generated + old[end:], encoding="utf-8")
    counts = ", ".join(f"{kind}={len(names)}" for kind, names in accessories.items())
    print(f"EC classifications: {len(bardings)} bardings, {len(faces)} facewear styles; {counts}.")


if __name__ == "__main__":
    main()
