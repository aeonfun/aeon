---
name: Vuln Scanner
category: core
description: Audit trending repos for real security vulnerabilities and disclose responsibly via PVR or dependency PRs
var: ""
tags: [dev, security]
depends_on: [github-trending]
---
<!-- autoresearch: variation B — responsible-disclosure-first: private reports for code vulns, public PRs only for already-disclosed dep CVEs -->

> **${var}** — Target repo in `owner/repo`. If empty, auto-select from `.outputs/github-trending.md` or GitHub's trending API.

Today is ${today}. Read `memory/MEMORY.md` and the last 30 days of `memory/logs/` before starting.

## Why this skill exists

A security scanner that dumps unpatched vulnerabilities into public PRs is a zero-day publisher, not a helper. This skill matches industry practice: **Private Vulnerability Reporting (PVR) for code flaws, public PRs only for dependency CVEs that are already public**. Bad disclosure burns credibility and puts users at risk.

## Goal

Find one trending repo, run purpose-built scanners (not raw grep), triage to real exploitable findings, and route each finding to the correct disclosure channel — PVR, SECURITY.md contact, or dependency-bump PR.

## Steps

### 1. Pick a target

If `${var}` is set, use it. Otherwise:

```bash
# Prefer chained output from github-trending skill
if [ -s .outputs/github-trending.md ]; then
  # parse owner/repo lines; pick first that matches criteria below
  :
else
  gh api "search/repositories?q=created:>$(date -u -d '14 days ago' +%Y-%m-%d)&sort=stars&order=desc&per_page=25" \
    --jq '.items[] | select(.fork==false) | select(.stargazers_count>=50) | {full_name, language, description, security_and_analysis}'
fi
```

Selection criteria:
- Language you can reason about (JS/TS, Python, Go, Rust, Solidity)
- ≥50 stars, not a fork, active in last 6 months
- Handles untrusted input: auth, crypto, network, file I/O, templating
- **Skip** if scanned in last 30 days (grep `memory/logs/` for the repo name)
- **Skip** deliberately vulnerable teaching repos (DVWA, juice-shop, webgoat, vulnerable-*, *-ctf, hackme-*)
- **Skip** repos with no `SECURITY.md` AND `security_and_analysis.private_vulnerability_reporting.status != "enabled"` — you have no safe channel to report code flaws (you can still run a dep-scan and skip code audit; see step 5)

### 2. Fork and clone

```bash
REPO="owner/repo"
gh repo fork "$REPO" --clone --default-branch-only -- --depth 200 --quiet
cd "$(basename "$REPO")"
```

### 3. Run purpose-built scanners

Raw grep produces too many false positives. Use tools with dataflow reachability and verified-secret matching.

The scanners are pre-installed by `scripts/prefetch-vuln-scanner.sh` (runs before
Claude starts, with full network access — see the Sandbox note below). **Do not
`pip install` / `curl | sh` here** — both the network and the permission layer
block those inside the sandbox. Put the prefetch's bin dir on `PATH` and invoke
each tool by **bare name** — the bare names (`semgrep`, `trufflehog`,
`osv-scanner`, `slither`) are exactly what the capability allowlist
(`scripts/skill_mode.sh`) grants, so `claude -p` is permitted to execute them. If
a binary is missing, log `VULN_SCANNER_SKIPPED` and continue (it records `fail`
in `sources.txt` below) — never abort the whole run for one tool.

```bash
mkdir -p /tmp/vuln-scan
export PATH="/tmp/bin:$PATH"   # prefetch staged trufflehog/osv-scanner (+ semgrep symlink) here

# --- SAST: Semgrep OSS ---
if command -v semgrep >/dev/null 2>&1; then
  semgrep --config=p/security-audit --config=p/owasp-top-ten --config=p/secrets \
    --severity=ERROR --severity=WARNING --json --quiet --timeout=300 \
    --exclude=test --exclude=tests --exclude=__tests__ --exclude=spec --exclude=specs \
    --exclude=fixtures --exclude=examples --exclude=example --exclude=demo \
    --exclude=vendor --exclude=node_modules --exclude=dist --exclude=build --exclude=.next \
    -o /tmp/vuln-scan/semgrep.json . 2>/dev/null || true
else
  echo "VULN_SCANNER_SKIPPED: semgrep not available"
fi

# --- Secrets: TruffleHog (only-verified = actually authenticates) ---
if command -v trufflehog >/dev/null 2>&1; then
  trufflehog filesystem . --only-verified --json \
    > /tmp/vuln-scan/trufflehog.json 2>/dev/null || true
  # Also scan full git history for secrets
  trufflehog git file://. --only-verified --json \
    > /tmp/vuln-scan/trufflehog-git.json 2>/dev/null || true
else
  echo "VULN_SCANNER_SKIPPED: trufflehog not available"
fi

# --- Dependencies: osv-scanner (unified CVE DB across ecosystems) ---
if command -v osv-scanner >/dev/null 2>&1; then
  osv-scanner --format=json --recursive . \
    > /tmp/vuln-scan/osv.json 2>/dev/null || true
else
  echo "VULN_SCANNER_SKIPPED: osv-scanner not available"
fi

# --- Smart-contract scan (if Solidity present) ---
if ls **/*.sol >/dev/null 2>&1 && command -v slither >/dev/null 2>&1; then
  slither . --json /tmp/vuln-scan/slither.json --exclude-informational --exclude-low 2>/dev/null || true
fi

# Record what succeeded (empty output ≠ clean, could be tool failure)
echo "semgrep=$([ -s /tmp/vuln-scan/semgrep.json ] && echo ok || echo fail)" >  /tmp/vuln-scan/sources.txt
echo "trufflehog=$([ -s /tmp/vuln-scan/trufflehog.json ] && echo ok || echo fail)" >> /tmp/vuln-scan/sources.txt
echo "osv=$([ -s /tmp/vuln-scan/osv.json ] && echo ok || echo fail)"              >> /tmp/vuln-scan/sources.txt
```

### 4. Triage — read every finding before trusting it

A scanner hit is a candidate, not a vulnerability. For each candidate:

1. **Open the file at the reported line** and read the surrounding 30–50 lines.
2. **Write one sentence** describing what an attacker controls and what they achieve. If you can't, discard it.
3. **Check the call path** — is the vulnerable function reachable from external input in production code (not tests, docs, examples)?
4. **Severity**: critical (RCE, auth bypass, secret exposure), high (SQLi, stored XSS, SSRF, path traversal), medium (reflected XSS, weak crypto, missing rate limit).
5. **Assign disclosure channel** per step 5.

Drop the finding if:
- It's in `test/`, `mock/`, `fixture/`, `example/`, `demo/`, `bench/`, `docs/`
- It's behind a feature flag not enabled by default
- It requires attacker privileges equal to or greater than the attack yields
- You'd be embarrassed to defend it to the maintainer

If 0 findings survive triage → log "clean audit — N candidates reviewed, 0 confirmed" and exit cleanly.

### 5. Route each finding to the correct disclosure channel

This is the core of the skill. Pick the channel by finding type:

| Finding type | Channel | Why |
|---|---|---|
| **Dependency CVE** (osv-scanner hit) | **Public PR** bumping the dep | CVE is already public; a patch PR is net-positive |
| **Code vulnerability** (Semgrep ERROR/WARNING, verified exploitable) | **PVR** (GitHub private advisory) | Unpatched code flaw — public disclosure creates a zero-day |
| **Verified leaked secret** (TruffleHog verified) | **PVR** + tell maintainer to rotate | Publishing the file/line in a public PR tells attackers where to look |
| **Smart-contract issue** (Slither high/medium) | **PVR** | On-chain exploitation is often immediate and irreversible |
| **No PVR enabled AND no SECURITY.md** | **Private issue** to maintainer if possible, else skip and log | No safe channel = do no harm |

#### 5a. Public PR (dependency CVEs only)

```bash
git checkout -b security/bump-<pkg>-<cve>
# Update lockfile/manifest
git add -A
git commit -m "fix(deps): bump <pkg> to patch <CVE-YYYY-NNNN>

Advisory: <link to GHSA or NVD>
Severity: <high/critical>
Fixed in: <version>"
git push -u origin HEAD
gh pr create --repo "$REPO" \
  --title "fix(deps): bump <pkg> to patch <CVE-YYYY-NNNN>" \
  --body "$(cat <<EOF
Automated dependency bump to address a disclosed CVE.

- **CVE:** <id>
- **Advisory:** <url>
- **Severity:** <severity>
- **Package:** \`<name>\` → \`<fixed-version>\`

Detected by [osv-scanner](https://google.github.io/osv-scanner/). No code changes outside the lockfile/manifest.

---
Filed by [Aeon](https://github.com/aeonframework/aeon).
EOF
)"
```

#### 5b. Private Vulnerability Report (code flaws, verified secrets, contract bugs)

```bash
# Private third-party reporting uses the /reports endpoint. Do NOT use the bare
# /security-advisories endpoint — that *creates* an advisory and requires
# admin/security-manager rights on the target repo, so it returns 403 on any repo
# you don't own. Classic `repo` scope is sufficient for /reports;
# `repository_advisories:write` is NOT required for third-party reporting.
#
# ⚠️ CRITICAL: the payload MUST include a non-empty `vulnerabilities` array.
# The REST docs mark it "optional", but the create handler returns **HTTP 500
# (empty body)** when it is omitted. This single bug is why every bare-API PVR
# in this project historically failed and got routed to the web form — the form
# only works because it always collects "affected products" (= vulnerabilities).
# Verified 2026-06-26: identical {summary,description} payload → 500 without the
# array, 201 with it. Always send at least one {package:{ecosystem,name}}.
#
# Write the advisory markdown to /tmp/pvr-body.md first (Summary / Impact /
# Location / Proof / Suggested fix / Detected by), then build the JSON payload
# (jq -Rs safely encodes the multi-line body) and POST it via --input:
cat > /tmp/pvr.json <<JSON
{
  "summary": "<short title>",
  "description": $(jq -Rs . < /tmp/pvr-body.md),
  "severity": "<critical|high|medium|low>",
  "cwe_ids": ["CWE-89"],
  "vulnerabilities": [
    { "package": { "ecosystem": "pip", "name": "<pkg-or-repo-name>" } }
  ]
}
JSON
# ecosystem ∈ pip|npm|go|maven|nuget|composer|rubygems|rust|erlang|actions|pub|swift|other
gh api -X POST "/repos/$REPO/security-advisories/reports" \
  -H "X-GitHub-Api-Version: 2022-11-28" --input /tmp/pvr.json
```

**Always POST via `--input <file>`, never a long inline heredoc / `-f description="$(cat …)"`** — the latter can trip the sandbox ("Unhandled node type: string"), and `vulnerabilities` is a nested array that `-f`/`-F` can't express cleanly. Write the full JSON payload (`{summary, description, severity, cwe_ids, vulnerabilities}` — `vulnerabilities` is **mandatory**, see the ⚠️ note above) to a temp file and `gh api -X POST … --input payload.json`.

Read the HTTP response code and branch accordingly. **Never** fall back to a public issue or a code-fix PR for an *unpatched* flaw (that publishes a zero-day):
- **`201`** → reported. Record the report/advisory id and link it in the local report.
- **`403 "Repository does not have private vulnerability reporting enabled"`** → PVR is OFF on the repo. This is **not** a token-scope problem (classic `repo` scope is enough). **Critically: the GitHub advisory web form (`/security/advisories/new`) is the SAME PVR backend — it returns `404` to external reporters when PVR is off. Do NOT stage that URL as the channel even if `SECURITY.md` recommends it** (a `SECURITY.md` that only says "use the advisory form" is *not* a usable channel when PVR is disabled — confirmed on agent-reach and world-of-claudecraft, 2026-06-19). Resolve an **out-of-band** private contact instead, in this order: (1) `SECURITY.md` email / portal / vendor PSIRT; (2) README contact (email / Discord / X); (3) package metadata — `pyproject.toml` / `setup.py` author, `package.json` `author` + `bugs`; (4) the maintainer/owner's git commit email or GitHub profile. Stage a maintainer-ready report at `memory/pending-disclosures/<repo>-<timestamp>.md` in the **auto-send-ready format** (see below) so the `disclosure-emailer` skill can send it. Only if no out-of-band contact exists anywhere, log "no safe channel — skipped".

  **Auto-send-ready draft format** (consumed by `disclosure-emailer` → `scripts/postprocess-email.sh`):

  ```markdown
  ---
  repo: owner/repo
  severity: <critical|high|medium|low>
  cwe: CWE-NN
  status: pending-operator-send
  auto_send: <true|false>            # ARMING GATE — see the rule below
  contact_email: maintainer@example.com
  cc: [security@example.com]         # optional — if SECURITY.md says "email X, cc Y/Z"
  email_subject: "Security: <short title>"
  detected_at: <ISO-8601>
  ---

  # Staged private disclosure — owner/repo
  <operator-facing notes: contact resolution, why private — NOT emailed>

  <!-- EMAIL-BODY-START -->
  Hi <name>,
  <the exact private message: where / the issue / why it matters / severity /
  suggested fix / offer to share a patch>
  Thanks,
  Aeon (https://github.com/aeonframework/aeon)
  <!-- EMAIL-BODY-END -->
  ```

  **Write the EMAIL-BODY as PLAIN TEXT — it is sent as a plain-text email, so any
  Markdown renders literally to the maintainer.** No `**bold**`, no `#` headings, no
  `backtick` code spans, no `[text](url)` links. Use plain prose; label sections with
  plain words and a colon (`Where:` not `**Where:**`); paste bare URLs; keep code or
  argv samples as plain indented lines (those read fine in plain text). Only the
  EMAIL-BODY block needs this — the operator-facing notes above it may use Markdown.
  Do **not** hard-wrap paragraphs mid-sentence: write each paragraph as one line,
  separated by a blank line (the sender also auto-de-wraps soft-wrapped lines, but
  authoring them unwrapped keeps the draft clean). Keep deliberate short breaks — the
  greeting and the `Thanks,` / signature — on their own lines.

  **`auto_send` rule (this is the only safeguard before a real send):**
  - `auto_send: true` **only when** a valid `contact_email` resolved **AND** the repo does **not** ban AI-generated security reports (check SECURITY.md — many do).
  - `auto_send: false` when the only contact is non-email (X/Discord), the email couldn't be validated, or the repo bans AI reports. A `false` draft waits for the operator to send manually (set `human_only: true` too if the ban is explicit). Never arm a draft you'd be uncomfortable auto-sending.
- **`500` (empty body) on a PVR-enabled repo** → in this project this has **always** meant the **`vulnerabilities` array was missing/empty** (the create handler crashes instead of returning a clean `422`; see the ⚠️ note above). This is fixable **in-band, not a reason to fall back**: ensure the payload carries at least one `{package:{ecosystem,name}}` and re-POST once. Verified 2026-06-26 — the same body went `500 → 201` purely by adding the array. Only if a report **with** a valid non-empty `vulnerabilities` array *still* `5xx`s is the endpoint genuinely broken for this repo: then (and only then) stage the report in `memory/pending-disclosures/` and have the operator file it via the web form `https://github.com/<repo>/security/advisories/new` (a different frontend to the same PVR backend), **without** retry-spamming. (Contrast the `403` PVR-*disabled* case above, where the form `404`s too — route to an out-of-band contact instead.)
- Any other failure → stage in `memory/pending-disclosures/` and surface to the operator; never publish.

**Dependency-bump PRs (step 5a) are the only public channel.** Hardening-class code findings (e.g. DNS-rebinding / Host-Origin allowlists) *may* be offered as a neutral public PR at operator discretion, but high-severity exploitable flaws (RCE, auth bypass, secret exposure, sandbox/guardrail escape) must stay on a private channel.

#### 5c. Proposed code patch (optional, paired with 5b)

If you have a minimal fix, push it to **your fork only** (not a PR to upstream) and link it in the PVR description so the maintainer can cherry-pick:

```bash
git checkout -b private/fix-<slug>
# apply fix
git commit -m "draft: proposed patch for reported advisory"
git push -u origin HEAD
# DO NOT open a PR. Link the branch in the advisory body.
```

### 6. Update dedup state

Append to `memory/vuln-scanned.json` (create if missing) so future runs skip this repo for 30 days:

```json
{"repo": "owner/repo", "scanned_at": "2026-04-20T16:00:00Z", "findings": <N>, "channel": "pvr|public-pr|skipped"}
```

### 7. Write local report

Save to `articles/vuln-scan-${today}.md` with sections for: repo metadata, scanner sources (ok/fail per tool), candidate count, confirmed findings with severity and channel, dedup note. Do **not** include exploit details for findings disclosed via PVR — redact file/line and link to the advisory ID instead.

### 8. Notify

Use `./notify`. One paragraph. Lead with the verdict.

```
*Vuln Scanner — <repo>*
<N> confirmed findings (<severity-summary>).
Disclosed via: <PVR: advisory #123 | public PR #45 | skipped (no channel)>
Scanners: semgrep=<ok|fail>, trufflehog=<ok|fail>, osv=<ok|fail>.
```

If the audit was clean:
```
*Vuln Scanner — <repo>*
Clean audit. <M> candidates reviewed, 0 confirmed. Scanners: semgrep=ok, trufflehog=ok, osv=ok.
```

### 9. Log

Append to `memory/logs/${today}.md`:

```
### vuln-scanner
- Target: owner/repo (stars, language)
- Candidates: N | Confirmed: M
- Channels used: PVR (x), public PR (y), skipped (z)
- Scanner status: semgrep=ok trufflehog=ok osv=ok
- Advisory/PR links: [...]
```

## Sandbox note

Getting the scanners to run in the GitHub Actions sandbox takes **two** things — both are now in place:

1. **Install** — the binaries (`semgrep`, `trufflehog`, `osv-scanner`, `slither`) are **not pre-installed**, and outbound `pip install` / `curl | sh` downloads are blocked. `scripts/prefetch-vuln-scanner.sh` stages them before Claude starts (full network access — see CLAUDE.md prefetch pattern), into `/tmp/bin` (+ `semgrep` symlink).
2. **Execute** — non-interactive `claude -p` runs under an `--allowedTools` allowlist, so any command not on it is **denied** ("requires approval") with no human to approve. The scanner *bare names* are granted in `scripts/skill_mode.sh` (write tier). This is why step 3 puts `/tmp/bin` on `PATH` and calls each tool by bare name (`semgrep …`, not `/tmp/bin/semgrep …`) — an absolute-path invocation would not match the allowlist pattern.

This two-part fix resolves ISS-001 (binaries installed *and* runnable). If any scanner binary is still missing at runtime, log `VULN_SCANNER_SKIPPED: <tool> not available`, record `tool=fail` in `sources.txt`, and continue with the remaining scanners rather than aborting the whole run.

General sandbox rules: use **WebFetch** as a fallback for any plain URL fetch. For anything requiring a token, use `gh api` (handles auth internally) or the pre-fetch/post-process pattern (see CLAUDE.md). An all-scanners-fail run must report **error**, not **clean**.

## Environment variables

- `GH_TOKEN` / `GITHUB_TOKEN` — required. Classic `repo` scope is sufficient, **including** private vulnerability reporting via the `/reports` endpoint (step 5b). `repository_advisories:write` is only needed to *manage advisories on repos you own* — it is **not** required to report to third-party repos, and its absence is not the reason a report fails (see step 5b for the real failure modes: a **missing `vulnerabilities` array** → `500` (by far the most common — fixable in-band), PVR-disabled `403`, or a genuine GitHub API `5xx`).

## Guidelines

- **Do no harm.** If you can't route a finding through a safe channel, don't publish it.
- **One report per repo per run.** Bundle related findings.
- **Read the code.** A scanner hit alone is not a vulnerability.
- **Skip intentionally vulnerable repos** (teaching tools, CTFs).
- **Don't scan the same repo twice in 30 days** (`memory/vuln-scanned.json`).
- **Never post exploit chains publicly.** PoCs go in the private advisory, not in a GitHub comment.
- **Be deferential in disclosure language** — you're offering help, not grading homework.
- **Public PRs are only for dependency bumps** addressing already-disclosed CVEs. Everything else is private.
- **All-scanners-failed ≠ clean.** Report it as an error and do not publish anything.
