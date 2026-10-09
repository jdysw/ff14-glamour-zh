"""Offline safety checks for the Python cloud audit runner."""
import asyncio
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch

MODULE_PATH = Path(__file__).with_name("cloud-audit.py")
spec = importlib.util.spec_from_file_location("ff14_cloud_audit", MODULE_PATH)
cloud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cloud)


class DummyPage:
    def __init__(self, executed):
        self.executed = executed
        self.script = ""

    async def goto(self, *args, **kwargs):
        pass

    async def title(self):
        return "Normal page"

    async def evaluate(self, code):
        if code == cloud.COLLECTOR_JS:
            return [{"kind": "text", "text": "검색", "path": "button", "ctx": {"ui": True}}]
        if code == cloud.LINKS_JS:
            return []
        if code == "window.__zhxAuditInjected === true":
            return self.executed
        return None

    async def add_script_tag(self, content):
        self.script = content  # Insertion succeeded even if the browser never executed it.


class CloudAuditTests(unittest.TestCase):
    def test_asset_urls_do_not_consume_page_budget(self):
        for suffix in (".webp", ".gif", ".woff", ".woff2", ".ico", ".png", ".css", ".json"):
            self.assertIsNone(cloud.normalize_url("https://example.com/file" + suffix,
                                                  "https://example.com/", ["example.com"]), suffix)
        self.assertEqual(cloud.normalize_url("/equip", "https://example.com/", ["example.com"]),
                         "https://example.com/equip/")
        self.assertIsNone(cloud.normalize_url("https://evil-example.com/", "https://example.com/",
                                              ["example.com"]))
        self.assertIsNone(cloud.normalize_url("https://www.example.com/", "https://example.com/",
                                              ["example.com"]))
        self.assertEqual(cloud.normalize_url("https://www.example.com/", "https://example.com/",
                                             ["www.example.com"]), "https://www.example.com/")
        for path in ("/signout/", "/sign-out/", "/signup/", "/logout/"):
            self.assertIsNone(cloud.normalize_url(path, "https://example.com/", ["example.com"]))

    def test_template_keys_collapse_detail_slugs_but_preserve_fcxiv_categories(self):
        detail = cloud.template_key("https://example.com/glamour/123/" + "long-title-" * 8 + "/")
        self.assertEqual(detail, cloud.template_key("https://example.com/glamour/456/short/"))
        self.assertEqual(detail, cloud.template_key("https://example.com/glamour/789/%E3%83%86%E3%82%B9%E3%83%88/"))
        self.assertNotEqual(
            cloud.template_key("https://ff14-fc.com/equipment_search_parts/equipment_search_head/"),
            cloud.template_key("https://ff14-fc.com/equipment_search_parts/equipment_search_foot/"),
        )

    def test_proxy_retry_checks_required_seeds_only(self):
        plan = {"hosts": ["example.com"], "pages": [
            {"id": "home", "url": "https://example.com/"},
            {"id": "search", "url": "https://example.com/search/"},
            {"id": "about", "url": "https://example.com/about/"},
            {"id": "list", "url": "https://example.com/list/"},
        ]}
        discovered = [
            {"pageId": "discovered-" + str(i), "url": "https://example.com/posts/" + str(i) + "/",
             "status": "ok", "error": None}
            for i in range(20)
        ]
        self.assertEqual(cloud.seed_success_count(discovered, plan), 0)
        partial = discovered + [{"pageId": "home", "url": "https://example.com/",
                                 "status": "ok", "error": None}]
        self.assertEqual(cloud.seed_success_count(partial, plan), 1)
        enough = partial + [{"pageId": "search", "url": "https://example.com/search/",
                             "status": "ok", "error": None}]
        self.assertEqual(cloud.seed_success_count(enough, plan), 2)
        failed = enough + [{"pageId": "list", "url": "https://example.com/list/",
                            "status": "failed", "error": "CF"}]
        self.assertEqual(cloud.seed_success_count(failed, plan), 2)

    def test_insertion_without_execution_is_failure(self):
        page = DummyPage(executed=False)
        with patch.object(cloud, "wait_ok", new=AsyncMock(return_value=True)), \
                patch.object(cloud.asyncio, "sleep", new=AsyncMock(return_value=None)):
            result = asyncio.run(cloud.scan_page(page, "https://example.com/", "// script",
                                                 None, "fc", "home", []))
        self.assertEqual(result["status"], "failed")
        self.assertIn("not confirmed", result["error"])
        self.assertNotEqual(result["items"], [{"text": "success"}])
        self.assertIn("__zhxAuditInjected = true", page.script)

    def test_confirmed_execution_allows_snapshot_collection(self):
        page = DummyPage(executed=True)
        with patch.object(cloud, "wait_ok", new=AsyncMock(return_value=True)), \
                patch.object(cloud.asyncio, "sleep", new=AsyncMock(return_value=None)):
            result = asyncio.run(cloud.scan_page(page, "https://example.com/", "// script",
                                                 None, "fc", "home", []))
        self.assertEqual(result["status"], "ok")
        self.assertIsNone(result["error"])
        self.assertEqual(result["items"][0]["before"], "검색")


if __name__ == "__main__":
    unittest.main()
