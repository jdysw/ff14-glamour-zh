#!/usr/bin/env python3
"""Collect actual FC detail-page equipment labels and join offline Item evidence.

The catalogue replay is not a substitute for checking the contents of its
linked pages. This audit retains every source label and candidate Item ID.
It never rewrites production dictionaries or equates a prefix match with
manual semantic approval.
"""
import argparse
import hashlib
import json
import os
import re
import time
import unicodedata
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

ORIGIN = "https://ff14-fc.com"
USER_AGENT = "ff14-glamour-zh-audit/1.0 (+https://github.com/jdysw/ff14-glamour-zh)"
START = "装備部位クリックで切替"
ENDS = ("染色クリックで切替", "種族クリックで切替")
PATH = re.compile(r"/equipment/[^/?#]+/")
PLACEHOLDER = re.compile(r"[-ー―─－—–・\s]+")
SUFFIX = re.compile(r"(?:套装|装束|组合)$")


def normalized(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", value))


class DetailParser(HTMLParser):
    """Capture only the native slot selector, excluding recommendations."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.active = False
        self.closed_region = False
        self.ignored = None
        self.heading = None
        self.labels = []
        self.marker_tail = ""

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "template"):
            self.ignored = tag
        elif tag == "h3" and self.active and not self.closed_region:
            self.heading = []

    def handle_endtag(self, tag):
        if tag == self.ignored:
            self.ignored = None
        if tag == "h3" and self.heading is not None:
            label = "".join(self.heading).strip()
            self.labels.append(label)
            self.heading = None

    def handle_data(self, data):
        if self.ignored or self.closed_region:
            return
        self.marker_tail = (self.marker_tail + normalized(data))[-64:]
        if not self.active:
            if START in self.marker_tail:
                self.active = True
                self.marker_tail = ""
            return
        if any(marker in self.marker_tail for marker in ENDS):
            self.closed_region = True
            return
        if self.heading is not None:
            self.heading.append(data)

    def equipment_labels(self, expected):
        if not self.active or not self.closed_region:
            raise ValueError("Missing or incomplete native equipment selector")
        if not self.labels or normalized(self.labels[0]) != normalized(expected + "（全身）"):
            raise ValueError("Native full-body heading differs from catalogue identity")
        members = [label for label in self.labels[1:] if label and not PLACEHOLDER.fullmatch(label)]
        if not members:
            raise ValueError("No actual equipment member labels")
        return list(dict.fromkeys(members))


def load_items(source):
    by_ja = defaultdict(list)
    with source.open(encoding="utf-8-sig") as stream:
        next(stream)
        for line in stream:
            fields = line.rstrip("\r\n").split("\t")
            if len(fields) != 9 or not fields[0].isdigit():
                continue
            item_id, zh, en, ja = fields[:4]
            if ja and zh:
                by_ja[normalized(ja)].append({"id": item_id, "ja": ja, "zh": zh, "en": en})
    if not by_ja:
        raise ValueError("No official Item records")
    return by_ja


def compare_members(row, labels, by_ja):
    members = [{"native": label, "items": by_ja.get(normalized(label), [])} for label in labels]
    names = [set(item["zh"] for item in member["items"]) for member in members]
    name = row["translated"]["catalogueZh"]
    stem = SUFFIX.sub("", name)
    unique_names = [next(iter(values)) for values in names if len(values) == 1]
    translated_consistent = len(set(row["translated"].values())) == 1
    family_supported = (
        translated_consistent
        and stem != name
        and len(set(unique_names)) >= 2
        and len(unique_names) == len(names)
        and all(normalized(label).startswith(normalized(row["native"])) for label in labels)
        and os.path.commonprefix(unique_names) == stem
    )
    if any(not values for values in names):
        evidence = "member-name-missing"
    elif any(len(values) > 1 for values in names):
        evidence = "member-name-ambiguous"
    elif family_supported:
        evidence = "member-stem-supported"
    else:
        evidence = "member-names-found-review-group"
    return {
        "path": row["path"], "native": row["native"], "translated": name,
        "members": members, "evidence": evidence,
        "officialNameMatches": row.get("officialNameMatches", []),
        "catalogueIssues": row.get("issues", []),
    }


def open_html(url):
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urlopen(request, timeout=18) as response:
        if response.url != url or response.headers.get_content_type() != "text/html":
            raise ValueError("Unexpected detail response or redirect")
        data = response.read(8 * 1024 * 1024 + 1)
        if len(data) > 8 * 1024 * 1024:
            raise ValueError("Detail page exceeded evidence size limit")
        return data.decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def check_robots():
    url = ORIGIN + "/robots.txt"
    parser = RobotFileParser(url)
    try:
        with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=18) as response:
            parser.parse(response.read(256 * 1024).decode("utf-8", errors="replace").splitlines())
    except HTTPError as error:
        if error.code == 404:
            parser.parse(["User-agent: *", "Disallow:"])
        else:
            raise
    return parser


def inspect(row, by_ja, robots):
    url = ORIGIN + row["path"]
    if not robots.can_fetch(USER_AGENT, url):
        raise PermissionError("Excluded by robots.txt")
    parser = DetailParser()
    parser.feed(open_html(url))
    return compare_members(row, parser.equipment_labels(row["native"]), by_ja)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalogue", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--source", type=Path, default=Path("data/source/ff14-items.tsv"))
    args = parser.parse_args()
    report = json.loads(args.catalogue.read_text(encoding="utf-8"))
    rows = report["results"]
    if report["status"] != "complete" or len(rows) != report["expected"]:
        raise ValueError("A reconciled complete catalogue is required")
    if len({row["path"] for row in rows}) != len(rows) or any(
        not row["path"] or not PATH.fullmatch(row["path"]) for row in rows
    ):
        raise ValueError("Invalid or duplicate catalogue paths")
    args.output.mkdir(parents=True, exist_ok=True)
    # Prioritize unresolved identities, but include every catalogue page.
    rows.sort(key=lambda row: (
        not bool(row.get("issues")),
        "exact-item-name-difference" not in row.get("issues", [])
        and "ambiguous-official-item" not in row.get("issues", []),
        row.get("evidence", {}).get("type") != "none",
    ))
    by_ja = load_items(args.source)
    with args.source.open("rb") as source:
        source_sha = hashlib.file_digest(source, "sha256").hexdigest()
    counts = Counter()
    stopped = None
    attempted = 0
    failures = 0
    with (args.output / "detail-evidence.jsonl").open("w", encoding="utf-8") as out:
        try:
            robots = check_robots()
            interval = max(1.5, robots.crawl_delay(USER_AGENT) or robots.crawl_delay("*") or 0)
            request_rate = robots.request_rate(USER_AGENT) or robots.request_rate("*")
            if request_rate and request_rate.requests:
                interval = max(interval, request_rate.seconds / request_rate.requests)
            for row in rows:
                time.sleep(interval)
                attempted += 1
                try:
                    result = inspect(row, by_ja, robots)
                    failures = 0
                except (HTTPError, URLError, TimeoutError, PermissionError, ValueError) as error:
                    result = {"path": row["path"], "native": row["native"],
                              "evidence": "unverified", "error": str(error)}
                    failures += 1
                    if isinstance(error, HTTPError) and error.code in (403, 429):
                        stopped = "Server refused or rate-limited requests"
                    elif isinstance(error, PermissionError):
                        stopped = "Excluded by robots.txt"
                    elif failures >= 5:
                        stopped = "Five consecutive failures; refusing to continue"
                counts[result["evidence"]] += 1
                out.write(json.dumps(result, ensure_ascii=False) + "\n")
                out.flush()
                if attempted % 25 == 0 or stopped:
                    print(f"Detail evidence: {attempted}/{len(rows)} {dict(counts)}", flush=True)
                if stopped:
                    break
        except (HTTPError, URLError, TimeoutError) as error:
            stopped = "Unable to establish robots policy: " + str(error)
    summary = {
        "expected": len(rows), "attempted": attempted,
        "unattempted": len(rows) - attempted, "evidenceCounts": dict(counts),
        "officialSourceSha256": source_sha, "stopped": stopped,
        "collectionStatus": "complete" if attempted == len(rows) and not counts["unverified"] else "partial",
        "semanticStatus": "needs-review",
        "note": "Exact member names and shared stems support review; they do not prove every translated title or bundle identity.",
    }
    (args.output / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if summary["collectionStatus"] != "complete":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
