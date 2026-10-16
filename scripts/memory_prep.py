#!/usr/bin/env python3
"""
memory_prep - deterministic pre/post pass for the memory-flush skill.

memory-flush used to make the model do bookkeeping every run: parse the scan
window off a prose line, list in-window logs, and rotate memory/logs/ once it
grew past ~45 files. That is pure code, and doing it in the LLM made it costly
(7 instances, weekly) and unreliable (the window silently fell back to 3 days
whenever the prose watermark was edited away, losing un-promoted entries).

This module owns that mechanical work so the model is left with only the
judgment: what to promote, dedup, and prune.

Watermark source of truth is memory/memory-flush-state.json (structured,
skill-owned) - NOT memory/cron-state.json, whose schema is a fixed shape folded
by state_reduce.py that would drop an extra field under the Issues backend. The
memory/MEMORY.md "*Last consolidated: <date>*" line is kept as a human mirror.

Subcommands:
  window   pre-pass: rotate old logs, then print the scan window + the exact
           list of in-window log files to stdout for the model to read, and
           MEMORY.md's size against its byte / line-length budget.
  stamp    post-pass: write today's date to the watermark file, record a
           fingerprint of every recent log, and mirror the date into the
           MEMORY.md prose line.
  idle     pre-run gate (run by the workflow before the model starts): exit 0
           when no log changed since the last flush, so the run can be skipped;
           exit 1 otherwise. Fails open: any doubt means "not idle".
  source   print the log section a `[source: logs/<date>#<skill>]` tag points
           at, from memory/logs/ or the monthly archive.

The date planners are kept pure (no clock, no I/O) so they are unit-testable;
the today's-date reads and file writes live in the thin I/O wrappers.
"""
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys

LOGS_DIR = "memory/logs"
ARCHIVE_DIR = "memory/logs/archive"
STATE_FILE = "memory/memory-flush-state.json"
MEMORY_MD = "memory/MEMORY.md"

ROTATE_THRESHOLD = 45   # only rotate once logs/ grows past this many dailies
SCAN_CLAMP_DAYS = 14    # a gap longer than this clamps the scan window
DEFAULT_LOOKBACK_DAYS = 3  # no watermark at all -> read the last 3 days
MAX_IDLE_DAYS = 7       # never skip a flush when the last one is this old (pruning still matters)
# MEMORY.md loads into every skill run, so its budget is bytes, not only lines:
# a ~50-line index of 2 KB bullets still costs ~7k tokens on every run.
MEMORY_MAX_BYTES = 8192
MEMORY_MAX_LINE = 300   # chars; a longer line is detail that belongs in a topic file
SKILL = "memory-flush"

_DAILY_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})\.md$")
_CONSOLIDATED_RE = re.compile(r"^\*Last consolidated:.*\*\s*$", re.IGNORECASE | re.MULTILINE)
_HEADING_RE = re.compile(r"^#{1,6}\s+(.*?)\s*$")
_ARCHIVE_MARK_RE = re.compile(r"^<!-- (\d{4}-\d{2}-\d{2}\.md) -->\s*$")
_SOURCE_RE = re.compile(r"^(?:memory/)?logs/(\d{4}-\d{2}-\d{2})(?:\.md)?#([A-Za-z0-9_-]+)$")


# ---------------------------------------------------------------------------
# pure planners (unit-tested)
# ---------------------------------------------------------------------------

def parse_date(s):
    """'2026-08-16' -> date, or None if unparseable/blank/'never'."""
    if not s:
        return None
    s = s.strip()
    if s.lower() == "never":
        return None
    try:
        return datetime.date.fromisoformat(s)
    except ValueError:
        return None


def watermark_from_memory_md(text):
    """Recover the last-consolidated date from the MEMORY.md prose line."""
    if not text:
        return None
    m = _CONSOLIDATED_RE.search(text)
    if not m:
        return None
    inner = m.group(0).split(":", 1)[1]  # after 'Last consolidated:'
    return parse_date(inner.strip().strip("*").strip())


def resolve_watermark(state_json, memory_md):
    """
    Decide the last-consolidated date and where it came from.
    Prefer the structured state file; fall back to the MEMORY.md prose line
    (first-run migration); else None. Returns (date_or_None, source_str).
    """
    if state_json:
        try:
            d = parse_date(json.loads(state_json).get("last_consolidated"))
            if d:
                return d, "state-file"
        except (ValueError, AttributeError):
            pass
    d = watermark_from_memory_md(memory_md)
    if d:
        return d, "memory.md"
    return None, "none"


def compute_window(last_consolidated, today):
    """
    (start_date, clamped_bool) for the log scan.
      - no watermark          -> last DEFAULT_LOOKBACK_DAYS
      - gap > SCAN_CLAMP_DAYS  -> clamp to last SCAN_CLAMP_DAYS (agent was dark)
      - otherwise              -> from the watermark day (re-reading it is
                                  idempotent thanks to the skill's dedup step)
    """
    if last_consolidated is None:
        return today - datetime.timedelta(days=DEFAULT_LOOKBACK_DAYS), False
    gap = (today - last_consolidated).days
    if gap > SCAN_CLAMP_DAYS:
        return today - datetime.timedelta(days=SCAN_CLAMP_DAYS), True
    return last_consolidated, False


def parse_daily(fname):
    """'2026-08-16.md' -> date, or None if it is not a daily log filename."""
    m = _DAILY_RE.match(fname)
    if not m:
        return None
    try:
        return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def select_logs(filenames, start_date, today):
    """In-window daily log filenames (start_date <= d <= today), date-sorted."""
    dated = [(parse_daily(f), f) for f in filenames]
    keep = [(d, f) for d, f in dated if d is not None and start_date <= d <= today]
    return [f for _, f in sorted(keep)]


def rotatable_months(filenames, today, threshold=ROTATE_THRESHOLD):
    """
    {YYYY-MM: [date-sorted filenames]} for whole months to roll into the
    archive. Only fires past the threshold, and only for months whose every
    daily is older than the 14-day scan floor (so nothing still in scope is
    touched). A month straddling the floor is left alone.
    """
    dailies = [(parse_daily(f), f) for f in filenames]
    dailies = [(d, f) for d, f in dailies if d is not None]
    if len(dailies) <= threshold:
        return {}
    cutoff = today - datetime.timedelta(days=SCAN_CLAMP_DAYS)
    by_month = {}
    for d, f in dailies:
        by_month.setdefault("%04d-%02d" % (d.year, d.month), []).append((d, f))
    out = {}
    for ym, items in by_month.items():
        if all(d < cutoff for d, _ in items):
            out[ym] = [f for _, f in sorted(items)]
    return out


def memory_size_report(text):
    """Lines for the window output: MEMORY.md bytes / lines against the budget and
    the over-long lines by number, so the model trims by measurement, not by eye."""
    if text is None:
        return ["MEMORY.md: missing."]
    size = len(text.encode("utf-8"))
    lines = text.splitlines()
    long_lines = [(n, len(l)) for n, l in enumerate(lines, 1) if len(l) > MEMORY_MAX_LINE]
    over = size > MEMORY_MAX_BYTES
    out = ["MEMORY.md size: %d bytes, %d lines (budget %d bytes, ~50 lines, no line over %d chars)%s" % (
        size, len(lines), MEMORY_MAX_BYTES, MEMORY_MAX_LINE,
        ": OVER BUDGET by %d bytes, overflow per step 3d." % (size - MEMORY_MAX_BYTES) if over else ": within budget.")]
    if long_lines:
        worst = sorted(long_lines, key=lambda x: -x[1])[:10]
        out.append("Lines over %d chars (line: chars), longest first: %s%s" % (
            MEMORY_MAX_LINE, ", ".join("%d: %d" % w for w in worst),
            " (+%d more)" % (len(long_lines) - len(worst)) if len(long_lines) > len(worst) else ""))
    return out


def stamp_memory_md(text, today):
    """
    Return MEMORY.md text with the '*Last consolidated: <date>*' line set to
    today. Update in place if present, else insert under the first H1 title.
    """
    line = "*Last consolidated: %s*" % today.isoformat()
    if _CONSOLIDATED_RE.search(text):
        return _CONSOLIDATED_RE.sub(line, text, count=1)
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        if ln.startswith("# "):
            lines.insert(i + 1, "")
            lines.insert(i + 2, line)
            return "\n".join(lines)
    # no title -> prepend
    return line + "\n\n" + text


def split_sections(text):
    """
    [(title_or_None, text)] - a log split at every markdown heading. The text
    before the first heading has title None.
    """
    out = []
    title, buf = None, []
    for ln in text.split("\n"):
        m = _HEADING_RE.match(ln)
        if m:
            if buf or title is not None:
                out.append((title, "\n".join(buf)))
            title, buf = m.group(1), [ln]
        else:
            buf.append(ln)
    if buf or title is not None:
        out.append((title, "\n".join(buf)))
    return out


def _is_own_or_trace(title):
    """memory-flush's own entries and the workflow's tool-action footers carry no new facts."""
    if title is None:
        return False
    words = title.split()
    return (bool(words) and words[0] == SKILL) or title.lower().endswith("under the hood")


def log_fingerprint(text):
    """
    sha256 of a daily log minus memory-flush's own sections and the "under the
    hood" footers, or "" when nothing else is left. Those sections are written
    by the flush run itself (before and after `stamp`), so counting them would
    make every flush look like new input for the next one.
    """
    kept = [body.strip() for title, body in split_sections(text or "")
            if not _is_own_or_trace(title) and body.strip()]
    if not kept:
        return ""
    return hashlib.sha256("\n\n".join(kept).encode("utf-8")).hexdigest()


def idle_decision(state_json, fingerprints, today):
    """
    (idle_bool, reason). `fingerprints` maps every daily log filename currently
    in memory/logs/ to log_fingerprint() of its content. Idle only when the
    structured watermark is under MAX_IDLE_DAYS old and every in-window log
    with real content matches what the last `stamp` recorded. Anything missing
    or odd -> not idle, so a doubt costs one run, never a lost entry.
    """
    try:
        state = json.loads(state_json) if state_json else None
    except ValueError:
        state = None
    if not isinstance(state, dict):
        return False, "no watermark state"
    last = parse_date(state.get("last_consolidated"))
    seen = state.get("seen_logs")
    if last is None or not isinstance(seen, dict):
        return False, "watermark has no log fingerprints yet"
    age = (today - last).days
    if age < 0 or age >= MAX_IDLE_DAYS:
        return False, "last flush %s is %d day(s) old (cap %d)" % (last.isoformat(), age, MAX_IDLE_DAYS)
    for f in select_logs(list(fingerprints), last, today):
        fp = fingerprints[f]
        if fp and seen.get(f) != fp:
            return False, "%s/%s has entries the last flush did not see" % (LOGS_DIR, f)
    return True, "no new log entries since the flush on %s" % last.isoformat()


def recent_fingerprints(fingerprints, today):
    """{filename: fp} for non-empty logs inside the 14-day scan floor (what `stamp` records)."""
    start = today - datetime.timedelta(days=SCAN_CLAMP_DAYS)
    return {f: fingerprints[f] for f in select_logs(list(fingerprints), start, today) if fingerprints[f]}


def parse_source(ref):
    """'logs/2026-10-13#token-report' -> ('2026-10-13.md', 'token-report'), else None."""
    m = _SOURCE_RE.match((ref or "").strip())
    if not m:
        return None
    return m.group(1) + ".md", m.group(2)


def extract_source(text, skill):
    """Every section of one day's log whose heading names `skill` (a skill can log more than once a day)."""
    hits = []
    for title, body in split_sections(text or ""):
        if title is None or title.lower().endswith("under the hood"):
            continue
        words = title.split()
        if words and words[0] == skill:
            hits.append(body.strip())
    return hits


def archived_day(text, fname):
    """One day's log out of a monthly archive file (days are marked `<!-- YYYY-MM-DD.md -->`)."""
    out, inside = [], False
    for ln in (text or "").split("\n"):
        m = _ARCHIVE_MARK_RE.match(ln)
        if m:
            inside = m.group(1) == fname
            continue
        if inside:
            out.append(ln)
    return "\n".join(out) if out else None


# ---------------------------------------------------------------------------
# thin I/O wrappers
# ---------------------------------------------------------------------------

def _read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except FileNotFoundError:
        return None


def _git_rm(root, relpaths):
    """git rm the given repo-relative paths (best-effort; rm is not granted)."""
    if not relpaths:
        return
    subprocess.run(["git", "-C", root, "rm", "--quiet", "--"] + relpaths, check=False)


def do_window(root, today):
    logs_dir = os.path.join(root, LOGS_DIR)
    try:
        entries = os.listdir(logs_dir)
    except FileNotFoundError:
        entries = []

    state_json = _read(os.path.join(root, STATE_FILE))
    memory_md = _read(os.path.join(root, MEMORY_MD))
    last, source = resolve_watermark(state_json, memory_md)
    start, clamped = compute_window(last, today)

    # rotate before selecting so the archive never overlaps the window
    rotated = rotatable_months(entries, today)
    archived_months = 0
    if rotated:
        archive_dir = os.path.join(root, ARCHIVE_DIR)
        os.makedirs(archive_dir, exist_ok=True)
        for ym, files in sorted(rotated.items()):
            chunks = []
            for f in files:
                body = _read(os.path.join(logs_dir, f))
                if body is not None:
                    chunks.append("<!-- %s -->\n%s" % (f, body.rstrip()))
            with open(os.path.join(archive_dir, ym + ".md"), "a", encoding="utf-8") as out:
                out.write("\n\n".join(chunks) + "\n")
            _git_rm(root, [os.path.join(LOGS_DIR, f) for f in files])
            archived_months += 1
        # drop rotated files from the in-memory listing before selecting
        rolled = {f for files in rotated.values() for f in files}
        entries = [e for e in entries if e not in rolled]

    in_window = select_logs(entries, start, today)

    out = []
    out.append("SCAN WINDOW for memory-flush")
    out.append("Watermark: %s (source: %s)" % (last.isoformat() if last else "none", source))
    out.append("Scan start: %s   Today: %s%s" % (
        start.isoformat(), today.isoformat(), "   [CLAMPED: >14d gap, older entries unrecoverable]" if clamped else ""))
    if in_window:
        out.append("Read these %d in-window log file(s):" % len(in_window))
        out.extend("  %s/%s" % (LOGS_DIR, f) for f in in_window)
    else:
        out.append("No in-window log files. If nothing to promote, log MEMORY_FLUSH_OK.")
    remaining = len([e for e in entries if parse_daily(e) is not None])
    out.append("Log rotation: archived %d month(s); %d daily file(s) remain (threshold %d)." % (
        archived_months, remaining, ROTATE_THRESHOLD))
    out.extend(memory_size_report(memory_md))
    out.append("Do NOT recompute the window or rotate logs yourself. Run "
               "`python3 scripts/memory_prep.py stamp` as your final step.")
    print("\n".join(out))
    return 0


def _log_fingerprints(root):
    """{daily filename: log_fingerprint} for every daily log in memory/logs/."""
    logs_dir = os.path.join(root, LOGS_DIR)
    try:
        entries = os.listdir(logs_dir)
    except FileNotFoundError:
        return {}
    return {f: log_fingerprint(_read(os.path.join(logs_dir, f)))
            for f in entries if parse_daily(f) is not None}


def do_stamp(root, today):
    # structured watermark = source of truth; seen_logs lets the next tick's
    # `idle` gate tell whether anything new was logged since this flush
    state_path = os.path.join(root, STATE_FILE)
    with open(state_path, "w", encoding="utf-8") as fh:
        json.dump({
            "last_consolidated": today.isoformat(),
            "updated_at": datetime.datetime.now(datetime.timezone.utc)
                .strftime("%Y-%m-%dT%H:%M:%SZ"),
            "seen_logs": recent_fingerprints(_log_fingerprints(root), today),
        }, fh, indent=2, sort_keys=True)
        fh.write("\n")

    # mirror into the human-readable MEMORY.md line
    memory_path = os.path.join(root, MEMORY_MD)
    text = _read(memory_path)
    if text is not None:
        with open(memory_path, "w", encoding="utf-8") as fh:
            fh.write(stamp_memory_md(text, today))

    print("Stamped last_consolidated=%s (%s + MEMORY.md mirror)." % (today.isoformat(), STATE_FILE))
    return 0


def do_idle(root, today):
    idle, reason = idle_decision(_read(os.path.join(root, STATE_FILE)), _log_fingerprints(root), today)
    print(("IDLE: " if idle else "NOT IDLE: ") + reason)
    return 0 if idle else 1


def do_source(root, ref):
    parsed = parse_source(ref)
    if not parsed:
        print("unrecognized source ref: %s (expected logs/YYYY-MM-DD#<skill>)" % ref)
        return 2
    fname, skill = parsed
    text = _read(os.path.join(root, LOGS_DIR, fname))
    where = "%s/%s" % (LOGS_DIR, fname)
    if text is None:
        # rotated into the monthly archive by `window`
        where = "%s/%s.md" % (ARCHIVE_DIR, fname[:7])
        text = archived_day(_read(os.path.join(root, where)), fname)
    hits = extract_source(text, skill) if text is not None else []
    if not hits:
        print("source not found: %s (no '### %s' section in %s)" % (ref, skill, where))
        return 1
    print("# %s (from %s)\n" % (ref, where))
    print("\n\n".join(hits)[:8000])
    return 0


def main(argv):
    root = os.environ.get("AEON_REPO_ROOT", ".")
    if "--root" in argv:
        i = argv.index("--root")
        root = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    today = datetime.date.today()
    cmd = argv[0] if argv else ""
    if cmd == "window":
        return do_window(root, today)
    if cmd == "stamp":
        return do_stamp(root, today)
    if cmd == "idle":
        return do_idle(root, today)
    if cmd == "source" and len(argv) > 1:
        return do_source(root, argv[1])
    sys.stderr.write("usage: memory_prep.py {window|stamp|idle|source <ref>} [--root DIR]\n")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
