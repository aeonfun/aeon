# Push Recap — 2026-04-29

## Verdict
> SHIPPING — pr-triage skill goes live as a first-touch layer for external PRs.

**Shape:** 1 user-visible commit · 0 internal · 0 infra · 0 bot-filtered
**Volume:** 4 files changed, +263/-2 lines across 1 commit by 1 author
**Merged PRs:** 1 (#147 feat(pr-triage): first-touch external-PR triage skill)

---

## aaronjmars/aeon

### External-PR triage skill ships

**What this is:** A new installable skill — `pr-triage` — that gives every external pull request a verdict, a `triage:*` label, and a templated welcoming comment within minutes of opening. It is the upstream signal `pr-review` and `auto-merge` were missing: "is this PR even worth a depth pass, or does it need author action / maintainer hand-off / closure?" Triggered by external PR #143 from `pezetel` sitting four days untouched while fork count climbs toward 40.

**Shipped to users**
- `e26e7a2` — `feat(pr-triage): first-touch external-PR triage skill (#147)`
  - `skills/pr-triage/SKILL.md` (new): defines a four-check rubric (scope / format / originality / size) and a four-rung verdict ladder — `ACCEPTED` (welcome + hand off to pr-review), `NEEDS-CHANGES` (specific asks, leave open), `DEFER` (RFC-only or >500 lines without `large-ok`, leave open for maintainer), `OUT-OF-SCOPE` (close-as-not-planned, only on protected-path violations: `.github/workflows/`, root `aeon` binary). Idempotency is double-layered — primary state in `memory/triaged-prs.json` keyed on `(PR, headRefOid)`, plus a defensive 7-day comment-prefix scan so re-runs are no-ops and pushes re-trigger triage. Notify is significance-gated: out-of-scope closures and first-PR welcomes notify; routine NEEDS-CHANGES / DEFER stay silent (the PR comment is the signal). Trusted-author allowlist matches the `## Trusted Authors` convention in `memory/watched-repos.md`, so internal PRs continue routing to `pr-review` / `auto-merge`. (+248/−0)
  - `aeon.yml`: wires `pr-triage` into the `30 9 * * *` mid-morning band (alongside `issue-triage` at `0 9` and `pr-review`/`github-monitor` at `0 9`), disabled-by-default with `var:` support for one-shot dispatch — `owner/repo` or `owner/repo#N`. (+1/−0)
  - `generate-skills-json`: adds `pr-triage` to the `dev` category branch alongside `pr-review`. (+1/−1)
  - `skills.json`: adds the catalog manifest entry between `pr-review` and `project-lens`; total skills bumps `92 → 93`. New install command: `./add-skill aaronjmars/aeon pr-triage`. (+13/−1)

---

## Developer notes
- **New dependencies:** none.
- **Breaking changes:** none. `pr-triage` is disabled by default in `aeon.yml`; existing `pr-review` / `auto-merge` flows are unchanged.
- **New public surface:**
  - New skill slug `pr-triage` in `skills.json` (installable via `./add-skill aaronjmars/aeon pr-triage`).
  - New `aeon.yml` skill key `pr-triage` (cron `30 9 * * *`, `var: "owner/repo"` or `"owner/repo#N"`).
  - New label namespace created on first run: `triage:accepted`, `triage:needs-changes`, `triage:deferred`, `triage:out-of-scope`.
  - New state file path: `memory/triaged-prs.json`.
- **Tech debt added:** none introduced in this diff. Skill body is a spec — no executable code under `skills/pr-triage/`; behavior is interpreted by the harness like every other skill.

## Open threads
- `pr-triage` is wired in disabled. Operator must flip `enabled: true` in `aeon.yml` (or run a workflow_dispatch with `var: aaronjmars/aeon`) to actually start triaging external PRs. Until then PR #143 (pezetel) — the trigger case — remains untouched.
- Manifest entry in `skills.json` ships placeholder values: `"sha": "0000000"` and `"files": 0`. These will be filled on the next `generate-skills-json` regen.

## Sources
- aaronjmars/aeon: ok
- gh api events: ok
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 0
- diff-truncated: 0
