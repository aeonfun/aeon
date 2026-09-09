#!/usr/bin/env python3
"""Submit a deployed Uniswap v4 hook to the public registry aeonfun/univ4-hooks.

Deterministic mechanics for the submit-hook skill (and deploy-uni-hook's publish
step). The listing prose (name/category/klass/mechanic/plain/rules) is passed in
by the calling skill; everything else - the v4 flags, the file, the aggregate,
the PR - is done here. The registry encodes a hook's flags in the low 14 bits of
its address, so we derive `flags` from the address and never trust a hand value.

All GitHub egress is via the `gh` CLI (ambient GH_TOKEN), so no URL or token ever
lands on a shell line and this helper's egress surface stays empty.

Usage:
  submit-univ4.py --address 0x.. --chain base --name MarketHoursGate \\
    --category Access --klass GATE --template freeform --stage deployed \\
    --mechanic "..." --plain "..." --rule "..." --rule "..." \\
    --date 2026-09-04 [--source aeon] [--verified] [--audit-url ..] [--dry-run]

Exit codes: 0 OK (PR opened, or fell back to an issue, or already listed);
1 bad input; 2 could not reach the registry.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

REGISTRY = "aeonfun/univ4-hooks"
FLAG_MASK = 0x3FFF
ADDR_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def run(cmd, cwd=None, check=True, capture=False):
    return subprocess.run(
        cmd, cwd=cwd, check=check, text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
    )


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def flags_hex(address):
    return "0x" + format(int(address, 16) & FLAG_MASK, "X")


def build_entry(a):
    entry = {
        "name": a.name,
        "source": a.source,
        "verified": bool(a.verified),
        "category": a.category,
        "klass": a.klass,
        "template": a.template,
        "stage": a.stage,
        "flags": flags_hex(a.address),
        "addresses": {a.chain: a.address},
        "mechanic": a.mechanic,
        "plain": a.plain,
        "rules": [r for r in (a.rule or []) if r.strip()],
        "date": a.date,
    }
    if a.audit_url:
        entry["auditUrl"] = a.audit_url
    if a.deployer:
        entry["deployer"] = a.deployer
    return entry


def already_listed(hooks_dir, address, slug):
    """True if this slug, or any file already carrying this address, exists."""
    target = os.path.join(hooks_dir, slug + ".json")
    if os.path.exists(target):
        return True
    addr = address.lower()
    if not os.path.isdir(hooks_dir):
        return False
    for f in os.listdir(hooks_dir):
        if not f.endswith(".json"):
            continue
        try:
            data = json.load(open(os.path.join(hooks_dir, f)))
        except Exception:
            continue
        if any(str(v).lower() == addr for v in (data.get("addresses") or {}).values()):
            return True
    return False


def file_issue_fallback(a, slug, reason):
    """No push access -> file the structured submit-hook issue instead."""
    body = (
        f"Automated submission from an aeon instance ({reason}).\n\n"
        f"### Chain\n\n{a.chain}\n\n### Hook address\n\n{a.address}\n\n"
        f"### Hook name\n\n{a.name}\n\n### Category\n\n{a.category}\n\n"
        f"### One-line summary\n\n{a.mechanic}\n\n### Plain-language description\n\n{a.plain}\n\n"
        f"### Rules\n\n" + "\n".join(r for r in (a.rule or []) if r.strip())
    )
    try:
        r = run(["gh", "issue", "create", "--repo", REGISTRY,
                 "--title", f"hook: {slug}", "--label", "hook-submission",
                 "--body", body], capture=True)
        print(r.stdout.strip())
        print(f"submit-hook: filed an issue (no PR access: {reason})", file=sys.stderr)
        return 0
    except subprocess.CalledProcessError as e:
        print(e.stdout or "", file=sys.stderr)
        print("submit-hook: could not open a PR or an issue on the registry", file=sys.stderr)
        return 2


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--address", required=True)
    p.add_argument("--chain", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--category", default="Access")
    p.add_argument("--klass", default="GATE")
    p.add_argument("--template", default="freeform")
    p.add_argument("--stage", default="deployed")
    p.add_argument("--mechanic", default="")
    p.add_argument("--plain", default="")
    p.add_argument("--rule", action="append", default=[])
    p.add_argument("--date", required=True)
    p.add_argument("--source", default="aeon")
    p.add_argument("--verified", action="store_true")
    p.add_argument("--audit-url", dest="audit_url", default="")
    p.add_argument("--deployer", default="")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()

    if not ADDR_RE.match(a.address):
        sys.exit(f"submit-hook: bad address {a.address!r}")
    slug = slugify(a.name)
    if not slug:
        sys.exit("submit-hook: name produced an empty slug")
    entry = build_entry(a)

    if a.dry_run:
        print(json.dumps(entry, indent=2))
        print(f"submit-hook: dry-run, would open a PR adding hooks/{slug}.json", file=sys.stderr)
        return 0

    work = tempfile.mkdtemp(prefix="univ4-")
    repo = os.path.join(work, "univ4-hooks")
    try:
        run(["gh", "repo", "clone", REGISTRY, repo, "--", "--depth", "1"], capture=True)
    except subprocess.CalledProcessError as e:
        print(getattr(e, "stdout", "") or "", file=sys.stderr)
        return 2

    hooks_dir = os.path.join(repo, "hooks")
    if already_listed(hooks_dir, a.address, slug):
        print(f"submit-hook: {a.address} / {slug} already listed - nothing to do")
        return 0

    with open(os.path.join(hooks_dir, slug + ".json"), "w") as f:
        f.write(json.dumps(entry, indent=2) + "\n")

    # Regenerate the aggregated registry so the registry's own --check gate passes.
    # aggregate.py is stdlib-only; validate.py needs jsonschema, so leave that to
    # the registry's CI (it runs on the PR).
    agg = run(["python3", "scripts/aggregate.py"], cwd=repo, check=False, capture=True)
    if agg.returncode != 0:
        print(agg.stdout, file=sys.stderr)
        return 2

    branch = f"hook-submission/{slug}"
    run(["git", "-C", repo, "config", "user.name", "aeon"], capture=True)
    run(["git", "-C", repo, "config", "user.email",
         "aeon@users.noreply.github.com"], capture=True)
    run(["git", "-C", repo, "checkout", "-b", branch], capture=True)
    run(["git", "-C", repo, "add", "hooks/", "hooklist.json", "HOOKS.md"], capture=True)
    msg = f"feat: list {a.name} ({a.chain} {a.address})\n\nAuto-submitted by an aeon instance after deploy."
    run(["git", "-C", repo, "commit", "-m", msg], capture=True)

    run(["gh", "auth", "setup-git"], check=False, capture=True)
    push = run(["git", "-C", repo, "push", "-u", "origin", branch], check=False, capture=True)
    if push.returncode != 0:
        return file_issue_fallback(a, slug, "push denied")

    pr = run(["gh", "pr", "create", "--repo", REGISTRY, "--base", "main",
              "--head", branch, "--label", "hook-submission",
              "--title", f"hook: {slug}",
              "--body", f"Auto-submitted by an aeon instance. {a.name} on {a.chain} "
                        f"({a.address}), flags {entry['flags']}. Flags + callbacks are "
                        f"decoded from the address and validated by CI."],
             check=False, capture=True)
    if pr.returncode != 0:
        return file_issue_fallback(a, slug, "pr create failed")
    print(pr.stdout.strip())
    return 0


if __name__ == "__main__":
    sys.exit(main())
