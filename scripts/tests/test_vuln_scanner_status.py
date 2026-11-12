"""Contract checks, not a claim that a model followed the reporting instructions."""
from pathlib import Path
import unittest

SKILL = (Path(__file__).resolve().parents[2] / "skills/vuln-scanner/SKILL.md").read_text()


class ScannerStatusContract(unittest.TestCase):
    # The status rows are prose rules the model applies to each scanner call's exit
    # code (the skill no longer ships an if/else shell block, which the run refuses).
    @staticmethod
    def _rule(prefix):
        rows = [line for line in SKILL.splitlines() if line.startswith(f"- `{prefix}=timeout`")]
        assert len(rows) == 1, f"expected one status rule for {prefix}, got {len(rows)}"
        return rows[0]

    def test_history_status_uses_exit_code_not_finding_count(self):
        rule = self._rule("trufflehog-git")
        # Timeout first, then ok only on exit 0, everything else (incl. never ran) fail.
        self.assertIn("when TRUFFLEHOG_GIT_RC is `124`", rule)
        self.assertIn("`trufflehog-git=ok` when it is `0`", rule)
        self.assertIn("else `trufflehog-git=fail` (also when the pass never ran)", rule)
        self.assertLess(rule.index("=timeout"), rule.index("=ok"))
        self.assertLess(rule.index("=ok"), rule.index("=fail"))
        self.assertIn("Its exit code is TRUFFLEHOG_GIT_RC.", SKILL)

    def test_filesystem_clean_empty_stream_is_ok(self):
        rule = self._rule("trufflehog")
        self.assertIn("when TRUFFLEHOG_RC is `124`", rule)
        self.assertIn("`trufflehog=ok` when it is `0`", rule)
        self.assertIn("else `trufflehog=fail`", rule)
        self.assertIn("an exit-0 empty stream is a clean scan", rule)
        self.assertIn("Its exit code is TRUFFLEHOG_RC.", SKILL)

    def test_report_preserves_history_status(self):
        report = SKILL.split("### A7. Write local report", 1)[1].split("### A8.", 1)[0]
        self.assertIn("trufflehog-git", report)
        self.assertIn("sources.txt", report)

    def test_both_notification_templates_preserve_history_status(self):
        notify = SKILL.split("### A8. Notify", 1)[1].split("## Arm D", 1)[0]
        rows = [line for line in notify.splitlines() if "Scanners:" in line]
        self.assertEqual(len(rows), 2)
        for row in rows:
            self.assertIn("trufflehog-git=<ok|fail|timeout>", row)

    def test_log_preserves_history_status(self):
        log = SKILL.split("## Log", 1)[1].split("## Network note", 1)[0]
        self.assertIn("trufflehog-git=ok|fail|timeout", log)


if __name__ == "__main__":
    unittest.main()
