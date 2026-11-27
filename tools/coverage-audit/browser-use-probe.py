#!/usr/bin/env python3
"""Manually requested, bounded Browser Use connectivity check.

A provider check visits example.com only. An EC check requires the operator
to confirm site permission by selecting ec-authorized. No proxy, retries,
page collection, account data, credentials or CDP endpoint in the output.
"""
import http.client
import json
import os
import re
from urllib.parse import urlsplit

API_HOST = "api.browser-use.com"
TARGETS = {
    "provider": "https://example.com/",
    "ec-authorized": "https://ffxiv.eorzeacollection.com/",
}


def api_request(key, method, path, payload=None):
    connection = http.client.HTTPSConnection(API_HOST, timeout=20)
    try:
        connection.request(
            method, path,
            body=json.dumps(payload) if payload is not None else None,
            headers={"X-Browser-Use-API-Key": key, "Content-Type": "application/json"},
        )
        response = connection.getresponse()
        status = response.status
        raw = response.read(1024 * 1024)
        if not 200 <= status < 300:
            raise RuntimeError(f"Browser Use API returned HTTP {status}")
        return json.loads(raw) if raw else {}
    finally:
        connection.close()


def check_page(cdp_url, target):
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(cdp_url, timeout=25000)
        try:
            context = browser.contexts[0]
            page = context.pages[0] if context.pages else context.new_page()
            response = page.goto(target, wait_until="domcontentloaded", timeout=25000)
            status = response.status if response else 0
            same_host = urlsplit(page.url).hostname == urlsplit(target).hostname
            title = page.title().lower()
            blocked = any(marker in title for marker in (
                "just a moment", "access denied", "attention required", "blocked",
            ))
            print(f"Page HTTP status: {status}; expected host: {same_host}; denial title: {blocked}")
            if not (200 <= status < 300 and same_host and not blocked):
                raise RuntimeError("Page access not established")
            print("Browser navigation succeeded; localization itself has NOT been audited.")
        finally:
            browser.close()


def main():
    key = os.environ.get("BROWSER_USE_API_KEY")
    mode = os.environ.get("BROWSER_USE_PROBE_MODE")
    if not key or mode not in TARGETS:
        raise SystemExit("Configure the repository secret and select a probe mode")
    api_request(key, "GET", "/api/v2/billing/account")
    print("Browser Use API authentication succeeded")
    session = api_request(key, "POST", "/api/v4/browsers", {
        "proxyCountryCode": None,
        "timeout": 3,
        "enableRecording": False,
        "solveCaptchas": False,
    })
    browser_id = session.get("id", "")
    if not isinstance(browser_id, str) or not re.fullmatch(r"[0-9a-fA-F-]{36}", browser_id):
        raise SystemExit("Unexpected browser identifier; session will expire at its short timeout")
    try:
        cdp_url = session.get("cdpUrl")
        if not isinstance(cdp_url, str) or not cdp_url.startswith("wss://"):
            raise RuntimeError("Missing secure CDP endpoint")
        check_page(cdp_url, TARGETS[mode])
    finally:
        api_request(key, "PATCH", "/api/v4/browsers/" + browser_id, {"action": "stop"})
        print("Cloud browser stopped")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # SDK and transport errors may contain a session's private CDP URL.
        # Do not print the exception string or the response body.
        print("Probe failed: " + type(error).__name__)
        if type(error) is RuntimeError and str(error).startswith("Browser Use API returned HTTP "):
            print(str(error))
        raise SystemExit(1) from None
