"""Offline regression checks for local/cloud tracking URL parity."""
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "cloud_audit", ROOT / "tools/coverage-audit/cloud-audit.py")
cloud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cloud)


class TrackingUrlTests(unittest.TestCase):
    def test_tracking_variants_match_local_and_preserve_route_params(self):
        base = "https://example.com/"
        params = ["ref", "source", "share", "nonce", "nonce_id", "REF",
                  "utm_source", "fbclid", "gclid", "session_id", "token"]
        urls = [base + "item?b=2&a=1&" + param + "=campaign#part"
                for param in params]
        urls.append(base + "item?b=2&a=1&reference=keep&source_id=keep")
        code = (
            "import { normalizeSiteUrl } from './tools/coverage-audit/coverage-core.mjs';"
            "const urls = JSON.parse(process.argv[1]);"
            "process.stdout.write(JSON.stringify(urls.map(url => "
            "normalizeSiteUrl(url, 'https://example.com/', ['example.com']))));"
        )
        local = json.loads(subprocess.run(
            ["node", "--input-type=module", "-e", code, json.dumps(urls)],
            cwd=ROOT, capture_output=True, text=True, check=True).stdout)
        normalized = [cloud.normalize_url(url, base, ["example.com"]) for url in urls]
        self.assertEqual(normalized, local)
        self.assertEqual(set(normalized[:-1]), {base + "item/?a=1&b=2"})
        self.assertIn("reference=keep&source_id=keep", normalized[-1])


if __name__ == "__main__":
    unittest.main()
