#!/usr/bin/env python3
"""aeon_update.py plans and applies an upstream sync without the model scripting it.

Builds a real upstream repo (BASELINE + HEAD commits) and an instance cloned
from BASELINE with operator edits, then runs `plan` and `apply` against the
local upstream (AEON_UPDATE_UPSTREAM_GIT) with no eyebrow binary, so the
lock fail-safe path runs.
"""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "aeon_update.py"
LINES = "".join(f"line {i}\n" for i in range(1, 11))


def lock(*entries):
    return {"version": 1, "artifacts": [
        {"discoveredFrom": f"skills/{slug}/SKILL.md", "name": slug, "capabilities": caps, "findings": findings}
        for slug, caps, findings in entries
    ]}


class AeonUpdateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.env = {
            **os.environ,
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_SYSTEM": os.devnull,
            "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
            "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid",
            "AEON_UPDATE_WORK": str(self.root / "work"),
            "AEON_UPDATE_EYEBROW_BIN": "none",
        }
        self.up = self.root / "upstream"
        self.inst = self.root / "instance"
        self.env["AEON_UPDATE_UPSTREAM_GIT"] = str(self.up)

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, cwd, *args):
        return subprocess.run(["git", *args], cwd=cwd, env=self.env, text=True, capture_output=True, check=True).stdout.strip()

    def write(self, base, files):
        for path, body in files.items():
            p = base / path
            if body is None:
                if p.exists():
                    p.unlink()
                continue
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(body if isinstance(body, str) else json.dumps(body, indent=2) + "\n")

    def tool(self, *args):
        p = subprocess.run([sys.executable, str(SCRIPT), *args], cwd=self.inst, env=self.env, text=True, capture_output=True)
        out = json.loads(p.stdout) if p.stdout.strip() else None
        return p.returncode, out, p.stderr

    def build(self):
        base_files = {
            "scripts/a.sh": "a1\n",
            "scripts/b.sh": LINES,
            "scripts/c.sh": LINES,
            "scripts/old.sh": "old\n",
            "scripts/edited-old.sh": "old\n",
            "scripts/resolved.sh": "r1\n",
            "scripts/still.sh": "s1\n",
            "docs/x.md": "moved\n",
            "skills/retired/SKILL.md": "retired\n",
            "skills/custom/SKILL.md": LINES,
            "aeon.yml": "skills:\n  retired: { enabled: true }\n",
            "catalog/skill-packs.json": {"packs": [{"repo": "a/one"}]},
            "catalog/skill-icons.json": {"version": 1, "icons": {"custom": "<path d='c'/>"}},
            "eyebrowlock.json": lock(("custom", {}, [{"line": 3}])),
        }
        self.git(self.root, "init", "-q", "-b", "main", str(self.up))
        self.write(self.up, base_files)
        os.chmod(self.up / "scripts/a.sh", 0o755)
        self.git(self.up, "add", "-A")
        self.git(self.up, "commit", "-qm", "base")
        self.base = self.git(self.up, "rev-parse", "HEAD")

        self.git(self.root, "clone", "-q", str(self.up), str(self.inst))
        self.write(self.inst, {
            "scripts/b.sh": LINES.replace("line 2\n", "line 2 operator\n"),
            "scripts/c.sh": LINES.replace("line 3\n", "line 3 operator\n"),
            "scripts/edited-old.sh": "old operator\n",
            "scripts/collide.sh": "mine\n",
            "scripts/still.sh": "s1 operator\n",
            "skills/custom/SKILL.md": LINES.replace("line 1\n", "line 1 operator\n"),
            "aeon.yml": "skills:\n  retired: { enabled: true }\n  mine: { enabled: true }\n",
            "memory/topics/aeon-update-state.json": {
                "baseline_sha": self.base, "upstream": "acme/aeon", "keep": "me",
                "pending_conflicts": [
                    {"path": "scripts/resolved.sh", "reason": "operator-customized"},
                    {"path": "scripts/still.sh", "reason": "operator-customized"},
                ],
            },
        })
        self.git(self.inst, "add", "-A")
        self.git(self.inst, "commit", "-qm", "operator edits")

        head_files = {
            "scripts/a.sh": "a2\n",
            "scripts/b.sh": LINES.replace("line 9\n", "line 9 upstream\n"),
            "scripts/c.sh": LINES.replace("line 3\n", "line 3 upstream\n"),
            "scripts/old.sh": None,
            "scripts/edited-old.sh": None,
            "scripts/resolved.sh": "r1\n",
            "scripts/still.sh": "s2\n",
            "scripts/new.sh": "new\n",
            "scripts/collide.sh": "theirs\n",
            "docs/x.md": None,
            "docs/y.md": "moved\n",
            "skills/retired/SKILL.md": None,
            "skills/custom/SKILL.md": LINES.replace("line 9\n", "line 9 upstream\n"),
            "skills/fresh/SKILL.md": "fresh <b>\n",
            "skills/fresh/helper.md": "helper\n",
            "conf/bad.json": "{not json\n",
            "aeon.yml": "skills:\n  retired: { enabled: false }\n  fresh: { enabled: false }\n",
            "catalog/skill-packs.json": {"packs": [{"repo": "a/one"}, {"repo": "b/two"}]},
            "catalog/skill-icons.json": {"version": 1, "icons": {"custom": "<path d='c'/>", "fresh": "<path d='f'/>"}},
            "eyebrowlock.json": lock(("custom", {}, [{"line": 3}]), ("fresh", {"network": ["x.dev"]}, [])),
        }
        self.write(self.up, head_files)
        os.chmod(self.up / "scripts/new.sh", 0o755)
        self.git(self.up, "add", "-A")
        self.git(self.up, "commit", "-qm", "upstream work")
        self.git(self.up, "commit", "-q", "--allow-empty", "-m", "second")
        self.head = self.git(self.up, "rev-parse", "HEAD")
        # the instance's frozen pack registry predates the baseline copy
        self.write(self.inst, {"catalog/skill-packs.json": {"packs": []}})
        self.git(self.inst, "commit", "-qam", "frozen registry")

    def test_plan_then_apply(self):
        self.build()
        rc, plan, err = self.tool("plan", "--upstream", "acme/aeon", "--baseline", self.base, "--head", self.head)
        self.assertEqual(rc, 0, err)
        self.assertEqual(plan["status"], "AEON_UPDATE_PLANNED")
        self.assertEqual(plan["ahead"], 2)
        self.assertEqual(self.git(self.inst, "status", "--porcelain"), "", "plan must not touch the repo")
        clean = plan["clean"]
        self.assertEqual(sorted(clean["CLEAN-ADD"]), ["conf/bad.json", "docs/y.md", "scripts/new.sh",
                                                      "skills/fresh/SKILL.md", "skills/fresh/helper.md"])
        self.assertEqual(sorted(clean["CLEAN-UPDATE"]), ["catalog/skill-packs.json", "scripts/a.sh"])
        self.assertEqual(sorted(clean["CLEAN-MERGE"]), ["scripts/b.sh", "skills/custom/SKILL.md"])
        self.assertEqual(sorted(clean["CLEAN-DELETE"]), ["docs/x.md", "scripts/old.sh"])
        reasons = {c["path"]: c["reason"] for c in plan["conflicts"]}
        self.assertEqual(reasons, {
            "scripts/c.sh": "operator-customized",
            "scripts/edited-old.sh": "removed-upstream-local-edited",
            "scripts/collide.sh": "local-collision",
            "scripts/still.sh": "operator-customized",
            "skills/retired/SKILL.md": "enabled-skill-removed-upstream",
        })
        c = next(x for x in plan["conflicts"] if x["path"] == "scripts/c.sh")
        self.assertIn("+line 3 upstream", Path(c["diff"]).read_text())
        self.assertEqual(len(c["upstream_commits"]), 1)
        self.assertIn("aeon.yml", [o["path"] for o in plan["operator"]])
        self.assertNotIn("eyebrowlock.json", json.dumps(plan["clean"]))

        rc, out, err = self.tool("apply")
        self.assertEqual(rc, 2, "apply must refuse to run on main")
        self.git(self.inst, "checkout", "-qb", f"aeon-update/sync-{self.head[:7]}")
        rc, res, err = self.tool("apply")
        self.assertEqual(rc, 0, err)
        self.assertEqual(res["status"], "AEON_UPDATE_APPLIED")
        f = lambda p: (self.inst / p).read_text()  # noqa: E731
        self.assertEqual(f("scripts/a.sh"), "a2\n")
        self.assertTrue(os.access(self.inst / "scripts/a.sh", os.X_OK))
        self.assertTrue(os.access(self.inst / "scripts/new.sh", os.X_OK))
        self.assertIn("line 2 operator", f("scripts/b.sh"))
        self.assertIn("line 9 upstream", f("scripts/b.sh"))
        self.assertEqual(f("scripts/c.sh"), LINES.replace("line 3\n", "line 3 operator\n"))
        self.assertFalse((self.inst / "scripts/old.sh").exists())
        self.assertFalse((self.inst / "docs/x.md").exists())
        self.assertEqual(f("docs/y.md"), "moved\n")
        self.assertTrue((self.inst / "skills/retired/SKILL.md").exists())
        self.assertEqual(f("aeon.yml"), "skills:\n  retired: { enabled: true }\n  mine: { enabled: true }\n")
        self.assertFalse((self.inst / "conf/bad.json").exists())
        self.assertEqual(json.loads(f("catalog/skill-packs.json"))["packs"][1]["repo"], "b/two")

        # eyebrow unavailable: the untouched new skill carries upstream's lock entry and
        # glyph; the operator-customized skill with findings is held back
        self.assertEqual(res["eyebrow_carried"], ["fresh"])
        self.assertEqual(res["eyebrow_held"], ["custom"])
        self.assertEqual(f("skills/custom/SKILL.md"), LINES.replace("line 1\n", "line 1 operator\n"))
        lk = f("eyebrowlock.json")
        self.assertIn('"x.dev"', lk)
        self.assertEqual(json.loads(lk)["artifacts"][1]["discoveredFrom"], "skills/fresh/SKILL.md")
        self.assertEqual(json.loads(f("catalog/skill-icons.json"))["icons"]["fresh"], "<path d='f'/>")
        self.assertEqual(res["glyphs_carried"], ["fresh"])

        reasons = {c["path"]: c["reason"] for c in res["conflicts"]}
        self.assertEqual(reasons["skills/custom/SKILL.md"], "needs-eyebrowlock-scan")
        self.assertEqual(reasons["conf/bad.json"], "parse-failed")
        state = json.loads(f("memory/topics/aeon-update-state.json"))
        self.assertEqual(state["baseline_sha"], self.head)
        self.assertEqual(state["keep"], "me")
        self.assertIsNone(state["last_pr"])
        self.assertEqual(state["applied"], {"added": 4, "updated": 2, "merged": 1, "deleted": 2})
        pending = {p["path"] for p in state["pending_conflicts"]}
        self.assertIn("scripts/still.sh", pending)
        self.assertNotIn("scripts/resolved.sh", pending)
        self.assertIn("skills/custom/SKILL.md", pending)
        self.assertIn("skills/retired/SKILL.md", pending)
        self.assertIn("D  scripts/old.sh", self.git(self.inst, "status", "--porcelain"))

    def test_in_sync_and_unreachable(self):
        self.build()
        rc, out, _ = self.tool("plan", "--upstream", "acme/aeon", "--baseline", self.head, "--head", self.head)
        self.assertEqual((rc, out["status"]), (0, "AEON_UPDATE_IN_SYNC"))
        # resolved.sh now matches HEAD, still.sh does not
        self.assertEqual([p["path"] for p in out["pending_conflicts"]], ["scripts/still.sh"])
        rc, out, _ = self.tool("plan", "--upstream", "acme/aeon", "--baseline", "deadbeef", "--head", self.head)
        self.assertEqual((rc, out["status"]), (3, "AEON_UPDATE_BASELINE_UNREACHABLE"))
        rc, out, _ = self.tool("plan", "--upstream", "acme/aeon", "--baseline", "x;y", "--head", self.head)
        self.assertEqual(rc, 2)


if __name__ == "__main__":
    unittest.main()
