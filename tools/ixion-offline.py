#!/usr/bin/env python3
"""Export the strings-v2 upstream game text for offline semantic review.

Keep raw multilingual values and row IDs; an Item value can contain several
fields (name, plural form, description, etc.), not just the display name.
An exact line match is supporting evidence, never proof of a fan-site set's
identity. This tool does not update production dictionaries or clear flags.
"""
import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

LANGUAGES = ("chs", "en", "ja")
SHEETS = {
    "Item", "ClassJob", "ContentFinderCondition", "TerritoryType",
    "PlaceName", "EquipSlotCategory", "ItemUICategory", "BNpcName",
    "ENpcResident",
}


def export(archive, output):
    counts = Counter()
    items = {}
    seen = set()
    with ZipFile(archive) as source, (output / "ixion-strings.jsonl").open(
        "w", encoding="utf-8"
    ) as target:
        for member in source.infolist():
            if member.is_dir() or not member.filename.lower().endswith(".json"):
                continue
            with source.open(member) as stream:
                rows = json.load(stream)
            if not isinstance(rows, list):
                continue
            for row in rows:
                if not isinstance(row, dict) or row.get("sheet") not in SHEETS:
                    continue
                sheet, row_id = row["sheet"], str(row["rowId"])
                values = {
                    lang: row["values"][lang]
                    for lang in LANGUAGES
                    if isinstance(row["values"].get(lang), str)
                }
                if (sheet, row_id) in seen:
                    raise ValueError(f"Duplicate upstream row: {sheet}:{row_id}")
                seen.add((sheet, row_id))
                target.write(json.dumps(
                    {"sheet": sheet, "rowId": row_id, "values": values},
                    ensure_ascii=False,
                ) + "\n")
                counts[sheet] += 1
                if sheet == "Item":
                    items[row_id] = {
                        lang: set(value.splitlines())
                        for lang, value in values.items()
                    }
    if not items:
        raise ValueError("No Item rows extracted; check ixion archive schema")
    return counts, items


def compare_names(source, items):
    counts = Counter()
    review = []
    with source.open(encoding="utf-8-sig", newline="") as stream:
        rows = csv.reader(stream, delimiter="\t", quoting=csv.QUOTE_NONE)
        next(rows)
        for fields in rows:
            if not fields:
                continue
            if len(fields) != 9:
                raise ValueError("Unexpected ff14-items.tsv row layout")
            row_id, zh, en, ja = fields[:4]
            names = dict(zip(LANGUAGES, (zh, en, ja)))
            counts["repositoryRows"] += 1
            if row_id not in items:
                counts["missingUpstreamId"] += 1
                review.append({"rowId": row_id, "names": names, "status": "missing-id"})
                continue
            counts["matchedUpstreamId"] += 1
            absent = [
                lang for lang, name in names.items()
                if name and name not in items[row_id].get(lang, set())
            ]
            if absent:
                counts["namesNeedReview"] += 1
                review.append({
                    "rowId": row_id, "names": names,
                    "status": "name-not-found-as-exact-line", "languages": absent,
                })
            else:
                counts["allPresentNamesFound"] += 1
    if not counts["matchedUpstreamId"]:
        raise ValueError("No common Item IDs; refusing an empty comparison")
    return counts, review


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--source", type=Path, default=Path("data/source/ff14-items.tsv"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with args.archive.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    counts, items = export(args.archive, args.output)
    comparison, review = compare_names(args.source, items)
    manifest = {
        "upstream": "thewakingsands/ixion",
        "archiveSha256": digest,
        "sheets": dict(sorted(counts.items())),
        "languages": LANGUAGES,
        "comparison": dict(comparison),
        "note": "Raw text line matches are evidence, not equipment-set identity.",
    }
    (args.output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (args.output / "item-name-review.json").write_text(
        json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
