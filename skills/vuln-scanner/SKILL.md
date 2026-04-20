---
name: Vuln Scanner
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

```bash
mkdir -p /tmp/vuln-scan

# --- SAST: Semgrep OSS ---
pip install --quiet semgrep 2>/dev/null || true
semgrep --config=p/security-audit --config=p/owasp-top-ten --config=p/secrets \
  --severity=ERROR --severity=WARNING --json --quiet --timeout=300 \
  --exclude=test --exclude=tests --exclude=__tests__ --exclude=spec --exclude=specs \
  --exclude=fixtures --exclude=examples --exclude=example --exclude=demo \
  --exclude=vendor --exclude=node_modules --exclude=dist --exclude=build --exclude=.next \
  -o /tmp/vuln-scan/semgrep.json . 2>/dev/null || true

# --- Secrets: TruffleHog (only-verified = actually authenticates) ---
curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh \
  | sh -s -- -b /tmp/bin 2>/dev/null || true
/tmp/bin/trufflehog filesystem . --only-verified --json \
  > /tmp/vuln-scan/trufflehog.json 2>/dev/null || true
# Also scan full git history for secrets
/tmp/bin/trufflehog git file://. --only-verified --json \
  > /tmp/vuln-scan/trufflehog-git.json 2>/dev/null || true

# --- Dependencies: osv-scanner (unified CVE DB across ecosystems) ---
curl -sSfL -o /tmp/bin/osv-scanner \
  https://github.com/google/osv-scanner/releases/latest/download/osv-scanner_linux_amd64 2>/dev/null && \
  chmod +x /tmp/bin/osv-scanner
/tmp/bin/osv-scanner --format=json --recursive . \
  > /tmp/vuln-scan/osv.json 2>/dev/null || true

# --- Smart-contract scan (if Solidity present) ---
if ls **/*.sol >/dev/null 2>&1; then
  pip install --quiet slither-analyzer 2>/dev/null || true
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
gh api -X POST "/repos/$REPO/security-advisories" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  -f summary="<short title>" \
  -f description="$(cat <<'EOF'
## Summary
<one-paragraph description>

## Impact
<what an attacker can do, concretely>

## Location
`path/to/file.ext:LINE`

## Proof of exploitation
<minimal PoC or request/payload — no working exploit chains>

## Suggested fix
<specific code change or pattern>

## Detected by
Aeon + <semgrep|trufflehog|slither>
EOF
)" \
  -f severity="<critical|high|medium|low>" \
  -F cwe_ids='["CWE-89"]'  # adjust per finding
```

If `gh api` returns 404/403 on the advisories endpoint, PVR is disabled. Do **not** fall back to a public issue or PR. Instead:
- Check `SECURITY.md` for a private contact. If present, draft an email/form submission and save to `.pending-disclosure/<repo>-<timestamp>.md` with body text — do not auto-send.
- If no contact exists, log "no safe channel — skipped" and move on. Document your findings in the local report (step 7) but do not publish them.

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

Scanner binaries (`semgrep`, `trufflehog`, `osv-scanner`, `slither`) are **not pre-installed** in the GitHub Actions sandbox, and outbound `pip install` / `curl | sh` downloads may be blocked. Operators should pre-cache them via `scripts/prefetch-vuln-scanner.sh` (runs before Claude starts, with full network access — see CLAUDE.md prefetch pattern). If any scanner binary is still missing at runtime, log `VULN_SCANNER_SKIPPED: <tool> not available`, record `tool=fail` in `sources.txt`, and continue with the remaining scanners rather than aborting the whole run.

General sandbox rules: use **WebFetch** as a fallback for any plain URL fetch. For anything requiring a token, use `gh api` (handles auth internally) or the pre-fetch/post-process pattern (see CLAUDE.md). An all-scanners-fail run must report **error**, not **clean**.

## Environment variables

- `GH_TOKEN` / `GITHUB_TOKEN` — required. Needs `repo` + `repository_advisories:write` scopes for PVR.

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
