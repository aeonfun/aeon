---
type: Reference
---

# Skill packs

Aeon ships **71 skills**, but most forks only ever run a handful. Packs make
that manageable: by default the dashboard shows **Core** (what makes Aeon
different) and **Basics** (simple skills you can run right now) — everything else
is grouped into **packs** that stay hidden until you enable them.
**Enabling a pack reveals its skills** across the sidebar and HQ. That's a
visibility switch (a per-browser preference), not a run switch — to actually put
a skill on duty you still flip its own on/off toggle. Enabling is always
per-skill.

There are two kinds:

- **First-party packs** — maintained in this repo. Defined as *data*, not
  separate repos: a skill's pack is derived from its category. Enabling a
  first-party pack just **reveals** its skills in the dashboard — nothing is
  downloaded, and nothing runs until you turn individual skills on.
- **Community packs** — maintained by others in external repos, listed in
  [`skill-packs.json`](../catalog/skill-packs.json) and installed with
  [`bin/install-skill-pack`](../bin/install-skill-pack).

---

## First-party packs

### How it works (the data layer)

```
packs.config.json   ──┐
                      ├─►  bin/generate-packs-json  ──►  packs.json  ──►  dashboard
skills.json         ──┘                                 (generated)      (/api/packs)
```

- **[`packs.config.json`](../catalog/packs.config.json)** — the hand-authored source of
  truth: the `core` allowlist + the list of packs with their display metadata
  (name, description, color) and how they claim skills.
- **[`generate-packs-json`](../bin/generate-packs-json)** — derives `packs.json` from
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
bin/generate-packs-json            # compact (committed form)
bin/generate-packs-json --pretty   # readable
```

### Membership precedence

When assigning a skill to a pack, the generator applies, in order:

1. **The `core` allowlist** — an explicit slug list in `packs.config.json`.
2. **Explicit packs** — packs that list their own `skills` (e.g. `fleet`).
3. **Category packs** — packs that claim a `category`; they take that category's
   remaining skills. A skill's category is declared in its `SKILL.md`
   frontmatter (`category:`) — the single source of truth, read by
   [`generate-skills-json`](../bin/generate-skills-json) into `skills.json`.
4. **The Lab catch-all** — anything still unassigned (a freshly authored or
   imported skill whose category isn't a known pack) lands in **Lab**, so adding
   a skill never breaks the catalog. Triage it into a real pack later.

### The packs

| Pack | What's in it | ~count |
|---|---|---|
| **Core** | Aeon's differentiators: self-evolution, self-healing, fleet coordination, autonomous on-chain action. Shown by default; not removable. | 13 |
| **Basics** | Simple, immediately-runnable skills — one approachable entry per area. Shown by default alongside Core. | 8 |
| **Research & Content** | Digests, deep research, trend/framework tracking. | 26 |
| **Dev & Code** | PR/issue triage, review, merges, releases, repo health, ecosystem mapping. | 34 |
| **Crypto & Markets** | Token/DeFi/prediction-market monitoring, narrative tracking. | 23 |
| **Onchain Security** | Rug/honeypot/LP checks, contract & approval audits, deployer/fund-flow tracing. | 15 |
| **Social & Writing** | Tweets/threads, replies, syndication, campaigns, engagement. | 17 |
| **Productivity** | Routines, goal/idea capture, retrospectives, deal flow, follow-ups. | 16 |
| **Agent Ops** | Skill analytics/health/graphing, capability mapping, spend, memory housekeeping, fork health. | 30 |
| **Lab** | Catch-all for unsorted skills. Hidden in the UI until something lands in it. | 0 |

### Core + Basics — what a fresh fork shows

Two packs are shown by default on the dashboard (locked always-on; every other
pack is revealed on demand). They answer two different questions:

- **Core — "what makes Aeon different from a cron job."** It evolves its own
  skills, heals itself, coordinates a fleet of instances, and takes autonomous
  on-chain action:
  `create-skill`, `install-skill`, `self-improve`, `autoresearch`,
  `skill-health`, `skill-repair`, `spawn-instance`, `fleet-control`, `ctrl`,
  `distribute-tokens`, `deploy-prototype`, `heartbeat`, `cost-report`.
- **Basics — "something simple you can run right now."** One approachable entry
  per area, little or no setup:
  `digest`, `article`, `token-movers`, `tx-explain`, `write-tweet`, `pr-review`,
  `github-trending`, `price-alert`.

`heartbeat` (Core) and `digest` (Basics) are enabled by default; the rest ship
present but on-demand. Edit the `core.skills` / `basics` skill lists in
`packs.config.json` to change membership, and `DEFAULT_VISIBLE_PACKS` in
`apps/dashboard/lib/constants.ts` to change which packs show by default.

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

- **`bin/new-from-template <tmpl> <name> --category dev`** — stamps the category
  (templates also ship a sensible default).
- **`create-skill`** — chooses a category as part of its design step.
- **Dashboard → Hire (import)** — a Pack dropdown writes the category onto the
  uploaded `SKILL.md`.

Then **regenerate**: `bin/generate-skills-json && bin/generate-packs-json`, and commit
both manifests (CI enforces they're fresh).

> **Core** and **Fleet** aren't category-selectable — they're curated in
> `packs.config.json` (the `core.skills` allowlist / the `fleet` skill list).
> And a skill with no/unknown category still works — it just lands in **Lab**
> until you triage it. The dashboard surfaces Lab so unsorted skills don't get lost.

---

## In the dashboard

By default the dashboard shows **Core** and **Basics** — their skills appear in
the sidebar and HQ, and nothing else does. Enable packs to reveal more.

The **Packs** view (`/api/packs`):

- **Your packs** — a card per first-party pack. Hit **Enable pack** to reveal
  that pack's skills across the sidebar and HQ (**Core** is always on). It's a
  visibility toggle, stored per-browser, that never changes what runs. **View
  skills** expands the card to list the pack's skills, each with its own on/off
  toggle to actually put it on duty.
- The **left sidebar** and **HQ** only show skills from enabled packs, grouped by
  pack. The sidebar's **Enabled** chip is an optional filter (off by default)
  that narrows the roster to skills on duty.
- **Community packs** — browse the registry with author, trust level, required
  secrets/capabilities, and a copy-paste `bin/install-skill-pack <repo>` command.

---

## Community packs

Unchanged from before — see
[community-skill-packs.md](./community-skill-packs.md). To list a pack: open a PR
adding an entry to [`skill-packs.json`](../catalog/skill-packs.json) and the README
table. To install one into your fork: `bin/install-skill-pack <owner>/<repo>`, then
enable its skills from the dashboard's Packs view.

---

## Status

The pack system is fully shipped: the data layer + three CI gates
(`ci-skills-json`, `ci-packs-json`, `ci-skill-category`), the dashboard **Packs**
view, frontmatter-driven categories, and `--category` authoring. README and
CONTRIBUTING document it. New skills declare `category:` (or use `--category`);
the **Lab** catch-all keeps anything uncategorized from breaking the catalog.
