# ICP Skills contribution (for `dfinity/icskills`)

**Workstream D of the Aeon × ICP integration.** These four `SKILL.md` files are the
**icskills-schema-compatible** form of Aeon's ICP skill pack, prepared for
contribution to the ICP community catalogue at
[`skills.internetcomputer.org`](https://skills.internetcomputer.org) /
[`dfinity/icskills`](https://github.com/dfinity/icskills).

## Why this is a separate package (not the Aeon skills themselves)

The runtime Aeon skills under [`skills/`](../../../../skills) **cannot** be submitted
to `dfinity/icskills` as-is. The icskills schema
(`skills/skill.schema.json`) sets `additionalProperties: false` at both the top
level and inside `metadata`, allowing only:

- top level: `name`, `description`, `metadata`, `license`, `compatibility`
- `metadata`: `title`, `category`

Aeon's runtime skills carry load-bearing `metadata` keys the schema rejects —
`mode`, `var`, `tags`, `requires`, `capabilities`, `depends_on` — and use Aeon's
own category vocab (`crypto`/`dev`), not ICP's (`Infrastructure`/`Governance`/
`Security`/…). Stripping those keys would break the Aeon runtime, so the knowledge
is **repackaged** here in the icskills format rather than force-fitted. (Full
analysis: [`../../ICP-SKILLS-COMPATIBILITY.md`](../../ICP-SKILLS-COMPATIBILITY.md).)

## Mapping

| Aeon skill (`skills/`) | icskills contribution (here) | category |
|---|---|---|
| `canister-status` | `canister-status-monitoring` | Infrastructure |
| `cycles-balance` | `cycles-balance-monitoring` | Infrastructure |
| `sns-digest` | `sns-proposal-digest` | Governance |
| `icp-deploy-check` | `icp-deploy-check` | Security |

Each file validates against `dfinity/icskills/skills/skill.schema.json`
(required `name`/`description`/`metadata{title,category}`; no additional
properties) — see the validation note in the PR.

## Submitting

1. Fork `dfinity/icskills`, add each `<name>/SKILL.md` under its `skills/` layout.
2. Run the repo's own schema check / `npx skills` validation.
3. Open a PR describing the four skills, their public-vs-identity-gated data paths,
   and that the authoritative, runnable versions live in Aeon.

These are **prepared**, not yet submitted — submission is a separate PR against an
external repo and follows its contribution process.
