#!/usr/bin/env python3
"""
verify_output — deterministic checks on a skill's output (hardening §9).

The self-healing loop scores output with an LLM, which can't tell a real citation
from a hallucinated one. This adds a *deterministic* gate that runs first: pull the
URLs a skill cited and confirm they actually resolve. A dead citation is ground truth
the LLM scorer misses — it gets surfaced as a `dead_citation` flag and fed into the
(adversarial) scorer so confident-but-wrong output can't quietly score a 5.

Pure parts (URL extraction, verdict) are unit-tested; the live fetch is opt-in.

Usage:
  verify_output.py <file>            # extract cited URLs, print them
  verify_output.py <file> --check    # also fetch each (HEAD/GET) and emit a verdict
  cat out.md | verify_output.py -     # read stdin
Exit: 0 always (advisory); the JSON `verdict` is the signal.
"""
import argparse
import json
import re
import sys

_URL_RE = re.compile(r"https?://[^\s)\]<>\"'`]+")
_TRIM = ".,;:!?"


def extract_urls(text):
    """Cited URLs in order of appearance, de-duplicated, trailing punctuation stripped."""
    seen, out = set(), []
    for m in _URL_RE.findall(text or ""):
        u = m.rstrip(_TRIM)
        # drop a single unbalanced trailing paren/bracket (markdown link spillover)
        if u.endswith(")") and u.count("(") < u.count(")"):
            u = u[:-1]
        if u.endswith("]") and "[" not in u:
            u = u[:-1]
        if u and u not in seen:
            seen.add(u)
            out.append(u)
    return out


def verdict(results):
    """results: [{"url","status"}]. status 2xx/3xx = ok, else dead. -> summary dict."""
    dead = [r["url"] for r in results if not (200 <= int(r.get("status", 0)) < 400)]
    ok = [r["url"] for r in results if 200 <= int(r.get("status", 0)) < 400]
    return {
        "checked": len(results),
        "ok": len(ok),
        "dead": dead,
        "verdict": "fail" if dead else "pass",
        "flag": "dead_citation" if dead else None,
    }


def check_url(url, timeout=8):
    """Live reachability — HEAD, fall back to GET. Returns HTTP status or 0."""
    import urllib.request
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method,
                                         headers={"User-Agent": "aeon-verify/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status
        except Exception as e:  # noqa: BLE001 — any failure means "couldn't confirm"
            code = getattr(e, "code", None)
            if isinstance(code, int):
                return code
            continue
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--check", action="store_true", help="live-fetch each URL")
    ap.add_argument("--max", type=int, default=15, help="cap URLs checked (bounds runtime)")
    args = ap.parse_args()
    text = sys.stdin.read() if args.file == "-" else open(args.file, encoding="utf-8").read()

    urls = extract_urls(text)
    if not args.check:
        print(json.dumps({"urls": urls}, indent=2))
        return
    results = [{"url": u, "status": check_url(u, timeout=6)} for u in urls[:args.max]]
    out = {"urls": urls, **verdict(results), "results": results}
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
