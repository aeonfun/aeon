---
name: workflow-security-audit
description: Audit .github/workflows and composite actions with zizmor + actionlint, classify findings against the prior audit, auto-fix Critical/High regressions, and open a PR only when something actually changed.
tags: [dev]
---
<!-- autoresearch: variation B — sharper output via zizmor-led scanning, NEW/REINTRODUCED/UNCHANGED/RESOLVED delta classification, attack-chain narratives for Critical/High, exit taxonomy, silent-on-no-delta -->

Today is `${today}`. Audit every workflow file and composite action in `.github/`, classify findings against the most recent prior audit, auto-apply fixes for NEW Critical/High items, and open a PR *only if the delta is non-empty*.

**Core principle:** the goal is not "run monthly and paste findings" — it's to surface *changes* (new vulns, regressions of fixed ones) with an attacker's-eye-view per finding, and stay silent on clean runs so the notify isn't trained-to-ignore.

## Preflight

### 0a. Bootstrap variables

```bash
today=$(date -u +%F)
REPO_NAME=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "unknown/unknown")
REPO_URL=$(gh repo view --json url -q .url 2>/dev/null || echo "")
```

### 0b. Install scanners

Try in order; if both fail, exit with `WORKFLOW_AUDIT_TOOL_FAIL`.

```bash
# zizmor (Trail of Bits, SARIF-capable GH Actions auditor)
# Pin to a specific version for reproducibility — bump this when upgrading.
ZIZMOR_VERSION="1.24.1"
if ! command -v zizmor >/dev/null 2>&1; then
  pipx install "zizmor==${ZIZMOR_VERSION}" 2>/dev/null \
    || python3 -m pip install --user "zizmor==${ZIZMOR_VERSION}" 2>/dev/null \
    || true
  export PATH="$HOME/.local/bin:$PATH"
fi
# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.
# actionlint (Rhymond's syntax-level workflow linter)
if ! command -v actionlint >/dev/null 2>&1; then
  bash <(curl -sL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) 2>/dev/null || true
  export PATH="$PWD:$PATH"
fi
```

If the sandbox blocks the download, use **WebFetch** to pull the install script, save it locally, and `bash` it. If both tools still fail to install, continue with the hand-rolled pattern checks in step 2 but mark the run as `WORKFLOW_AUDIT_TOOL_DEGRADED` in the footer.

## Steps

### 1. Enumerate audit targets

```bash
TARGETS=$(find .github/workflows -maxdepth 2 -type f \( -name "*.yml" -o -name "*.yaml" \) 2>/dev/null; \
          find .github/actions -type f \( -name "action.yml" -o -name "action.yaml" \) 2>/dev/null)
```

If `$TARGETS` is empty, exit with `WORKFLOW_AUDIT_NO_WORKFLOWS` — notify `*Workflow audit* — no workflow files found under .github/` and stop.

### 2. Run scanners

**Primary — zizmor:**
```bash
mkdir -p .audit
zizmor --format sarif --persona auditor .github/workflows .github/actions \
  > .audit/zizmor.sarif 2> .audit/zizmor.err || true
```
Parse SARIF. Each `runs[0].results[]` entry yields: `ruleId`, `level` (note/warning/error), `message.text`, `locations[0].physicalLocation.artifactLocation.uri`, `locations[0].physicalLocation.region.startLine`, and `properties["zizmor/severity"]` + `properties["zizmor/confidence"]`.

Map zizmor severity → our severity:
- `error` + confidence ≥ `high` → **Critical**
- `error` (other confidence) or `warning` + confidence = `high` → **High**
- `warning` → **Medium**
- `note` → **Low**

**Secondary — actionlint:**
```bash
actionlint -format '{{json .}}' > .audit/actionlint.json 2> .audit/actionlint.err || true
```
Raise actionlint errors to **Medium** unless they touch a security-relevant rule (`expression`, `shellcheck` with `SC2086`/`SC2046` over a `${{ github.* }}` interpolation), in which case **High**.

**Supplemental hand-rolled checks (always run, even when zizmor succeeds):**
These backstop tool gaps specific to this repo:

- **toJson-into-shell injection:** grep for `echo '\${{ toJson\(github\.event` or `echo "\${{ toJson\(` piped to `jq` or assigned via command substitution. This is the `messages.yml:577` pattern (prior April 11 audit missed it). Severity: **Critical**.
- **`persist-credentials: true` on `actions/checkout` followed by `ref: ${{ github.event.pull_request.head.sha }}`** (or `head.ref`): classic poisoned-pipeline pattern. Severity: **Critical** on `pull_request_target` triggers, **High** on `workflow_run`.
- **`GITHUB_ENV` / `GITHUB_OUTPUT` writes with user-controlled data:** `echo "X=${{ github.event.* }}" >> "$GITHUB_ENV"` — newline-injection bypasses env masking. Severity: **High**.
- **Fleet-specific:** `spawn-instance` / `fleet-control` / `chain-runner` jobs that pass `${{ inputs.* }}` directly into `gh workflow run`, `gh api repos/.../dispatches`, or a `run:` shell without env intermediary. Severity: **High**.
- **Mutable ref on third-party action:** `uses: owner/action@branch` or `uses: owner/action@vN` where `owner` is not `actions`, `github`, `docker`, or `aws-actions`. Severity: **Medium** (supply chain).

### 3. Build the current-run findings set

For each finding, emit a canonical record:
```
{
  "fingerprint": sha256("${rule_id}|${file}|${step_name_or_line_context}"),
  "severity": "Critical|High|Medium|Low",
  "rule_id": "template-injection|excessive-permissions|unpinned-uses|...",
  "file": ".github/workflows/messages.yml",
  "line": 577,
  "step": "Extract message",
  "pattern": "<verbatim vulnerable snippet, ≤120 chars>",
  "source": "zizmor|actionlint|hand-rolled"
}
```

The fingerprint is the key for delta classification — keep it stable across runs by anchoring to step name when available rather than line number (lines drift on unrelated edits).

### 4. Classify against prior audit (delta)

Find the most recent prior report:
```bash
PRIOR=$(ls -1 articles/workflow-security-audit-*.md 2>/dev/null | sort | tail -1)
```

If `$PRIOR` exists, extract its fingerprints from a machine-readable trailer (see step 6 format). Then label each current finding:

- **NEW** — fingerprint absent from prior report
- **REINTRODUCED** — fingerprint was marked `Auto-fixed` or `Resolved` in prior report, now present again
- **UNCHANGED** — fingerprint present in prior report, still present
- **RESOLVED** — fingerprint was present in prior report, now absent from current scan (emit as a separate section, no fix needed)

If `$PRIOR` does not exist, every finding is NEW.

### 5. Determine verdict and exit mode

Compute a one-line verdict from the delta:

| Condition | Verdict | Exit mode |
|---|---|---|
| No findings at all | `WORKFLOW_AUDIT_CLEAN — no findings across N files` | `CLEAN` |
| Only UNCHANGED findings, no NEW/REINTRODUCED | `WORKFLOW_AUDIT_UNCHANGED — N carried over from ${PRIOR_DATE}` | `UNCHANGED` |
| ≥1 REINTRODUCED | `WORKFLOW_AUDIT_REGRESSION — N previously-fixed finding(s) reintroduced` | `REGRESSION` |
| ≥1 NEW Critical | `WORKFLOW_AUDIT_NEW_CRITICAL — N new critical finding(s)` | `NEW_CRITICAL` |
| ≥1 NEW High (no critical) | `WORKFLOW_AUDIT_NEW_HIGH — N new high-severity finding(s)` | `NEW_HIGH` |
| NEW Medium/Low only | `WORKFLOW_AUDIT_NEW_INFO — N new lower-severity finding(s)` | `NEW_INFO` |
| All scanners failed | `WORKFLOW_AUDIT_TOOL_FAIL — zizmor and actionlint both unavailable` | `TOOL_FAIL` |

**Gating rule:** in `CLEAN` and `UNCHANGED` modes, do not create a PR, do not send a notify, and write a log-only entry. Silence is correct on no-delta runs.

### 6. Write the audit report

Path: `articles/workflow-security-audit-${today}.md` (if the file already exists from an earlier run today, overwrite it — the latest audit of the day is authoritative).

Format:

```markdown
# Workflow Security Audit — ${today}

**Verdict:** ${VERDICT_LINE}
**Repo:** [${REPO_NAME}](${REPO_URL})
**Files audited:** ${count} (${workflow_count} workflows, ${action_count} composite actions)
**Findings this run:** ${total} (${crit} critical, ${high} high, ${med} medium, ${low} low)
**Delta vs ${PRIOR_DATE or "(no prior audit)"}:** ${new_count} new, ${reintroduced_count} reintroduced, ${unchanged_count} unchanged, ${resolved_count} resolved
**Auto-fixed:** ${fixed_count}

## Regressions (previously-fixed findings now present again)

[One subsection per REINTRODUCED finding, same format as Findings.]

## New findings

[One subsection per NEW finding.]

### [CRITICAL|HIGH] ${rule_id} — ${short title}
**File:** `.github/workflows/file.yml` · **Step:** `Step Name` · **Line:** ${line}
**Pattern:**
```yaml
${verbatim snippet}
```

**Attack chain:**
1. **Entry:** ${trigger} — reachable by ${who (external user / repo collaborator / scheduled)}
2. **Vector:** ${what field is attacker-controlled}
3. **Sink:** ${where it gets evaluated — shell / with: / github-script / GITHUB_ENV write}
4. **Reachable secrets:** ${secrets in job env}
5. **Blast radius:** ${what the reachable token can do — push? dispatch? comment? cross-repo?}

**Fix:**
```yaml
# BEFORE
...
# AFTER
...
```

**Status:** Auto-fixed in this PR / Manual review required

---

[Medium and Low findings get a compact one-line-per-finding table, no attack chain.]

## Carried over (unchanged)

| Severity | Rule | File | First seen |
|---|---|---|---|
| ... |

## Resolved since ${PRIOR_DATE}

- ${finding title} in `${file}` — no longer present

## Source status

- zizmor: ${ok|fail|degraded}
- actionlint: ${ok|fail|degraded}
- hand-rolled: ${ok|fail}

<!--
workflow-security-audit-fingerprints
${fingerprint_1} severity=Critical status=auto-fixed rule=template-injection file=.github/workflows/messages.yml step=Extract_message
${fingerprint_2} severity=High status=manual rule=unpinned-uses file=.github/workflows/aeon.yml step=Checkout
...
-->
```

The HTML-comment trailer at the bottom is the machine-readable fingerprint set the *next* run reads in step 4. Don't omit it.

### 7. Auto-fix NEW Critical/High findings (idempotent)

For each NEW Critical and NEW High finding (**not** for UNCHANGED — those failed a prior fix or are known-manual; don't thrash them):

**Idempotency check before fixing a script-injection finding:**
1. Read the step's `env:` block.
2. If a key starting with `_` already maps to the same `${{ ... }}` expression as the vulnerable interpolation, skip — the fix is already present; this is a stale finding and should be flagged in the report.
3. Otherwise insert a new `env:` key (prefix `_`, uppercase, derived from the expression: `${{ inputs.message }}` → `_INPUT_MESSAGE`; `${{ steps.msg.outputs.source }}` → `_MSG_SOURCE`; `${{ github.event.client_payload.message }}` → `_CLIENT_PAYLOAD_MESSAGE`).
4. Replace the in-`run:` interpolation with `"$_VARNAME"`.
5. Validate the edited YAML loads: `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" "$FILE"`. If it fails, revert and mark the finding as `Manual required — auto-fix produced invalid YAML`.

Use the Edit tool for inline modifications. Do not rewrite whole files.

**Script-injection fix template:**
```yaml
# BEFORE:
- name: Step
  run: |
    VAR="${{ inputs.user_input }}"

# AFTER:
- name: Step
  env:
    _USER_INPUT: ${{ inputs.user_input }}
  run: |
    VAR="$_USER_INPUT"
```

**toJson-into-shell fix template (the pattern April 11 missed):**
```yaml
# BEFORE:
MESSAGE=$(echo '${{ toJson(github.event.client_payload.message) }}' | jq -r '.')

# AFTER:
env:
  _PAYLOAD: ${{ toJson(github.event.client_payload.message) }}
...
MESSAGE=$(printf '%s' "$_PAYLOAD" | jq -r '.')
```

For **permissions**, **pinning**, and **`persist-credentials`** findings, do not auto-fix — always flag as `Manual required` (these need operator judgment about which jobs actually need the write scope, and SHA pinning requires verifying the intended commit).

### 8. Commit, branch, and PR (gated)

Exit modes `CLEAN`, `UNCHANGED`, `TOOL_FAIL`: skip this step entirely.

Otherwise:

```bash
# Reuse an existing open PR if one exists (don't spawn duplicates)
EXISTING=$(gh pr list --head fix/workflow-security-audit --state open --json number,url -q '.[0].url' 2>/dev/null)
BRANCH="fix/workflow-security-audit"
if [ -n "$EXISTING" ]; then
  git fetch origin "$BRANCH" 2>/dev/null && git checkout "$BRANCH" || git checkout -b "$BRANCH"
else
  # Version-suffix if the branch exists but no open PR (e.g. closed/merged)
  if git show-ref --quiet "refs/remotes/origin/$BRANCH"; then
    BRANCH="fix/workflow-security-audit-${today}"
  fi
  git checkout -b "$BRANCH"
fi

git add .github/workflows/ .github/actions/ articles/workflow-security-audit-${today}.md
git commit -m "fix(security): workflow audit ${today} — ${exit_mode}

Auto-fixed: ${fixed_count} finding(s)
Manual review: ${manual_count} finding(s)
Regressions: ${reintroduced_count}
Report: articles/workflow-security-audit-${today}.md"

git push -u origin "$BRANCH"

if [ -z "$EXISTING" ]; then
  gh pr create --title "fix: workflow security audit ${today} — ${VERDICT_LINE}" \
    --body-file <(cat <<'EOF'
## Verdict
${VERDICT_LINE}

## Summary
- **NEW:** ${new_count} (${new_crit} crit / ${new_high} high / ${new_med} med / ${new_low} low)
- **REINTRODUCED:** ${reintroduced_count}
- **UNCHANGED:** ${unchanged_count}
- **RESOLVED:** ${resolved_count}
- **Auto-fixed:** ${fixed_count}
- **Manual review:** ${manual_count}

## Attack chains worth reading first
${top_3_chain_titles}

## Full report
articles/workflow-security-audit-${today}.md

## Source status
zizmor: ${ok|fail} · actionlint: ${ok|fail} · hand-rolled: ${ok|fail}
EOF
)
else
  gh pr comment "$EXISTING" --body "Re-ran ${today}: ${VERDICT_LINE}. Auto-fixed ${fixed_count} new finding(s). See articles/workflow-security-audit-${today}.md."
fi
```

### 9. Notify (gated on exit mode)

Only in exit modes `NEW_CRITICAL`, `NEW_HIGH`, `REGRESSION`:

```bash
./notify "*Workflow audit — ${today}*
${VERDICT_LINE}
Auto-fixed ${fixed_count} · Manual ${manual_count}
Top chain: ${top_attack_chain_one_liner}
PR: ${pr_url}"
```

Exit mode `NEW_INFO` (medium/low only): write a log entry but **do not notify** (prior audits showed medium pinning/permission reminders become ignorable wallpaper).

Exit mode `TOOL_FAIL`: notify once with `*Workflow audit — ${today}* WORKFLOW_AUDIT_TOOL_FAIL — zizmor and actionlint both unavailable, no scan completed`.

Keep notify under one paragraph. No banned phrases: `consider`, `might want to`, `potentially`, `exciting`, `robust`, `leveraging`, `unlocks`, `in this fast-moving space`.

### 10. Log

Append to `memory/logs/${today}.md`:

```
## Workflow Security Audit
- Exit: ${EXIT_MODE}
- Verdict: ${VERDICT_LINE}
- Files audited: ${count} (${workflow_count} workflows, ${action_count} actions)
- Findings: ${total} total (${crit}C / ${high}H / ${med}M / ${low}L)
- Delta: ${new_count} new, ${reintroduced_count} reintroduced, ${unchanged_count} unchanged, ${resolved_count} resolved
- Auto-fixed: ${fixed_count}
- PR: ${pr_url or "(none — no delta)"}
- Report: articles/workflow-security-audit-${today}.md
- Source status: zizmor=${ok|fail} actionlint=${ok|fail} hand-rolled=${ok|fail}
```

## Sandbox note

- `pipx install zizmor` and `pip install --user zizmor` both hit PyPI — expected to work from GitHub-hosted runners (outbound to PyPI is allowed), but if the sandbox blocks them use **WebFetch** to retrieve the zizmor install script from `https://docs.zizmor.sh/install.sh` (or the release tarball from the `zizmorcore/zizmor` releases page) and run it locally.
- `gh` CLI uses existing `GITHUB_TOKEN` / `GH_GLOBAL` — no extra auth setup needed.
- No new secrets required. zizmor and actionlint are offline-only static analyzers.

## Constraints

- Never auto-fix `UNCHANGED` findings (if they didn't get fixed the first time there's a reason — manual-only scopes, permission decisions, or a prior auto-fix that broke YAML). Auto-fix is for NEW and REINTRODUCED Critical/High only.
- Never auto-fix **permissions**, **unpinned-uses**, or **persist-credentials** findings — always flag as Manual. These need operator judgment.
- Never run destructive git operations on `main`. All changes go through `fix/workflow-security-audit` or a version-suffixed branch.
- Preserve the existing PR lifecycle — if a fix PR is open, add a comment rather than spawning a duplicate.
- No new env vars beyond `GITHUB_TOKEN` / `GH_GLOBAL` (already in `aeon.yml`).
- If exit mode is `CLEAN` or `UNCHANGED`, skip PR and notify — log only.
