#!/usr/bin/env python3
"""Unit tests for verify_output (pure parts). Run: python3 scripts/tests/test_verify_output.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import verify_output as vo  # noqa: E402


class TestExtract(unittest.TestCase):
    def test_markdown_link(self):
        urls = vo.extract_urls("see [the docs](https://example.com/docs) for more")
        self.assertEqual(urls, ["https://example.com/docs"])

    def test_bare_url_strips_trailing_punct(self):
        self.assertEqual(vo.extract_urls("source: https://example.com/page."), ["https://example.com/page"])
        self.assertEqual(vo.extract_urls("(https://example.com/x)"), ["https://example.com/x"])

    def test_dedupe_preserves_order(self):
        text = "https://a.com then https://b.com then https://a.com again"
        self.assertEqual(vo.extract_urls(text), ["https://a.com", "https://b.com"])

    def test_no_urls(self):
        self.assertEqual(vo.extract_urls("no links here"), [])
        self.assertEqual(vo.extract_urls(""), [])

    def test_multiple_in_markdown(self):
        text = "[a](https://a.com/1) and [b](https://b.com/2)"
        self.assertEqual(vo.extract_urls(text), ["https://a.com/1", "https://b.com/2"])

    def test_ignores_non_http(self):
        self.assertEqual(vo.extract_urls("ftp://x.com file:///y mailto:z@x.com"), [])


class TestVerdict(unittest.TestCase):
    def test_all_ok(self):
        v = vo.verdict([{"url": "https://a.com", "status": 200}, {"url": "https://b.com", "status": 301}])
        self.assertEqual(v["verdict"], "pass")
        self.assertEqual(v["dead"], [])
        self.assertIsNone(v["flag"])
        self.assertEqual(v["ok"], 2)

    def test_one_dead_fails(self):
        v = vo.verdict([{"url": "https://a.com", "status": 200}, {"url": "https://gone.com", "status": 404}])
        self.assertEqual(v["verdict"], "fail")
        self.assertEqual(v["dead"], ["https://gone.com"])
        self.assertEqual(v["flag"], "dead_citation")

    def test_unreachable_is_dead(self):
        v = vo.verdict([{"url": "https://x.com", "status": 0}])
        self.assertEqual(v["verdict"], "fail")
        self.assertEqual(v["dead"], ["https://x.com"])

    def test_empty(self):
        v = vo.verdict([])
        self.assertEqual(v["verdict"], "pass")
        self.assertEqual(v["checked"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
