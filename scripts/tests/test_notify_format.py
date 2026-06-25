#!/usr/bin/env python3
"""Local tests for notify_format. Run: python3 scripts/tests/test_notify_format.py"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import notify_format as nf  # noqa: E402


def fences_balanced(s: str) -> bool:
    return nf._fence_count(s) % 2 == 0


class TestChunk(unittest.TestCase):
    def test_short_text_single_chunk_unchanged(self):
        self.assertEqual(nf.chunk("hello world", 3900), ["hello world"])

    def test_empty(self):
        self.assertEqual(nf.chunk("", 3900), [])
        self.assertEqual(nf.chunk("\n\n", 3900), [])

    def test_all_chunks_within_limit(self):
        text = "\n\n".join(f"para {i} " + "x" * 200 for i in range(50))
        for c in nf.chunk(text, 500):
            self.assertLessEqual(len(c), 500, f"chunk over limit: {len(c)}")

    def test_long_single_paragraph_hard_split(self):
        text = "y" * 5000
        chunks = nf.chunk(text, 1000)
        self.assertTrue(len(chunks) >= 5)
        for c in chunks:
            self.assertLessEqual(len(c), 1000)

    def test_never_splits_inside_fence(self):
        # a code block big enough to force a split must stay balanced per-chunk
        code = "```python\n" + "\n".join(f"line_{i} = {i}" for i in range(400)) + "\n```"
        text = "intro paragraph\n\n" + code + "\n\noutro paragraph"
        chunks = nf.chunk(text, 600)
        self.assertGreater(len(chunks), 1)
        for c in chunks:
            self.assertLessEqual(len(c), 600)
            self.assertTrue(fences_balanced(c), f"unbalanced fence in chunk:\n{c}")

    def test_reassembly_preserves_payload(self):
        # stripping rebalance fences + footers, the content survives a round trip
        text = "alpha\n\nbravo\n\ncharlie " + "z" * 1200
        chunks = nf.chunk(text, 400)
        joined = "".join(chunks).replace("```", "")
        for token in ("alpha", "bravo", "charlie"):
            self.assertIn(token, joined)


class TestChannels(unittest.TestCase):
    def test_telegram_adds_index_suffix_when_split(self):
        chunks = nf.telegram("p\n\n" + "x" * 9000, title="", severity="info", limit=3900)
        self.assertGreater(len(chunks), 1)
        self.assertIn("[1/", chunks[0])
        for c in chunks:
            self.assertLessEqual(len(c), 3900)

    def test_telegram_title_prefix(self):
        chunks = nf.telegram("body", title="Token Report", severity="warn")
        self.assertIn("Token Report", chunks[0])
        self.assertIn("⚠️", chunks[0])

    def test_discord_returns_embeds_with_color(self):
        payloads = nf.discord("body text", title="Alert", severity="critical")
        self.assertEqual(len(payloads), 1)
        embed = payloads[0]["embeds"][0]
        self.assertEqual(embed["color"], nf.SEVERITY["critical"]["color"])
        self.assertIn("Alert", embed["title"])
        self.assertEqual(embed["description"], "body text")

    def test_discord_chunks_long_body_into_multiple_embeds(self):
        payloads = nf.discord("z" * 9000, title="X", severity="info", limit=4096)
        self.assertGreater(len(payloads), 1)
        for p in payloads:
            self.assertLessEqual(len(p["embeds"][0]["description"]), 4096)
        # title only on first embed
        self.assertIn("title", payloads[0]["embeds"][0])
        self.assertNotIn("title", payloads[1]["embeds"][0])

    def test_slack_block_kit_shape(self):
        payload = nf.slack("body", title="Heads up", severity="info")
        self.assertEqual(payload["blocks"][0]["type"], "header")
        self.assertEqual(payload["blocks"][1]["type"], "section")
        self.assertEqual(payload["blocks"][1]["text"]["type"], "mrkdwn")

    def test_slack_sections_within_limit(self):
        payload = nf.slack("z" * 9000, title="", severity="info", limit=3000)
        for b in payload["blocks"]:
            if b["type"] == "section":
                self.assertLessEqual(len(b["text"]["text"]), 3000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
