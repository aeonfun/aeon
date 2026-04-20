---
name: Security Digest
description: Lead with confirmed exploitation (CISA KEV), enrich with EPSS, filter GitHub Advisories to your tracked stack, output one action per item
var: ""
tags: [news, dev]
---
<!-- autoresearch: variation D — rethink from "list critical advisories" to "tell me what to patch today, ranked by real-world exploitation signal" -->

> **${var}** — Comma-separated ecosystems you care about (e.g. `npm,pip,Go`). If empty, reads `memory/MEMORY.md` for tracked stack; defaults to `npm,pip,Go,crates.io,GitHub Actions`.

Read `memory/MEMORY.md` for tracked stack and any pinned packages.
Read last 2 days of `memory/logs/` — collect CVE/GHSA IDs mentioned to avoid repeats.

## Frame

CVSS measures theoretical severity. Most critical CVEs are never exploited. A security digest that lists them by score trains the reader to ignore it. This version inverts the order: **what's actually being exploited** first, **what's likely to be** second, and only then **what's severe but quiet**. Every item ends with one concrete action.

## Steps

1. **Load CISA KEV and find what was added this week.**
   ```bash
   SINCE=$(date -u -d '7 days ago' '+%Y-%m-%d' 2>/dev/null || date -u -v-7d '+%Y-%m-%d')
   curl -sf --max-time 20 "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json" \
     > kev.json || echo "KEV curl failed, falling back to WebFetch"
   jq --arg s "$SINCE" '[.vulnerabilities[] | select(.dateAdded >= $s)]' kev.json > kev_recent.json 2>/dev/null || echo "[]" > kev_recent.json
   ```
   If curl fails, **WebFetch** `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` and extract vulnerabilities with `dateAdded` within the last 7 days. KEV entries are the top priority — confirmed exploitation in the wild.

2. **Fetch GitHub Advisory Database (last 48h, critical + high).**
   ```bash
   SINCE48=$(date -u -d '2 days ago' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -v-2d '+%Y-%m-%dT%H:%M:%SZ')
   for SEV in critical high; do
     curl -sf --max-time 20 "https://api.github.com/advisories?type=reviewed&severity=${SEV}&published=${SINCE48}.." \
       -H "Accept: application/vnd.github+json" \
       ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"}
   done > advisories.json
   ```
   If curl fails or rate-limits, use `gh api "/advisories?type=reviewed&severity=critical&published=${SINCE48}.."` instead (gh handles auth internally). Extract: `ghsa_id`, `cve_id`, `summary`, `severity`, `cvss.score`, `vulnerabilities[].package.{ecosystem,name}`, `vulnerabilities[].patched_versions`, `vulnerabilities[].vulnerable_version_range`, `html_url`, `published_at`.

3. **Filter GH advisories to the tracked stack.** Parse `${var}` (or the tracked-ecosystems default from memory). Keep only advisories whose `vulnerabilities[].package.ecosystem` is in the tracked set — **except** advisories whose CVE is in KEV, which always pass through (real-world exploitation overrides stack filter).

4. **Enrich every candidate with EPSS** (FIRST.org's 30-day exploitation probability):
   ```bash
   CVES=$(jq -r '[.. | .cveID? // .cve_id? | select(.!=null)] | unique | join(",")' kev_recent.json advisories.json)
   [ -n "$CVES" ] && curl -sf --max-time 20 "https://api.first.org/data/v1/epss?cve=${CVES}" > epss.json \
     || echo '{"data":[]}' > epss.json
   ```
   Join by CVE ID. Missing EPSS → treat as 0.

5. **Dedupe and rank into three action tiers.** Drop anything whose GHSA or CVE ID appears in the last 2 days of `memory/logs/`.

   | Tier | Rule | Action template |
   |------|------|-----------------|
   | **PATCH TODAY** | In KEV added this week, OR EPSS ≥ 0.5, OR (CVSS ≥ 9.8 AND public PoC referenced in summary) | `upgrade <pkg> to ≥<fix> and redeploy` |
   | **PATCH THIS WEEK** | CVSS ≥ 8.0 in tracked ecosystem, OR EPSS 0.1–0.5 | `schedule upgrade: <pkg> → ≥<fix>` |
   | **MONITOR** | Remaining critical/high in tracked ecosystems with no fix available | `track <ghsa>; no patch yet` |

   Cap: 3 / 5 / 3. Sort inside each tier by (in-KEV desc, EPSS desc, CVSS desc).

6. **For each item in PATCH TODAY / PATCH THIS WEEK, fetch patch detail** via **WebFetch** on the advisory `html_url` — extract the exact patched version if not already clear from the JSON, and note whether a public exploit/PoC exists. Skip this step for MONITOR tier (not worth the extra calls).

7. **Format and send via `./notify`** (<4000 chars). Every item ends with an action verb. Lead with a one-line verdict:
   ```
   *Security Digest — ${today}*
   Verdict: 1 actively exploited, 2 likely soon, 3 to schedule. _Sources: KEV, GH Advisory, EPSS_

   *PATCH TODAY*
   - [CVE-2026-12345](url) — Acme Router firmware · KEV added 2026-04-18 · EPSS 0.94 · CVSS 9.8
     RCE via unauth'd admin panel. Exploited per CISA.
     → patch firmware to ≥3.7.2 today.

   *PATCH THIS WEEK*
   - [GHSA-xxxx](url) — django (pip) · CVSS 9.1 · EPSS 0.31 · no public PoC
     Template injection in admin. → upgrade django to ≥5.2.4.

   *MONITOR*
   - [GHSA-yyyy](url) — gin (Go) · CVSS 7.8 · no fix yet · EPSS 0.02
     Header smuggling. → watch for patched release; avoid exposing admin routes.
   ```

   **Always include CVSS alongside KEV/EPSS** on every line so readers see both the ranking-signal (KEV/EPSS) and the traditional severity score (CVSS) — this preserves backward-compatibility for consumers used to the old CVSS-first format.

   If `PATCH TODAY` is empty, change the verdict line to `Verdict: nothing urgent today. N to schedule, M to monitor.` Drop empty sections entirely rather than printing "(none)".

8. **Log** to `memory/logs/${today}.md`:
   ```
   ### security-digest
   - Tier counts: today=N, this-week=M, monitor=K
   - IDs: [list of GHSA/CVE ids included]
   - KEV additions this week: N (across all ecosystems)
   - Sources status: kev=ok|fail, gh=ok|fail, epss=ok|fail
   - Notable: [e.g., first KEV add for npm in 3 months, or 0 items → SECURITY_DIGEST_OK]
   ```

If all three tiers are empty and sources succeeded, log `SECURITY_DIGEST_OK` with source status and skip `./notify`. If all sources failed, notify a single-line failure message and log `SECURITY_DIGEST_ERROR`.

## Sandbox note

curl in the sandbox can fail silently, and env-var expansion in auth headers is blocked for some services. For each fetch:
- Always set `--max-time` and check `$?`.
- On curl failure, fall back to **WebFetch** on the same URL.
- For GitHub API specifically, prefer `gh api` (handles auth internally) over raw curl with `$GITHUB_TOKEN` headers.
- CISA KEV and FIRST EPSS are public (no auth) — curl failures there are network, not auth, problems.

## Environment Variables

- `GITHUB_TOKEN` (optional): raises GH Advisory API rate limit from 60 to 5000 req/hr. Present by default in GitHub Actions.
- No other secrets required. CISA KEV (`cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`) and FIRST EPSS (`api.first.org/data/v1/epss`) are public.
