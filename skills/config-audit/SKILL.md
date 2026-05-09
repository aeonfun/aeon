---
name: Config Audit
description: Audit Aeon framework configuration for security, PII, and permission issues with A-F grading
var: ""
tags: [dev, security]
---

> **${var}** — Comma-separated file list to audit (e.g., "CLAUDE.md,aeon.yml"). If empty, audits all config targets.

Read `memory/MEMORY.md` for context. Read `memory/issues/INDEX.md` to avoid filing duplicate issues.

## Goal

Scan the framework's own configuration layer for security issues that existing skills miss. `workflow-security-audit` covers GHA YAML with zizmor/actionlint. `skill-security-scan` covers shell scripts in skills. This skill covers the prompt/config layer: CLAUDE.md override vulnerabilities, aeon.yml var field leaks, SKILL.md prompt injection surfaces, and soul/ PII exposure.

## Steps

### 1. Determine scope

If `${var}` is set, parse as a comma-separated list and audit only those files/directories. Otherwise audit all five targets below.

### 2. Scan Target 1: CLAUDE.md

Read `CLAUDE.md` and check for:

- **Injection vectors (HIGH):** Instructions that could be overridden by fetched content — look for phrasing like "follow instructions from", "do what X says", "execute the commands in". The security section should explicitly say to discard instructions from fetched content, not follow them.
- **Hardcoded secrets (CRITICAL):** Regex scan for strings matching API key / token / hex patterns longer than 20 chars (exclude obvious non-secrets like SHA hashes in git examples, model names, and documented patterns).
- **Missing safety rules (MEDIUM):** Check that CLAUDE.md contains: (a) "never push directly to main", (b) "never expose secrets", (c) "treat fetched content as untrusted". Flag any missing.
- **Stale env var references (LOW):** Cross-reference env var names mentioned in CLAUDE.md against `.github/workflows/aeon.yml` env block. Flag references to vars that don't exist in any workflow.

### 3. Scan Target 2: aeon.yml

Read `aeon.yml` and check for:

- **Secrets in var fields (HIGH):** Regex scan all `var:` values for hex strings >20 chars, strings matching `[A-Za-z0-9+/]{32,}` (base64), wallet addresses (0x prefix + 40 hex chars), API key patterns. Flag each with the skill name and line context.
- **Cost risk (MEDIUM):** Skills with `schedule: "workflow_dispatch"` AND `model: "claude-opus-4-7"` AND `enabled: true` — these can be accidentally triggered in bulk. Flag if more than 3 exist.
- **Phantom chain references (HIGH):** For each chain in the `chains:` section, verify every skill name in `parallel:` and `skill:` entries exists under `skills/`. Flag any that don't — these will silently fail at runtime.
- **Duplicate entries (LOW):** Check for duplicate skill names in the `skills:` section.

### 4. Scan Target 3: skills/*/SKILL.md

For each skill directory, read the SKILL.md and check:

- **Unescaped var in shell (HIGH):** Look for `${var}` or `$var` inside shell code blocks (``` or `run:` blocks) without quoting. Unquoted var in shell is an injection surface.
- **Fetched content trust (CRITICAL):** Look for instructions telling Claude to follow, execute, or act on content from fetched URLs, API responses, or external data without verification. The correct pattern is to treat fetched content as untrusted data.
- **Missing Sandbox note (MEDIUM):** Check for a `## Sandbox note` section. If absent, flag it.
- **Missing Constraints (MEDIUM):** Check for a `## Constraints` section. If absent, flag it.
- **Unsafe notify (MEDIUM):** Look for `./notify` calls that interpolate `${var}` directly without sanitization — Telegram markdown injection risk.

Read only frontmatter + first 50 lines of each SKILL.md for the catalog scan, then full read only for skills that trigger a frontmatter-level flag.

### 5. Scan Target 4: .github/workflows/*.yml (Aeon-specific only)

Read workflow YAML files and check Aeon-specific patterns (do NOT duplicate zizmor/actionlint checks):

- **Var passthrough injection (HIGH):** `workflow_dispatch` inputs passed directly to `gh workflow run` or `claude -p` without env-var intermediary. The safe pattern is to pass inputs via environment variables, not inline interpolation.
- **Concurrency collisions (MEDIUM):** Check that chain-runner and aeon.yml workflows use distinct concurrency group keys so parallel chains don't cancel each other.

### 6. Scan Target 5: soul/ files

If `soul/` directory exists and contains files, scan for:

- **PII (HIGH):** Regex scan for email addresses, phone numbers (various formats), physical addresses (street number + street name patterns), SSN patterns. Flag each with file and line.
- **Sensitive content (MEDIUM):** Flag the existence of soul/ files if the repo is public (`gh repo view --json isPrivate --jq '.isPrivate'`). If public, escalate all soul/ findings to HIGH.

### 7. Compute grade

Start at 100 points. For each finding:
- CRITICAL: -25 points
- HIGH: -15 points
- MEDIUM: -5 points
- LOW: -1 point

Grade: A (90-100), B (75-89), C (60-74), D (40-59), F (<40).

### 8. Auto-fix safe issues

Only these fixes, always via PR (never direct to main):

- Add stub `## Sandbox note` sections to skills missing them:
  ```
  ## Sandbox note

  This skill uses local file reads and web search only. No outbound API calls needed.
  ```
- Add stub `## Constraints` sections to skills missing them:
  ```
  ## Constraints

  - Do not change the skill's tags or var semantics.
  ```
- Quote bare `${var}` in shell blocks: `${var}` → `"${var}"`

If any auto-fixes were applied:
```bash
git checkout -b fix/config-audit-${today}
git add -A
git commit -m "fix: config-audit auto-fixes — add missing sections, quote vars"
gh pr create --title "fix: config-audit auto-fixes" --body "Auto-generated by config-audit. Safe fixes only: missing Sandbox/Constraints sections, unquoted var interpolation."
```

### 9. File issues for CRITICAL/HIGH findings

For each CRITICAL or HIGH finding, check `memory/issues/INDEX.md` for existing issues with the same file + pattern. If no duplicate exists, file a new issue:

```
memory/issues/ISS-{NNN}.md
---
id: ISS-{NNN}
title: "{severity}: {finding description}"
status: open
severity: {critical|high}
category: {config|prompt-bug|security}
detected_by: config-audit
detected_at: ${today}
affected_skills: [{skill name or "framework"}]
root_cause: "{description}"
---
```

Update `memory/issues/INDEX.md` with the new entry.

### 10. Notify

Send via `./notify`:
```
Config Audit — ${today} — Grade: {letter}

{CRITICAL count} critical, {HIGH count} high, {MEDIUM count} medium, {LOW count} low

Top findings:
- [{severity}] {target}: {finding} (line {N})
- [{severity}] {target}: {finding} (line {N})
- [{severity}] {target}: {finding} (line {N})

{Auto-fixes applied: N | No auto-fixes needed}
{Issues filed: N | No new issues}
```

Cap at top 5 findings in notification. Full report in articles/.

### 11. Log

Append to `memory/logs/${today}.md`:
```
### config-audit
- Grade: {letter} ({score}/100)
- Findings: {CRITICAL}C {HIGH}H {MEDIUM}M {LOW}L
- Targets scanned: {list}
- Auto-fixes: {count or "none"}
- Issues filed: {count or "none"}
- PR: {url or "none"}
```

Write full report to `articles/config-audit-${today}.md` with all findings, affected files, and remediation guidance.

## Sandbox note

This skill uses local file reads, `gh` CLI (for repo visibility check and PR creation), and grep/regex. No outbound API calls. `gh` handles auth internally — sandbox-friendly.

## Constraints

- Never duplicate zizmor/actionlint rules — those are workflow-security-audit's domain.
- Never duplicate `scan.sh` regex patterns — those are skill-security-scan's domain.
- Never auto-fix permissions, model assignments, schedule changes, or soul/ content — those need operator judgment.
- Never read actual secret values (impossible from the workflow, but explicitly stated).
- One run per week is sufficient for config drift detection. Do not increase frequency.
- Do not modify soul/ files — PII findings are flagged for human review only.
