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

# 与 audit.mjs COLLECTOR_JS 同款（保持同步；云脚本独立实现，避免跨语言传递）
COLLECTOR_JS = r"""(() => {
  const out = [];
  const seen = new Set();
  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.nodeType !== 1) return false;
    const cs = window.getComputedStyle(el);
    if (!cs) return false;
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    if (el.offsetParent === null && cs.position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return true;
  };
  const skipTag = (el) => {
    const tag = el.tagName;
    return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'IFRAME' || tag === 'TEMPLATE';
  };
  const skipZhx = (el) => {
    const cls = String(el.className || '');
    const id = String(el.id || '');
    return cls.includes('zhx-') || id.includes('zhx-') || el.hasAttribute('data-zhx-item') || el.hasAttribute('data-zhx-card') || el.hasAttribute('data-zhx-done') || el.hasAttribute('data-zhxWikiDone');
  };
  const ctxOf = (el) => {
    let p = el.parentElement;
    let cls = '', id = '', name = '', href = '', parentText = '', ad = false;
    if (p) { cls = String(p.className || ''); id = String(p.id || ''); }
    const inp = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
    if (inp) {
      name = String(el.getAttribute('name') || '');
      const f = el.form;
      if (f) { cls = String(f.className || '') + ' ' + cls; id = String(f.id || '') + ' ' + id; }
    }
    if (el.tagName === 'A') href = String(el.getAttribute('href') || '');
    if (p) parentText = (p.textContent || '').trim().slice(0, 120);
    let anc = el;
    for (let i = 0; anc && i < 8; i++) {
      const acls = String(anc.className || '') + ' ' + String(anc.id || '');
      if (anc.tagName === 'INS' && /adsbygoogle/i.test(acls)) { ad = true; break; }
      if (/(adsbygoogle|google-anno|aswift|ad-slot|adunit|ad-container|advert|sponsor)/i.test(acls)) { ad = true; break; }
      anc = anc.parentElement;
    }
    return { tag: el.tagName.toLowerCase(), cls, id, name, href, parentText, ad };
  };
  const push = (el, text, kind) => {
    const t = (text || '').trim();
    if (!t) return;
    if (seen.has(el + '|' + t + '|' + kind)) return;
    seen.add(el + '|' + t + '|' + kind);
    out.push({ kind, text: t, ctx: ctxOf(el), path: zhxPath(el) });
  };
  const zhxPath = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement && parts.length < 12) {
      let sel = cur.tagName.toLowerCase();
      if (cur.id) sel += '#' + cur.id;
      else if (cur.className && typeof cur.className === 'string') sel += '.' + cur.className.trim().split(/\s+/).slice(0, 2).join('.');
      const parent = cur.parentElement;
      if (parent) {
        const sib = Array.from(parent.children).filter((c) => c.tagName === cur.tagName && !(c.id) && String(c.className || '') === String(cur.className || ''));
        const idx = Array.from(parent.children).indexOf(cur) + 1;
        if (sib.length > 1) sel += ':nth-child(' + idx + ')';
      }
      parts.unshift(sel);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const p = node.parentElement;
      if (!p || skipTag(p) || skipZhx(p)) return NodeFilter.FILTER_REJECT;
      if (!isVisible(p)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = walker.nextNode())) {
    const t = (n.nodeValue || '').trim();
    if (!t) continue;
    push(n.parentElement, t, 'text');
  }
  const attrSel = 'input[placeholder],textarea[placeholder],input[title],a[title],button[title],[aria-label],[alt]';
  for (const el of document.querySelectorAll(attrSel)) {
    if (!isVisible(el) || skipZhx(el)) continue;
    for (const attr of ['placeholder','title','aria-label','alt']) {
      const v = el.getAttribute(attr);
      if (v && v.trim()) push(el, v, 'attr:' + attr);
    }
  }
  for (const opt of document.querySelectorAll('option')) {
    if (!isVisible(opt) || skipZhx(opt)) continue;
    push(opt, opt.textContent || '', 'option');
  }
  return out;
})()"""

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
    entry = {"site": site, "pageId": page_id, "url": url, "items": [], "error": None}
    try:
        await page.goto(url, timeout=60000, wait_until="domcontentloaded")
        ok = await wait_ok(page)
        print("[%s] load ok=%s | %s" % (page_id, ok, (await page.title())[:70]), flush=True)
        if not ok:
            entry["error"] = "CF challenge / page not ready"
            return entry
        await asyncio.sleep(2)
        # 清 gm + 预置数据（云环境无本地数据，依赖脚本从数据站拉取）
        await page.evaluate(GM_STUB)
        try:
            await page.add_script_tag(content=dist)
            print("[%s] dist 注入 add_script_tag" % page_id, flush=True)
        except Exception as e:
            print("[%s] add_script_tag 失败，尝试 evaluate: %s" % (page_id, str(e)[:120]), flush=True)
            try:
                await page.evaluate(dist)
            except Exception as e2:
                entry["error"] = "inject failed: " + str(e2)[:150]
                return entry
        # 等待数据流程 + 补扫（约 15s）
        await asyncio.sleep(15)
        # 运行收集器
        try:
            items = await page.evaluate(COLLECTOR_JS)
            entry["items"] = items
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
        for page_cfg in plan["pages"]:
            page = await ctx.new_page()
            page.on("console", lambda m, _c=console_msgs: _c.append((m.type, (m.text or "")[:200])))
            r = await scan_page(page, page_cfg["url"], dist, out_dir, plan["site"], page_cfg["id"], console_msgs)
            results.append(r)
            # 增量保存
            out = Path(out_dir) / ("%s-%s-cloud.json" % (plan["site"], page_cfg["id"]))
            out.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
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
                ok_pages = sum(1 for r in results if r.get("items"))
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