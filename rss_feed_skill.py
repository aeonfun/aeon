"""rss-feed skill orchestrator. Captures baseline, regenerates, validates, classifies, prints state."""
import hashlib
import json
import os
import re
import subprocess
import sys


FEED_PATH = "articles/feed.xml"


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def entry_titles(path):
    with open(path, encoding="utf-8") as f:
        content = f.read()
    titles = re.findall(r"<title>([^<]+)</title>", content)
    return sorted(set(titles[1:])) if titles else []


def main():
    repo_slug_arg = os.environ.get("AEON_VAR", "").strip()

    # Step 2: baseline
    if os.path.isfile(FEED_PATH):
        prev_hash = sha256_file(FEED_PATH)
        prev_titles = entry_titles(FEED_PATH)
    else:
        prev_hash = ""
        prev_titles = []

    # Step 3: regenerate
    cmd = ["bash", "scripts/generate-feed.sh"]
    if repo_slug_arg:
        cmd.append(repo_slug_arg)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    gen_stdout = proc.stdout
    gen_stderr = proc.stderr
    gen_rc = proc.returncode

    # Step 4: validate
    status = ""
    validation_err = ""
    xmllint = subprocess.run(
        ["xmllint", "--noout", FEED_PATH], capture_output=True, text=True
    )
    if xmllint.returncode != 0:
        status = "RSS_FEED_ERROR"
        validation_err = (xmllint.stderr or "xmllint failed").strip()

    # Step 5: classify
    if status != "RSS_FEED_ERROR":
        new_hash = sha256_file(FEED_PATH)
        new_titles = entry_titles(FEED_PATH)
        prev_set = set(prev_titles)
        new_set = set(new_titles)
        added = sorted(new_set - prev_set)
        removed = sorted(prev_set - new_set)
        entry_count = len(new_titles)

        if prev_hash == new_hash:
            status = "RSS_FEED_NO_CHANGE"
        elif not added and not removed:
            status = "RSS_FEED_METADATA_ONLY"
        else:
            status = "RSS_FEED_OK"
    else:
        new_hash = ""
        added = []
        removed = []
        entry_count = 0

    # Detect repo for subscribe URL
    try:
        remote = subprocess.check_output(
            ["git", "remote", "get-url", "origin"], text=True
        ).strip()
    except Exception:
        remote = ""
    m = re.search(r"github\.com[:/]([^/]+/[^/.]+)", remote)
    repo_slug = repo_slug_arg or (m.group(1) if m else "aaronjmars/aeon")

    out = {
        "status": status,
        "prev_hash": prev_hash,
        "new_hash": new_hash,
        "entry_count": entry_count,
        "added": added,
        "removed": removed,
        "validation_err": validation_err,
        "gen_rc": gen_rc,
        "gen_stdout": gen_stdout[-2000:],
        "gen_stderr": gen_stderr[-2000:],
        "repo_slug": repo_slug,
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
