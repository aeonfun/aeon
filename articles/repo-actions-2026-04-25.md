# Repo Actions — aaronjmars/aeon — 2026-04-25

**Top pick for tomorrow:** #1 — Add `.github/dependabot.yml` covering GitHub Actions, dashboard npm, and mcp-server npm (Security, Small)
**Verdict:** Five HIGH-priority structural gaps anchor this cycle — every one is a missing repo-meta file that the project's own skill catalog (`vuln-scanner`, `skill-security-scan`, `weekly-shiplog`, `repo-pulse`) would either consume or produce. Top pick is dependabot.yml because today's `security-digest` flagged a live CVE in `@anthropic-ai/claude-code` (GHSA-q5hj-mxqh-vv77 / CVE-2026-40068) that a dependabot config would surface automatically.

## Actions

### 1. Add `.github/dependabot.yml` covering Actions + npm in dashboard/ and mcp-server/
**Priority:** HIGH (leverage 4)
**Type:** Security
**Effort:** Small (hours)
**Anchor:** MISSING:.github/dependabot.yml
**Score:** L=4 C=5 N=5 (total 14/15)
**Impact:** Dependabot opens PRs automatically when a dependency goes unsafe. Today's `security-digest` flagged GHSA-q5hj-mxqh-vv77 / CVE-2026-40068 in `@anthropic-ai/claude-code` (vulnerable >=2.1.63, <2.1.84) — an Aeon-stack package. Without a dependabot config, the maintainer has to chase CVEs manually; with one, they land as PRs that `auto-merge` can ship.
**How:**
1. Create `.github/dependabot.yml` with three update blocks: `package-ecosystem: "github-actions"` at `directory: "/"`, `package-ecosystem: "npm"` at `directory: "/dashboard"`, and `package-ecosystem: "npm"` at `directory: "/mcp-server"` (and `directory: "/a2a-server"` if a `package.json` exists there — confirm via tree before writing).
2. Set `schedule: { interval: "weekly", day: "monday" }` and `open-pull-requests-limit: 5` per ecosystem.
3. Add `labels: ["dependencies"]` so `auto-merge` and `issue-triage` can route them.
4. Open PR with title `chore(security): add dependabot config for actions + npm`.
**Definition of done:** PR merged; dependabot has scanned within 24h; the repo's Insights → Dependency graph → Dependabot tab shows three configured ecosystems and at least one alert/PR draft for the `@anthropic-ai/claude-code` advisory.

### 2. Add `.github/ISSUE_TEMPLATE/` with `bug_report.yml`, `feature_request.yml`, and `ai_build.yml`
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:.github/ISSUE_TEMPLATE/
**Score:** L=4 C=5 N=5 (total 14/15)
**Impact:** Issues are enabled (totalCount=0) but there are no templates. The README advertises an existing capability — "Label any GitHub issue `ai-build` → workflow fires → Claude reads the issue, implements it, opens a PR" — and a structured `ai_build.yml` template would funnel new contributors directly into that workflow with the right label pre-applied. Today the path is invisible.
**How:**
1. Create `.github/ISSUE_TEMPLATE/config.yml` with `blank_issues_enabled: false` and a `contact_links` block pointing at Discussions or the `aeonframework` X account.
2. Create `bug_report.yml` (form schema): fields for skill name, expected vs actual, log excerpt from `memory/issues/`, repro repo URL.
3. Create `feature_request.yml`: fields for skill category (matches the README table — Research, Dev, Crypto, Social, Productivity, Meta), proposed skill name, var schema.
4. Create `ai_build.yml` with `labels: ["ai-build"]` pre-set, structured fields for goal / acceptance criteria / repo path — so a labeled issue is well-formed enough for the workflow to parse.
5. Open PR; reference README §"Trigger feature builds from issues".
**Definition of done:** New issue UI on `aaronjmars/aeon` shows three template choices; submitting `ai_build.yml` lands an issue with `ai-build` label already attached.

### 3. Generate `CHANGELOG.md` from the last ~20 merged PRs and wire `weekly-shiplog` to append to it
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours for the seed file, half a day to wire weekly-shiplog)
**Anchor:** MISSING:CHANGELOG.md
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** Twenty merged PRs in the last 30 days (PRs #141, #140, #139, #138, #137, #36, #34, #32, #27, #26, #21, #20, #19, #18, #17, #16, #15, #11, #10, #5, #4, #3, #1) and no CHANGELOG. Forks and watchers can't tell what shipped without trawling git log. A Keep-a-Changelog file makes the velocity legible to grant committees and prospective contributors and gives `weekly-shiplog` a stable target.
**How:**
1. Create `CHANGELOG.md` using Keep-a-Changelog 1.1.0 format with an `Unreleased` section followed by `## [0.x.0] - 2026-04-DD` blocks reconstructed from merged PR titles, grouping them under `Added` / `Changed` / `Fixed` / `Security` (e.g. PR #34 `fix(security): gate skills.lock auto-advance` → `Security`; PR #27 `feat: skill-evals` → `Added`).
2. Write a `scripts/changelog-from-prs.sh` helper that calls `gh pr list --state merged --search "merged:>=$(date -d '7 days ago' -I)" --json number,title,mergedAt,labels` and emits a markdown block.
3. Edit `skills/weekly-shiplog/SKILL.md` to append to `CHANGELOG.md` (under `## [Unreleased]`) at the end of each weekly run.
4. Open PR with title `docs: seed CHANGELOG.md from merged PRs and append via weekly-shiplog`.
**Definition of done:** `CHANGELOG.md` exists at repo root with at least 20 entries spread across categories; the next `weekly-shiplog` run appends a dated section under `## [Unreleased]` without rewriting existing entries.

### 4. Add `CONTRIBUTING.md` with the fork-flow, skill-add CLI, and smoke-test contract
**Priority:** HIGH (leverage 4)
**Type:** Community
**Effort:** Small/Medium (1 day)
**Anchor:** MISSING:CONTRIBUTING.md
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** 36 forks but no contributing guide. The README has a `Two-repo strategy` paragraph that explains how operators fork for private use, but nothing for upstream contribution. Skill #10 (`skill smoke tests — automated PR validation for all SKILL.md files`) already exists and there's a `fork-skill-digest` measuring divergence — this skill expects fork authors to want to push back upstream, but the upstream side has no documented contract. Adds friction for the loop the maintainer is explicitly investing in.
**How:**
1. Create `CONTRIBUTING.md` with five sections: (a) Architecture-in-30-seconds (link to `assets/architecture.jpg` and `docs/skill-graph.md`); (b) Adding a new skill (the `SKILL.md` frontmatter contract — `name`, `description`, `var`, `tags`, `model`); (c) The smoke test contract that PR #10 set up — what gets validated, what fails the PR; (d) PR style — branch names, commit style based on the visible pattern (`feat:`, `fix(...):`, `improve(...):`, `chore(...):`); (e) The `fork-skill-digest` upstream loop — how to surface a fork divergence as a PR.
2. Cross-link from README §"Adding skills" → `CONTRIBUTING.md`.
3. Open PR with title `docs: add CONTRIBUTING.md covering skill contract, smoke tests, and fork-loop`.
**Definition of done:** `CONTRIBUTING.md` exists; "New issue" / "New PR" pages on GitHub show the contributor-guide banner; running `./aeon` locally references the file.

### 5. Add `SECURITY.md` with disclosure path, supported-versions table, and skill-security-scan output reference
**Priority:** MED (leverage 3 — signal-grade until the project hits the install-base size where reporters show up)
**Type:** Security
**Effort:** Small (hours)
**Anchor:** MISSING:SECURITY.md
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** The repo ships four security-domain skills (`skill-security-scan`, `vuln-scanner`, `workflow-security-audit`, `security-digest`) and a CVE was just disclosed against an Aeon-stack package. There's no SECURITY.md telling reporters where to send a vuln, and no documented relationship between the project's own scanners and its disclosure policy. Adds credibility for any prospective security-conscious adopter (which includes grant committees and enterprise forks).
**How:**
1. Create `SECURITY.md` with three sections: (a) Reporting — a private email address (e.g. `security@aeon.<domain>`) or GitHub Security Advisories link, with a 90-day disclosure window; (b) Supported versions — single-row table for `main` (current), explicit "no LTS branches"; (c) Self-scanning — bullet list noting that this repo runs `skill-security-scan` on imported skills, `vuln-scanner` against its dependencies, and `workflow-security-audit` against its own `.github/workflows/*.yml`, with cron times, so reporters know what's already covered.
2. Add a `Security policy` badge to the README header next to the existing status badge.
3. Open PR with title `docs: add SECURITY.md disclosure policy and supported-versions table`.
**Definition of done:** `SECURITY.md` exists; the repo's "Security" tab shows a "Reporting a vulnerability" entry; README badge renders.

## Monitor

### A. Add `ROADMAP.md` reflecting the next ~6 weeks of skill-fleet evolution
**Why not yet:** Needs the maintainer's roadmap input — what lands next, in what order, with what owner. external-feature can scaffold the file but the priorities are owner decisions and would be wrong if guessed.
**Anchor:** MISSING:ROADMAP.md

### B. Review and unblock PR #142 "feat: skill-analytics — fleet-level skill-run analytics widget"
**Why not yet:** PR was opened by the repo owner (aaronjmars) at 2026-04-25T11:20:05Z — under three hours before this run. external-feature should not auto-review the maintainer's own PRs without an explicit allowlist entry. Worth a 24h hold; surface again tomorrow if still open with no review.
**Anchor:** PR:#142 "feat: skill-analytics — fleet-level skill-run analytics widget"

### C. Add `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1)
**Why not yet:** Implementable as a drop-in, but leverage is low (signal-only) until the project's contributor base grows enough to justify the enforcement framing. Tracking; promote to the main 5 once `CONTRIBUTING.md` lands and PR throughput from non-owners ticks up.
**Anchor:** MISSING:CODE_OF_CONDUCT.md

---

**Source status:** gh=ok code_search=rate_limited memory_topics=missing(repos.md) articles_dir=ok watched_repos=1 parsed
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** — (first repo-actions run; no prior article)
