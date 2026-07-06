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

- **[`packs.config.json`](../catalog/packs.config.json)** — the hand-authored list of
  packs with their display metadata (name, description, color) and the `category`
  each one claims. Membership itself lives in each skill's frontmatter.
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

### Membership — one grouping

**A skill's pack IS its `category`.** There's no separate axis: the `category:`
line in a skill's `SKILL.md` frontmatter is the single source of truth, read by
[`generate-skills-json`](../bin/generate-skills-json) into `skills.json`, and
each pack in `packs.config.json` claims the skills whose category equals its key.
To move a skill between packs, change that one line.

Anything with a missing/unknown category lands in the **Lab** catch-all (category
`other`), so adding a skill never breaks the catalog. (A pack may also hand-list
`skills` explicitly, but first-party packs are category-driven.)

### The packs

Pack key = category. Empty packs are hidden in the UI.

| Pack (`category`) | What's in it | count |
|---|---|---|
| **Core** (`core`) | Aeon's differentiators: self-evolution, self-healing, fleet coordination, autonomous on-chain action. Shown by default; not removable. | 16 |
| **Basics** (`basics`) | Simple, immediately-runnable skills — one approachable entry per area. Shown by default alongside Core. | 12 |
| **Dev & Code** (`dev`) | PR/issue triage, review, merges, releases, repo health, ecosystem mapping. | 17 |
| **Crypto & Markets** (`crypto`) | Token/DeFi/prediction-market monitoring, narrative tracking, token/tx forensics. | 15 |
| **Research & Content** (`research`) | Digests, deep research, trend/framework tracking. | 0 |
| **Social & Writing** (`social`) | Tweets/threads, replies, syndication, campaigns, engagement. | 3 |
| **Productivity** (`productivity`) | Routines, goal/idea capture, retrospectives, deal flow, follow-ups. | 4 |
| **Agent Ops** (`meta`) | Skill analytics/health/graphing, capability mapping, spend, memory housekeeping, fork health. | 4 |
| **Onchain Security** (`onchain-security`) | Rug/honeypot/LP checks, contract & approval audits, deployer/fund-flow tracing. | 0 |
| **Lab** (`other`) | Catch-all for unsorted skills. Hidden until something lands in it. | 0 |

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
present but on-demand. To move a skill into Core or Basics, set its `category:`
to `core` / `basics`. Change `DEFAULT_VISIBLE_PACKS` in
`apps/dashboard/lib/constants.ts` to change which packs show by default.

---

## Adding a skill to a pack

A skill's pack is one frontmatter line. Set `category:` in its `SKILL.md` to one
of — `core`, `basics`, `dev`, `crypto`, `research`, `social`, `productivity`,
`meta`, `onchain-security` (the pack key is the category, verbatim):

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

> **Core** and **Basics** are ordinary categories now — set `category: core` or
> `category: basics` to file a skill there (they're just the two packs shown by
> default). A skill with no/unknown category still works — it lands in **Lab**
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
