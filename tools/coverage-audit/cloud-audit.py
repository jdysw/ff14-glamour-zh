#!/usr/bin/env python3
"""
cloud-audit.py — coverage-audit 云浏览器扫描执行器（mirapri/EC 等被 CF 拦的站）

用法:
  python3 tools/coverage-audit/cloud-audit.py --site mirapri [--countries jp,us] [--plan tests/.cache/coverage-audit/cloud-plan-mirapri.json] [--out tests/.cache/coverage-audit/]

流程:
  1. 读取 cloud-plan-<site>.json（run-scan.mjs --channel cloud 生成）
  2. 创建云浏览器（多国家代理重试）
  3. 逐页导航 → 注入 GM 桩 + dist → 等待数据流程 → 运行收集器（与本地同款 COLLECTOR_JS）
  4. 保存 JSON 结果到 out 目录

依赖:
  BROWSER_USE_API_KEY（~/.hermes/.env）
  browser_use_sdk（已装于 ~/.venvs/bu-cloud）
"""
import asyncio
import json
import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DIST = REPO_ROOT / "dist" / "ff14-glamour-zh.greasyfork.user.js"
CACHE = REPO_ROOT / "tests" / ".cache" / "coverage-audit"
DEFAULT_COUNTRIES = ["jp", "us", "sg"]

# The identical JS collector is used in local CDP and cloud Playwright.
# Node is already a project requirement (>=22). Avoid maintaining two
# inconsistent language detectors/DOM walkers.
import subprocess
import re
from urllib.parse import urlsplit, urlunsplit, urljoin, parse_qsl, urlencode

def browser_scripts():
    code = (
        "import { COLLECTOR_JS, LINKS_JS } from './tools/coverage-audit/coverage-collector.mjs';"
        "process.stdout.write(JSON.stringify({collector:COLLECTOR_JS,links:LINKS_JS}));"
    )
    process = subprocess.run(
        ["node", "--input-type=module", "-e", code], cwd=REPO_ROOT,
        capture_output=True, text=True, check=True, timeout=15,
    )
    scripts = json.loads(process.stdout)
    return scripts["collector"], scripts["links"]

COLLECTOR_JS, LINKS_JS = browser_scripts()

def pair_snapshots(before, after):
    source = {}
    for item in before:
        source.setdefault((item.get("kind"), item.get("path")), []).append(item.get("text"))
    result = []
    for item in after:
        values = source.get((item.get("kind"), item.get("path")), [])
        result.append({**item, "before": values.pop(0) if values else None})
    return result

def normalize_url(candidate, base, hosts):
    try:
        u = urlsplit(urljoin(base, candidate))
        if u.scheme not in ("https", "http") or not u.hostname:
            return None
        if not any(u.hostname == host or u.hostname.endswith("." + host) for host in hosts):
            return None
        if re.search(r"/(login|logout|signout|register|delete|remove|checkout|account|settings|admin|api)(/|$)", u.path, re.I):
            return None
        if re.search(r"\.(png|jpe?g|gif|svg|webp|css|js|xml|json|zip|pdf|woff2?|ico)$", u.path, re.I):
            return None
        query = urlencode(sorted((k, v) for k, v in parse_qsl(u.query) if not re.match(r"(utm_|fbclid$|gclid$|token|session)", k, re.I)))
        path = u.path.rstrip("/") + "/" if u.path and u.path != "/" else "/"
        return urlunsplit((u.scheme, u.netloc, path, query, ""))
    except (ValueError, TypeError):
        return None

def template_key(url):
    u = urlsplit(url)
    segments = []
    for part in u.path.split("/"):
        if not part:
            continue
        if part.isdigit() or re.fullmatch(r"[0-9a-f]{20,}", part, re.I):
            part = ":id"
        segments.append(part)
    return u.netloc + "/" + "/".join(segments[:3])

GM_STUB = r"""(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.__reqLog = [];
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) { window.__setFail = (window.__setFail || 0) + 1; } };
  window.GM_xmlhttpRequest = (opt) => {
    window.__reqLog.push(opt.url);
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})()"""


def _key():
    k = os.environ.get("BROWSER_USE_API_KEY")
    if k:
        return k
    for p in (Path.home() / ".hermes" / ".env",):
        try:
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("BROWSER_USE_API_KEY="):
                    return line.split("=", 1)[1].strip()
        except OSError:
            pass
    return ""


async def wait_ok(page, tries=60):
    for _ in range(tries):
        try:
            t = await page.title()
            rs = await page.evaluate("document.readyState")
        except Exception:
            t, rs = "", ""
        if t and "just a moment" not in t.lower() and rs in ("interactive", "complete"):
            return True
        await asyncio.sleep(1)
    return False


async def scan_page(page, url, dist, out, site, page_id, console_msgs):
    entry = {"site": site, "pageId": page_id, "url": url, "items": [], "error": None, "status": "failed"}
    try:
        await page.goto(url, timeout=60000, wait_until="domcontentloaded")
        ok = await wait_ok(page)
        print("[%s] load ok=%s | %s" % (page_id, ok, (await page.title())[:70]), flush=True)
        if not ok:
            entry["error"] = "CF challenge / page not ready"
            return entry
        await asyncio.sleep(2)
        before = await page.evaluate(COLLECTOR_JS)
        links = await page.evaluate(LINKS_JS)
        # 清 gm + 预置数据（云环境无本地数据，依赖脚本从数据站拉取）
        await page.evaluate(GM_STUB)
        # The marker is executed *inside* the same synchronous script after
        # startup. Successful tag insertion alone does not imply execution.
        wrapped_dist = (
            "(function(){try{\n" + dist +
            "\nwindow.__zhxAuditInjected = true;\n"
            "}catch(e){console.error('[AUDIT-INJECT]', e && e.message);}})();"
        )
        try:
            await page.add_script_tag(content=wrapped_dist)
            print("[%s] dist 注入 add_script_tag" % page_id, flush=True)
        except Exception as e:
            print("[%s] add_script_tag 失败，尝试 evaluate: %s" % (page_id, str(e)[:120]), flush=True)
            try:
                await page.evaluate(wrapped_dist)
            except Exception as e2:
                entry["error"] = "inject failed: " + str(e2)[:150]
                entry["status"] = "failed"
                return entry
        if not await page.evaluate("window.__zhxAuditInjected === true"):
            entry["error"] = "userscript execution not confirmed (CSP/runtime failure)"
            entry["status"] = "failed"
            return entry
        # 等待数据流程 + 补扫（约 15s）
        await asyncio.sleep(15)
        # 运行收集器
        try:
            items = await page.evaluate(COLLECTOR_JS)
            if not isinstance(items, list):
                raise ValueError("collector did not return a list")
            entry["items"] = pair_snapshots(before, items)
            entry["links"] = links
            entry["beforeCount"] = len(before)
            entry["status"] = "ok"
            print("[%s] 收集到 %d 条候选" % (page_id, len(items)), flush=True)
        except Exception as e:
            entry["error"] = "collector failed: " + str(e)[:200]
            print("[%s] 收集失败: %s" % (page_id, str(e)[:150]), flush=True)
    except Exception as e:
        entry["error"] = str(e)[:200]
        print("[%s] 异常: %s" % (page_id, str(e)[:180]), flush=True)
    return entry


async def run_session(browser, plan, dist, out_dir):
    from playwright.async_api import async_playwright
    results = []
    async with async_playwright() as p:
        b = await p.chromium.connect_over_cdp(browser.cdp_url, timeout=45000)
        ctx = await b.new_context(viewport={"width": 1366, "height": 900}, locale="ja-JP", bypass_csp=True)
        console_msgs = []
        discover = bool(plan.get("discover", False))
        max_pages = min(500, max(1, int(plan.get("maxPages", 60)))) if discover else len(plan["pages"])
        max_depth = min(5, max(0, int(plan.get("maxDepth", 2))))
        per_template = min(15, max(1, int(plan.get("perTemplate", 3))))
        hosts = plan.get("hosts") or [urlsplit(p["url"]).hostname for p in plan["pages"]]
        queue = [{**item, "depth": 0} for item in plan["pages"]]
        visited = set()
        counts = {}
        index = 0
        while index < len(queue) and len(visited) < max_pages:
            page_cfg = queue[index]
            index += 1
            normalized = normalize_url(page_cfg["url"], page_cfg["url"], hosts)
            if not normalized or normalized in visited:
                continue
            template = template_key(normalized)
            if discover and counts.get(template, 0) >= per_template:
                continue
            counts[template] = counts.get(template, 0) + 1
            visited.add(normalized)
            page = await ctx.new_page()
            page.on("console", lambda m, _c=console_msgs: _c.append((m.type, (m.text or "")[:200])))
            try:
                ident = page_cfg.get("id", "discovered-%d" % index)
                r = await scan_page(page, normalized, dist, out_dir, plan["site"], ident, console_msgs)
                r["template"] = template
                r["scannedAt"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
                links = r.pop("links", [])
                results.append(r)
                # Keep a single JSON per URL/scan (no collisions with seed ids).
                out = Path(out_dir) / ("%s-%s-cloud-%d.json" % (plan["site"], ident, index))
                out.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
                if discover and not r.get("error") and page_cfg["depth"] < max_depth:
                    for link in links:
                        next_url = normalize_url(link, normalized, hosts)
                        if next_url and next_url not in visited:
                            queue.append({"url": next_url, "depth": page_cfg["depth"] + 1})
            finally:
                try:
                    await page.close()
                except Exception:
                    pass
        try:
            await b.close()
        except Exception:
            pass
    return results


async def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--countries", default=",".join(DEFAULT_COUNTRIES))
    ap.add_argument("--plan", default=None)
    ap.add_argument("--out", default=str(CACHE))
    args = ap.parse_args()

    os.environ["BROWSER_USE_API_KEY"] = _key()
    if not os.environ["BROWSER_USE_API_KEY"]:
        print("❌ 未找到 BROWSER_USE_API_KEY", file=sys.stderr)
        sys.exit(1)
    if not DIST.exists():
        print("❌ 未找到 dist: %s（先跑 npm run build）" % DIST, file=sys.stderr)
        sys.exit(1)

    plan_path = Path(args.plan) if args.plan else CACHE / ("cloud-plan-%s.json" % args.site)
    if not plan_path.exists():
        print("❌ 未找到计划文件: %s（先跑 run-scan.mjs --site %s --channel cloud）" % (plan_path, args.site), file=sys.stderr)
        sys.exit(1)
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    dist = DIST.read_text(encoding="utf-8")
    countries = [c.strip() for c in args.countries.split(",") if c.strip()]

    from browser_use_sdk.v4 import AsyncBrowserUse
    async with AsyncBrowserUse(api_key=os.environ["BROWSER_USE_API_KEY"]) as client:
        for country in countries:
            print("===== 尝试云浏览器 proxy=%s =====" % country, flush=True)
            try:
                browser = await client.browsers.create(proxy_country_code=country, timeout=15)
                print("浏览器就绪: %s" % str(browser.id)[:24], flush=True)
            except Exception as e:
                print("创建失败: %s" % str(e)[:150], flush=True)
                continue
            try:
                results = await asyncio.wait_for(run_session(browser, plan, dist, out_dir), timeout=900)
                ok_pages = sum(1 for r in results if not r.get("error"))
                print("=== 结果 === country=%s 有效页=%d/%d" % (country, ok_pages, len(plan["pages"])), flush=True)
                if ok_pages >= max(1, len(plan["pages"]) // 2):
                    print("CLOUD AUDIT SUCCESS", flush=True)
                    return
            except asyncio.TimeoutError:
                print("session 总超时", flush=True)
            except Exception as e:
                print("session 异常: %s" % str(e)[:200], flush=True)
            finally:
                try:
                    await client.browsers.stop(browser.id)
                except Exception:
                    pass
        print("ALL_ATTEMPTS_FAILED", flush=True)
        sys.exit(3)


if __name__ == "__main__":
    asyncio.run(main())