---
name: capabilities-sweep
description: One-shot Phase 2 sweep — infers a `capabilities:` declaration for every skill that doesn't have one yet by pattern-matching its SKILL.md body against the locked taxonomy, writes a JSON proposal manifest, and opens a single PR adding the declarations. Reruns safely (skills already declared are skipped). Closes the ~174-skill undeclared backlog left after the Phase 1 high-blast-radius sweep (PR #322).
var: ""
tags: [dev, meta]
requires: []
capabilities: [external_api, writes_external_host, sends_notifications]
---

> **${var}** — Optional. Tokens (whitespace-separated):
> - `dry-run` — write the proposal manifest + article, do NOT open a PR, do NOT notify.
> - `propose-only` — write the proposal manifest + article + PR, but mark every row as `proposed: needs-review` regardless of confidence (the PR description asks the operator to confirm each row before merge). Default behaviour: rows that meet the high-confidence threshold (≥2 matching pattern hits OR a single unambiguous on-chain-write signal) are pre-applied to the SKILL.md frontmatter; low-confidence rows are listed in the PR description for operator decision.
> - `slug=<skill-slug>` — restrict the sweep to a single skill (useful for iterating on the inference heuristics without churning ~174 files). The PR is still opened with one file changed.
> - Empty → default execute.
>
> Any unrecognised token → log `CAPABILITIES_SWEEP_BAD_VAR: ${var}` and exit (no writes, no notify).

Today is ${today}. PR #268 landed the locked 6-value capabilities taxonomy in `docs/CAPABILITIES.md` and the matching `capabilities: []` field in `skill-packs.json` (per-pack and per-skill). PR #304 added a CI parity check so the taxonomy can't drift. PR #322 declared `capabilities:` on 22 high-blast-radius skills (the Phase 1 sweep). What remains: **~174 skills shipped before the Phase 1 sweep with no declaration at all** — `capabilities-map` lumps every one of them into a single `(undeclared)` row, drowning the gap signal it was built to surface.

This skill is the Phase 2 closer. It walks every `skills/<slug>/SKILL.md`, skips skills that already have a `capabilities:` line in their frontmatter (idempotent — safe to rerun), and for every undeclared skill runs a body-pattern inference against the locked taxonomy. Inferences that meet a confidence threshold are pre-applied to the SKILL.md frontmatter in a single PR; inferences below the threshold are listed in the PR description for human triage. Goal: empty the `(undeclared)` row in `capabilities-map` in one operator-reviewable PR rather than ~174 micro-edits over months.

Read `memory/MEMORY.md` for context.
Read the last 8 days of `memory/logs/` for prior-run context.
Read `soul/SOUL.md` + `soul/STYLE.md` if populated to match voice in the notification and article.

## Why this exists

`capabilities-map` (PR #313) is supposed to answer "what does my enabled stack actually cover, and where are the gaps?" Today, its output is dominated by one row: "undeclared skills: ~174". Every native skill written before the Phase 1 sweep is in that bucket. The operator can't tell whether a tier is *genuinely* uncovered or whether the coverage is hidden behind an undeclared skill that quietly does `./notify` and `gh api`. The matrix is noise until that backlog is closed.

Closing the backlog by hand is the obvious path and the wrong one. It is ~174 frontmatter edits across files written by ~12 distinct contributors over six months. The edits are mechanically uniform (regex-grade pattern → declaration) but tedious enough that no operator does them on a Tuesday afternoon. The job has been deferred since PR #268 shipped.

This skill makes the job a single PR review. The heuristics are deliberately conservative: a single ambiguous match per skill yields no declaration (the row goes to "needs human"). A skill whose body shows two or more matching signals — say, `./notify` + `gh api repos/.*/issues` — gets a pre-applied `capabilities: [external_api, sends_notifications]` line that the operator can either accept verbatim or override in the PR. Skills with zero matching signals get a pre-applied `capabilities: [read_only]` line — the explicit "this skill does nothing externally visible" declaration the taxonomy already has a value for.

This skill is **a one-shot meta-tool**. It is registered `workflow_dispatch` only — not on a cron — because after one successful merge the backlog is gone and there's nothing left to do until a future contributor lands a new skill without a `capabilities:` line. (When that happens, `capabilities-map` will surface it as a single undeclared row, and the operator dispatches this skill with `slug=<that-skill>` to clear it.)

## Inputs

| Source | Purpose | Auth |
|--------|---------|------|
| `skills/<slug>/SKILL.md` | Each skill's frontmatter + body. Frontmatter is parsed for the existing `capabilities:` line (to skip declared skills). Body is pattern-matched for inference signals. | Local file |
| `docs/CAPABILITIES.md` | The locked 6-value taxonomy — extracted from the `## The taxonomy` section, same parser `capabilities-map` and `scripts/check-capabilities-parity.sh` use. Used to validate every value the skill emits and reject any heuristic that proposes an unknown value. | Local file |
| `skills.json` | Slug → human name, category, schedule. Used in the proposal manifest + PR description for context. | Local file |
| `aeon.yml` | `enabled: true|false` per skill. Surfaces "X of the rows you're about to review are currently enabled" in the PR description so the operator knows the priority order. | Local file |
| `memory/topics/capabilities-sweep-state.json` | Per-skill last_run, last_status, last_proposed_capabilities. Used to skip skills whose proposal hasn't changed since the prior run (no point re-opening a PR that's a no-op). | Local file |

No network calls beyond `gh pr list` (duplicate-PR guard), the `git push` of the sweep branch, and `gh pr create` at the end. No new secrets. `gh` uses `GH_TOKEN` per the standard auth path.

Writes:
- `articles/capabilities-sweep-${today}.md` — full human-readable proposal table (every non-error run, including `NO_CHANGES`)
- `.outputs/capabilities-sweep-proposals.json` — machine-readable proposal manifest (consumed by step 5)
- For each high-confidence proposal: a single line added to `skills/<slug>/SKILL.md` frontmatter — `capabilities: [...]` immediately after the `requires:` line (or after `tags:` when the skill has no `requires:` line), matching the placement Phase 1 used in PR #322 and `vigil-revoke` (`skills/vigil-revoke/SKILL.md:7`).
- `memory/topics/capabilities-sweep-state.json` — per-skill last_run / last_status / last_proposed_capabilities
- `memory/logs/${today}.md` — one log block per run
- One GitHub PR via `gh pr create` (skipped on `dry-run`)
- Notification via `./notify` — full message on any run that opens a PR (`OK`, `PROPOSE_ONLY`); one-line messages on `PR_EXISTS`, `NO_TAXONOMY`, `HEURISTIC_DRIFT`, `STATE_CORRUPT` (see the exit taxonomy)

## The locked taxonomy

Extracted at runtime from `docs/CAPABILITIES.md` (the parser refuses to emit a value that isn't in the extracted set — drift between this skill's heuristics and the canonical doc is a fatal error, not a warning).

| Value | Reminder |
|-------|----------|
| `read_only` | No network writes, no on-chain calls, no notifications. Default for skills with zero matching signals. |
| `external_api` | Auth'd third-party HTTP call (OpenAI, X v2, Discord webhook, Slack bot, Coingecko, gh api against any endpoint, etc.). |
| `writes_external_host` | POST/PUT/DELETE/PATCH against a non-Aeon host. Subset of `external_api` — declare both. |
| `onchain_writes` | Signs and broadcasts a transaction. The skill holds or proxies a wallet key. |
| `agent_messaging` | DMs, replies, posts on X / Farcaster / Discord / Slack / Telegram (speaks for the operator publicly). |
| `sends_notifications` | Calls `./notify` (operator's own channel). Lower blast radius than `agent_messaging`. |

## Inference rules

Each rule scans the SKILL.md body (everything after the closing `---` of frontmatter) line by line and counts pattern hits. A skill needs **≥2 distinct hits across any of the high-confidence patterns** OR **≥1 hit on a single-signal pattern** to flip from "needs human" to "auto-apply". The single-signal patterns are the ones where one match is unambiguous in this codebase — `eth_sendRawTransaction`, `tweet-api/post`, `Bankr.*revoke`, etc. — and are listed separately below.

Apply rules in this fixed order; a skill's final `capabilities:` array is the deduplicated union of every rule that fires.

### Default — applies to every skill before any other rule

- `read_only` is the starting set. Any later rule that fires **removes** `read_only` from the set (a skill that calls `./notify` is not read-only by definition).

### Rule R1 — `sends_notifications` (notifies operator's own channel)

Match patterns (line-level regex, case-insensitive):
- `^\s*\./notify\b` — direct invocation
- `\bnotify\s+"\$MSG"` — argv-style invocation
- `\.pending-notify` — postprocess wrapper
- `notify-jsonrender` — dashboard render shorthand

Threshold: **single match → auto-apply** (`./notify` is unambiguous in this codebase; only the runner-injected `notify` script reads `$1` this way).

### Rule R2 — `external_api` (auth'd third-party HTTP, includes reads)

Match patterns:
- `\bWebFetch\b` — built-in Claude WebFetch (treated as external_api because operators routinely point it at auth'd endpoints; conservative side of the line)
- `\bcurl\b.*https?://` — direct HTTP call
- `\bgh\s+api\b` — GitHub REST/GraphQL
- `\beth_call\b|\beth_getBalance\b|\beth_getLogs\b|\beth_blockNumber\b|\beth_getTransactionReceipt\b` — Base RPC reads
- `OPENAI_API_KEY|ANTHROPIC_API_KEY|XAI_API_KEY|COINGECKO_API_KEY|REPLICATE_API_TOKEN|NEYNAR_API_KEY|BANKR_API_KEY|TELEGRAM_BOT_TOKEN|DISCORD_BOT_TOKEN|SLACK_BOT_TOKEN|GH_TOKEN|GITHUB_TOKEN` — secret reference
- `\bx\.ai/v1\b|api\.openai\.com|api\.anthropic\.com|api\.x\.ai|generativelanguage\.googleapis|api\.replicate\.com|api\.coingecko\.com|pro-api\.coinmarketcap|api\.neynar\.com|hub-api\.neynar|api\.bankr\.bot|api\.telegram\.org|discord\.com/api|slack\.com/api|api\.basescan\.org` — known auth'd endpoints

Threshold: **≥2 distinct matches → auto-apply**. Single match → tally counts toward the multi-rule combined threshold (R2+R1 together = 2 hits passes).

### Rule R3 — `writes_external_host` (POST/PUT/DELETE/PATCH against an external host)

Match patterns:
- `\bcurl\b.*-X\s*(POST|PUT|DELETE|PATCH)\b` — explicit non-GET verb
- `\bcurl\b.*-d\s+` — body-bearing curl (default verb POST)
- `\bgh\s+api\b.*-X\s*(POST|PUT|DELETE|PATCH)\b`
- `\bgh\s+pr\s+(create|comment|edit|review|close|merge)\b` — uses GitHub REST writes under the hood
- `\bgh\s+issue\s+(create|comment|close|edit|reopen)\b`
- `\bgh\s+release\s+(create|edit|delete|upload)\b`
- `\bgh\s+workflow\s+run\b` — workflow dispatch is a POST
- `https?://[^\s"']+/webhooks?/` — webhook POST
- `https?://api\.telegram\.org/bot.*/(send|edit|delete)` — Telegram write endpoint
- `\bcompletions\b.*POST|/v1/(chat/)?completions\b` — LLM POST (rare in bash, common in JS examples)

Threshold: **single match → auto-apply** when paired with an R2 match (R2+R3 = 2 hits with the same root cause). **≥2 distinct R3 matches → auto-apply** standalone.

Whenever R3 fires, R2 also fires (R3 is a strict subset).

### Rule R4 — `onchain_writes` (signs and broadcasts a tx)

Match patterns (high-signal, single-match unambiguous):
- `\beth_sendRawTransaction\b`
- `\beth_sendTransaction\b`
- `\bBankr\b.*\b(revoke|transfer|approve|swap|sell|buy)\b` — Bankr is the canonical agent-wallet path
- `api\.bankr\.bot/agent/(prompt|action)` — Bankr write endpoint
- `\bsendRawTransaction\b|\bsendTransaction\b` (web3.js/ethers wrappers)
- `\bwalletClient\.(writeContract|sendTransaction|signTransaction)\b` (viem)

Threshold: **single match → auto-apply**. On-chain writes carry the highest blast radius; one signal is enough to declare it.

Whenever R4 fires, R2 also fires (signing requires an RPC connection).

### Rule R5 — `agent_messaging` (speaks publicly for the operator)

Match patterns:
- `\bapi\.twitter\.com\b|\bapi\.x\.com\b.*tweet|/2/tweets\b` — X v2 post
- `\btweet-api\b|\bpost-tweet\b` — local helper names
- `\bdiscord\.com/api/(channels/[^/]+/messages|webhooks/)` — Discord post
- `\bslack\.com/api/chat\.postMessage` — Slack write
- `\bapi\.warpcast\.com\b|\bhub-api\.neynar\.com.*cast` — Farcaster cast
- `\bcastV2\b|\bcastMessage\b|\bsendCast\b` — Farcaster helpers

Threshold: **single match → auto-apply**. Public messaging is also high-blast-radius.

Whenever R5 fires, R2 and R3 also fire (auth + write).

### Edge case: skills that produce articles but do NOT notify or call external APIs

A handful of skills write `articles/*.md` and only that. After all rules run, if the resulting set is `{read_only}` and the body contains the literal `articles/${today}.md` or `articles/<slug>-` token, leave it as `{read_only}` and append a `note: writes articles only` field on the proposal manifest. The taxonomy doesn't have a `writes_repo_files` value — and shouldn't, per CAPABILITIES.md's "adding a new capability requires a separate PR" rule. The note exists for operator scanning, not for inclusion in the array.

### Validation — every emitted value MUST be in the locked taxonomy

After the rules produce a set, intersect it with the values extracted from `docs/CAPABILITIES.md` step 2. Any value not in the intersection is a heuristic bug (this skill's regexes drifted from the doc). On any non-empty diff → log `CAPABILITIES_SWEEP_HEURISTIC_DRIFT: <values>` and exit (no PR; one-line failure notify per the exit taxonomy). The drift means the doc added or removed a value and this skill's rules need updating before it can safely run again.

## Steps

### 0. Bootstrap

```bash
mkdir -p memory/topics articles .outputs
[ -f memory/topics/capabilities-sweep-state.json ] || cat > memory/topics/capabilities-sweep-state.json <<'EOF'
{"last_run":null,"last_status":null,"per_skill":{}}
EOF
```

If `jq empty` fails on the state file, or it parses but the top-level shape is unrecognizable (`jq -e 'has("per_skill") and (.per_skill | type == "object")'` fails), back it up to `.bak`, reset to the empty template, set `STATE_WAS_CORRUPT=true`. Continue — a corrupt state simply means every skill looks "never proposed before" and will be re-evaluated. The next clean run resets the watermark.

If the recovery itself fails — the `.bak` copy or the template rewrite cannot be written — exit `CAPABILITIES_SWEEP_STATE_CORRUPT` (one-line failure notify per the exit taxonomy; no PR, no other writes). A filesystem that won't accept the reset won't accept step 7's persist either, and a sweep whose results can't be recorded silently breaks the `NO_CHANGES` dedup on the next dispatch.

### 1. Parse var

Parse tokens per the var contract at the top of this file. Reject unknown tokens with `CAPABILITIES_SWEEP_BAD_VAR` (no writes, no notify). Set `MODE` (`execute` / `dry-run` / `propose-only`) and `ONLY_SLUG` (one slug or empty).

### 2. Load the locked taxonomy

Extract the 6 values from `docs/CAPABILITIES.md`:

```bash
[ -f docs/CAPABILITIES.md ] || { echo "CAPABILITIES_SWEEP_NO_TAXONOMY"; exit 0; }

awk '
  /^## The taxonomy[[:space:]]*$/ { in_tax=1; next }
  /^## / && in_tax { in_tax=0 }
  in_tax && /^\| `[a-z_]+` \|/ {
    match($0, /`[a-z_]+`/)
    val = substr($0, RSTART+1, RLENGTH-2)
    print val
  }
' docs/CAPABILITIES.md
```

If the result has fewer than 6 values or contains an unexpected entry → `CAPABILITIES_SWEEP_NO_TAXONOMY` and exit. The skill cannot operate when the taxonomy parser falls off the doc's section structure.

### 3. Iterate the skill catalog

For each `skills/<slug>/SKILL.md`:

1. **Skip if already declared** — `grep -E '^capabilities:\s*\[' skills/<slug>/SKILL.md` returns at least one match → record `skip=already-declared` and continue. Idempotent rerun.
2. **Skip if `ONLY_SLUG` is set and this slug doesn't match** — record `skip=slug-filter`.
3. **Read frontmatter and body.** Frontmatter is everything between the first `---` and the next `---`. Body is everything after.
4. **Run rules R1–R5** against the body, line by line. Record per-rule hit counts.
5. **Apply default `read_only`** if no rule fires; otherwise drop `read_only` and use the union of fired rules.
6. **Validate against the locked taxonomy** (step 2). Drift → fatal exit per the rule.
7. **Classify confidence:**
   - `high` — any single-signal rule fired (R1/R4/R5 with ≥1 hit, R2 with ≥2 hits, R3 standalone with ≥2 hits, or R2+R3 = ≥2 combined), OR result is `{read_only}` from zero hits.
   - `low` — exactly one matched pattern across R2/R3 (R2 single match alone, or R3 single match without R2 reinforcement).
8. **Record** in the proposal manifest: `{slug, current: [], proposed: [...], confidence: high|low, rule_hits: {R1: n, R2: n, R3: n, R4: n, R5: n}, note: "..."}`.

If `MODE=propose-only`, override every classification to `low` so the PR description lists every row for operator decision.

### 4. Write the proposal manifest and article

`.outputs/capabilities-sweep-proposals.json`:

```json
{
  "generated": "2026-06-10",
  "mode": "execute|dry-run|propose-only",
  "taxonomy": ["read_only", "external_api", "writes_external_host", "onchain_writes", "agent_messaging", "sends_notifications"],
  "totals": {
    "scanned": 197,
    "already_declared": 23,
    "evaluated": 174,
    "high_confidence": 167,
    "low_confidence": 7
  },
  "proposals": [
    {
      "slug": "weekly-shiplog",
      "current": [],
      "proposed": ["external_api", "sends_notifications"],
      "confidence": "high",
      "rule_hits": {"R1": 3, "R2": 5, "R3": 0, "R4": 0, "R5": 0},
      "note": null,
      "enabled": true
    }
  ]
}
```

`articles/capabilities-sweep-${today}.md`: human-readable version of the same data, sorted by `enabled-first then slug`. Three tables: high-confidence auto-applied, low-confidence needs review, already-declared (skipped this run). The first row of each table is a short sentence explaining what it means.

### 5. Apply high-confidence proposals to SKILL.md frontmatter

For every proposal where `confidence == "high"` AND `MODE == "execute"`:

- Insert the line `capabilities: [<values>]` immediately after the `requires:` line in the SKILL.md frontmatter — the placement every Phase 1 declaration uses (`skills/vigil-revoke/SKILL.md:7`). Most undeclared skills (142 of ~174) have no `requires:` line; for those, insert immediately after the `tags:` line instead (the placement `vigil` uses, `skills/vigil/SKILL.md:6`). If neither line exists, insert immediately before the closing `---`.
- Preserve the rest of the file byte-for-byte. Trailing whitespace, line endings, comment lines — all left alone.
- Use a single shell-side edit per file, not a regex over the whole file (a bad regex on ~174 files is the source of churn the operator least wants to deal with). Pattern: read the file, find the closing `---` of frontmatter (the second `---` line, counting from the top), splice the line in.

If `MODE == "dry-run"` or `MODE == "propose-only"` → SKIP this step. Manifest + article still write.

### 6. Open the PR (skipped on `dry-run`)

Always use the branch `chore/capabilities-sweep-phase-2-${today}`. Before creating it, check whether a sweep PR is already open from any `chore/capabilities-sweep-phase-2*` branch — an open sweep PR means the prior run's proposals are still under operator review, and a second PR (or extra commits) would split or invalidate that review:

```bash
EXISTING=$(gh pr list --state open --json headRefName,url \
  --jq '[.[] | select(.headRefName | startswith("chore/capabilities-sweep-phase-2"))][0].url // empty' 2>/dev/null)
if [ -n "$EXISTING" ]; then
  echo "CAPABILITIES_SWEEP_PR_EXISTS: $EXISTING"
  # → persist state, log, send the one-line notify with the existing PR URL, exit.
  #   The operator merges or closes that PR, then re-dispatches.
fi

git checkout -b chore/capabilities-sweep-phase-2-${today}
git add skills/*/SKILL.md .outputs/capabilities-sweep-proposals.json articles/capabilities-sweep-${today}.md
git commit -m "chore(capabilities): Phase 2 sweep — declare capabilities on ${N} undeclared skills

Auto-generated by skills/capabilities-sweep — pre-applies high-confidence
inferences from the locked 6-value taxonomy in docs/CAPABILITIES.md.

Closes the (undeclared) row in capabilities-map left after the Phase 1
sweep (PR #322).

Generated manifest: .outputs/capabilities-sweep-proposals.json
Human-readable article: articles/capabilities-sweep-${today}.md

High-confidence rows: ${H} pre-applied to SKILL.md frontmatter.
Low-confidence rows: ${L} listed in PR description for operator decision.
"
git push -u origin chore/capabilities-sweep-phase-2-${today}
```

PR body must include:
1. The high-confidence rows table (slug → proposed capabilities, enabled status, rule hits) — operator scans for surprises.
2. The low-confidence rows table — operator picks values or marks read_only.
3. A note that this PR is idempotent: subsequent dispatches re-evaluate and only act on skills that *changed* since the last run (state file `memory/topics/capabilities-sweep-state.json`).

`gh pr create -t "chore(capabilities): Phase 2 sweep" -F /tmp/capabilities-sweep-pr-body.md -B main`.

### 7. Persist state

For every evaluated slug (including skipped-already-declared rows), update `memory/topics/capabilities-sweep-state.json`:

```json
{
  "last_run": "2026-06-10",
  "last_status": "OK",
  "per_skill": {
    "weekly-shiplog": {
      "last_run": "2026-06-10",
      "last_proposed_capabilities": ["external_api", "sends_notifications"],
      "last_confidence": "high",
      "last_applied": true
    }
  }
}
```

Write `.tmp` then `mv` over the live path so a mid-write crash leaves the prior snapshot intact.

### 8. Notify

Send via `./notify "$MSG"` (single positional arg, aeon's standard contract):

```
*Capabilities Sweep — ${today}*

Phase 2 sweep ran on ${N_evaluated} undeclared skills.
- ${N_high} high-confidence rows pre-applied
- ${N_low} low-confidence rows need review
- ${N_skipped} already declared (skipped)

PR: ${PR_URL}
Manifest: .outputs/capabilities-sweep-proposals.json
Article: articles/capabilities-sweep-${today}.md
```

Suppress notify on `NO_CHANGES`, `DRY_RUN`, `BAD_VAR` — exactly the statuses the exit taxonomy below marks "No". `NO_TAXONOMY`, `HEURISTIC_DRIFT`, and `STATE_CORRUPT` (recovery failed — routine corruption is recovered in step 0 and never reaches here) send a one-line failure instead of the full message; `PR_EXISTS` sends a one-line message with the existing PR URL. Send the full message above on every run that successfully opens a PR (`OK`, `PROPOSE_ONLY`).

### 9. Log

Append to `memory/logs/${today}.md`:

```markdown
## capabilities-sweep
- **Mode**: execute / dry-run / propose-only
- **Slug filter**: <slug> | none
- **Scanned**: N
- **Already declared (skipped)**: A
- **Evaluated**: E
- **High-confidence applied**: H
- **Low-confidence flagged**: L
- **Heuristic drift**: yes/no
- **PR**: <url> | none (dry-run)
- **Article**: articles/capabilities-sweep-${today}.md
- **Notification**: sent / skipped (gated)
- **Status**: CAPABILITIES_SWEEP_OK
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `CAPABILITIES_SWEEP_OK` | Article + manifest + state wrote; PR opened with at least one row | Yes |
| `CAPABILITIES_SWEEP_NO_CHANGES` | Every undeclared skill produced the same proposal it did last run — nothing to PR | No |
| `CAPABILITIES_SWEEP_PR_EXISTS` | An open PR from a `chore/capabilities-sweep-phase-2*` branch already exists — no new branch, no new PR | Yes (one-line with existing PR URL) |
| `CAPABILITIES_SWEEP_DRY_RUN` | `MODE=dry-run`; article + manifest wrote, no PR, no notify | No |
| `CAPABILITIES_SWEEP_PROPOSE_ONLY` | Every row downgraded to `needs-review`; PR opened with zero pre-applied edits | Yes |
| `CAPABILITIES_SWEEP_NO_TAXONOMY` | `docs/CAPABILITIES.md` missing or unparseable | Yes (one-line failure) |
| `CAPABILITIES_SWEEP_HEURISTIC_DRIFT` | One or more rules produced a value not in the locked taxonomy | Yes (one-line failure) |
| `CAPABILITIES_SWEEP_STATE_CORRUPT` | State JSON corrupt **and** the step-0 recovery failed (`.bak` copy or template rewrite unwritable) — routine corruption is recovered silently in step 0 and the run continues under its normal exit status | Yes (one-line failure) |
| `CAPABILITIES_SWEEP_BAD_VAR` | `${var}` parse failed | No |

## Design notes (do not edit without reading)

- **One PR, many file changes.** The operator's review burden is concentrated on a single PR description that lists every row; the actual file changes are mechanical and uniform. Splitting into ~174 micro-PRs would invert the cost: the operator would review ~174 PR titles to do the same scan. The taxonomy is small enough (6 values) that one matrix-shaped review is the cheap path.
- **Conservative defaults: ambiguity → `needs-review`, not auto-apply.** A wrong declaration is worse than a missing one because it lies to `capabilities-map`. The skill applies a declaration only when the body shows two corroborating signals OR a single unambiguous signal (on-chain write, agent messaging). Everything else lands in the low-confidence table.
- **`read_only` is the explicit default for zero-signal skills.** The taxonomy has the value; using it is the point. A skill that produces an article and nothing else IS read_only — declaring it surfaces the coverage signal, not the silence.
- **Idempotent rerun.** Skills already declared are skipped on every rerun (the frontmatter grep is the gate). State tracks last proposal per slug; a rerun that produces the same proposal exits `NO_CHANGES` without opening a duplicate PR, and a rerun while a sweep PR is still open exits `PR_EXISTS` instead of stacking a second one.
- **Heuristic drift is a fatal error, not a warning.** If a rule emits a value the doc no longer contains, the rule is stale and continuing would corrupt the catalog. Exit, surface the failure, fix the rule, rerun.
- **No new capability values invented here.** The locked taxonomy in `docs/CAPABILITIES.md` is the source of truth. Patterns that don't map to an existing value (e.g. "writes a file under `memory/`") are ignored — adding `writes_memory` is a separate PR per CAPABILITIES.md's amendment rule.
- **`workflow_dispatch` only, no cron.** This is a one-shot meta-tool. After one merge the backlog is empty. Re-dispatch happens only when a future contributor lands a new skill without a declaration — at which point `capabilities-map` surfaces it as a single row and the operator runs this skill with `slug=<that-skill>` to clear it.
- **Per-skill PR for a single `slug=` filter.** When invoked with `slug=<one>`, the PR title and body name only that slug and the diff is one file. Useful for iterating on heuristics: tighten a rule, dispatch with `slug=<X>`, review the resulting one-file PR, merge or refine.

## Sandbox Note

All work is local-file. The only outbound calls are `gh pr list` (duplicate-PR guard), the `git push` of the sweep branch, `gh pr create`, and `./notify`, all already sandbox-safe per CLAUDE.md pattern 2 (gh handles `GH_TOKEN` internally) and pattern 3 (notify reads `$1`, no expansion in the body of this skill). No `WebFetch`, no `curl`, no `${today_minus_N}` phantom variables — only `${today}` is interpolated.

## Required Env Vars

- `GH_TOKEN` (or `GITHUB_TOKEN` in CI) — provided by the runner; needed by `gh pr list` / the `git push` to origin / `gh pr create` only.

No third-party API keys. No on-chain reads. No file writes outside `skills/<slug>/SKILL.md` (in-place frontmatter splice), `articles/`, `.outputs/`, and `memory/`.
