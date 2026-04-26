---
name: contributor-reward
description: Closes the contributor flywheel — turns the weekly fork-contributor-leaderboard ranking into a tier-priced rewards plan, writes it into memory/distributions.yml, and hands off to distribute-tokens for the actual on-chain send
var: ""
tags: [community, crypto]
---

> **${var}** — Optional override. Pass `dry-run` to print the plan without writing to `memory/distributions.yml` or sending a notification. Pass an explicit ISO week (e.g. `2026-W17`) to force-process that week instead of the most recent leaderboard. Empty = process the most recent leaderboard.

Today is ${today}. Closes the loop from `fork-contributor-leaderboard` to `distribute-tokens`: read this week's contributor ranking, price each eligible contributor against a tier table, write a labelled list into `memory/distributions.yml`, and notify the operator with a one-command run line. Humans still gate the actual send (`distribute-tokens` execution stays a manual or chained step) — this skill's job is plan generation, not money movement.

## Why this design

The fork-contributor-leaderboard already names the people moving the project. The distribute-tokens skill already moves tokens with idempotency, balance preflight, and dry-run. The gap was the wiring between them: a contributor's score on Sunday's leaderboard had no path to a wallet credit. This skill is the wiring — and only the wiring.

It deliberately stops short of executing transfers because (a) `distribute-tokens` is the only sanctioned transfer path and re-implementing it here would fragment the idempotency state, and (b) keeping a human-visible diff on `memory/distributions.yml` between plan and execution is the cheapest possible audit trail when real money is involved. The plan lands in git; the operator (or a chained step) runs `distribute-tokens contributors-${ISO_WEEK}` next.

## Tier pricing

| Rank in leaderboard | Reward (USDC) |
|---------------------|---------------|
| 1                   | 25            |
| 2                   | 15            |
| 3                   | 10            |
| 4                   | 5             |
| 5                   | 5             |

**First-PR bonus:** +5 USDC, additive, applied once-ever per login (tracked in state file). Rewards landing your first merged upstream PR — the highest-leverage signal in the leaderboard scoring.

**Eligibility floor:** score ≥ 10 AND the contributor must own a non-empty `@handle` (logins without `@` prefix in the table are skipped — bots and parsing artifacts).

Default `token: USDC` on Base, matching `distribute-tokens` defaults. Operator can override per-recipient amounts in `memory/distributions.yml` after the plan is written if a special bonus is warranted.

## Config

No new config files. Reads:

- `articles/fork-contributor-leaderboard-${MOST_RECENT}.md` — the source-of-truth ranking
- `memory/state/contributor-reward-state.json` — idempotency + first-PR-bonus history (created on first run)
- `memory/distributions.yml` — the file `distribute-tokens` reads (created/updated by this skill)

No new secrets. No new external API calls. No curl. All work is local file I/O plus one optional `gh api` for the upstream default branch.

## Steps

### 1. Parse var and resolve week

- If `${var}` starts with `dry-run`, set `MODE=dry-run`. Strip the `dry-run` prefix; remainder (if any) is treated as the week override.
- Otherwise `MODE=execute`.
- If the remaining var matches `^\d{4}-W\d{2}$`, set `TARGET_WEEK=${var}` and `LEADERBOARD_GLOB="articles/fork-contributor-leaderboard-*.md"` (will pick the latest file regardless of date — operator is asserting they know which file maps to that week).
- Otherwise compute `TARGET_WEEK` from today: `TARGET_WEEK=$(date -u +%G-W%V)` (ISO-8601 week-numbering year + week — `%G/%V` not `%Y/%U`, so Monday-anchored weeks roll over correctly across years).

### 2. Find and validate the source leaderboard article

- `LEADERBOARD_FILE=$(ls -1t articles/fork-contributor-leaderboard-*.md 2>/dev/null | head -1)`
- If no file → log `CONTRIBUTOR_REWARD_NO_LEADERBOARD` to `memory/logs/${today}.md`, exit silently (no notify). The leaderboard skill is the upstream dependency; if it didn't run, this skill has nothing to do.
- Compute the file's age in days from its filename suffix (`fork-contributor-leaderboard-YYYY-MM-DD.md`). If age > 8 days → log `CONTRIBUTOR_REWARD_STALE_LEADERBOARD — last leaderboard ${age}d old`, notify the operator that the upstream leaderboard hasn't run, exit. Don't reward against a fortnight-old ranking.

### 3. Parse the Top Contributors table

The leaderboard's `## Top Contributors` section uses this column layout (from the upstream skill spec):

```
| Rank | Contributor | Score | Merged PRs | Open PRs | Reviews | Fork Commits | New Skills | First PR? | Change |
```

Extract rows with a tolerant regex: `^\|\s*(\d+)\s*\|\s*@(\S+)\s*\|\s*(\d+)\s*\|.*?\|\s*(✨|—|\s*)\s*\|\s*[^|]*\|\s*$`

Capture: `rank`, `login` (without `@`), `score`, `first_pr_marker` (✨ if present, else absent).

If zero rows extracted (leaderboard format drift) → log `CONTRIBUTOR_REWARD_PARSE_FAIL — extracted 0 rows from ${LEADERBOARD_FILE}`, notify with the file path so the operator can inspect, exit.

### 4. Load idempotency state

```json
// memory/state/contributor-reward-state.json
{
  "weeks": {
    "2026-W17": {
      "written_at": "2026-04-26T09:00:00Z",
      "label": "contributors-2026-W17",
      "leaderboard_file": "articles/fork-contributor-leaderboard-2026-04-26.md",
      "rewards": [
        { "login": "alice_dev", "rank": 1, "score": 47, "amount": "25", "first_pr_bonus": false },
        { "login": "bob_builder", "rank": 2, "score": 31, "amount": "20", "first_pr_bonus": true }
      ]
    }
  },
  "first_pr_bonus_paid": ["bob_builder", "carol_eng"]
}
```

Bootstrap with `{"weeks": {}, "first_pr_bonus_paid": []}` if the file doesn't exist.

### 5. Compute the plan

For each parsed row with `rank ≤ 5` AND `score ≥ 10`:

- Look up `base_amount` from the tier table (rank 1→25, 2→15, 3→10, 4-5→5).
- If `first_pr_marker == "✨"` AND `login ∉ first_pr_bonus_paid` → set `first_pr_bonus = true`, `amount = base_amount + 5`. Otherwise `first_pr_bonus = false`, `amount = base_amount`.
- Build row: `{ rank, login, score, base_amount, first_pr_bonus, amount }`.

If `weeks[TARGET_WEEK]` already exists in state → this week was already processed. Diff the current plan against `state.weeks[TARGET_WEEK].rewards` keyed on `login`:

- If diffs are empty (same logins, same amounts) → log `CONTRIBUTOR_REWARD_ALREADY_PROCESSED — week ${TARGET_WEEK}`, exit silently (no notify). Idempotent re-run.
- If diffs exist (leaderboard re-ran after first reward write — late tweet bumped a score, etc.) → flag `RE_PROCESS`. Continue but don't re-pay anyone already in `state.weeks[TARGET_WEEK].rewards`; add only the deltas. New entries get full reward; existing entries with bumped amounts get the **delta** (e.g. moved from rank 3→2 = additional 5 USDC top-up). Demoted entries are not clawed back.

If the plan is empty (zero eligible contributors after threshold + dedup) → log `CONTRIBUTOR_REWARD_NO_ELIGIBLE` and exit silently.

### 6. Render the plan

```
Contributor Reward Plan — ${TARGET_WEEK} (${MODE})

Source: ${LEADERBOARD_FILE}
Tier: rank 1=25, 2=15, 3=10, 4-5=5 USDC; first-PR bonus +5 once per login.

  ✓ #1 @alice_dev      score 47  →  25 USDC                  [NEW]
  ✓ #2 @bob_builder    score 31  →  20 USDC (15 + 5 first-PR)[NEW + BONUS]
  ✓ #3 @carol_eng      score 24  →  10 USDC                  [NEW]
  ✓ #4 @dave_ops       score 18  →   5 USDC                  [NEW]
  ↻ #5 @eve_hax        score 14  →   5 USDC                  [DEDUP — already in state]

Total to write: 60 USDC across 4 new entries.
Total in state for ${TARGET_WEEK} after write: 5 entries, 65 USDC.

Next: ./aeon distribute-tokens "dry-run:contributors-${TARGET_WEEK}" (preview)
      ./aeon distribute-tokens "contributors-${TARGET_WEEK}"           (execute)
```

If `MODE=dry-run`: notify this plan with header `*Contributor Reward Plan — ${TARGET_WEEK}* — DRY RUN`, log to `memory/logs/${today}.md`, exit `CONTRIBUTOR_REWARD_DRY_RUN`. **Do not** touch `memory/distributions.yml` or the state file.

### 7. Update memory/distributions.yml

Read `memory/distributions.yml`. If missing → bootstrap with the standard header (matching distribute-tokens' bootstrap style):

```yaml
# memory/distributions.yml
defaults:
  token: USDC
  amount: "5"
  chain: base

lists:
```

Compute the new list block:

```yaml
  contributors-${TARGET_WEEK}:
    description: "Weekly contributor rewards for ${TARGET_WEEK} (auto-generated from fork-contributor-leaderboard)"
    token: USDC
    amount: "5"
    recipients:
      - handle: "@alice_dev"
        amount: "25"        # rank 1
      - handle: "@bob_builder"
        amount: "20"        # rank 2 + first-PR bonus
      - handle: "@carol_eng"
        amount: "10"        # rank 3
      - handle: "@dave_ops"
        amount: "5"         # rank 4
```

Recipient ordering matches plan order (rank ascending). Per-recipient `amount` is required so distribute-tokens picks up the tier-priced value rather than falling back to the list default.

**Update strategy:**
- If a list named `contributors-${TARGET_WEEK}` already exists in the YAML, **replace** it wholesale (the plan is the authoritative current state).
- Otherwise append the block under `lists:` (preserving existing lists — never rewrite them).
- Use a YAML-aware update (e.g. `python -c "import yaml; ..."` if available, otherwise a careful text-based block replacement keyed on the `^  contributors-${TARGET_WEEK}:$` line). If YAML parse fails on the existing file → log error, do not write, notify the operator (file is hand-edited; auto-edit would clobber).

Verify the write by re-reading the file and confirming the list is present and has `len(recipients) == len(plan)`.

### 8. Update state file

Atomically write the updated state JSON to `memory/state/contributor-reward-state.json`:
- Set `weeks[TARGET_WEEK]` = `{ written_at: now_utc, label, leaderboard_file, rewards: [{login, rank, score, amount, first_pr_bonus}, ...] }` (full replacement on RE_PROCESS, otherwise additive).
- Append any logins where `first_pr_bonus == true` to `first_pr_bonus_paid` (deduplicated).

Write to a tempfile and `mv` over the target so partial writes can't corrupt state.

### 9. Notify

```
*Contributor Reward Plan — ${TARGET_WEEK}*

Wrote ${N_NEW} new entries (${TOTAL_USDC} USDC) to memory/distributions.yml as `contributors-${TARGET_WEEK}`.

Top of plan:
  #1 @alice_dev   — 25 USDC
  #2 @bob_builder — 20 USDC (✨ first-PR bonus)
  #3 @carol_eng   — 10 USDC
  #4 @dave_ops    —  5 USDC
${IF_DEDUP}

Source: ${LEADERBOARD_FILE}
First-PR bonuses awarded: ${LIST_OR_NONE}

Next: run `distribute-tokens dry-run:contributors-${TARGET_WEEK}` to preview, then drop the `dry-run:` prefix to execute.

Plan: https://github.com/${GITHUB_REPOSITORY}/blob/main/memory/distributions.yml
```

Suppress the `${IF_DEDUP}` line when no entries were deduped. Use `$GITHUB_REPOSITORY` env var for the link target. Send via `./notify`.

**Significance gate:** notify only when `N_NEW ≥ 1`. Re-process runs that produced zero new entries (RE_PROCESS with all rewards already paid) → silent log only.

### 10. Log

Append to `memory/logs/${today}.md`:

```
## Contributor Reward
- **Mode:** execute | dry-run | already-processed | no-leaderboard | stale-leaderboard | parse-fail | no-eligible
- **Week:** ${TARGET_WEEK}
- **Source:** ${LEADERBOARD_FILE} (age: ${AGE_DAYS}d)
- **List label:** contributors-${TARGET_WEEK}
- **Entries written (new):** ${N_NEW}
- **Entries deduped:** ${N_DEDUP}
- **Total USDC planned:** ${TOTAL_USDC}
- **First-PR bonuses:** [list or "none"]
- **Notification sent:** yes/no
```

## Exit codes

- `CONTRIBUTOR_REWARD_OK` — plan written, notification sent
- `CONTRIBUTOR_REWARD_DRY_RUN` — plan rendered, no writes, notification sent
- `CONTRIBUTOR_REWARD_ALREADY_PROCESSED` — week already in state with identical plan, silent exit
- `CONTRIBUTOR_REWARD_NO_LEADERBOARD` — no leaderboard article found, silent exit
- `CONTRIBUTOR_REWARD_STALE_LEADERBOARD` — leaderboard >8 days old, notified
- `CONTRIBUTOR_REWARD_PARSE_FAIL` — could not extract any rows from the leaderboard table, notified
- `CONTRIBUTOR_REWARD_NO_ELIGIBLE` — zero contributors above threshold, silent exit
- `CONTRIBUTOR_REWARD_ERROR` — file I/O or YAML write failure, notified

## Sandbox note

Pure local file I/O — no curl, no auth-bearing headers, no env-var-expansion. Reads `articles/`, `memory/state/`, `memory/distributions.yml`. Writes `memory/state/contributor-reward-state.json`, `memory/distributions.yml`, `memory/logs/${today}.md`. The optional `gh api` call for the upstream default branch isn't needed at runtime — `distribute-tokens` does its own resolution. No prefetch, no postprocess scripts required.

## Constraints

- **Money-adjacent — never auto-execute.** This skill writes plans and notifies. The actual transfer always goes through `distribute-tokens`, which has its own preflight and idempotency. Do not call distribute-tokens from inside this skill.
- **Idempotency is per-(week, login).** Re-runs in the same week add only deltas; demotions never claw back already-paid amounts.
- **First-PR bonus is once-ever per login.** Track in `first_pr_bonus_paid` list; never re-award even if the same person appears as ✨ on a later leaderboard (which they shouldn't, since ✨ means *first ever* — but defend against parsing drift).
- **No silent overwrites of distributions.yml.** If the file exists and is malformed, fail loudly rather than rewriting.
- **Eligibility floor stays low (score ≥ 10) by design.** A single merged upstream PR (+10) qualifies — the goal is to reward shipped work, not gate on volume.

## Future iterations

- Wire as a chain (`fork-contributor-leaderboard → contributor-reward → distribute-tokens dry-run`) once the operator is comfortable with end-to-end automation. The pieces exist; the chain wiring is a one-line `aeon.yml` change.
- Add a Bankr Agent API "wallet-linked?" pre-filter so contributors without linked wallets are flagged in the notification (prevents distribute-tokens from logging RESOLVE_FAILED rows on every run).
- Tier table should become operator-configurable via `memory/contributor-reward-config.yml` once the first month of runs reveals the right curve. Hardcoded for v1.

Write the full plan. No TODOs or placeholders.
