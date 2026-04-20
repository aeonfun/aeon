---
name: Skill Security Scan
description: Audit skills, workflows, and companion scripts for injection, exfiltration, traversal, and prompt-override risks with delta tracking, baseline suppression, issue filing, and per-finding remediation
var: ""
tags: [dev]
---
<!-- autoresearch: variation B — sharper output: delta tracking + issue filing + code-fence-aware suppression + baseline + remediation snippets + expanded coverage (workflows, companion scripts) -->

> **${var}** — a SKILL.md path, a skill name (e.g. `token-movers`), or a directory. Empty = full corpus scan.

Today is ${today}. Audit the codebase for security risks in skill instructions, CI workflows, and companion scripts before they run.

## Threat categories

Files instruct Claude Code and GitHub Actions runners to take actions. Adversarial or sloppy files can:

- **Shell injection** — unquoted variable expansion, `eval`, backticks, `$(...)` in bash blocks
- **Secret exfiltration** — env vars or file contents piped into outbound HTTP requests
- **GitHub Actions script injection** — user-controlled template expressions (`${{ github.event.* }}`, PR titles, issue bodies, incoming messages) interpolated directly into `run:` blocks (see the 2026-04-11 `messages.yml` incident in `articles/workflow-security-audit-2026-04-11.md` for the canonical pattern and fix)
- **Path traversal** — access files outside repo via `../..` chains or absolute paths
- **Prompt override** — instructions in fetched content or skill bodies attempting to make the agent disregard prior guidance, switch persona, or act on new "system" rules
- **Destructive commands** — irreversible ops like recursive deletes from root, device writes, forced pushes to main
- **Obfuscation (2026 additions)** — zero-width Unicode (U+200B, U+FEFF), bidi override (U+202E / Trojan Source), base64-decoded payloads, `fromCharCode`, hex-escaped command strings, webhook SSRF hosts (ngrok, interact.sh, webhook.site, burpcollaborator, pipedream, requestbin)

## Coverage

Scan every run:
- `skills/*/SKILL.md` (primary)
- `skills/*/*.sh` and `skills/*/*.py` (companion scripts that skills invoke)
- `.github/workflows/*.yml` (CI — especially `run:` blocks referencing `${{ ... }}`)
- `scripts/*.sh` (repo-level scripts)

When `${var}` is set:
- If it matches an existing SKILL.md path (absolute or relative) → scan that file only
- Else if a directory exists at `skills/${var}/` → scan everything under it
- Else if it looks like a bare skill name and `skills/${var}/SKILL.md` exists → scan that file
- Else abort with `ERROR: scope not found for var=${var}`

## Inputs and state

| Path | Purpose |
|------|---------|
| `skills/skill-security-scan/scan.sh` | Raw regex scanner (HIGH/MEDIUM/LOW pattern library) |
| `skills/security/trusted-sources.txt` | GitHub owners/repos whose skills get format-only scans |
| `skills/security/scan-baseline.yml` | Human-reviewed-as-safe suppressions (bootstrap if missing) |
| `memory/state/security-scan.json` | Prior scan snapshot — used for delta |
| `memory/issues/INDEX.md` | Open/resolved issue index (HIGH findings file here) |
| `articles/security-scan-${today}.md` | Report output (only written if there are findings or a delta) |

### Baseline file format

`skills/security/scan-baseline.yml`:
```yaml
# Each entry suppresses a specific (file, line_range, pattern) match that a human has reviewed.
# Format:
#   - file: <path>
#     pattern: <regex pattern from scan.sh HIGH_PATTERNS/MEDIUM_PATTERNS/LOW_PATTERNS>
#     lines: "15-25"          # optional line range; omit to suppress across whole file
#     reason: "documentation in threat model section"
#     reviewed_by: "aaronjmars"
#     reviewed_at: "2026-04-20"
suppressions: []
```

Seed `suppressions` at bootstrap with the self-documenting matches that we already know are false positives:
1. `skills/skill-security-scan/SKILL.md` — all prompt-override pattern matches inside the "Threat categories" section (documentation, not payload)
2. `skills/security-digest/SKILL.md` — any curl/token pattern inside fenced code blocks showing example usage

## Steps

1. **Read memory.** Read `memory/MEMORY.md` and today's `memory/logs/${today}.md` (create if missing) for context.

2. **Bootstrap baseline.** If `skills/security/scan-baseline.yml` does not exist, create it with the seed suppressions listed above and record `BASELINE_BOOTSTRAPPED` in the exit status.

3. **Resolve scope** per the `${var}` rules above. Log the chosen scope.

4. **Preflight scanner.** Verify `skills/skill-security-scan/scan.sh` is present and executable. If missing (sandbox edge case), fall back to inline Grep using the same HIGH/MEDIUM/LOW pattern library defined in `scan.sh` — never silently skip.

5. **Run scanner in JSON mode** — invoke `scan.sh --json` (or `--all --json` for the full corpus) and capture the structured output: `[{skill, status, file, high, medium, low}, ...]`. Do not parse stderr into findings.

6. **Trusted-source filter.** Load `skills/security/trusted-sources.txt`. For each scanned file, check if the skill directory has an `origin:` field in its frontmatter, or fall back to the repo's git remote. If the source is trusted (owner or owner/repo match), downgrade to format-only validation: verify frontmatter has `name`, `description`, `tags`, and a `var` key — emit no HIGH/MEDIUM/LOW findings for trusted sources, only format errors.

7. **Code-fence downgrade.** For each non-trusted finding, re-read the file around the finding's line. If the line is inside a fenced code block (between ```` ``` ```` markers in a Markdown file, or inside a `run: |` / `script: |` YAML block in a workflow file that is clearly an example, not an executable step), downgrade severity by one tier (HIGH → MEDIUM, MEDIUM → LOW, LOW → drop). Never downgrade inside actual `run:` steps in real workflow files — those execute.

8. **Apply baseline suppression.** Drop any finding whose (file, pattern, line) tuple is in `skills/security/scan-baseline.yml`.

9. **Compute delta** against `memory/state/security-scan.json` (previous run's finding set, keyed by `sha256(file+line_content+pattern)`):
   - **NEW** — findings present now but not last run
   - **RESOLVED** — findings present last run but gone now
   - **PERSISTENT** — findings in both runs (not re-notified, but still counted)

10. **File/close issues** in `memory/issues/`:
    - For each NEW HIGH finding (post-suppression): create `memory/issues/ISS-{next_id}.md` with YAML frontmatter (`id`, `title`, `status: open`, `severity: high`, `category: quality-regression`, `detected_by: skill-security-scan`, `detected_at: ${today}`, `affected_skills`) and append a row to `INDEX.md` under `## Open`.
    - For each RESOLVED finding that corresponds to an open ISS filed by `skill-security-scan`: set `status: resolved`, `resolved_at: ${today}`, move the row from `## Open` to `## Resolved` in `INDEX.md`.
    - Do NOT file issues for NEW MEDIUM or LOW findings — those live in the article report only.

11. **Write the report** to `articles/security-scan-${today}.md` only if there are any NEW, RESOLVED, or current HIGH findings. Structure:

    ```markdown
    # Security Scan — ${today}

    **Verdict:** [CLEAN | ATTENTION | DEGRADED]
    **Scope:** [full corpus | ${var}]
    **Counts:** N files scanned · H HIGH · M MEDIUM · L LOW · X new · Y resolved since last scan

    ## Needs attention (NEW high-severity this run)
    For each: file:line, pattern that matched, one-line remediation snippet (see table below).

    ## Resolved since last scan
    List of findings that disappeared — good for confirming fixes.

    ## Persistent findings (unchanged)
    Count per severity; full list only in the appendix.

    ## Per-file results
    Table: file, status (PASS/WARN/FAIL), HIGH count, MEDIUM count, LOW count.

    ## Appendix — all current findings
    Full structured dump.
    ```

12. **Remediation snippets.** For each HIGH finding, attach a one-line fix hint keyed off the pattern. Map (non-exhaustive — extend as new patterns are added to `scan.sh`):

    | Pattern category | Remediation |
    |---|---|
    | Shell eval / backticks / `$(...)` with variable | Quote the variable; prefer `${VAR}` with explicit quoting; replace `eval` with a function |
    | `curl`/`wget` with an env var in the URL or body | Move secret into a pre-fetch script (see `CLAUDE.md` Sandbox section); never interpolate secrets into shell-block strings |
    | `${{ github.event.* }}` inside a `run:` block | Rebind the value to an `env:` key first, then read `$_SAFE_NAME` from the shell (see `articles/workflow-security-audit-2026-04-11.md`) |
    | Path-traversal sequence | Validate input against `skills/*/` or explicit allow-list; reject absolute paths |
    | Prompt-override phrasing | If the string is documentation, add a baseline suppression entry; if it's a payload, delete it |
    | Recursive delete rooted at `/` or `~` | Scope to `$REPO_ROOT` or a specific subdir; never take a variable as the delete root |
    | Force-push to main | Remove the option or gate behind explicit human dispatch |
    | Obfuscation (zero-width / bidi / base64-decode pipe) | Delete unless there's a documented, reviewed reason |

13. **Persist state.** Write the full current finding set to `memory/state/security-scan.json` so the next run can compute delta. Include `{generated_at, scope, findings: [{file, line, pattern, severity, fingerprint}]}`.

14. **Notify** via `./notify` only when there is something new for the operator:
    - If any NEW HIGH finding → one paragraph summary naming affected skill(s), finding count, and path to the report.
    - If any RESOLVED HIGH finding (but no new HIGH) → short "Resolved: X HIGH findings cleared since last scan."
    - If only MEDIUM/LOW changes → skip notification (report is written, operator reads on demand).
    - If no findings and no delta → skip notification; emit `SECURITY_SCAN_OK` to stdout so heartbeat can log it.

15. **Log** to `memory/logs/${today}.md` with an `### skill-security-scan` section: scope, exit status code, counts by severity, new/resolved counts, PR/issue IDs filed, report path.

## Exit status codes

Emit exactly one to stdout (on its own line) before normal output:

- `SECURITY_SCAN_OK` — no findings after suppression, no delta
- `SECURITY_SCAN_NEW` — at least one NEW HIGH finding
- `SECURITY_SCAN_RESOLVED` — no new HIGH findings, but at least one was resolved
- `SECURITY_SCAN_NOCHANGE` — findings exist but identical to last run
- `SECURITY_SCAN_BOOTSTRAPPED` — baseline file was just created; this run writes initial state
- `SECURITY_SCAN_ERROR` — scope unresolvable, scanner missing, or write failure

## Constraints

- Never auto-delete a finding from `scan-baseline.yml`. Suppression is a human decision; the skill only *adds* seed entries on first bootstrap.
- Never file an issue for a finding that is already represented by an open ISS (match by fingerprint — file+line+pattern).
- Never change `scan.sh`'s pattern library from inside this skill. Pattern evolution happens in a separate, reviewed PR.
- Never notify on a pure no-op week. Silence is correct when nothing has changed.
- Treat trusted-sources downgrades as opt-in only — never trust a source not explicitly listed.

## Sandbox note

This skill reads local files and shells out to `scan.sh`; no network calls required. If `scan.sh` is unavailable, perform the scan inline using Grep with the same pattern library — never silently skip. The `./notify` call is covered by the standard post-processor (see `CLAUDE.md` Sandbox section).
