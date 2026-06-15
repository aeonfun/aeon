# Skill packs

Aeon ships **180+ skills**, but most forks only ever run a handful. Packs make
that manageable: a small **core** is always present, and everything else is
grouped into **packs** you browse from the dashboard — open a pack to see what's
inside, then switch on the individual skills you want. A pack is a lens for
discovery, not a bulk on-switch; enabling is always per-skill.

There are two kinds:

- **First-party packs** — maintained in this repo. Defined as *data*, not
  separate repos: a skill's pack is derived from its category. "Installing" a
  first-party pack just enables its skills in `aeon.yml` — nothing is downloaded.
- **Community packs** — maintained by others in external repos, listed in
  [`skill-packs.json`](../skill-packs.json) and installed with
  [`./install-skill-pack`](../install-skill-pack).

---

## First-party packs

### How it works (the data layer)

```
packs.config.json   ──┐
                      ├─►  ./generate-packs-json  ──►  packs.json  ──►  dashboard
skills.json         ──┘                                 (generated)      (/api/packs)
```

- **[`packs.config.json`](../packs.config.json)** — the hand-authored source of
  truth: the `core` allowlist + the list of packs with their display metadata
  (name, description, color) and how they claim skills.
- **[`generate-packs-json`](../generate-packs-json)** — derives `packs.json` from
  `packs.config.json` + `skills.json`. It asserts every skill lands in **exactly
  one** pack (no duplicate claims, no unknown slugs).
- **`packs.json`** — the generated catalog the dashboard reads. Membership only;
  live enabled/installed state is joined at request time by `/api/packs`.
- **[`ci-packs-json.yml`](../.github/workflows/ci-packs-json.yml)** — fails any
  PR that leaves `packs.json` stale, exactly like `ci-skills-json`.
- **[`ci-skill-category.yml`](../.github/workflows/ci-skill-category.yml)** — fails
  any PR where a `SKILL.md` is missing a valid `category:`
  (`bash scripts/check-skill-categories.sh` runs it locally).

Regenerate after any change to the config or to `skills.json`:

```bash
./generate-packs-json            # compact (committed form)
./generate-packs-json --pretty   # readable
```

### Membership precedence

When assigning a skill to a pack, the generator applies, in order:

1. **The `core` allowlist** — an explicit slug list in `packs.config.json`.
2. **Explicit packs** — packs that list their own `skills` (e.g. `fleet`).
3. **Category packs** — packs that claim a `category`; they take that category's
   remaining skills. A skill's category is declared in its `SKILL.md`
   frontmatter (`category:`) — the single source of truth, read by
   [`generate-skills-json`](../generate-skills-json) into `skills.json`.
4. **The Lab catch-all** — anything still unassigned (a freshly authored or
   imported skill whose category isn't a known pack) lands in **Lab**, so adding
   a skill never breaks the catalog. Triage it into a real pack later.

### The packs

| Pack | What's in it | ~count |
|---|---|---|
| **Core** | Self-evolution, self-healing, memory/liveness, setup, cost guardrail, + two default outputs. Always present. | 13 |
| **Fleet & Replication** | Spawn/coordinate sub-agents, scorecards, feature rollout, on-chain distribute/reward, vuln scanning. | 8 |
| **Research & Content** | Digests, deep research, trend/framework tracking. | 26 |
| **Dev & Code** | PR/issue triage, review, merges, releases, repo health, ecosystem mapping. | 34 |
| **Crypto & Markets** | Token/DeFi/prediction-market monitoring, narrative tracking. | 23 |
| **Hound — Onchain Security** | Rug/honeypot/LP checks, contract & approval audits, deployer/fund-flow tracing. | 15 |
| **Social & Writing** | Tweets/threads, replies, syndication, campaigns, engagement. | 17 |
| **Productivity** | Routines, goal/idea capture, retrospectives, deal flow, follow-ups. | 16 |
| **Agent Ops** | Skill analytics/health/graphing, capability mapping, spend, memory housekeeping, fork health. | 30 |
| **Lab** | Catch-all for unsorted skills. Hidden in the UI until something lands in it. | 0 |

### Core — what every fork ships with

The core set is deliberately small: the skills that make Aeon *self-running and
self-improving*, plus a couple of broadly useful default outputs. Of these,
`heartbeat` and `digest` are enabled by default; the rest ship present but
on-demand.

`create-skill`, `self-improve`, `skill-health`, `skill-repair`, `skill-evals`,
`autoresearch`, `config-validator`, `heartbeat`, `onboard`, `cost-report`,
`reflect`, `digest`, `priority-brief`.

Edit the `core.skills` allowlist in `packs.config.json` to change it.

---

## Adding a skill to a pack

A skill's pack is one frontmatter line. Set `category:` in its `SKILL.md` to one
of the **category packs** — `research`, `dev`, `crypto` (→ Markets),
`onchain-security` (→ Hound), `social`, `productivity`, `meta` (→ Agent Ops):

```yaml
---
name: My Skill
category: dev
description: ...
---
```

The authoring tools set it for you:

- **`./new-from-template <tmpl> <name> --category dev`** — stamps the category
  (templates also ship a sensible default).
- **`create-skill`** — chooses a category as part of its design step.
- **Dashboard → Hire (import)** — a Pack dropdown writes the category onto the
  uploaded `SKILL.md`.

Then **regenerate**: `./generate-skills-json && ./generate-packs-json`, and commit
both manifests (CI enforces they're fresh).

> **Core** and **Fleet** aren't category-selectable — they're curated in
> `packs.config.json` (the `core.skills` allowlist / the `fleet` skill list).
> And a skill with no/unknown category still works — it just lands in **Lab**
> until you triage it. The dashboard surfaces Lab so unsorted skills don't get lost.

---

## In the dashboard

The **Packs** view (`/api/packs`):

- **Your packs** — first-party pack cards with live "X / Y on duty" counts.
  Expand a card to see its skills and switch them **on individually** (an inline
  toggle per skill), or hit **In sidebar →** to filter the left roster to that
  pack and enable them in context. There is no bulk "enable pack" — a pack is a
  lens, not a switch.
- The **left sidebar** groups the roster by pack and defaults to showing only
  enabled skills; pick a pack chip to reveal all of its skills (enabled or not)
  so you can turn them on.
- **Community packs** — browse the registry with author, trust level, required
  secrets/capabilities, and a copy-paste `./install-skill-pack <repo>` command.

---

## Community packs

Unchanged from before — see
[community-skill-packs.md](./community-skill-packs.md). To list a pack: open a PR
adding an entry to [`skill-packs.json`](../skill-packs.json) and the README
table. To install one into your fork: `./install-skill-pack <owner>/<repo>`, then
enable its skills from the dashboard's Packs view.

---

## Status

The pack system is fully shipped: the data layer + three CI gates
(`ci-skills-json`, `ci-packs-json`, `ci-skill-category`), the dashboard **Packs**
view, frontmatter-driven categories, and `--category` authoring. README and
CONTRIBUTING document it. New skills declare `category:` (or use `--category`);
the **Lab** catch-all keeps anything uncategorized from breaking the catalog.
