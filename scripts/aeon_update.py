#!/usr/bin/env python3
"""
aeon_update - the mechanical half of the aeon-update skill (S4-S8).

The skill used to spell these steps out as shell snippets: helper functions,
per-file loops, redirects into /tmp files. Claude Code's permission layer
refuses every one of those shapes in a skill run, so the model wrote its own
script and ran it with `bash`, which is refused as well. Two runs on
miroshark-aeon (2026-10-21) ended green with nothing synced. This script does
the whole compare/classify/apply pass in one allowed command
(`Bash(python3:*)` is in the write tier), so every disposition is decided by
code, not by the model's reading of the steps.

  python3 scripts/aeon_update.py plan --upstream OWNER/REPO --baseline SHA --head SHA
      S4-S6. Diffs upstream's BASELINE and HEAD trees, partitions the changed
      paths, 3-way classifies each OWNED file and stages every blob the apply
      step needs under $WORK. Mutates nothing in the repo, so `report` mode
      stops here. Prints a JSON summary; the full plan is $WORK/plan.json.

  python3 scripts/aeon_update.py apply
      S7-S8, on the checked-out aeon-update/* branch. Writes the CLEAN files,
      carries new skills' glyphs, regenerates the catalogs, runs the
      pack-registry and eyebrow-lock checks (reverting what would go red),
      runs validate-config, recomputes pending_conflicts and writes
      memory/topics/aeon-update-state.json. Prints a JSON result; the full
      result is $WORK/result.json. Stages nothing except deletions.

$WORK is $AEON_UPDATE_WORK, else ${RUNNER_TEMP:-/tmp}/aeon-update.
Exit codes: 0 done (read "status"), 2 usage or environment error,
3 baseline is not an ancestor of HEAD (plan only).

Test hooks: AEON_UPDATE_UPSTREAM_GIT=<dir> reads upstream from a local git
repo instead of `gh api`; AEON_UPDATE_EYEBROW_BIN=<path|none> picks the
eyebrow binary (none = unavailable, exercises the fail-safe).
"""
import argparse
import concurrent.futures
import difflib
import hashlib
import json
import os
import platform
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

STATE_FILE = "memory/topics/aeon-update-state.json"
PACK_UNIT = (
    "catalog/skill-packs.json",
    "docs/community-skill-packs.md",
    "scripts/validate-skill-packs.mjs",
    "scripts/tests/test_validate_skill_packs.sh",
    ".github/workflows/ci-skill-packs.yml",
)
OPERATOR_FILES = {
    "aeon.yml", "STRATEGY.md", ".mcp.json", "aeon.db", "skills.lock",
    "eyebrowlock.json", ".github/dependabot.yml",
}
OPERATOR_DIRS = ("soul/", "memory/", "output/", "apps/dashboard/outputs/")
CLEAN = ("CLEAN-ADD", "CLEAN-UPDATE", "CLEAN-MERGE", "CLEAN-DELETE")
CATALOG_GENERATORS = (
    ["bin/generate-skills-json"],
    ["bin/generate-packs-json"],
    ["bin/generate-skill-icons"],
)


def die(msg, code=2):
    print(json.dumps({"status": "AEON_UPDATE_ERROR", "error": msg}))
    sys.exit(code)


def run(cmd, cwd=None, input=None, check=False, env=None):
    p = subprocess.run(cmd, check=False, cwd=cwd, input=input, capture_output=True, env=env)
    if check and p.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}: {p.stderr.decode(errors='replace').strip()[-300:]}")
    return p


def blob_sha(data):
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def work_dir():
    base = os.environ.get("AEON_UPDATE_WORK") or os.path.join(os.environ.get("RUNNER_TEMP") or "/tmp", "aeon-update")
    return Path(base)


def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# --- upstream backends --------------------------------------------------------

class GhUpstream:
    """Reads upstream through `gh api` (auth from GITHUB_TOKEN / GH_TOKEN)."""

    def __init__(self, repo):
        self.repo = repo

    def _api(self, path, raw=False):
        cmd = ["gh", "api", f"repos/{self.repo}/{path}"]
        if raw:
            cmd[2:2] = ["-H", "Accept: application/vnd.github.raw"]
        p = run(cmd)
        if p.returncode != 0:
            err = (p.stderr + p.stdout).decode(errors="replace")
            if "HTTP 404" in err or '"status":"404"' in err.replace(" ", ""):
                return None
            raise RuntimeError(f"gh api {path}: {err.strip()[-300:]}")
        return p.stdout if raw else json.loads(p.stdout or b"null")

    def compare(self, base, head):
        c = self._api(f"compare/{base}...{head}")
        if c is None:
            return None
        return {
            "status": c.get("status"),
            "ahead": c.get("ahead_by", 0),
            "behind": c.get("behind_by", 0),
            "commits": [
                {"sha": x["sha"], "msg": x["commit"]["message"].split("\n")[0], "date": x["commit"]["author"]["date"]}
                for x in c.get("commits") or []
            ],
        }

    def tree(self, sha):
        t = self._api(f"git/trees/{sha}?recursive=1")
        if t is None:
            raise RuntimeError(f"tree {sha} not found")
        if t.get("truncated"):
            raise RuntimeError(f"tree {sha} is truncated (repo too large for one recursive tree call)")
        return {e["path"]: (e["mode"], e["sha"]) for e in t["tree"] if e["type"] in ("blob", "commit")}

    def blob(self, sha):
        data = self._api(f"git/blobs/{sha}", raw=True)
        if data is None:
            raise RuntimeError(f"blob {sha} not found")
        return data

    def path_commits(self, path, head):
        rows = self._api(f"commits?sha={head}&path={urllib.parse.quote(path)}&per_page=30") or []
        return [r["sha"] for r in rows]


class GitUpstream:
    """Reads upstream from a local clone (tests, or an operator dry run)."""

    def __init__(self, path):
        self.path = path

    def _git(self, *args, check=True):
        return run(["git", *args], cwd=self.path, check=check)

    def compare(self, base, head):
        if self._git("cat-file", "-e", f"{base}^{{commit}}", check=False).returncode != 0:
            return None
        if base == head:
            return {"status": "identical", "ahead": 0, "behind": 0, "commits": []}
        if self._git("merge-base", "--is-ancestor", base, head, check=False).returncode != 0:
            return {"status": "diverged", "ahead": 0, "behind": 1, "commits": []}
        log = self._git("log", "--reverse", "--format=%H%x09%aI%x09%s", f"{base}..{head}").stdout.decode()
        commits = []
        for line in log.splitlines():
            sha, date, msg = line.split("\t", 2)
            commits.append({"sha": sha, "msg": msg, "date": date})
        return {"status": "ahead", "ahead": len(commits), "behind": 0, "commits": commits}

    def tree(self, sha):
        out = self._git("ls-tree", "-r", "-z", sha).stdout.decode()
        tree = {}
        for rec in out.split("\0"):
            if not rec:
                continue
            meta, path = rec.split("\t", 1)
            mode, _typ, obj = meta.split(" ")
            tree[path] = (mode, obj)
        return tree

    def blob(self, sha):
        return self._git("cat-file", "blob", sha).stdout

    def path_commits(self, path, head):
        return self._git("log", "--format=%H", "-n", "30", head, "--", path).stdout.decode().split()


def upstream_backend(repo):
    local = os.environ.get("AEON_UPDATE_UPSTREAM_GIT")
    return GitUpstream(local) if local else GhUpstream(repo)


# --- local tree ---------------------------------------------------------------

def local_entry(path):
    """(mode, sha) of the working-tree copy, or None when absent."""
    if os.path.islink(path):
        return ("120000", blob_sha(os.readlink(path).encode()))
    if os.path.isdir(path):
        return ("040000", "dir")
    if not os.path.isfile(path):
        return None
    data = Path(path).read_bytes()
    mode = "100755" if os.stat(path).st_mode & stat.S_IXUSR else "100644"
    return (mode, blob_sha(data))


def same(a, b):
    """Two entries are the same file when content and the exec bit agree."""
    if a is None or b is None:
        return a is b
    return a[1] == b[1] and (a[0] == "100755") == (b[0] == "100755")


def operator_owned(p):
    if p in OPERATOR_FILES:
        return True
    if "/" not in p and p.startswith(".env"):
        return True
    if p.startswith(OPERATOR_DIRS):
        return True
    if p.startswith(".claude/") and not p.startswith(".claude/skills/aeon/"):
        return True
    if p.startswith("catalog/") and p.count("/") == 1 and p.endswith(".json") and p != "catalog/skill-packs.json":
        return True
    return False


def skill_of(p):
    m = re.match(r"skills/([^/]+)/", p)
    return m.group(1) if m else None


def enabled_skills():
    try:
        text = Path("aeon.yml").read_text()
    except OSError:
        return set()
    return set(re.findall(r"^  ([A-Za-z0-9_-]+): *\{[^}]*enabled: true", text, re.MULTILINE))


def write_blob(work, sha, data):
    d = work / "blobs"
    d.mkdir(parents=True, exist_ok=True)
    (d / sha).write_bytes(data)


def read_blob(work, sha):
    return (work / "blobs" / sha).read_bytes()


def safe_name(p):
    return p.replace("/", "__")


def text_diff(a, b, path):
    if b"\0" in a[:8000] or b"\0" in b[:8000]:
        return f"(binary file {path} changed)\n"
    return "".join(difflib.unified_diff(
        a.decode(errors="replace").splitlines(True), b.decode(errors="replace").splitlines(True),
        f"a/{path}", f"b/{path}", n=2,
    ))


def load_state():
    try:
        return json.loads(Path(STATE_FILE).read_text())
    except (OSError, ValueError):
        return {}


# --- plan (S4-S6) -------------------------------------------------------------

def classify(path, base, head, local, enabled, head_tree):
    """Disposition for one OWNED path from its BASELINE, HEAD and local entries."""
    if base is not None and head is not None and same(base, head):
        return "SKIP", "unchanged-upstream"
    for e in (base, head):
        if e is not None and e[0] == "160000":
            return ("SKIP", "already-synced") if same(local, head) else ("CONFLICT", "submodule")
    if local is not None and local[0] == "040000":
        return "CONFLICT", "local-directory"
    if head is None:
        if local is None:
            return "SKIP", "already-removed"
        if not same(local, base):
            return "CONFLICT", "removed-upstream-local-edited"
        slug = skill_of(path)
        if slug and slug in enabled and f"skills/{slug}/SKILL.md" not in head_tree:
            return "CONFLICT", "enabled-skill-removed-upstream"
        return "CLEAN-DELETE", ""
    if base is None:
        if local is None:
            return "CLEAN-ADD", ""
        if same(local, head):
            return "SKIP", "already-synced"
        return "CONFLICT", "local-collision"
    if same(local, head):
        return "SKIP", "already-synced"
    if local is None:
        return "CONFLICT", "deleted-locally"
    if same(local, base):
        return "CLEAN-UPDATE", ""
    return "MERGE", ""


def three_way(work, path, base_data, head_data, idx):
    d = work / "merge" / str(idx)
    d.mkdir(parents=True, exist_ok=True)
    (d / "base").write_bytes(base_data)
    (d / "head").write_bytes(head_data)
    shutil.copyfile(path, d / "local")
    p = run(["git", "merge-file", "-p", "--diff3", str(d / "local"), str(d / "base"), str(d / "head")])
    if p.returncode == 0:
        (d / "merged").write_bytes(p.stdout)
        return True, str(d / "merged")
    return False, None


def packs_subset(local_bytes, head_bytes):
    try:
        lp = {x.get("repo") for x in json.loads(local_bytes).get("packs", [])}
        hp = {x.get("repo") for x in json.loads(head_bytes).get("packs", [])}
    except (ValueError, AttributeError):
        return False
    return lp <= hp


def cmd_plan(args):
    work = work_dir()
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    up = upstream_backend(args.upstream)
    try:
        cmp = up.compare(args.baseline, args.head)
    except RuntimeError as e:
        die(str(e))
    if cmp is None or cmp["status"] in ("diverged", "behind"):
        print(json.dumps({"status": "AEON_UPDATE_BASELINE_UNREACHABLE", "baseline": args.baseline, "head": args.head,
                          "compare_status": cmp and cmp["status"]}))
        sys.exit(3)
    if cmp["status"] == "identical":
        # Nothing to apply, but a prior conflict may have been resolved by hand since.
        try:
            head_tree = up.tree(args.head)
        except RuntimeError as e:
            die(str(e))
        prior = load_state().get("pending_conflicts") or []
        print(json.dumps({"status": "AEON_UPDATE_IN_SYNC", "baseline": args.baseline, "head": args.head,
                          "pending_conflicts": compute_pending([], prior, head_tree, enabled_skills())}, indent=1))
        return
    try:
        base_tree = up.tree(args.baseline)
        head_tree = up.tree(args.head)
    except RuntimeError as e:
        die(str(e))

    changed = {p for p in set(base_tree) | set(head_tree) if base_tree.get(p) != head_tree.get(p)}
    if changed & set(PACK_UNIT):
        changed |= set(PACK_UNIT)
    changed.add("catalog/skill-packs.json")
    enabled = enabled_skills()

    entries, fetch = [], set()
    for path in sorted(changed):
        base, head = base_tree.get(path), head_tree.get(path)
        local = local_entry(path)
        e = {"path": path, "base": base, "head": head, "local": local, "reason": ""}
        if operator_owned(path):
            e["disposition"] = "OPERATOR" if base != head else "SKIP"
        else:
            e["disposition"], e["reason"] = classify(path, base, head, local, enabled, head_tree)
        if e["disposition"] == "SKIP":
            continue
        entries.append(e)
        for side in ("base", "head"):
            if e[side] and e[side][0] != "160000":
                fetch.add(e[side][1])
    if "catalog/skill-icons.json" in head_tree:
        fetch.add(head_tree["catalog/skill-icons.json"][1])
    if "eyebrowlock.json" in head_tree:
        fetch.add(head_tree["eyebrowlock.json"][1])
    if "eyebrowlock.json" in base_tree:
        fetch.add(base_tree["eyebrowlock.json"][1])

    unreadable = {}

    def get(sha):
        try:
            write_blob(work, sha, up.blob(sha))
        except RuntimeError as e:
            unreadable[sha] = str(e)

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        list(pool.map(get, sorted(fetch)))

    for i, e in enumerate(entries):
        need = [e[s][1] for s in ("base", "head") if e[s] and e[s][0] != "160000"]
        if any(sha in unreadable for sha in need):
            e["disposition"], e["reason"] = "UNREADABLE", "; ".join(unreadable[s] for s in need if s in unreadable)
            continue
        if e["disposition"] == "MERGE":
            path, base_data, head_data = e["path"], read_blob(work, e["base"][1]), read_blob(work, e["head"][1])
            if path == "catalog/skill-packs.json" and packs_subset(Path(path).read_bytes(), head_data):
                e["disposition"], e["reason"] = "CLEAN-UPDATE", "stale-copy"
                continue
            ok, merged = three_way(work, path, base_data, head_data, i)
            if ok:
                e["disposition"], e["merged"] = "CLEAN-MERGE", merged
            else:
                e["disposition"], e["reason"] = "CONFLICT", "operator-customized"

    unit = [e for e in entries if e["path"] in PACK_UNIT]
    if any(e["disposition"] == "CONFLICT" for e in unit):
        for e in unit:
            if e["disposition"] in CLEAN:
                e["disposition"], e["reason"] = "CONFLICT", "skill-packs-unit"

    in_range = {c["sha"] for c in cmp["commits"]}
    diffs = work / "diffs"
    diffs.mkdir()
    surfaced = [e for e in entries if e["disposition"] in ("CONFLICT", "OPERATOR")]

    def describe(e):
        try:
            e["upstream_commits"] = [s[:7] for s in up.path_commits(e["path"], args.head) if s in in_range]
        except RuntimeError:
            e["upstream_commits"] = []
        a = read_blob(work, e["base"][1]) if e["base"] and e["base"][0] != "160000" else b""
        b = read_blob(work, e["head"][1]) if e["head"] and e["head"][0] != "160000" else b""
        e["diff"] = str(diffs / (safe_name(e["path"]) + ".diff"))
        Path(e["diff"]).write_text(text_diff(a, b, e["path"]))

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        list(pool.map(describe, surfaced))

    plan = {
        "upstream": args.upstream, "baseline": args.baseline, "head": args.head,
        "ahead": cmp["ahead"], "commits": cmp["commits"], "entries": entries,
        "head_icons": head_tree.get("catalog/skill-icons.json"),
        "head_lock": head_tree.get("eyebrowlock.json"),
        "base_lock": base_tree.get("eyebrowlock.json"),
        "head_tree": head_tree,
    }
    (work / "plan.json").write_text(json.dumps(plan, indent=2))
    prior = load_state().get("pending_conflicts") or []
    pending = compute_pending(entries, prior, head_tree, enabled_skills())
    print(json.dumps(summary(plan, entries, pending, work), indent=1))


def summary(plan, entries, pending, work, extra=None):
    by = {}
    for e in entries:
        by.setdefault(e["disposition"], []).append(e["path"])
    out = {
        "status": "AEON_UPDATE_PLANNED",
        "upstream": plan["upstream"],
        "range": f"{plan['baseline'][:7]}..{plan['head'][:7]}",
        "ahead": plan["ahead"],
        "counts": {k: len(v) for k, v in sorted(by.items())},
        "clean": {k: by[k] for k in CLEAN if k in by},
        "conflicts": [
            {"path": e["path"], "reason": e["reason"], "upstream_commits": e.get("upstream_commits", []), "diff": e.get("diff")}
            for e in entries if e["disposition"] == "CONFLICT"
        ],
        "operator": [{"path": e["path"], "diff": e.get("diff")} for e in entries if e["disposition"] == "OPERATOR"],
        "unreadable": [{"path": e["path"], "error": e["reason"]} for e in entries if e["disposition"] == "UNREADABLE"],
        "pending_conflicts": pending,
        "commits": [f"{c['sha'][:7]} {c['msg']}" for c in plan["commits"]],
        "work": str(work),
    }
    if extra:
        out.update(extra)
    return out


def compute_pending(entries, prior, head_tree, enabled):
    """S8: this run's conflicts plus prior entries that are still divergent."""
    now = {e["path"]: e for e in entries}
    out = [
        {"path": e["path"], "reason": e["reason"], "upstream_commits": e.get("upstream_commits", [])}
        for e in entries if e["disposition"] == "CONFLICT"
    ]
    seen = {x["path"] for x in out}
    for p in prior:
        path = p.get("path")
        if not path or path in seen:
            continue
        e = now.get(path)
        if e and e["disposition"] in CLEAN:
            continue
        if p.get("reason") == "enabled-skill-removed-upstream":
            slug = skill_of(path)
            if slug in enabled and path not in head_tree:
                out.append(p)
                seen.add(path)
            continue
        if not same(local_entry(path), head_tree.get(path)):
            out.append(p)
            seen.add(path)
    return out


# --- apply (S7-S8) ------------------------------------------------------------

def parses(path, data):
    try:
        if path.endswith(".json"):
            json.loads(data)
        elif path.endswith((".yml", ".yaml")):
            try:
                import yaml
            except ImportError:
                return True
            list(yaml.safe_load_all(data))
    except Exception:  # noqa: BLE001 - any parse error means "do not ship it"
        return False
    return True


class Tree:
    """Applies entries and remembers each original so any of them can be reverted."""

    def __init__(self, work):
        self.work = work
        self.saved = {}

    def _save(self, path):
        if path in self.saved:
            return
        if os.path.islink(path):
            self.saved[path] = ("link", os.readlink(path))
        elif os.path.isfile(path):
            self.saved[path] = ("file", Path(path).read_bytes(), os.stat(path).st_mode)
        else:
            self.saved[path] = ("absent",)

    def put(self, path, data, mode):
        self._save(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        if os.path.islink(path) or os.path.exists(path):
            os.remove(path)
        if mode == "120000":
            os.symlink(data.decode(), path)
            return
        Path(path).write_bytes(data)
        if mode == "100755":
            os.chmod(path, os.stat(path).st_mode | 0o111)

    def delete(self, path):
        self._save(path)
        tracked = run(["git", "ls-files", "--error-unmatch", "--", path]).returncode == 0
        if tracked:
            run(["git", "rm", "-q", "--", path], check=True)
        elif os.path.lexists(path):
            os.remove(path)

    def revert(self, path):
        s = self.saved.pop(path, None)
        if s is None:
            return
        run(["git", "reset", "-q", "--", path])
        if os.path.islink(path) or os.path.exists(path):
            os.remove(path)
        if s[0] == "link":
            os.symlink(s[1], path)
        elif s[0] == "file":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            Path(path).write_bytes(s[1])
            os.chmod(path, stat.S_IMODE(s[2]))


def apply_entry(tree, work, e):
    path, d = e["path"], e["disposition"]
    if d == "CLEAN-DELETE":
        tree.delete(path)
        return None
    if d == "CLEAN-MERGE":
        data = Path(e["merged"]).read_bytes()
        mode = e["head"][0] if e["base"][0] != e["head"][0] else e["local"][0]
    else:
        data, mode = read_blob(work, e["head"][1]), e["head"][0]
    if mode != "120000" and not parses(path, data):
        return "parse-failed"
    tree.put(path, data, mode)
    return None


def run_tool(cmd):
    """Run a repo tool if this instance has it; None when the file is absent."""
    if not os.path.exists(cmd[1] if cmd[0] == "node" else cmd[0]):
        return None
    p = run(cmd)
    return {"cmd": " ".join(cmd), "rc": p.returncode, "out": (p.stdout + p.stderr).decode(errors="replace")[-1500:]}


def regen_catalogs():
    results = [run_tool(c) for c in CATALOG_GENERATORS] + [run_tool(["node", "scripts/gen-agents-md.js"])]
    return [r for r in results if r and r["rc"] != 0]


def go_json(data):
    """eyebrow writes Go-style JSON: 2-space indent, <, > and & escaped."""
    out = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    return out.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def carry_glyphs(work, plan, applied):
    """A new skill's glyph lives in the hand-authored catalog/skill-icons.json, which
    is regenerated rather than synced; copy upstream's entry for each new skill."""
    new = sorted({skill_of(e["path"]) for e in applied
                  if e["disposition"] == "CLEAN-ADD" and e["path"].endswith("/SKILL.md") and skill_of(e["path"])})
    if not new or not plan.get("head_icons") or not os.path.isfile("catalog/skill-icons.json"):
        return []
    try:
        up_icons = json.loads(read_blob(work, plan["head_icons"][1])).get("icons", {})
        local = json.loads(Path("catalog/skill-icons.json").read_text())
    except (OSError, ValueError):
        return []
    added = [s for s in new if s in up_icons and s not in local.get("icons", {})]
    for s in added:
        local.setdefault("icons", {})[s] = up_icons[s]
    if added:
        Path("catalog/skill-icons.json").write_text(json.dumps(local, indent=2, ensure_ascii=False) + "\n")
    return added


def eyebrow_binary(work):
    forced = os.environ.get("AEON_UPDATE_EYEBROW_BIN")
    if forced:
        return None if forced == "none" else forced
    found = shutil.which("eyebrow")
    if found:
        return found
    wf = Path(".github/workflows/ci-skill-integrity.yml")
    text = wf.read_text() if wf.exists() else ""
    # The step's `version:` input is the binary CI really runs; the `# vX` comment on
    # the uses: line can drift ahead of it after a Dependabot bump.
    m = re.search(r"alexverify/eyebrow/action@[^\n]*\n(?:[^\n]*\n){0,6}?\s*version:\s*(v\d+\.\d+\.\d+)", text)
    m = m or re.search(r"alexverify/eyebrow/action@[0-9a-f]+\s*#\s*(v\d+\.\d+\.\d+)", text)
    ver = m.group(1) if m else "v0.5.6"
    arch = {"x86_64": "amd64", "amd64": "amd64", "aarch64": "arm64", "arm64": "arm64"}.get(platform.machine().lower())
    osname = platform.system().lower()
    if not arch or osname not in ("linux", "darwin"):
        return None
    tb = f"eyebrow_{ver[1:]}_{osname}_{arch}.tar.gz"
    d = work / "eb"
    d.mkdir(exist_ok=True)
    p = run(["gh", "release", "download", ver, "-R", "alexverify/eyebrow", "-p", tb, "-p", "checksums.txt", "-D", str(d), "--clobber"])
    if p.returncode != 0:
        return None
    sums = {}
    for line in (d / "checksums.txt").read_text().splitlines():
        parts = line.split()
        if len(parts) == 2:
            sums[parts[1].lstrip("*")] = parts[0]
    if sums.get(tb) != hashlib.sha256((d / tb).read_bytes()).hexdigest():
        return None
    with tarfile.open(d / tb) as t:
        member = next((m for m in t.getmembers() if m.isfile() and os.path.basename(m.name) == "eyebrow"), None)
        if member is None:
            return None
        src = t.extractfile(member)
        (d / "eyebrow").write_bytes(src.read())
    os.chmod(d / "eyebrow", 0o755)
    return str(d / "eyebrow")


def eyebrow_scan(work):
    eb = eyebrow_binary(work)
    if not eb:
        return False, "eyebrow binary unavailable"
    # A local file hasher: no secrets, no network, so give it a scrubbed env.
    env = {"PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", "")}
    p = run([eb, "scan", "--path", ".", "--lockfile", "eyebrowlock.json"], env=env)
    if p.returncode != 0:
        return False, (p.stdout + p.stderr).decode(errors="replace")[-500:]
    return True, "scanned"


def lock_entry(lock, slug):
    want = f"skills/{slug}/SKILL.md"
    return [a for a in lock.get("artifacts", []) if a.get("discoveredFrom") == want]


def eyebrow_failsafe(work, plan, tree, entries):
    """Without a fresh scan, never ship a skill against a stale lock entry: carry
    upstream's entry when the skill matches HEAD exactly, else hold the skill."""
    try:
        local_lock = json.loads(Path("eyebrowlock.json").read_text())
    except (OSError, ValueError):
        local_lock = {"artifacts": []}
    up_lock = json.loads(read_blob(work, plan["head_lock"][1])) if plan.get("head_lock") else {"artifacts": []}
    base_lock = json.loads(read_blob(work, plan["base_lock"][1])) if plan.get("base_lock") else {"artifacts": []}
    slugs = {}
    for e in entries:
        if e["disposition"] in ("CLEAN-ADD", "CLEAN-UPDATE", "CLEAN-MERGE") and e["path"].endswith("/SKILL.md"):
            slug = skill_of(e["path"])
            if slug and e["path"] == f"skills/{slug}/SKILL.md":
                slugs[slug] = e
    carried, held = [], []
    for slug, e in sorted(slugs.items()):
        mine = lock_entry(local_lock, slug)
        new = e["disposition"] == "CLEAN-ADD" or not mine
        findings = any(a.get("findings") for a in mine)
        caps = [a.get("capabilities") for a in lock_entry(base_lock, slug)] != [a.get("capabilities") for a in lock_entry(up_lock, slug)]
        if not (new or findings or caps):
            continue
        up_tree = {p: v for p, v in plan["head_tree"].items() if p.startswith(f"skills/{slug}/")}
        local_paths = set()
        for root, _dirs, files in os.walk(f"skills/{slug}"):
            local_paths.update(os.path.join(root, f) for f in files)
        identical = set(up_tree) == local_paths and all(same(local_entry(p), tuple(v)) for p, v in up_tree.items())
        theirs = lock_entry(up_lock, slug)
        if identical and len(theirs) == 1:
            want = f"skills/{slug}/SKILL.md"
            arts = local_lock.setdefault("artifacts", [])
            if mine:
                local_lock["artifacts"] = [theirs[0] if a.get("discoveredFrom") == want else a for a in arts]
            else:
                arts.extend(theirs)
            carried.append(slug)
            continue
        for x in entries:
            if skill_of(x["path"]) == slug and x["disposition"] in CLEAN:
                tree.revert(x["path"])
                x["disposition"], x["reason"] = "CONFLICT", "needs-eyebrowlock-scan"
        held.append(slug)
    if carried:
        Path("eyebrowlock.json").write_text(go_json(local_lock))
    return carried, held


def cmd_apply(_args):
    work = work_dir()
    try:
        plan = json.loads((work / "plan.json").read_text())
    except (OSError, ValueError):
        die(f"no plan at {work}/plan.json: run `plan` first")
    branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.decode().strip()
    if not branch.startswith("aeon-update/"):
        die(f"on branch {branch!r}: check out the aeon-update/sync-* branch first (S7)")
    entries = plan["entries"]
    for e in entries:
        for k in ("base", "head", "local"):
            if e.get(k):
                e[k] = tuple(e[k])
    tree = Tree(work)
    for e in entries:
        if e["disposition"] not in CLEAN:
            continue
        if not same(local_entry(e["path"]), e["local"]):
            e["disposition"], e["reason"] = "CONFLICT", "changed-since-plan"
            continue
        err = apply_entry(tree, work, e)
        if err:
            e["disposition"], e["reason"] = "CONFLICT", err

    notes = {}
    unit = [e for e in entries if e["path"] in PACK_UNIT]
    if any(e["disposition"] in CLEAN for e in unit):
        r = run_tool(["node", "scripts/validate-skill-packs.mjs"])
        if r and r["rc"] != 0:
            for e in unit:
                if e["disposition"] in CLEAN:
                    tree.revert(e["path"])
                    e["disposition"], e["reason"] = "CONFLICT", "skill-packs-parity"
            notes["skill_packs_validator"] = r["out"]

    # Lock first (it only reads skills/), then glyphs + catalogs from the final tree,
    # so a held skill never leaves a glyph or catalog row behind.
    if any(e["path"].startswith("skills/") for e in entries if e["disposition"] in CLEAN):
        ok, why = eyebrow_scan(work)
        notes["eyebrow"] = why
        if not ok:
            notes["eyebrow_carried"], notes["eyebrow_held"] = eyebrow_failsafe(work, plan, tree, entries)
    applied = [e for e in entries if e["disposition"] in CLEAN]
    if any(e["path"].startswith("skills/") for e in applied):
        notes["glyphs_carried"] = carry_glyphs(work, plan, applied)
        notes["catalog_errors"] = regen_catalogs()

    head_tree = {p: tuple(v) for p, v in plan["head_tree"].items()}
    prior = load_state().get("pending_conflicts") or []
    pending = compute_pending(entries, prior, head_tree, enabled_skills())

    vc = run_tool(["node", "scripts/validate-config.js", "aeon.yml"])
    if vc and vc["rc"] != 0:
        notes["validate_config"] = vc["out"]

    if not applied:
        status = "AEON_UPDATE_MANUAL_ONLY"
    else:
        status = "AEON_UPDATE_APPLIED"
        state = load_state()
        count = lambda d: sum(1 for e in applied if e["disposition"] == d)
        state.update({
            "baseline_sha": plan["head"],
            "upstream": plan["upstream"],
            "last_run": today(),
            "last_pr": None,
            "applied": {"added": count("CLEAN-ADD"), "updated": count("CLEAN-UPDATE"),
                        "merged": count("CLEAN-MERGE"), "deleted": count("CLEAN-DELETE")},
            "pending_conflicts": pending,
        })
        Path(STATE_FILE).parent.mkdir(parents=True, exist_ok=True)
        Path(STATE_FILE).write_text(json.dumps(state, indent=2) + "\n")
    result = summary(plan, entries, pending, work, {"status": status, **{k: v for k, v in notes.items() if v}})
    (work / "result.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=1))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("plan")
    p.add_argument("--upstream", required=True)
    p.add_argument("--baseline", required=True)
    p.add_argument("--head", required=True)
    sub.add_parser("apply")
    args = ap.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", getattr(args, "upstream", "a/b")):
        die("--upstream must be owner/name")
    for k in ("baseline", "head"):
        if hasattr(args, k) and not re.fullmatch(r"[0-9a-fA-F]{7,40}", getattr(args, k)):
            die(f"--{k} must be a commit sha")
    top = run(["git", "rev-parse", "--show-toplevel"]).stdout.decode().strip()
    if not top:
        die("not inside a git repo")
    os.chdir(top)
    {"plan": cmd_plan, "apply": cmd_apply}[args.cmd](args)


if __name__ == "__main__":
    main()
