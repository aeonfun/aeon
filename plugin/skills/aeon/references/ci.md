# CI gates in `aeonfun/aeon`

Thirteen `ci-*.yml` workflows. Twelve are **path-filtered** and fire on `pull_request`, `push` to `main`, and `workflow_dispatch`; the thirteenth, `ci-gate`, runs on every pull request.

**`ci-gate` is what blocks merges.** `main` is branch-protected with one required status check, `gate` (the `ci-gate` job). Because the other twelve are path-filtered, none of them can be required directly (a skipped workflow never reports). `gate` waits for every other check run on the PR head and fails if any of them did not end `success`, `skipped`, or `neutral`. So a red gate anywhere on the PR blocks the merge, and a push straight to `main` still runs the same gates after the fact. Run them locally before pushing anyway; it is faster than waiting on the gate.

## The gates

| Workflow | Fires when you touch | Enforces | Run locally |
|---|---|---|---|
| `ci-gate` | any PR | every other check on the PR passed or skipped (the required `gate` check) | - |
| `ci-skill-category` | `skills/**`, `docs/examples/skill-templates/**`, `bin/new-from-template` | every `SKILL.md` has a valid `category:` | `bash scripts/check-skill-categories.sh` |
| `ci-skills-json` | `skills/**`, `bin/generate-skills-json`, `catalog/skills.json` | committed catalog == fresh regen | `bin/generate-skills-json` |
| `ci-packs-json` | `catalog/packs.config.json`, **`catalog/skills.json`**, `bin/generate-packs-json`, `catalog/packs.json` | pack catalog == fresh regen; every skill in exactly one pack | `bin/generate-packs-json` |
| `ci-skill-integrity` | `skills/**`, `eyebrowlock.json`, `eyebrow.policy.json` | **every skill has an `eyebrowlock.json` entry** (hard coverage gate), then `eyebrow verify` fails on a new egress host or new critical finding | `eyebrow scan` / `eyebrow verify` (see below) |
| `ci-readme-catalog` | `.github/README.md`, `catalog/*.json`, `docs/skill-packs.md`, `docs/aeon-setup.md`, `docs/examples/README.md`, the hero SVG | README skill tables and skill counts match the catalog | `node scripts/validate-readme-catalog.mjs` |
| `ci-tests` | `scripts/**`, `bin/**`, `aeon.yml`, `.github/workflows/aeon.yml`, `harness-adapter/adapters/**` | the `scripts/tests/` suites + config validation | see below |
| `ci-shellcheck` | `aeon`, `scripts/**`, `bin/**`, `harness-adapter/**`, `skills/**/*.sh` | shellcheck on the tracked shell surface | `bash scripts/lint-shell.sh` |
| `ci-harnesses-json` | `harness-adapter/adapters/**`, `harness-adapter/bin/generate-harnesses-json`, `harness-adapter/harnesses.json`, `harness-adapter/gateways.json` | committed harness + gateway manifests == fresh regen | `harness-adapter/bin/generate-harnesses-json` |
| `ci-capabilities-parity` | `bin/install-skill-pack`, `docs/CAPABILITIES.md` | capabilities taxonomy in sync across both | `bash scripts/check-capabilities-parity.sh` |
| `ci-skill-packs` | `catalog/skill-packs.json`, `docs/community-skill-packs.md`, `bin/install-skill-pack`, `skills/security/trusted-sources.txt` | community registry well-formed + matches the Listed packs table in `docs/community-skill-packs.md`; no unbacked `trust_level: trusted` | `node scripts/validate-skill-packs.mjs` |
| `ci-agents-md` | `CLAUDE.md`, `STRATEGY.md`, `AGENTS.md`, `scripts/gen-agents-md.js` | `AGENTS.md` regenerated from `CLAUDE.md` (with `STRATEGY.md` inlined) | `node scripts/gen-agents-md.js --check` |
| `ci-apps` | `apps/**` | dashboard typecheck+lint+test+build, cli typecheck+lint, mcp-server build, webhook lint+bundle | per app, see below |

The pack security scan in `bin/install-skill-pack` runs at *install* time, not in CI. `ci-skill-integrity` is the CI-side check, and it gates on a skill's *reach* (hosts, capabilities), not on content.

## Checklist: adding or editing a skill

This is the common case (Modes 4 and 5). A **new** skill trips four gates. Run all of it from the repo root before opening the PR:

```bash
bash scripts/check-skill-categories.sh    # category is valid
# commit SKILL.md first: skills.json sha/updated are git-derived
bin/generate-skills-json                  # refresh catalog/skills.json
bin/generate-packs-json                   # REQUIRED - see the trap below
eyebrow scan --path . --lockfile /tmp/fresh.json   # then splice ONLY your skill's entry into eyebrowlock.json
node scripts/validate-config.js           # only if you touched aeon.yml
node scripts/validate-readme-catalog.mjs  # skill counts in README/docs
git add catalog/skills.json catalog/packs.json eyebrowlock.json
```

**The trap: `bin/generate-skills-json` alone is not enough.** It rewrites `catalog/skills.json`, which is itself a *trigger path* for `ci-packs-json`. Commit the skills catalog without regenerating the pack catalog and the PR goes red on a workflow you never touched. Always run both generators, always commit both files.

**The eyebrow entry.** `ci-skill-integrity` fails if any `skills/<slug>/SKILL.md` has no `"discoveredFrom": "skills/<slug>/SKILL.md"` entry in `eyebrowlock.json`. Use the eyebrow release the workflow pins (the `version:` input in `.github/workflows/ci-skill-integrity.yml`), checksum-verify it, and run `eyebrow scan`. The committed lockfile is usually stale for other skills, so don't commit a whole rescan: copy only your skill's artifact object into the committed file. `eyebrow verify -ci -lockfile eyebrowlock.json -policy eyebrow.policy.json` then exits 0 and prints drift for the other skills only.

**Editing an existing skill** needs a catalog regen only when frontmatter that `skills.json` stores changes (`name`, `description`, `category`, `var`, `requires`, `mcp`) or a file is added or removed. A body-only edit needs no regen, and needs no eyebrow rescan unless it adds a new host or capability, or inserts lines above a pinned finding (that shifts the finding's `line` and fails the verify).

Both catalog files carry a `generated` UTC timestamp that changes on every run - that's expected. `ci-skills-json` and `ci-packs-json` normalize it out (plus per-skill `sha`/`updated`, which churn on every squash-merge), so a timestamp-only diff is not drift and won't fail.

### `category:` - the valid set

`core evolution basics dev crypto productivity`. Anything else fails the gate. Category is the *only* thing deciding which pack a skill joins.

## `ci-tests` in full

Needs `pip install pyyaml==6.0.2` first. The suite list grows often, so read it from the workflow rather than from here:

```bash
yq '.jobs[].steps[].run' .github/workflows/ci-tests.yml | grep -v '^null$'
```

Editing `aeon.yml` alone is enough to fire this workflow - `node scripts/validate-config.js` (plus `node --test scripts/validate-config.test.js`) is the one to run after any hand-edit (Mode 4 step 4).

## `ci-apps` in full

One job per app so a red X names the broken surface.

```bash
cd apps/dashboard && npm ci && npm run typecheck && npm run lint && npm test && npm run build
cd apps/cli       && npm ci && npm run typecheck && npm run lint   # needs apps/dashboard deps installed first
cd apps/mcp-server && npm install && npm run build
cd apps/webhook   && node --check src/worker.js && npm install && npm run lint && npx wrangler deploy --dry-run --outdir /tmp/w
```

The dashboard runs **both** `typecheck` and `build` on purpose: a past Dependabot bump crashed `next build` while `tsc --noEmit` passed. Don't treat the typecheck as sufficient. The CLI cannot typecheck without the dashboard's `node_modules` - its tsconfig compiles `../dashboard/lib/**/*.ts` and borrows that app's typescript and `@types`.
