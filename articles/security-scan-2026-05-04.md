# Security Scan — 2026-05-04

**Verdict:** ATTENTION (no new findings; 2 PERSISTENT HIGH still open under ISS-015)
**Scope:** full corpus (`var` empty)
**Scanner:** inline-grep-fallback (scan.sh shell-out blocked by sandbox; same HIGH/MEDIUM/LOW pattern library applied via Grep)
**Counts:** 113 SKILL.md + 3 workflows + 11 scripts + 1 companion script scanned · 2 HIGH · 2 MEDIUM (post-filter) · 0 NEW · 0 RESOLVED · 4 PERSISTENT
**Exit status:** `SECURITY_SCAN_NOCHANGE`

## Needs attention (NEW high-severity this run)

None. The two open HIGH findings are persistent from the 2026-04-27 run and remain tracked under ISS-015.

## Resolved since last scan

None.

## Persistent findings (unchanged)

| File | Line | Severity | Pattern | ISS |
|------|------|----------|---------|-----|
| `.github/workflows/messages.yml` | 577 | HIGH | `github_event_interpolation_in_run_block` (toJson client_payload into single-quoted echo) | ISS-015 |
| `.github/workflows/messages.yml` | 578 | HIGH | `github_event_interpolation_in_run_block` (`${{ github.event.action }}` direct in `run:`) | ISS-015 |
| `skills/monitor-runners/SKILL.md` | 74 | MEDIUM (raw HIGH, code-fence downgrade) | `eval\s` inside ```bash code block | — |
| `skills/monitor-runners/SKILL.md` | 77 | MEDIUM (raw HIGH, code-fence downgrade) | `eval\s` inside ```bash code block | — |

## Per-file results

| File | Status | HIGH | MEDIUM | LOW |
|------|--------|------|--------|-----|
| `.github/workflows/messages.yml` | FAIL | 2 | 0 | 0 |
| `.github/workflows/aeon.yml` | PASS | 0 | 0 | 0 |
| `.github/workflows/chain-runner.yml` | PASS | 0 | 0 | 0 |
| `skills/monitor-runners/SKILL.md` | WARN | 0 | 2 | 0 |
| (108 other SKILL.md, 11 scripts, 1 companion) | PASS | 0 | 0 | 0 |

## Pattern-classification notes (continuity with 2026-04-27 run)

The raw scanner pattern library would also fire HIGH on a large family of `curl -H "Authorization: Bearer $TOKEN" …` and `curl … "https://…/${API_KEY}/…"` lines in `.github/workflows/messages.yml`, `.github/workflows/aeon.yml`, and `scripts/postprocess-*.sh`/`scripts/prefetch-*.sh`. These match the HIGH patterns `\$DISCORD_BOT_TOKEN`, `\$SLACK_BOT_TOKEN`, `curl.*\$\{`, and `curl.*\$[A-Z_]`. They are the *intended* auth-to-the-API design (sending the Discord bot token to Discord's own API; sending Telegram bot token to Telegram's own API; sending Replicate token to Replicate; etc.) — not exfiltration.

The 2026-04-27 fallback run classified these as known-design and did not surface them as actionable HIGH. This run preserves that classification for continuity. **Operator action recommended:** add a documented baseline-suppression block to `skills/security/scan-baseline.yml` covering these specific lines, so future scans (including the canonical `scan.sh` JSON path when sandbox unblocks) drop them automatically with a recorded reason. Candidate lines (file, line, pattern):

- `.github/workflows/messages.yml:482, 500, 506, 517, 527, 538, 650` — bot/webhook auth in pollers and senders
- `.github/workflows/aeon.yml:333, 341, 351, 356, 668, 674, 680` — telegram/discord/slack notify steps
- `scripts/postprocess-replicate.sh:70` — replicate poll
- `scripts/postprocess-admanage.sh:85`, `scripts/postprocess-admanage-create.sh:81, 147` — admanage POSTs
- `scripts/prefetch-xai.sh:171, 183` — Vercel deploy lookup

The MEDIUM-tier `base64 -d` matches in `gh api … | base64 -d` decode chains across `skills/fork-fleet`, `skills/issue-triage`, `skills/skill-leaderboard`, `skills/repo-article`, `skills/fleet-control`, `skills/fork-skill-digest`, `skills/skill-update-check`, `scripts/sync-upstream.sh`, and the `printf '%s' "$TG_CHUNK_B64" | base64 -d` in `.github/workflows/aeon.yml:332` similarly decode their own GH-API responses or chunks the workflow itself encoded — same continuity treatment applies.

The MEDIUM-tier `git push --force-with-lease` matches in `.github/workflows/aeon.yml:722` and `.github/workflows/messages.yml:753` are scoped to `$CURRENT_BRANCH` (not `main`), and `--force-with-lease` is the safe variant. Continuity treatment applies.

## Appendix — all current findings (post-filter, post-baseline)

```json
[
  {
    "file": ".github/workflows/messages.yml",
    "line": 577,
    "pattern": "github_event_interpolation_in_run_block",
    "match": "MESSAGE=$(echo '${{ toJson(github.event.client_payload.message) }}' | jq -r '.')",
    "severity": "high",
    "fingerprint": "msg-yml-577-toJson-clientpayload",
    "issue_id": "ISS-015",
    "delta": "PERSISTENT"
  },
  {
    "file": ".github/workflows/messages.yml",
    "line": 578,
    "pattern": "github_event_interpolation_in_run_block",
    "match": "TYPE=\"${{ github.event.action }}\"",
    "severity": "high",
    "fingerprint": "msg-yml-578-action",
    "issue_id": "ISS-015",
    "delta": "PERSISTENT"
  },
  {
    "file": "skills/monitor-runners/SKILL.md",
    "line": 74,
    "pattern": "eval\\s",
    "match": "&& eval \"${N}_TREND_OK=1\" || eval \"${N}_TREND_OK=0\"",
    "severity": "medium",
    "raw_severity": "high",
    "downgrade_reason": "fenced-code-block",
    "fingerprint": "monitor-runners-74-eval",
    "delta": "PERSISTENT"
  },
  {
    "file": "skills/monitor-runners/SKILL.md",
    "line": 77,
    "pattern": "eval\\s",
    "match": "&& eval \"${N}_VOL_OK=1\" || eval \"${N}_VOL_OK=0\"",
    "severity": "medium",
    "raw_severity": "high",
    "downgrade_reason": "fenced-code-block",
    "fingerprint": "monitor-runners-77-eval",
    "delta": "PERSISTENT"
  }
]
```

## Remediation

| Pattern | Remediation |
|---------|-------------|
| `${{ github.event.* }}` inside a `run:` block | Rebind to an `env:` key first, then read `$_SAFE_NAME` from the shell. See `articles/workflow-security-audit-2026-04-11.md` and ISS-015's remediation block. PR carrier #4 stalled awaiting workflow-scoped PAT — operator action. |
| `eval` inside `monitor-runners` markdown code block | Rewrite the snippet to use a pair of explicit `if/else` arms or `declare -g` instead of `eval`. Documentation-only; not executed by the workflow. Low priority. |
| Auth-curl patterns flagged in continuity notes above | Add baseline-suppression entries to `skills/security/scan-baseline.yml` after operator review (one batch PR), with `reason: "auth header to API that owns the secret"` and `reviewed_by: "tomscaria"`. |
