#!/usr/bin/env python3
"""Bounded, read-only EC public-page localization check.

Use a single ordinary Browser Use session, without optional proxy or captcha
solving. Require readable robots rules, honor refusals and crawl intervals,
never log raw browser endpoint, secret, player text, or exceptions.
"""
import datetime
import importlib.util
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = "https://ffxiv.eorzeacollection.com"
RAW = ROOT / "tests/.cache/ec-cloud-raw"


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def save(row):
    RAW.mkdir(parents=True, exist_ok=True)
    row["scannedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (RAW / ("ec-" + row["pageId"] + "-cloud.json")).write_text(
        json.dumps(row, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def allowed_origin(url):
    parsed = urlsplit(url)
    return parsed.scheme == "https" and parsed.netloc == "ffxiv.eorzeacollection.com"


def read_rules(page, pages):
    response = page.goto(ORIGIN + "/robots.txt", wait_until="domcontentloaded", timeout=20000)
    status = response.status if response else 0
    print("EC robots.txt HTTP status:", status, flush=True)
    if status != 200 or not allowed_origin(page.url) or urlsplit(page.url).path != "/robots.txt":
        raise RuntimeError("Site access rules unavailable; stop")
    body = response.text()
    if len(body) > 512000 or not re.search(r"(?im)^\s*user-agent\s*:", body):
        raise RuntimeError("Unrecognized robots document; stop")
    parser = RobotFileParser()
    parser.parse(body.splitlines())
    agent = page.evaluate("navigator.userAgent")
    if any(not parser.can_fetch(agent, row["url"]) or not parser.can_fetch("*", row["url"]) for row in pages):
        raise RuntimeError("Public seed path restricted by robots; stop")
    delay = max(2, parser.crawl_delay(agent) or 0, parser.crawl_delay("*") or 0)
    for rate in (parser.request_rate(agent), parser.request_rate("*")):
        if rate and rate.requests:
            delay = max(delay, rate.seconds / rate.requests)
    if delay > 10:
        raise RuntimeError("Required crawl interval exceeds smoke-test budget; stop")
    print("Public seed paths permitted by robots rules; no broad crawl requested", flush=True)
    return delay


def valid_document(page, status, cloud):
    if not allowed_origin(page.url):
        return "unexpected final host"
    identity = page.evaluate("({title:document.title,body:(document.body?.innerText||'').slice(0,5000)})")
    identity["httpStatus"] = status
    reason = cloud.non_content_page_reason(identity)
    if reason:
        return reason
    if not 200 <= status < 300:
        return "missing successful document response"
    if "eorzea collection" not in identity["title"].lower() or len(identity["body"]) < 50:
        return "unrecognized EC business page"
    return None


def scan(page, cfg, scripts, dist, cloud):
    url = cfg["url"]
    row = {"site": "ec", "pageId": cfg["id"], "url": url, "status": "failed",
           "items": [], "error": "not completed", "channel": "browser-use-cloud",
           "revision": os.environ.get("ZHX_AUDIT_SHA", "")}
    status = 0
    try:
        document_status = [0]

        def remember_response(response):
            if response.request.resource_type == "document" and response.frame == page.main_frame:
                document_status[0] = response.status

        page.on("response", remember_response)
        response = page.goto(url, wait_until="domcontentloaded", timeout=20000)
        status = response.status if response else 0
        document_status[0] = document_status[0] or status
        row["httpStatus"] = status
        reason = valid_document(page, status, cloud)
        if reason:
            row["error"] = reason
            return row
        page.wait_for_timeout(1000)
        before = page.evaluate(scripts["collector"])
        if not isinstance(before, list) or not before:
            row["error"] = "no baseline collector evidence"
            return row
        page.evaluate("(entries) => { window.__v3MemoryCache = new Map(Object.entries(entries)); }", scripts["entries"])
        page.evaluate(scripts["gm"])
        page.evaluate("window.__zhxDiagOn = true")
        page.evaluate("(function(){try{\n" + dist +
                      "\nwindow.__zhxAuditInjected = true;\n}catch(e){}})()")
        if not page.evaluate("window.__zhxAuditInjected === true"):
            row["error"] = "userscript execution not confirmed"
            return row
        page.wait_for_function(scripts["ready"], timeout=30000)
        page.wait_for_timeout(1500)
        reason = valid_document(page, document_status[0], cloud)
        if reason:
            row["error"] = "post-injection: " + reason
            return row
        after = page.evaluate(scripts["collector"])
        if not isinstance(after, list) or not after:
            row["error"] = "no translated collector evidence"
            return row
        row.update(status="ok", error=None, beforeCount=len(before),
                   httpStatus=document_status[0], items=cloud.pair_snapshots(before, after))
        return row
    except Exception as error:
        row["error"] = "scan stopped: " + type(error).__name__
        return row


def execute(cdp, scripts, dist, cloud):
    pages = scripts["pages"]
    fixed_seeds = {"/", "/glamours", "/gearsets", "/accessories", "/about"}
    if not 1 <= len(pages) <= len(fixed_seeds) or any(
        not allowed_origin(row["url"]) or urlsplit(row["url"]).path.rstrip("/") not in
        {path.rstrip("/") for path in fixed_seeds} or urlsplit(row["url"]).query
        for row in pages
    ):
        raise RuntimeError("Expected a bounded set of fixed public EC seeds")
    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(cdp, timeout=25000)
        try:
            context = browser.contexts[0]
            page = context.pages[0] if context.pages else context.new_page()
            try:
                delay = read_rules(page, pages)
            except Exception as error:
                print("EC rule check stopped: " + type(error).__name__, flush=True)
                save({"site": "ec", "pageId": pages[0]["id"], "url": pages[0]["url"],
                      "items": [], "status": "failed", "error": "robots policy unavailable or restrictive; no business page requested",
                      "channel": "browser-use-cloud", "revision": os.environ.get("ZHX_AUDIT_SHA", "")})
                return False
            completed = 0
            for cfg in pages:
                time.sleep(delay)
                page = context.new_page()
                try:
                    row = scan(page, cfg, scripts, dist, cloud)
                    save(row)
                    print("EC", cfg["id"], "HTTP", row.get("httpStatus", 0), row["status"],
                          "baseline", row.get("beforeCount", 0), "after", len(row["items"]),
                          "reason", row.get("error"), flush=True)
                    if row["status"] != "ok":
                        break
                    completed += 1
                finally:
                    page.close()
            print("EC valid seed pages:", completed, "/", len(pages), flush=True)
            return completed == len(pages)
        finally:
            browser.close()


def main():
    key = os.environ.pop("BROWSER_USE_API_KEY", None)
    if not key:
        raise SystemExit("Missing repository secret")
    provider = load_module("browser_use_probe", "browser-use-probe.py")
    cloud = load_module("cloud_audit", "cloud-audit.py")
    scripts = json.loads((ROOT / "tests/.cache/ec-cloud-inputs.json").read_text(encoding="utf-8"))
    dist = (ROOT / "dist/ff14-glamour-zh.greasyfork.user.js").read_text(encoding="utf-8")
    provider.api_request(key, "GET", "/api/v2/billing/account")
    session = provider.api_request(key, "POST", "/api/v4/browsers", {
        "proxyCountryCode": None, "timeout": 5, "enableRecording": False, "solveCaptchas": False,
    })
    browser_id = session.get("id", "")
    if not isinstance(browser_id, str) or not re.fullmatch(r"[0-9a-fA-F-]{36}", browser_id):
        raise RuntimeError("Invalid browser ID")
    try:
        cdp = provider.secure_cdp_endpoint(key, browser_id, session)
        return execute(cdp, scripts, dist, cloud)
    finally:
        provider.api_request(key, "PATCH", "/api/v4/browsers/" + browser_id, {"action": "stop"})
        print("Cloud browser stopped", flush=True)


if __name__ == "__main__":
    try:
        if not main():
            raise SystemExit(1)
    except Exception as error:
        print("EC check stopped: " + type(error).__name__, flush=True)
        raise SystemExit(1) from None
