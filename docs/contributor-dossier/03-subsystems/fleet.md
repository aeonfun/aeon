# Subsystem: Fleet

How Aeon spawns, monitors, and learns from the network of forks running its skills in the wild.

---

## Why a fleet exists

A single Aeon instance is interesting. A *fleet* of instances — each with its own purpose, schedule, and skill mix — surfaces what works, what doesn't, what to ship upstream, and what to leave to specialized forks.

Per `SHOWCASE.md`, there are ~24 active forks (pushed within 30 days). The fleet subsystem is how upstream sees them, and how an operator manages their own child instances.

## Two kinds of fleet

| Kind | Created by | Owned by | Purpose |
|---|---|---|---|
| **Managed instances** | `spawn-instance` | Operator (registered in `memory/instances.json`) | The operator delegates a vertical (e.g. "crypto-tracker") to a child fork they own. Centralized management via `fleet-control`. |
| **Wild forks** | Anyone clicking "Fork" on GitHub | Random operators | Discovered via the GitHub forks API. No registry. Observed via `fork-cohort`, `fork-fleet`, `fork-skill-digest`, `fork-contributor-leaderboard`, `fork-first-run-alert`, `fork-release-tracker`. |

The same skills can target both, but the data models differ — managed instances are tracked locally; wild forks are queried live.

---

## Managed instances

### Spawning — [`spawn-instance`](../../../skills/spawn-instance/SKILL.md)

`var: "name: purpose"` — e.g. `"crypto-tracker: monitor DeFi protocols and token movements"`.

The skill ([`spawn-instance/SKILL.md:38-100`](../../../skills/spawn-instance/SKILL.md#L38-L100)):

1. Parse the var, sanitize `name` (becomes `REPO_NAME = "aeon-${NAME}"`).
2. Pre-flight: `gh auth status`, GitHub rate limit, resolve parent repo (handles fork-of-fork chains).
3. Check `memory/instances.json` — if entry exists and not archived: exit `SPAWN_FORK_EXISTS_REGISTERED`.
4. **Build skill plan** from the live catalog (enumerate `skills/*/SKILL.md`, parse frontmatter, match purpose keywords).
5. Fork via `gh`, configure (rename, default branch), push initial commit with the curated skill plan, enable Actions on the fork, register in `memory/instances.json` with `status: pending_secrets`.

**Security model:** the fork is created but **inert** until the operator manually adds `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` to the new repo's secrets. No secrets are propagated. This is by design.

### Registry — `memory/instances.json`

Schema ([`spawn-instance/SKILL.md:66-79`](../../../skills/spawn-instance/SKILL.md#L66-L79)):

```json
{
  "instances": [
    {
      "name": "crypto-tracker",
      "repo": "OWNER/aeon-crypto-tracker",
      "purpose": "monitor DeFi protocols and token movements",
      "created": "2026-04-20",
      "status": "pending_secrets | active | degraded | archived",
      "skills_enabled": ["token-movers", "defi-monitor", "heartbeat"],
      "parent": "OWNER/aeon"
    }
  ]
}
```

### Control — [`fleet-control`](../../../skills/fleet-control/SKILL.md)

Two modes:

**Health check** ([`fleet-control/SKILL.md:42-96`](../../../skills/fleet-control/SKILL.md#L42-L96)): for each registered instance (skip archived), parallel API calls:
- Repo metadata: `pushed_at`, `archived`, `default_branch`, `open_issues_count`.
- Workflow runs last 24h.
- Cron-state from child repo (cross-repo read of `memory/cron-state.json`).

Per-instance classification: `unreachable | archived | pending_secrets | stale | degraded | warning | healthy`.

Next-action assignment: `add secrets | investigate skill | monitor | confirm intent | verify access | none`.

Delta tracking vs `memory/state/fleet-control-state.json` (last snapshot): `NEW | DEGRADED | RECOVERED | DROPPED`.

**Dispatch**: `dispatch <instance | *> <skill> [var=<value>]` — triggers a skill on a specific or all healthy/degraded children. Uses `gh workflow run` against the child repo with the operator's GH token.

### Roll-up — [`fleet-state`](../../../skills/fleet-state/SKILL.md)

Weekly Monday digest synthesizing:
- `memory/topics/fork-cohort-state.json` (bucket counts)
- `memory/topics/fork-release-state.json` (releases this week)
- `memory/topics/contributor-spotlight-history.json` (spotlight pick)
- Prior `memory/topics/fleet-state.json` (WoW deltas, 12-week trend capped LRU)

Graceful degradation: if one source unavailable, produce a partial digest; all three missing → `FLEET_STATE_NO_SOURCES`, silent.

---

## Wild forks

### Inventory — [`fork-fleet`](../../../skills/fork-fleet/SKILL.md)

The catch-all inventory: every fork of the upstream repo, with substance-weighted scoring.

**Per-fork score** ([`fork-fleet/SKILL.md:89-99`](../../../skills/fork-fleet/SKILL.md#L89-L99)):

```
score = 10×(new skills)
      +  4×(modified skills)
      +  2×min(commits, 15)
      +  3×(new content, capped 5)
      +  2×(workflow/config changes, capped 3)
      +  1×(schedule flag)
      +  1×(stargazers)
```

**Activity classification** ([`fork-fleet/SKILL.md:52-56`](../../../skills/fork-fleet/SKILL.md#L52-L56)):
- Active — pushed within 30d.
- Stale — 30–365d.
- Dormant — >365d or never pushed.

**Output tiers**: `PROMOTE` (highest-impact divergence worth a PR) / `REVIEW` (interesting, watch) / `NOTE` (small changes).

### Activation buckets — [`fork-cohort`](../../../skills/fork-cohort/SKILL.md)

Different lens: buckets forks by *whether they're actually running*, not by code divergence.

**Buckets** ([`fork-cohort/SKILL.md:18-26`](../../../skills/fork-cohort/SKILL.md#L18-L26)):
- `POWER` — ≥1 run in 7d **and** ≥5 distinct enabled skills in `aeon.yml`.
- `ACTIVE` — ≥1 run in 7d (not POWER).
- `STALE` — last run 7–365d ago.
- `COLD` — no runs ever, or last run >365d.
- `UNREADABLE` — API errors after retry exhaustion.

This is what feeds the `SHOWCASE.md` "Active forks" table.

### Divergence signal — [`fork-skill-digest`](../../../skills/fork-skill-digest/SKILL.md)

The most important fleet skill from upstream's POV.

Surfaces where the fleet **disagrees with upstream defaults** — enabled vs disabled, var values, model overrides, schedule shifts. When 2+ forks independently flip the same default, it's flagged as a `DEFAULT_FLIP` candidate. The author then decides whether to flip the upstream default.

This is the peer-learning loop: forks vote with `aeon.yml`; upstream notices; upstream adopts (or doesn't).

### Coverage gap — [`fork-skill-gap`](../../../skills/fork-skill-gap/SKILL.md)

Per-fork table of upstream skills not yet adopted. Used by the operator to onboard a fork to skills the rest of the fleet finds useful.

### Contributors — [`fork-contributor-leaderboard`](../../../skills/fork-contributor-leaderboard/SKILL.md)

Ranks contributors across forks + upstream PRs. Feeds `contributor-spotlight` for the weekly fleet digest.

### Lifecycle alerts

- [`fork-first-run-alert`](../../../skills/fork-first-run-alert/SKILL.md) — same-day alert when a fork completes its first workflow run. Reads `fork-cohort` cache (≤8d fresh) with live-fallback. Suppresses bots.
- [`fork-release-tracker`](../../../skills/fork-release-tracker/SKILL.md) — weekly celebration when any fork cuts a tagged GitHub release in the last 7d. Silent on quiet weeks.

---

## The upstream-learning loop

Aeon does **not** automatically PR fork innovations back upstream. The flow is:

1. Weekly digests (`fork-fleet`, `fork-cohort`, `fork-skill-digest`, `fork-contributor-leaderboard`) surface signal.
2. Operator (or co-maintainer — see [`../04-GOVERNANCE.md`](../04-GOVERNANCE.md)) reads the reports.
3. Manual decision: "this skill enable choice is a good default; flip it" or "this fork's custom skill is generalizable; bring it in".
4. Manual PR.

This is intentional. Automatic upstream PRs from fork data would risk noise, copying private skills, or amplifying single-fork preferences into upstream defaults prematurely.

## The `DEFAULT_FLIP` signal

Referenced in `SHOWCASE.md` and `fork-skill-digest`. Definition: when N independent forks (N≥2 today) flip the same `aeon.yml` field (e.g. `morning-brief: enabled: false → true`), the digest tags it as a candidate for an upstream change. Surfaces as a single line in the weekly digest, e.g.:

```
DEFAULT_FLIP candidate: morning-brief enabled (3 forks: maacx2022, DannyTsaii, davenamovich)
```

Not auto-applied. The author reviews and decides.

## Cross-repo access

Several fleet skills (`fleet-control` dispatch, fork enumeration on private forks, etc.) need a token that can read across repos. The built-in `GITHUB_TOKEN` is scoped to the running repo only.

Solution per `README.md` § Cross-repo access: add `GH_GLOBAL`, a fine-grained personal access token with repo selection for the cross-repo work. Skills fall back to `GITHUB_TOKEN` automatically when `GH_GLOBAL` is absent.

| | `GITHUB_TOKEN` | `GH_GLOBAL` |
|---|---|---|
| Scope | This repo | Any repo you grant |
| Created by | GitHub (automatic) | You (manual fine-grained PAT) |
| Lifetime | Job duration | Up to 1 year |

## Operational gotchas

- **`memory/instances.json` is the only source of truth for managed instances.** No upstream registry — your fleet is private to your fork.
- **Wild-fork enumeration is rate-limited by GitHub API.** Heavy use can exhaust your hourly quota. The fleet skills batch and cache to mitigate this.
- **Spawned forks are dormant until secrets are added.** Don't be confused if a freshly spawned instance shows `status: pending_secrets` — that's correct. Confusion happens when an operator expects auto-propagation.
- **`fork-skill-digest`'s `DEFAULT_FLIP` only fires for 2+ forks.** A single popular fork can't flip an upstream default on its own.
- **Fleet skills consume GH API quota heavily.** Schedule them weekly or less. Don't run them on every tick.

## Related docs

- [`memory.md`](memory.md) — `instances.json`, the topic-state files fleet skills depend on.
- [`self-healing.md`](self-healing.md) — how individual instances' cron-state surfaces health.
- [`../04-GOVERNANCE.md`](../04-GOVERNANCE.md) — the upstream learning loop and `DEFAULT_FLIP` decision flow.
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) — option #3 (Fleet Coordination) builds an active federation on top of these primitives.
