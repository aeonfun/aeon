# Integration — adding a Grok harness model

How to make a new **Grok Build** model selectable in Aeon (dashboard picker +
manual dispatch), why each change is needed, and how to verify it before it
ships. Written against the `re-add-grok-build` work that put `grok-build` back on
the harness.

> **Scope:** this is for the **grok CLI harness** (`harness: grok` →
> `scripts/run-grok.sh`), which runs the `grok` binary itself. It is **not** the
> grok *gateway* (`gateway.provider: grok`), which points Claude Code at xAI's
> Anthropic-compatible `api.x.ai` and uses different model ids. See the notes in
> `scripts/llm-gateway.sh` and `apps/dashboard/lib/gateway-registry.ts` for that
> path.

---

## TL;DR

Two files are the actual switch; a third is documentation.

| # | File | Change | Load-bearing? |
|---|------|--------|---------------|
| 1 | `apps/dashboard/lib/constants.ts` | add the model to `GROK_MODELS` | Yes — puts it in the dashboard picker |
| 2 | `.github/workflows/aeon.yml` | add the id to the `model` `choice` options | Yes — dispatch 422s without it |
| 3 | `aeon.yml` | update the "Grok harness models" comment | No — docs only |

Everything else (`run-grok.sh`, `skill_mode.sh`, auth, secrets) already supports
any `grok-*` model with no change.

---

## The one gotcha that will bite you

**Use the bare CLI id, not the API id.**

- `grok-build` — the **grok CLI** id. This is what `--model` accepts and what
  `grok models` lists. It is also grok's own current default.
- `grok-build-0.1` — the **xAI API** id (used by the *gateway* path). Passing this
  to the CLI fails the run immediately:

  ```
  Error: Couldn't set model 'grok-build-0.1': Invalid params: "unknown model id".
  Run 'grok models' to see available models.
  ##[error]grok exited 1
  ```

**Always confirm the id from the CLI itself** — do not trust blog posts or the API
docs, which quote the API id:

```bash
grok models
# You are logged in with grok.com.
# Default model: grok-build
# Available models:
#   * grok-build (default)
#   - grok-composer-2.5-fast
```

(Requires a logged-in session at `~/.grok/auth.json`, or `XAI_API_KEY` in the env.)

---

## Step 1 — dashboard picker (`apps/dashboard/lib/constants.ts`)

Add an entry to `GROK_MODELS`:

```ts
export const GROK_MODELS = [
  { id: 'grok-composer-2.5-fast', label: 'Composer 2.5' },
  { id: 'grok-build', label: 'Grok Build' },   // ← added
]
```

- `id` is the **on-disk model value** written to `aeon.yml` (`model: grok-build`)
  and dispatched to the workflow — it must be the exact CLI id.
- `label` is display-only.
- `modelsForHarness('grok')` returns this list, so it only shows when the xAI
  harness is selected. The first entry is the default/fallback for that harness.

## Step 2 — dispatch validation gate (`.github/workflows/aeon.yml`)

Add the same id to the `workflow_dispatch` → `model` `choice` options:

```yaml
      model:
        type: choice
        options:
          - '(config default)'
          - claude-opus-4-8
          # …
          - grok-composer-2.5-fast
          - grok-build          # ← added
```

**Why this is load-bearing:** the dashboard dispatches runs with
`gh workflow run … -f model=grok-build`. Because `model` is a `type: choice`
input, GitHub rejects any value **not** in `options` with **HTTP 422 at dispatch
time** — before the job starts. If Step 1 offers a model that Step 2 doesn't list,
the picker hands the user a model that can't be launched. Keep the two lists in
sync (the comment above the `options` block says this too).

## Step 3 — comment (`aeon.yml`)

Documentation only — keep the "Grok harness models" comment near `model:` honest:

```yaml
# (Grok harness models: grok-composer-2.5-fast — fast single-agent default;
#  grok-build — reasoning/multi-agent coding model, run with --no-subagents in CI.
#  Use the bare CLI id `grok-build`, not the API id `grok-build-0.1`.)
```

---

## What you do NOT need to change

These already handle any `grok-*` model:

- **`scripts/run-grok.sh`** —
  - Passes `--model "$MODEL"` for any real grok id (omits it only for empty /
    `claude-*` values, letting grok pick its own default).
  - Detects reasoning models by pattern: `grok-*` (non-composer) →
    `MODEL_IS_REASONING=1`, which enables `--effort` / `--reasoning-effort`.
    `grok-build` matches; composer does not (composer 400s on `reasoningEffort`).
  - Passes `--no-subagents` by default. **This is the fix that made grok-build
    viable in CI** — grok-build otherwise delegates to up to 8 parallel subagents,
    whose spawn tool used to be denied and abort the whole turn
    (`stopReason=Cancelled`). Skills that opt into `best_of_n:` or `verify:` are
    built on subagents, so `--no-subagents` is dropped for them automatically.
- **`scripts/skill_mode.sh`** — runs grok under `--permission-mode
  bypassPermissions` (approve-all). Combined with `--no-subagents`, this removes
  the old "refuse a non-allowlisted tool → Cancel the turn" behaviour.
- **Auth** — one of these must be present (checked in `run-grok.sh`):
  - `GROK_CREDENTIALS` — base64 of the X-account OAuth session captured by the
    dashboard (works for subscription-gated models like grok-build). **Set this
    in the dashboard.**
  - `XAI_API_KEY` — an xAI API key (only works if the key has the model's
    early-access entitlement).

---

## Turning it on in production

1. **Merge** the change to `main`. The dashboard and the `workflow_dispatch`
   dropdown both read from `main`.
2. In the **dashboard**: set harness to **xAI** and pick **Grok Build** (top-level
   or per-skill). The dashboard writes `model: grok-build` into `aeon.yml` and
   pushes to `main`.
3. Ensure grok auth exists (`GROK_CREDENTIALS` via the dashboard, or
   `XAI_API_KEY`). Confirm with `gh secret list`.
4. Scheduled and manual runs now route through `run-grok.sh` on `grok-build`.

---

## Verifying before you ship

**Local smoke test (fast, authoritative for the model id + normalizer).** With the
grok CLI installed and a session at `~/.grok/auth.json`:

```bash
echo "Reply with exactly this text and nothing else: SMOKE_OK" \
  | MODEL=grok-build SKILL_MODE=read-only GROK_MAX_TURNS=5 bash scripts/run-grok.sh
# → {"result":"SMOKE_OK","usage":{"input_tokens":0, …}}   exit 0
```

A clean normalized envelope + exit 0 confirms the id is valid, auth works, and the
output normalization is correct.

**Unit tests:**

```bash
bash scripts/tests/test_run_grok.sh   # 23 checks; must all pass
```

**CI run — read the right signal.** Dispatch a real skill on the model:

```bash
gh workflow run aeon.yml --ref <branch> \
  -f skill=github-trending -f harness=grok -f model=grok-build
```

Then judge it by **which step and stopReason**, not just the run's pass/fail:

- The model works if the **"Run" step** completes and the skill produces output
  (`stopReason=EndTurn`, non-empty result). A grok-build *Cancel* fails in
  ~15–20s in that step — that's the failure mode you're checking for.
- **Known false failure:** the `aeon.yml` workflow commits skill results to
  **`main`** (`Commit results` / `Update cron state` steps do `git checkout main`
  / `git pull --rebase origin main`). Running on a **feature branch** makes those
  steps fail with `pathspec 'main' did not match` and add/add conflicts — **after
  the skill already succeeded.** That is a branch artifact, not a model problem; it
  cannot happen on a real `main` run. To get a fully green run, dispatch from
  `main` (i.e. after merge).

### Token accounting caveat

grok's `--output-format json` has no usage field, so token counts normalize to
**0** (`grok-build,0,0,0,0` in `memory/token-usage.csv`). Expected, not a bug —
noted in the normalizer in `scripts/run-grok.sh`.

---

## Reference: adding *any* future grok model

1. `grok models` → copy the exact CLI id.
2. Add `{ id, label }` to `GROK_MODELS` (`apps/dashboard/lib/constants.ts`).
3. Add the id to the `model` `choice` options (`.github/workflows/aeon.yml`).
4. Update the `aeon.yml` comment.
5. Smoke-test with `run-grok.sh`; run `test_run_grok.sh`.
6. Merge, then select it in the dashboard.
