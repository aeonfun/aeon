# Skill packs

Aeon ships **180+ skills**, but most forks only ever run a handful. Packs make
that manageable: a small **core** is always present, and everything else is
grouped into **packs** you enable when you want them — and browse, install, and
bulk-toggle from the dashboard.

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
   remaining skills (category comes from `skills.json`, see
   [`generate-skills-json`](../generate-skills-json)).
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

1. **Author the skill** with [`./new-from-template`](../new-from-template) or the
   `create-skill` skill (see [CONTRIBUTING.md](../CONTRIBUTING.md)).
2. **Give it a pack** by making sure its category maps to the right pack:
   - For a **category pack** (research, dev, crypto→Markets, onchain-security→
     Hound, social, productivity, meta→Agent Ops): add the slug to the matching
     branch of `get_category()` in `generate-skills-json`.
   - For **Core**, **Fleet**, or any explicit pack: add the slug to that pack's
     list (or `core.skills`) in `packs.config.json`.
3. **Regenerate**: `./generate-skills-json && ./generate-packs-json`, and commit
   both manifests (CI enforces they're fresh).

> Skip step 2 and the skill still works — it just lands in **Lab** until you
> triage it. The dashboard surfaces Lab so unsorted skills don't get lost.

---

## In the dashboard

The **Packs** view (`/api/packs`):

- **Your packs** — first-party pack cards with live "X / Y on duty" counts.
  Enable/disable a whole pack at once, or expand it to toggle individual members
  (Core can't be bulk-disabled). Bulk toggle writes every member's `enabled` to
  `aeon.yml` in a single commit.
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

## Roadmap

Planned follow-ups (not yet shipped):

- **Category in frontmatter** — move `category` from the `get_category()` map in
  `generate-skills-json` into each `SKILL.md`'s frontmatter, so "add a skill to a
  pack" is a one-line frontmatter edit and the central map can retire.
- **`--pack` authoring** — a pack/category selector in `new-from-template`,
  `create-skill`, and the dashboard's import flow.
- **README/CONTRIBUTING** — fold first-party packs into the main catalog docs.
