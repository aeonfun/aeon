# Governance

How decisions get made, who makes them, and how contributions move from idea to merged.

---

## Roles

Aeon has five visible roles. None of them are formalized in CODEOWNERS or a charter today — this is descriptive, not prescriptive.

| Role | Who | What they do |
|---|---|---|
| **Author / lead maintainer** | `aaronjmars` | Sets direction, accepts/rejects PRs to the upstream public repo, owns brand, owns the public `@aeonframework` X account, owns the [bankr.bot](https://bankr.bot) integration relationship. Single point of decision on anything that ships in the public catalog. |
| **Co-maintainers / contributors** | (currently us, plus historical PR authors) | Land skills, fix bugs, write docs, maintain subsystems. No formal seat yet — see "Open governance questions" below. |
| **Fork operators** | ~24 active operators per `SHOWCASE.md` | Run their own private/public fork with a curated subset of skills. Feed signal back upstream via `fork-skill-digest` (`DEFAULT_FLIP` detection) and `fork-contributor-leaderboard`. |
| **Ecosystem builders** | ~50 projects per `ECOSYSTEM.md` | Build products *on top of* Aeon (Bankr, Reg Terminal, x402Books, Bankrsynth, BaseHouse, etc.). They consume the framework, sometimes contribute back. |
| **Skill-pack authors** | 6 known packs per `README.md` | Publish independent skill collections in their own repos that install via `./install-skill-pack <owner>/<pack>`. Registered in `skill-packs.json`. |

## Decision-making, today

There is no written governance document. Empirically:

- **Skill PRs** → reviewed by the author. Bar appears to be: follows conventions, includes a sandbox note, doesn't introduce unscanned outbound dependencies.
- **Core runtime PRs** (`.github/workflows/`, `dashboard/`, `mcp-server/`, `a2a-server/`, `add-*` scripts) → author decision only. These have outsized blast radius (every fork inherits them via `sync-upstream`).
- **Doc PRs** → low friction, author merges.
- **`ai-build` label flow** → labeling a GitHub issue with `ai-build` triggers a workflow that has Claude read the issue, implement it, and open a PR. Author still reviews the PR before merge.
- **Community skill packs** → no review of pack contents; the registry in `skill-packs.json` only requires guideline compliance per `README.md` (own repo, clear license, per-skill `SKILL.md`, no monkey-patching of internals, no private-endpoint dependencies). `./install-skill-pack` runs `skill-security-scan` on each `SKILL.md` before copying it in.
- **Ecosystem listings** (`ECOSYSTEM.md`) → low bar (X handle, public link, alphabetized). PR-based.

## Contribution flow

```
            ┌─────────────────────────────────────────────────────────────┐
            │                  Where the change starts                    │
            └─────────────────────────────────────────────────────────────┘
                          │                       │                 │
                ┌─────────▼─────────┐  ┌──────────▼─────────┐  ┌───▼────┐
                │ External operator │  │ Co-maintainer (us) │  │ Author │
                │ files GitHub      │  │ opens PR directly  │  │ commits│
                │ issue + ai-build  │  │                    │  │ direct │
                └─────────┬─────────┘  └──────────┬─────────┘  └───┬────┘
                          │                       │                │
                          ▼                       ▼                │
                  ai-build workflow ──> PR ───────┘                │
                          │                       │                │
                          ▼                       ▼                ▼
            ┌─────────────────────────────────────────────────────────────┐
            │            Author review (currently the only gate)          │
            └─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                       Merge to main
                          │
                          ▼
            ┌─────────────────────────────────────────────────────────────┐
            │  Forks pull via sync-upstream.yml → fork-release-tracker    │
            │  surfaces the change → fork-skill-digest re-classifies      │
            │  fleet adoption → upstream learns from DEFAULT_FLIP signals │
            └─────────────────────────────────────────────────────────────┘
```

## Upstream / fork relationship

`README.md` recommends a **two-repo strategy**: the public template is `aaronjmars/aeon`, and every operator runs a private fork. The reasoning is straightforward — memory (`memory/MEMORY.md`, `memory/topics/*`, `memory/logs/*`), articles, soul files, and tokens accumulate in the fork and should not be exfiltrated to the public repo.

The synchronization shape:

- **Upstream → fork:** `git remote add upstream … && git fetch upstream && git merge upstream/main` (manual cadence). Operators can automate via `.github/workflows/sync-upstream.yml`.
- **Fork → upstream:** **only via PR.** No telemetry, no auto-push. The signal upstream gets from forks is *what they enabled*, which the weekly `fork-skill-digest` skill computes by reading the GitHub forks API. When two or more forks independently flip the same default, it's flagged as a `DEFAULT_FLIP` candidate. The author decides whether to flip the upstream default.

This is a **soft governance loop**: forks vote with their `aeon.yml`, upstream notices, upstream adopts.

## The `ai-build` channel

Aeon has a self-referential contribution channel: label any GitHub issue with `ai-build`, and a workflow fires that has Claude implement the change and open a PR. This is documented in `README.md`. Operationally:

- Lowers the cost of low-stakes contributions (small skills, docs fixes, well-scoped features).
- Author still reviews every PR — the workflow does not auto-merge.
- Quality varies. The `pr-review` skill (run by the author or another contributor) provides an LLM-as-judge second opinion before merge.

## Release cadence

**Not formalized.** No SemVer, no changelog file (the `changelog` skill produces *content* not a *version log*), no release branches. The convention appears to be:

- `main` is the only release branch.
- Forks pick up changes by merging from upstream when they want.
- Breaking changes to the skill format would propagate immediately to every fork on next sync.

This is a place where joining as co-author may want to introduce structure. See `08-OPEN-QUESTIONS.md`.

## Ecosystem stewardship

`ECOSYSTEM.md` lists ~50 projects. The guidelines (per the file):

- Project must publicly identify as built on / using / extending Aeon.
- One row per project.
- At least an X handle or public link required.
- Forks that mainly run stock skills belong on `SHOWCASE.md`, not `ECOSYSTEM.md`.
- Cross-listing with the skill-pack registry encouraged when applicable.

There is no quality bar or vetting — the listing is a directory, not an endorsement. This matters because the brand carries weight in the agent-framework discourse; abuse risk is non-trivial. See `05-SECURITY.md` for the supply-chain concerns this creates.

## Community skill packs — trust model

Critical surface. Documented in `docs/community-skill-packs.md`.

- Packs live in their own repos with their own licenses.
- `./install-skill-pack` reads a `skills-pack.json` manifest from the pack root (or falls back to scanning `skills/`).
- Each declared `SKILL.md` is scanned by `skill-security-scan` before being copied in.
- Approved skills land in `skills/` with rows added to `skills.json`, entries added to `aeon.yml` (disabled), and provenance recorded in `skills.lock`.

The scan-on-install is the entire trust enforcement. If the scan misses something (or the pack is updated post-scan and re-pulled), the operator inherits the risk. See `05-SECURITY.md` § Supply-chain for what a malicious pack could do.

## Our seat as co-author (confirmed 2026-05-26)

Operator decision 2026-05-26: **we will be repo owners of `aaronjmars/aeon`.** The framing shifts from "private fork staging ground" to "in-repo upstream contribution." Concretely:

- **Repo owner permissions on `aaronjmars/aeon`** for both Andrew and aaronjmars. Both have merge rights; CODEOWNERS file recommended (per [`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md) Q1 — RESOLVED).
- **Sealed Sprint output lands in the main repo** (not a private fork). The expansion work (Session 06 implementation + scaffolds for 02/03/09/01 + new in-repo subprojects `aeon-federation-registry/` and `aeon-agora/`) all goes to `aaronjmars/aeon`.
- **Conflict-of-interest watch:** if a change would benefit one ecosystem partner over another (e.g. favoring Bankr's gateway, or one skill pack over another), surface that for the other maintainer's judgment rather than committing solo.
- **Brand and external comms** stay with the human who originated them — aaronjmars owns `@aeonframework`; Andrew speaks for himself. Neither auto-posts on behalf of the other.
- **Public-repo merges:**
  - **Docs, skills, tests, scaffolds** — either maintainer can merge.
  - **Runtime / dashboard / mcp-server / a2a-server / workers-runtime / aeon-agora / aeon-federation-registry core changes** — discussed first, then either can merge.
  - **Breaking changes** — discussed + announced first; both sign off.

### Author-decision items now resolved

- **Q1 Formal co-maintainer status** — resolved: full co-maintainer with the scope above.
- **Q4 (Decision 2 from break-the-seal blockers) Federation registry hosting** — resolved: in-repo at [`aeon-federation-registry/`](../../aeon-federation-registry/); canonical URL `federation.aeon.bot`.
- **Q-implicit Agora hosting location** — resolved: in-repo at [`aeon-agora/`](../../aeon-agora/); canonical URL `agora.beta.aeon.bot` (beta 90d → `agora.aeon.bot`).
- **Q-implicit Embedding provider preference** — resolved: Workers AI primary (post-seal), OpenAI fallback.

## Open governance questions

These need an explicit conversation with the author. Captured here, expanded in [`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md):

1. **Formal co-maintainer status** — do we add ourselves to CODEOWNERS / repo permissions, and at what scope?
2. **Release process** — should breaking changes get a SemVer-style major bump and a written migration note? (Currently they would silently propagate to every fork.)
3. **Skill-pack vetting** — is `skill-security-scan` enough, or do we want a manual review tier for packs we promote in the README table?
4. **Ecosystem listing standards** — is the listing a directory (current state) or an endorsement? Affects abuse risk.
5. **Discussion forum** — currently GitHub issues + Telegram/Discord/Slack (per-operator). Is an upstream community channel (Discord server, Discussions tab) needed as the fleet grows?
6. **Fleet Watcher upstream story** — Fleet Watcher is mentioned as an optional auth layer pointing at `github.com/yourorg/fleet-watcher` (note: placeholder org). Is the canonical Fleet Watcher repo published yet? Should it be in `aaronjmars/`?
