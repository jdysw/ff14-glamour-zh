#!/usr/bin/env python3
"""根据游戏数据表重建 EC 鸟甲、面饰和四类饰品的智能搜索名单。

必须依据实际游戏数据表，不允许通过名称片段猜测分类：
  ItemAction Action=1013 -> chocobo barding, including Shaffron / Harness.
  Glasses.csv Style>=0 -> base facewear names from separate Glasses sheet.
  Chinese Glasses.csv uses the same numeric row key as English.

所需四份源 CSV 可从以下数据挖掘仓库获取：
  xivapi/ffxiv-datamining/csv/en/{Item.csv,ItemAction.csv,Glasses.csv}
  thewakingsands/ffxiv-datamining-cn/Glasses.csv

Run:
  python3 tools/update-ec-search-categories.py --item ... --actions ... --glasses-en ... --glasses-zh ...
添加 --check 可只校验当前快照，不修改文件。
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
    # 官方装备栏位：9=耳饰，10=项链，11=腕饰，12=戒指。
    # 使用官方原生名称，运行时与 V3 可幻化候选白名单取交集。
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


def compact_names(names):
    """对排序后的原生名称做前缀差分，减少随所有站点分发的分类常量体积。"""
    previous = ""
    encoded = []
    for native in names:
        if "\n" in native or "\r" in native:
            raise ValueError("装备名称含换行符，无法使用前缀差分编码")
        i = 0
        while i < min(len(previous), len(native)) and previous[i] == native[i]:
            i += 1
        # JavaScript 的 slice 按 UTF-16 码元计数，兼容补充平面字符。
        prefix = len(previous[:i].encode("utf-16-le")) // 2
        digits = "0123456789abcdefghijklmnopqrstuvwxyz"
        value = ""
        while True:
            value = digits[prefix % 36] + value
            prefix //= 36
            if prefix == 0:
                break
        encoded.append(value + ":" + native[i:])
        previous = native
    return "\n".join(encoded)


def render(bardings, faces, accessory_slots):
    """输出与原 Set 接口兼容的紧凑离线快照，不依赖远程 V3 数据。"""
    js = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    slot_js = ",".join(js(kind) + ":new Set(decodeEcNativeNames(" + js(compact_names(names)) + "))"
                       for kind, names in accessory_slots.items())
    return ("// EC 分类严格取自游戏数据表，不从名称模糊推断。\n"
            "// 鸟甲：Item.csv 的 ItemAction 对应 Action=1013，包含 Shaffron、Harness。\n"
            "// 面饰：Glasses.csv 按 Style 去重，再依据记录 ID 对应国服名称。\n"
            "// 饰品：Item.csv 的 EquipSlotCategory 为 9/10/11/12。\n"
            "// 面饰来自独立数据表，不能当作头部防具。\n"
            "// 相邻名称按共同前缀长度（36 进制）与剩余后缀储存，仅在加载时解码。\n"
            "function decodeEcNativeNames(packed) {\n"
            "  const out = [];\n"
            "  let previous = '';\n"
            "  for (const row of packed.split('\\n')) {\n"
            "    const separator = row.indexOf(':');\n"
            "    const prefix = Number.parseInt(row.slice(0, separator), 36);\n"
            "    const name = previous.slice(0, prefix) + row.slice(separator + 1);\n"
            "    out.push(name);\n"
            "    previous = name;\n"
            "  }\n"
            "  return out;\n"
            "}\n"
            + "const EC_BARDING_NATIVES = new Set(decodeEcNativeNames(" + js(compact_names(bardings)) + "));\n"
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
