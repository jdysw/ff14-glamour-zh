#!/usr/bin/env python3
"""First bounded EC catalogue batch. Inventory is not proof of full coverage.

Only follow visible, same-origin native catalogue links. Test ordinary
read-only GET navigation in a single browser session. Stop on denial, and
never submit account forms, follow player links, or guess detail URLs.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import parse_qsl, urlsplit

from playwright.sync_api import TimeoutError as PlaywrightTimeout

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = "https://ffxiv.eorzeacollection.com"
MANIFEST = ROOT / "tests/.cache/ec-catalog-manifest.json"
LISTS = {
    "/gearsets": "gearset", "/accessories": "accessories",
    "/facewear": "facewear", "/fashion-accessories": "fashion-accessory",
}
LIST_PATHS = set(LISTS) | {"/glamours"}
DETAIL_RE = re.compile(r"^/(gearset|accessories|facewear|fashion-accessory)/[a-z0-9-]{1,120}/?$")
MAX_DOCUMENTS = 12
MAX_SECONDS = 240

# All exported filter identifiers are structural names, never typed values.
# Capture native page bounds and link destinations, not player titles.
INVENTORY_JS = r"""(() => {
  const form=document.querySelector('#filter_form');
  const nav=document.querySelector('nav.pagination');
  const number=t=>/^\s*\d+\s*$/.test(t||'')?Number(t):null;
  const current=nav?.querySelector('.pagination-link.is-current');
  const nums=nav?[...nav.querySelectorAll('.pagination-link')].map(e=>number(e.textContent)).filter(n=>n!==null):[];
  const heading=document.querySelector('.l-section-pagination-title')?.textContent||'';
  const modern=heading.match(/Page\s+(\d+)\s+of\s+(\d+)/i)||heading.match(/第\s*(\d+)\s*页\s*\/\s*共\s*(\d+)\s*页/);
  const active=document.querySelector('.l-section-pagination-page-active');
  const links=(root,selector)=>[...(root?.querySelectorAll(selector)||[])].map(a=>a.href).filter(Boolean);
  const ids=el=>/^[A-Za-z][A-Za-z0-9_-]{0,70}$/.test(el.id||'')?el.id:null;
  const names=el=>/^[A-Za-z][A-Za-z0-9_-]{0,70}(?:\[\])?$/.test(el.name||'')?el.name:null;
  const controls=[...(form?.querySelectorAll('select,input:not([type=hidden]):not([type=password]):not([type=file])')||[])].map((el,index)=>({
    index,id:ids(el),name:names(el),type:el.tagName==='SELECT'?'select':el.type,
    optionCount:el.tagName==='SELECT'?el.options.length:null,
    selectedIndex:el.tagName==='SELECT'?el.selectedIndex:null,
    enabled:!el.disabled,visible:el.getClientRects().length>0
  }));
  return {
    pagination:{current:modern?Number(modern[1]):number(current?.textContent)||number(active?.textContent),
      total:modern?Number(modern[2]):nums.length?Math.max(...nums):null,
      hasNext:!!nav?.querySelector('.pagination-next:not(.is-disabled)')||!!active?.nextElementSibling,
      links:links(nav,'a.pagination-link[href],a.pagination-next[href]')},
    detailLinks:links(form||document,'a[href]'),
    controls,
    formMethod:form?.method||null,
    headingCount:document.querySelectorAll('h1').length
  };
})()"""


def public_route(url):
    p = urlsplit(url)
    if p.scheme != "https" or p.netloc != "ffxiv.eorzeacollection.com":
        return None
    path = p.path.rstrip("/") or "/"
    if path in LIST_PATHS:
        return path
    return path if DETAIL_RE.fullmatch(path) and not p.query else None


def permitted(url, parser, agent):
    return bool(public_route(url) and parser.can_fetch(agent, url)
                and parser.can_fetch("*", url))


def detail_urls(inventory, list_url):
    kind = LISTS.get(public_route(list_url))
    result = []
    if not kind:
        return result
    for url in inventory.get("detailLinks", []):
        route = public_route(url)
        if route and DETAIL_RE.fullmatch(route) and route.split("/")[1] == kind:
            canonical = ORIGIN + route
            if canonical not in result:
                result.append(canonical)
    return result


def clean_inventory(inventory, url):
    """Allowlist only public game catalogue routes, numeric pages and controls."""
    if not inventory:
        return {}
    raw = inventory.get("pagination", {})
    links = []
    for link in raw.get("links", []):
        route = public_route(link)
        query = parse_qsl(urlsplit(link).query, keep_blank_values=True)
        if route == public_route(url) and query and all(
            k == "page" and re.fullmatch(r"[1-9]\d{0,5}", v) for k, v in query
        ):
            if link not in links:
                links.append(link)
    pagination = {key: raw.get(key) for key in ("current", "total", "hasNext")}
    pagination["observedPageLinks"] = links
    return {"pagination": pagination, "details": detail_urls(inventory, url),
            "controls": inventory.get("controls", []), "formMethod": inventory.get("formMethod"),
            "headingCount": inventory.get("headingCount")}


def status_denied(row):
    error = str(row.get("error") or "").lower()
    return row.get("httpStatus") in (401, 403, 429) or "waf" in error or "challenge" in error


def install_read_only_guard(page, parser, agent, route_path):
    # Check the actual navigated URL, including the site's filter parameters.
    # Avoid arbitrary POST / account actions; do not circumvent a refusal.
    def guard(route):
        request = route.request
        try:
            first_party = urlsplit(request.url).netloc == "ffxiv.eorzeacollection.com"
            main_doc = request.is_navigation_request() and request.frame == page.main_frame
            if main_doc:
                if request.method != "GET" or public_route(request.url) != route_path or not permitted(request.url, parser, agent):
                    route.abort()
                    return
            elif first_party and request.method not in ("GET", "HEAD"):
                route.abort()
                return
            route.continue_()
        except Exception:
            route.abort()
    page.route("**/*", guard)


def next_page(page, route_path):
    if route_path == "/glamours":
        selector = ".l-section-pagination-page-active + button.l-section-pagination-page"
    else:
        selector = "nav.pagination a.pagination-next:not(.is-disabled)"
    locator = page.locator(selector)
    if not locator.count() or not locator.first.is_visible():
        return None
    with page.expect_navigation(wait_until="domcontentloaded", timeout=20000) as navigation:
        locator.first.click(timeout=5000)
    return navigation.value


def select_piece(page):
    form = page.locator("form#filter_form")
    select = page.locator("form#filter_form select#piece")
    if not form.count() or form.evaluate("(f)=>f.method") != "get" or not select.count() or not select.first.is_visible():
        return None, None
    index = select.evaluate("(el)=>[...el.options].findIndex((o,i)=>i!==el.selectedIndex&&!o.disabled)")
    if index < 0:
        return None, None
    before = select.evaluate("(el)=>el.selectedIndex")
    try:
        with page.expect_navigation(wait_until="domcontentloaded", timeout=5000) as navigation:
            select.select_option(index=index, timeout=5000)
        return navigation.value, {"control": "piece", "fromIndex": before, "requestedIndex": index}
    except PlaywrightTimeout:
        # Native select did not submit. Use only the verified GET filter form.
        if select.count() and select.evaluate("(el)=>el.selectedIndex") == index:
            button = page.locator("form#filter_form button#save")
            if button.count() and button.is_visible() and form.evaluate("(f)=>f.method") == "get":
                with page.expect_navigation(wait_until="domcontentloaded", timeout=15000) as navigation:
                    button.click(timeout=5000)
                return navigation.value, {"control": "piece", "fromIndex": before, "requestedIndex": index}
        return None, {"control": "piece", "fromIndex": before, "requestedIndex": index}


def run_batch(context, scripts, dist, cloud, parser, agent, delay, scan, save):
    scripts = {**scripts, "catalog_inventory": INVENTORY_JS}
    started = time.monotonic()
    visited = []
    discovered = {}
    summaries = {}
    interactions = []
    denied = False
    documents = 0

    def budget():
        return not denied and documents < MAX_DOCUMENTS and time.monotonic() - started < MAX_SECONDS

    def record(row, cfg):
        nonlocal denied
        before = clean_inventory(row.pop("inventoryBefore", None), cfg["url"])
        after = clean_inventory(row.pop("inventoryAfter", None), cfg["url"])
        # JSON evidence for every completed/failed attempt remains separate
        # from the manifest. State identifiers cannot hide a failed scan.
        save(row)
        key = cfg["id"]
        visited.append({"id": key, "url": cfg["url"], "status": row["status"],
                        "httpStatus": row.get("httpStatus", 0), "error": row.get("error"),
                        "before": row.get("beforeCount", 0), "after": len(row.get("items", [])),
                        "inventory": before, "translatedInventory": after})
        for url in before.get("details", []):
            discovered.setdefault(url, key)
        if key in ("gearsets", "accessories", "facewear", "fashion-accessories", "glamours"):
            summaries[key] = before.get("pagination", {})
        denied = status_denied(row)
        print("EC", key, "HTTP", row.get("httpStatus", 0), row["status"],
              "baseline", row.get("beforeCount", 0), "after", len(row.get("items", [])),
              "reason", row.get("error"), flush=True)
        write_manifest()

    def write_manifest():
        done = {row["url"] for row in visited if row["status"] == "ok"}
        pending = [{"url": url, "discoveredOn": source} for url, source in discovered.items() if url not in done]
        data = {
            "revision": os.environ.get("ZHX_AUDIT_SHA", ""), "status": "partial",
            "documentBudget": MAX_DOCUMENTS, "documentAttempts": documents,
            "cataloguePagination": summaries, "visited": visited, "interactions": interactions,
            "discoveredDetailCount": len(discovered), "pendingDetails": pending,
            "stoppedOnAccessDenial": denied,
            "scope": "bounded first batch; all pagination, details and filter combinations not certified"
        }
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def new_scan(cfg):
        nonlocal documents
        if not budget() or not permitted(cfg["url"], parser, agent):
            return None
        time.sleep(delay)
        page = context.new_page()
        documents += 1
        row = scan(page, cfg, scripts, dist, cloud)
        record(row, cfg)
        return page

    def interact(page, seed, action):
        nonlocal documents, denied
        if not budget() or not page:
            return
        route_path = public_route(seed["url"])
        cfg = {"id": seed["id"] + "-" + action, "url": seed["url"]}
        state = {"id": cfg["id"], "kind": action, "status": "not-verified"}
        try:
            install_read_only_guard(page, parser, agent, route_path)
            time.sleep(delay)
            documents += 1
            if action == "next-page":
                response = next_page(page, route_path)
            else:
                response, selected = select_piece(page)
                state["selection"] = selected
            if not response:
                state["reason"] = "no verified native navigation"
                return
            status = response.status
            state["httpStatus"] = status
            if status in (401, 403, 429):
                denied = True
                state["reason"] = "access refused"
                return
            row = scan(page, cfg, scripts, dist, cloud, loaded_status=status)
            inventory = row.get("inventoryBefore", {})
            if action == "next-page":
                current = inventory.get("pagination", {}).get("current")
                state["observedPage"] = current
                state["status"] = "verified" if row["status"] == "ok" and current == 2 else "not-verified"
            else:
                selected = state.get("selection") or {}
                values = [c.get("selectedIndex") for c in inventory.get("controls", []) if c.get("id") == "piece"]
                state["status"] = "verified" if row["status"] == "ok" and values == [selected.get("requestedIndex")] else "not-verified"
            record(row, cfg)
        except Exception as error:
            state["reason"] = type(error).__name__
        finally:
            interactions.append(state)
            write_manifest()
            print("EC interaction", state["id"], state["status"], flush=True)

    try:
        # Discover every catalogue's first page, even if a template lacks
        # pagination. Do not infer a one-page catalogue from absent controls.
        for seed in scripts["pages"]:
            page = new_scan(seed)
            if not page:
                continue
            try:
                if seed["id"] in ("gearsets", "glamours") and visited[-1]["status"] == "ok":
                    interact(page, seed, "next-page")
            finally:
                page.close()
            if denied:
                break
        # One native detail per catalogue in the initial batch. All other
        # observed links are preserved for a future explicitly authorized batch.
        for kind in LISTS.values():
            target = next((url for url in discovered if urlsplit(url).path.split("/")[1] == kind), None)
            if target and budget():
                slug = urlsplit(target).path.rsplit("/", 1)[-1]
                page = new_scan({"id": kind + "-" + slug, "url": target})
                if page:
                    page.close()
        # Test an actual translated filter control rather than synthesizing
        # a query URL. A fresh document is required for baseline pairing.
        if budget() and documents + 2 <= MAX_DOCUMENTS:
            seed = {"id": "gearsets-filter-baseline", "url": ORIGIN + "/gearsets"}
            page = new_scan(seed)
            if page:
                try:
                    if visited[-1]["status"] == "ok":
                        interact(page, seed, "select-piece")
                finally:
                    page.close()
    finally:
        write_manifest()
    print("EC catalogue batch documents:", documents, "detail links:", len(discovered),
          "verified interactions:", sum(s["status"] == "verified" for s in interactions), flush=True)
    # A partial batch is diagnostic, not an assertion that every requested
    # state or page is complete; fail on refusal or absence of any valid pages.
    return not denied and any(row["status"] == "ok" for row in visited)
