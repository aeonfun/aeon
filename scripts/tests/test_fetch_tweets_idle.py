#!/usr/bin/env python3
"""Unit tests for fetch_tweets_idle. Run: python3 scripts/tests/test_fetch_tweets_idle.py

No real API calls: the decision tests feed parsed answers, and the end-to-end
test runs the CLI against a local fake twitterapi.io server.
"""
import datetime
import http.server
import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
sys.path.insert(0, SCRIPTS)
import fetch_tweets_idle as ft  # noqa: E402

D = datetime.date
TODAY = D(2026, 11, 3)
# Built from pieces so no scanner mistakes it for a real key.
FAKE_KEY = "-".join(["fake", "twapi", "key", "0001"])

TRACKED = """# Accounts tracked by the tweet-digest skill
accounts:
  - handle: miroshark_
    why: our own X account
"""


def tw(tid, created, handle="miroshark_"):
    return {"id": str(tid), "url": "https://x.com/%s/status/%s" % (handle, tid), "createdAt": created}


def answer(tweets, has_next=False):
    return {"status": "success", "data": {"tweets": tweets}, "has_next_page": has_next}


OLD = "Wed Oct 21 20:21:43 +0000 2026"       # outside every window
FRESH = "Mon Nov 02 09:00:00 +0000 2026"     # inside both windows
EDGE3 = "Sat Oct 31 00:00:01 +0000 2026"     # today-3: inside the 3-day window only


class TestParseVar(unittest.TestCase):
    def test_account_forms(self):
        self.assertEqual(ft.parse_var("account:"), ("tracked", None))
        self.assertEqual(ft.parse_var("  account:  "), ("tracked", None))
        self.assertEqual(ft.parse_var("account:@VitalikButerin"), ("single", "vitalikbuterin"))
        self.assertEqual(ft.parse_var("account:https://x.com/foo/status/123"), ("single", "foo"))
        self.assertEqual(ft.parse_var("@miroshark_"), ("single", "miroshark_"))

    def test_other_sources_not_gated(self):
        for v in ["", "keyword:solana", "topic:", "topic:ai", "list:1953536336675365173",
                  "agent-buzz", "agent-buzz:MCP", "solana", "account", "123,456",
                  "account:has space", "account:waytoolonghandle_x", "@"]:
            mode, _ = ft.parse_var(v)
            self.assertIsNone(mode, v)


class TestParseTracked(unittest.TestCase):
    def test_reads_handles(self):
        self.assertEqual(ft.parse_tracked(TRACKED), ["miroshark_"])
        two = "accounts:\n  - handle: Foo\n    why: x\n  - handle: \"@bar\"  # note\n"
        self.assertEqual(ft.parse_tracked(two), ["foo", "bar"])

    def test_fails_open(self):
        self.assertIsNone(ft.parse_tracked(None))
        self.assertIsNone(ft.parse_tracked("accounts: []\n"))
        self.assertIsNone(ft.parse_tracked("accounts:\n  - foo\n  - handle: bar\n"))
        self.assertIsNone(ft.parse_tracked("accounts:\n  - handle: not a handle\n"))
        self.assertIsNone(ft.parse_tracked("accounts:\n  - handle: ${HANDLE}\n"))

    def test_comments_ignored(self):
        txt = "accounts:\n  # - handle: old_one\n  - handle: new_one\n"
        self.assertEqual(ft.parse_tracked(txt), ["new_one"])


class TestParseCreated(unittest.TestCase):
    def test_twitter_native(self):
        dt = ft.parse_created("Wed Oct 21 20:21:43 +0000 2026")
        self.assertEqual(dt, datetime.datetime(2026, 10, 21, 20, 21, 43, tzinfo=datetime.timezone.utc))

    def test_offset_moves_the_utc_day(self):
        dt = ft.parse_created("Sun Nov 01 23:30:00 -0200 2026")
        self.assertEqual(dt.date(), D(2026, 11, 2))

    def test_iso(self):
        self.assertEqual(ft.parse_created("2026-11-02T09:00:00Z").date(), D(2026, 11, 2))
        self.assertIsNone(ft.parse_created("2026-11-02T09:00:00"))  # naive: no zone, unknown day

    def test_garbage(self):
        for s in [None, "", "yesterday", "Wed Foo 21 20:21:43 +0000 2026", 12345]:
            self.assertIsNone(ft.parse_created(s), s)

    def test_string_compare_gotcha(self):
        # The skill's old jq bug: "Wed ..." >= "2026-10-31" is always true as strings.
        self.assertTrue(OLD >= "2026-10-31")
        quiet, why = ft.handle_verdict(answer([tw(1, OLD)]), D(2026, 10, 31), set())
        self.assertTrue(quiet, why)


class TestSeenIds(unittest.TestCase):
    LOG = ("# 2026-11-02\n\n### fetch-tweets\n- mode: account (all tracked)\n"
           "- https://x.com/miroshark_/status/111\n\n"
           "### fetch-tweets — under the hood\n- https://x.com/a/status/222\n\n"
           "### shiplog\n- mode: account\n- https://x.com/miroshark_/status/333\n\n"
           "### fetch-tweets\n- mode: keyword\n- https://x.com/b/status/444\n")

    def test_only_account_entries_in_range(self):
        logs = {"2026-11-02.md": self.LOG,
                "2026-11-01.md": "### fetch-tweets\n- mode: account\n- https://x.com/c/status/555\n",
                "2026-10-31.md": "### fetch-tweets\n- mode: account\n- https://x.com/c/status/666\n",
                "notes.md": "### fetch-tweets\n- mode: account\n- https://x.com/c/status/777\n"}
        self.assertEqual(ft.seen_ids_from_logs(logs, TODAY), {"111", "555"})


class TestVerdict(unittest.TestCase):
    F3 = TODAY - datetime.timedelta(days=3)

    def test_quiet_when_all_old(self):
        quiet, why = ft.handle_verdict(answer([tw(1, OLD), tw(2, OLD)]), self.F3, set())
        self.assertTrue(quiet)
        self.assertIn("2026-10-21", why)

    def test_runs_on_new_tweet(self):
        quiet, _ = ft.handle_verdict(answer([tw(9, FRESH), tw(1, OLD)]), self.F3, set())
        self.assertFalse(quiet)

    def test_window_edge_is_inclusive_like_the_skill(self):
        quiet, _ = ft.handle_verdict(answer([tw(5, EDGE3)]), self.F3, set())
        self.assertFalse(quiet)
        f2 = TODAY - datetime.timedelta(days=2)
        quiet, _ = ft.handle_verdict(answer([tw(5, EDGE3)]), f2, set())
        self.assertTrue(quiet)

    def test_quiet_when_in_window_already_reported(self):
        quiet, why = ft.handle_verdict(answer([tw(9, FRESH), tw(1, OLD)]), self.F3, {"9"})
        self.assertTrue(quiet)
        self.assertIn("already reported", why)

    def test_pinned_old_tweet_first_does_not_hide_new(self):
        quiet, _ = ft.handle_verdict(answer([tw(1, OLD), tw(9, FRESH)]), self.F3, set())
        self.assertFalse(quiet)

    def test_full_page_in_window_runs(self):
        quiet, _ = ft.handle_verdict(answer([tw(9, FRESH)], has_next=True), self.F3, {"9"})
        self.assertFalse(quiet)
        quiet, _ = ft.handle_verdict(answer([tw(9, FRESH), tw(1, OLD)], has_next=True), self.F3, {"9"})
        self.assertTrue(quiet)

    def test_fails_open(self):
        for resp in [None, {}, {"data": {"tweets": []}}, {"data": {"tweets": "x"}},
                     answer([{"id": "1", "createdAt": "garbage"}]),
                     answer([{"createdAt": FRESH}]),
                     answer(["not a dict"])]:
            quiet, _ = ft.handle_verdict(resp, self.F3, set())
            self.assertFalse(quiet, resp)

    def test_id_from_url(self):
        t = {"url": "https://x.com/a/status/777", "createdAt": FRESH}
        self.assertTrue(ft.handle_verdict(answer([t]), self.F3, {"777"})[0])

    def test_decide_all_needs_every_handle_quiet(self):
        answers = {"a": answer([tw(1, OLD)]), "b": answer([tw(2, FRESH)])}
        self.assertTrue(ft.decide_all(["a"], answers, TODAY, 3, set())[0])
        idle, why = ft.decide_all(["a", "b"], answers, TODAY, 3, set())
        self.assertFalse(idle)
        self.assertTrue(why.startswith("b:"))
        self.assertFalse(ft.decide_all([], answers, TODAY, 3, set())[0])


class TestGate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        os.makedirs(os.path.join(self.root, "memory", "topics"))
        os.makedirs(os.path.join(self.root, "memory", "logs"))
        with open(os.path.join(self.root, ft.TRACKED_FILE), "w") as f:
            f.write(TRACKED)
        self.calls = []

    def tearDown(self):
        self.tmp.cleanup()

    def fetcher(self, resp):
        def fetch(handle, key):
            self.calls.append((handle, key))
            return resp
        return fetch

    def test_skip(self):
        idle, _ = ft.gate(self.root, TODAY, "account:", FAKE_KEY, self.fetcher(answer([tw(1, OLD)])))
        self.assertTrue(idle)
        self.assertEqual(self.calls, [("miroshark_", FAKE_KEY)])

    def test_single_handle_uses_2_day_window(self):
        idle, _ = ft.gate(self.root, TODAY, "@someone", FAKE_KEY, self.fetcher(answer([tw(5, EDGE3)])))
        self.assertTrue(idle)
        self.assertEqual(self.calls[0][0], "someone")
        idle, _ = ft.gate(self.root, TODAY, "account:", FAKE_KEY, self.fetcher(answer([tw(5, EDGE3)])))
        self.assertFalse(idle)

    def test_dedup_against_logs(self):
        with open(os.path.join(self.root, "memory/logs/2026-11-02.md"), "w") as f:
            f.write("### fetch-tweets\n- mode: account\n- https://x.com/miroshark_/status/9\n")
        idle, _ = ft.gate(self.root, TODAY, "account:", FAKE_KEY, self.fetcher(answer([tw(9, FRESH)])))
        self.assertTrue(idle)

    def test_no_key_or_other_mode_does_not_call(self):
        self.assertFalse(ft.gate(self.root, TODAY, "account:", "", self.fetcher(None))[0])
        self.assertFalse(ft.gate(self.root, TODAY, "topic:", FAKE_KEY, self.fetcher(None))[0])
        self.assertEqual(self.calls, [])

    def test_failed_fetch_runs(self):
        self.assertFalse(ft.gate(self.root, TODAY, "account:", FAKE_KEY, self.fetcher(None))[0])

    def test_missing_config_runs(self):
        os.remove(os.path.join(self.root, ft.TRACKED_FILE))
        self.assertFalse(ft.gate(self.root, TODAY, "account:", FAKE_KEY, self.fetcher(None))[0])

    def test_too_many_handles_runs(self):
        body = "accounts:\n" + "".join("  - handle: h%d\n" % i for i in range(ft.MAX_HANDLES + 1))
        with open(os.path.join(self.root, ft.TRACKED_FILE), "w") as f:
            f.write(body)
        self.assertFalse(ft.gate(self.root, TODAY, "account:", FAKE_KEY, self.fetcher(None))[0])
        self.assertEqual(self.calls, [])

    def test_base_override_only_local(self):
        old = os.environ.get("AEON_TWITTERAPI_BASE")
        try:
            os.environ["AEON_TWITTERAPI_BASE"] = "https://evil.example/twitter"
            self.assertEqual(ft._api_base(), ft.API_BASE)
            os.environ["AEON_TWITTERAPI_BASE"] = "http://127.0.0.1:9/twitter/"
            self.assertEqual(ft._api_base(), "http://127.0.0.1:9/twitter")
        finally:
            if old is None:
                os.environ.pop("AEON_TWITTERAPI_BASE", None)
            else:
                os.environ["AEON_TWITTERAPI_BASE"] = old


class FakeApi(http.server.BaseHTTPRequestHandler):
    routes = {}
    seen = []

    def do_GET(self):  # noqa: N802
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        FakeApi.seen.append((u.path, q.get("userName", [""])[0], self.headers.get("X-API-Key")))
        code, body = FakeApi.routes.get(q.get("userName", [""])[0], (404, {}))
        raw = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *a):
        pass


class TestCli(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = http.server.HTTPServer(("127.0.0.1", 0), FakeApi)
        cls.port = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.makedirs(os.path.join(self.tmp.name, "memory", "topics"))
        with open(os.path.join(self.tmp.name, ft.TRACKED_FILE), "w") as f:
            f.write("accounts:\n  - handle: quiet_one\n  - handle: busy_one\n")
        FakeApi.seen = []

    def tearDown(self):
        self.tmp.cleanup()

    def run_cli(self, var, key=FAKE_KEY):
        env = dict(os.environ, SKILL_VAR=var, TWITTER_API_KEY=key, NO_PROXY="127.0.0.1,localhost",
                   AEON_TWITTERAPI_BASE="http://127.0.0.1:%d/twitter" % self.port)
        return subprocess.run([sys.executable, os.path.join(SCRIPTS, "fetch_tweets_idle.py"),
                               "--root", self.tmp.name, "--today", TODAY.isoformat()],
                              env=env, capture_output=True, text=True, timeout=60)

    def test_idle_exit_0_and_key_sent_as_header_only(self):
        FakeApi.routes = {"quiet_one": (200, answer([tw(1, OLD, "quiet_one")])),
                          "busy_one": (200, answer([tw(2, OLD, "busy_one")]))}
        r = self.run_cli("account:")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertTrue(r.stdout.startswith("IDLE: "), r.stdout)
        self.assertEqual([(p, h, k) for p, h, k in FakeApi.seen],
                         [("/twitter/user/last_tweets", "quiet_one", FAKE_KEY),
                          ("/twitter/user/last_tweets", "busy_one", FAKE_KEY)])
        self.assertNotIn(FAKE_KEY, r.stdout + r.stderr)

    def test_new_tweet_exit_1(self):
        FakeApi.routes = {"quiet_one": (200, answer([tw(1, OLD, "quiet_one")])),
                          "busy_one": (200, answer([tw(2, FRESH, "busy_one")]))}
        r = self.run_cli("account:")
        self.assertEqual(r.returncode, 1)
        self.assertIn("NOT IDLE: busy_one: new tweet 2", r.stdout)

    def test_http_error_fails_open(self):
        FakeApi.routes = {"quiet_one": (500, {"status": "error"}),
                          "busy_one": (200, answer([tw(2, OLD, "busy_one")]))}
        r = self.run_cli("account:")
        self.assertEqual(r.returncode, 1)
        self.assertIn("fetch failed", r.stdout)
        self.assertNotIn(FAKE_KEY, r.stdout + r.stderr)

    def test_error_status_in_200_fails_open(self):
        FakeApi.routes = {"quiet_one": (200, {"status": "error", "msg": "bad key"}),
                          "busy_one": (200, answer([tw(2, OLD, "busy_one")]))}
        self.assertEqual(self.run_cli("account:").returncode, 1)

    def test_no_key_exit_1_without_calls(self):
        r = self.run_cli("account:", key="")
        self.assertEqual(r.returncode, 1)
        self.assertIn("TWITTER_API_KEY not set", r.stdout)
        self.assertEqual(FakeApi.seen, [])

    def test_bad_root_fails_open(self):
        env = dict(os.environ, SKILL_VAR="account:", TWITTER_API_KEY=FAKE_KEY)
        r = subprocess.run([sys.executable, os.path.join(SCRIPTS, "fetch_tweets_idle.py"),
                            "--root", os.path.join(self.tmp.name, "nope")],
                           env=env, capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 1)
        self.assertTrue(r.stdout.startswith("NOT IDLE: "))


if __name__ == "__main__":
    unittest.main(verbosity=1)
