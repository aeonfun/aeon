#!/usr/bin/env python3
"""
fetch_tweets_idle - pre-run gate for the fetch-tweets skill.

fetch-tweets in `account` mode starts a model run every day even when no
tracked account posted anything: the model fetches each timeline, finds
nothing inside the window, and logs TWEET_DIGEST_OK with no notification. On a
quiet watchlist that is a paid run a day for no output.

This gate runs in the workflow before the model starts. It reads the same
inputs the skill would (the `var`, memory/topics/tracked-accounts.yml, the
recent `### fetch-tweets` log entries), asks twitterapi.io for each handle's
latest tweets, and exits 0 ("idle", skip the run) only when no handle has a
tweet the skill would report:

  - a tweet counts when its date is inside the skill's window (3 days for all
    tracked accounts, 2 for a single handle; same day-level cut as the skill's
    `date -u -d "N days ago" +%Y-%m-%d`), and
  - its status id is not already in a `### fetch-tweets` account entry of the
    last 2 days of memory/logs/ (the skill's own dedup set).

Only `account:` (empty = all tracked accounts), `account:<handle>` and
`@handle` vars are gated; every other source (keyword, topic, list,
agent-buzz, or a bare word the model might read either way) always runs.

Fails open: a missing key, a non-200 answer, an empty timeline (the skill
would try its xAI fallback), an unparseable date or id, a full first page of
in-window tweets, or any other error means "not idle", so the worst case is
one ordinary run. The API key is read from TWITTER_API_KEY and only ever sent
as the X-API-Key header; it is never printed.

createdAt is Twitter-native ("Wed Oct 21 20:21:43 +0000 2026"), not ISO, so it
is parsed into a datetime here; a string compare against "2026-10-31" would be
always true and silently keep every tweet.

Usage: python3 scripts/fetch_tweets_idle.py [--root DIR] [--today YYYY-MM-DD]
  var from SKILL_VAR, key from TWITTER_API_KEY. Exit 0 = idle, 1 = run.
"""
import datetime
import json
import os
import re
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from memory_prep import parse_daily, split_sections  # noqa: E402

TRACKED_FILE = "memory/topics/tracked-accounts.yml"
LOGS_DIR = "memory/logs"
API_BASE = "https://api.twitterapi.io/twitter"
SKILL = "fetch-tweets"

# Mirrors skills/fetch-tweets/SKILL.md (account branch): FROM_3D / FROM_2D and
# "Seen set: last 2 days of logs". Change both together.
TRACKED_WINDOW_DAYS = 3
SINGLE_WINDOW_DAYS = 2
SEEN_DAYS = 2
MAX_HANDLES = 25        # a bigger watchlist just runs (bounds gate time and spend)
HTTP_TIMEOUT = 20

_HANDLE_RE = re.compile(r"^[A-Za-z0-9_]{1,15}$")
_TRACKED_HANDLE_RE = re.compile(
    r"""^\s*(?:-\s*)?handle:\s*["']?@?([A-Za-z0-9_]{1,15})["']?\s*(?:#.*)?$""")
_LIST_ITEM_RE = re.compile(r"^\s*-\s+\S")
_STATUS_ID_RE = re.compile(r"/status(?:es)?/(\d+)")
_TW_DATE_RE = re.compile(
    r"^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2}) (\d{4})$")
_MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
_URL_PREFIXES = ("https://", "http://")
_URL_HOSTS = ("www.x.com/", "x.com/", "www.twitter.com/", "twitter.com/", "nitter.net/")


# ---------------------------------------------------------------------------
# pure planners (unit-tested)
# ---------------------------------------------------------------------------

def normalize_handle(arg):
    """'@Foo', 'https://x.com/foo/status/1' -> 'foo'; None when it is not a handle."""
    s = (arg or "").strip()
    for p in _URL_PREFIXES:
        if s.lower().startswith(p):
            s = s[len(p):]
            break
    for h in _URL_HOSTS:
        if s.lower().startswith(h):
            s = s[len(h):]
            break
    s = s.lstrip("@").split("/", 1)[0].strip().lower()
    return s if _HANDLE_RE.match(s) else None


def parse_var(var):
    """
    ('tracked', None) | ('single', handle) | (None, reason). Only the explicit
    account forms are gated: `account:`, `account:<handle>`, `@handle`.
    """
    v = (var or "").strip()
    if v.lower().startswith("account:"):
        arg = v[len("account:"):].strip()
        if not arg:
            return "tracked", None
        h = normalize_handle(arg)
        return ("single", h) if h else (None, "account arg is not a handle")
    if v.startswith("@"):
        h = normalize_handle(v)
        return ("single", h) if h else (None, "var is not a handle")
    return None, "source is not account (var %r)" % v[:40]


def parse_tracked(text):
    """
    Handles in tracked-accounts.yml (lowercased, de-duplicated, file order), or
    None when the file is unreadable or any list item has no plain `handle:`.
    """
    if text is None:
        return None
    handles, items, found = [], 0, 0
    for ln in text.split("\n"):
        if ln.lstrip().startswith("#"):
            continue
        if _LIST_ITEM_RE.match(ln):
            items += 1
        m = _TRACKED_HANDLE_RE.match(ln)
        if m:
            found += 1
            h = m.group(1).lower()
            if h not in handles:
                handles.append(h)
        elif re.match(r"^\s*(?:-\s*)?handle:", ln):
            return None   # a handle we cannot read: let the model handle it
    # every list item must carry exactly one readable handle
    if not handles or items != found:
        return None
    return handles


def parse_created(s):
    """Twitter-native or ISO createdAt -> aware UTC datetime, or None."""
    if not isinstance(s, str) or not s.strip():
        return None
    s = s.strip()
    m = _TW_DATE_RE.match(s)
    if m:
        mon = _MONTHS.get(m.group(1).lower())
        if not mon:
            return None
        try:
            off = datetime.timedelta(hours=int(m.group(7)), minutes=int(m.group(8)))
            tz = datetime.timezone(off if m.group(6) == "+" else -off)
            dt = datetime.datetime(int(m.group(9)), mon, int(m.group(2)),
                                   int(m.group(3)), int(m.group(4)), int(m.group(5)), tzinfo=tz)
        except ValueError:
            return None
        return dt.astimezone(datetime.timezone.utc)
    try:
        dt = datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        return None
    return dt.astimezone(datetime.timezone.utc)


def tweet_id(t):
    """The tweet's status id as a string, from `id` or its URL; None if neither."""
    tid = t.get("id")
    if isinstance(tid, int) and not isinstance(tid, bool):
        return str(tid)
    if isinstance(tid, str) and tid.strip().isdigit():
        return tid.strip()
    m = _STATUS_ID_RE.search(str(t.get("url") or t.get("twitterUrl") or ""))
    return m.group(1) if m else None


def seen_ids_from_logs(logs, today, days=SEEN_DAYS):
    """
    Status ids already reported by a fetch-tweets account entry. `logs` maps a
    daily log filename to its text; only files dated today-days..today count.
    """
    start = today - datetime.timedelta(days=days)
    ids = set()
    for fname, text in logs.items():
        d = parse_daily(fname)
        if d is None or not (start <= d <= today):
            continue
        for title, body in split_sections(text or ""):
            if title is None:
                continue
            words = title.split()
            if not words or words[0] != SKILL or title.lower().endswith("under the hood"):
                continue
            if "mode: account" not in body:
                continue
            ids.update(_STATUS_ID_RE.findall(body))
    return ids


def handle_verdict(resp, from_date, seen):
    """(quiet_bool, reason) for one handle's /user/last_tweets answer."""
    if not isinstance(resp, dict):
        return False, "no usable answer"
    data = resp.get("data")
    tweets = data.get("tweets") if isinstance(data, dict) else None
    if tweets is None:
        tweets = resp.get("tweets")
    if not isinstance(tweets, list) or not tweets:
        return False, "empty timeline (skill would try its fallback)"
    newest, oldest, in_window = None, None, 0
    for t in tweets:
        if not isinstance(t, dict):
            return False, "unparseable tweet"
        dt = parse_created(t.get("createdAt"))
        if dt is None:
            return False, "unparseable createdAt"
        d = dt.date()
        newest = d if newest is None or d > newest else newest
        oldest = d if oldest is None or d < oldest else oldest
        if d < from_date:
            continue
        tid = tweet_id(t)
        if tid is None:
            return False, "in-window tweet without an id"
        if tid not in seen:
            return False, "new tweet %s from %s" % (tid, d.isoformat())
        in_window += 1
    has_next = data.get("has_next_page") if isinstance(data, dict) else None
    if has_next is None:
        has_next = resp.get("has_next_page")
    if has_next and oldest is not None and oldest >= from_date:
        return False, "first page is all in-window tweets, more may follow"
    if in_window:
        return True, "%d in-window tweet(s), all already reported" % in_window
    return True, "newest %s, outside the window" % newest.isoformat()


def decide_all(handles, answers, today, window_days, seen):
    """
    (idle_bool, reason) over every handle: idle only when each one is quiet.
    `answers` maps handle -> parsed API answer (None on a failed fetch).
    """
    if not handles:
        return False, "no handles"
    from_date = today - datetime.timedelta(days=window_days)
    notes = []
    for h in handles:
        quiet, why = handle_verdict(answers.get(h), from_date, seen)
        if not quiet:
            return False, "%s: %s" % (h, why)
        notes.append("%s: %s" % (h, why))
    return True, "no new tweet in the %d-day window (%s)" % (window_days, "; ".join(notes))


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------

def _read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return None


def _read_logs(root):
    d = os.path.join(root, LOGS_DIR)
    try:
        names = os.listdir(d)
    except OSError:
        return {}
    return {n: _read(os.path.join(d, n)) for n in names if parse_daily(n)}


def _api_base():
    # Tests point this at a local fake server; nothing else may receive the key.
    b = os.environ.get("AEON_TWITTERAPI_BASE", "")
    if b.startswith(("http://127.0.0.1:", "http://localhost:")):
        return b.rstrip("/")
    return API_BASE


def fetch_last_tweets(handle, key, base=None, timeout=HTTP_TIMEOUT):
    """Parsed /user/last_tweets answer, or None on any error or non-200."""
    url = "%s/user/last_tweets?%s" % (base or _api_base(), urllib.parse.urlencode({"userName": handle}))
    req = urllib.request.Request(url, headers={"X-API-Key": key, "User-Agent": "aeon-fetch-tweets-idle"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 (fixed https host)
            if r.status != 200:
                return None
            body = json.loads(r.read(4 * 1024 * 1024).decode("utf-8"))
    except Exception:  # noqa: BLE001 - fail open, never echo the error (it may hold the URL)
        return None
    if not isinstance(body, dict) or str(body.get("status", "success")).lower() == "error":
        return None
    return body


def gate(root, today, var, key, fetch=fetch_last_tweets):
    """(idle_bool, reason). Pure apart from the reads and `fetch`."""
    mode, arg = parse_var(var)
    if mode is None:
        return False, arg
    if not key:
        return False, "TWITTER_API_KEY not set"
    if mode == "tracked":
        handles = parse_tracked(_read(os.path.join(root, TRACKED_FILE)))
        if handles is None:
            return False, "%s missing, empty or not plain handles" % TRACKED_FILE
        window = TRACKED_WINDOW_DAYS
    else:
        handles, window = [arg], SINGLE_WINDOW_DAYS
    if len(handles) > MAX_HANDLES:
        return False, "%d handles (> %d), not gated" % (len(handles), MAX_HANDLES)
    seen = seen_ids_from_logs(_read_logs(root), today)
    answers = {}
    for h in handles:
        answers[h] = fetch(h, key)
        if answers[h] is None:
            return False, "%s: twitterapi fetch failed" % h
    return decide_all(handles, answers, today, window, seen)


def main(argv):
    root = os.environ.get("AEON_REPO_ROOT", ".")
    today = datetime.datetime.now(datetime.timezone.utc).date()
    if "--root" in argv:
        i = argv.index("--root")
        root = argv[i + 1]
    if "--today" in argv:
        i = argv.index("--today")
        today = datetime.date.fromisoformat(argv[i + 1])
    try:
        idle, reason = gate(root, today, os.environ.get("SKILL_VAR", ""),
                            os.environ.get("TWITTER_API_KEY", ""))
    except Exception as e:  # noqa: BLE001 - fail open
        idle, reason = False, "gate error (%s)" % type(e).__name__
    print(("IDLE: " if idle else "NOT IDLE: ") + reason)
    return 0 if idle else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
