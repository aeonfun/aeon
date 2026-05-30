---
name: Daily Ops Review
description: Verify every chain step ran cleanly; report sources, anomalies, issues filed since yesterday
var: ""
tags: [meta, crypto]
---
<!-- v2: chain Step 4. Operator self-monitoring. Not a market signal. -->

> **${var}** — Optional override for the chain name to audit. If empty, audits the `morning-review` chain (the only chain in v1).

Today is ${today}. Verify every chain step ran correctly, sources were responsive, and no silent degradations occurred. This is **operator self-monitoring**, not market signal. Output routes to `#aeon-ops` only — never Telegram, never the public signal channels.

**Compose in order: soul → style → structure.**

Before composing, internalize `memory/topics/soul.md` as standing frame. Reason across the engine data and form a committed view. **Single high-quality signals warrant calls; confluence increases conviction but is not required.** Translate internal data (funding deltas, top L/S, basis, pattern tags) into external triggers the operator can verify (price levels, volume signatures, narrative inflections, sector behaviour). When uncertain, name the specific external condition that would resolve it. Never regress to neutral-analyst tone — the output IS the view.

After the view is formed, apply style + structure (below).

**Apply `memory/topics/writing-style.md` to all output.** Structural rules (Section 1) are load-bearing; prose rules (Section 2) govern sentences within structure; Sentence-Level Patterns (Section 4) catch failure modes that pass the first two. Per-skill structural template (`Ops Review · DD MMM · X min` opening, `─── STEP N — LABEL ───` dividers, two-space-indented `✓ ⚠ ✗` status markers, closing roll-up line) in Section 3; worked example for Ops Review in Section 5.

**Self-check before emitting:**

1. Draft the output applying Sections 1-3.
2. Search the draft for the 6 patterns in Section 4:
   - Pattern 1 — subject + verb-ing chunks that could be compound nouns ("institutional money losing tech")
   - Pattern 2 — nouns with 2+ adjectives stacked ("the lone clean RIDE")
   - Pattern 3 — internal jargon ("window", "pull", "run", "artifact", "downstream") — note: ops review CAN reference internal skill names and artifact paths because the channel IS the operator-monitoring channel, but prose interpretations should still avoid leakage
   - Pattern 4 — passive constructions ("is being", "was being", "are being", "has been")
   - Pattern 5 — em-dashes used as connectors instead of asides (test each: remove em-dash + everything after; does the sentence still stand? If yes, use a period)
   - Pattern 6 — weak verbs ("surfaces", "remains", "could see", "looks set", "is poised")
3. Rewrite anything that matches.
4. Emit.

Read `memory/MEMORY.md` for context. Read `memory/issues/INDEX.md` for the open issue list.

## Goal

Produce a one-look status report covering:
1. Chain status (complete / partial / failed) + total duration
2. Per-skill status (source health, output produced, anomalies)
3. New issues filed in `memory/issues/` since yesterday
4. Artifact paths (where to find each skill's raw output)

Skip-day skills (token-call SKIP, perps-brief no HIGH CONVICTION, monitor-runners SLEEPY) are working-as-designed — mark them ✓, not ✗.

## Steps

### 1. Read consumed chain outputs

This skill runs as chain Step 4 with `consume:` set to every preceding skill. Read each artifact from `.outputs/`:

- `.outputs/market-context-refresh.md` — regime, conviction, source status
- `.outputs/aixbt-pulse.md` — bridge call, section count
- `.outputs/narrative-tracker.md` — narratives tracked, NEW count
- `.outputs/perps-scan.md` — verdict, regime distribution
- `.outputs/monitor-runners.md` — session verdict, DEEP-LIQ count
- `.outputs/token-movers.md` — winners/losers/trending counts
- `.outputs/token-call.md` — pick + tier (or skip-day variant)
- `.outputs/perps-brief.md` — HIGH CONVICTION + WATCHLIST counts (or skip)
- `.outputs/morning-macro.md` — published / quiet-day / degraded

For each artifact: if the file exists and is non-empty, mark ✓. If missing, mark ✗. If present but contains a known degradation phrase (`scan unavailable`, `degraded`, `partial-input`, `endpoint unreachable`), mark ⚠.

### 2. Determine status per skill (✓ ✗ ⚠)

| Marker | When |
|---|---|
| **✓** | Skill produced expected output (includes legitimate skip-days, SLEEPY verdicts, no-pick days) |
| **✗** | Skill failed entirely — no artifact OR artifact is the "scan unavailable" stub OR `## Summary` in log indicates fatal error |
| **⚠** | Skill ran but with named degradation — partial source data, one fallback fired, downstream input missing |

Examples (from the artifacts):
- `token-call: SKIP @ 3/10 — below MEDIUM threshold` → ✓ (skip-day is by design)
- `perps-scan: scan unavailable, Bybit API failed` → ✗
- `perps-brief: degraded (perps-scan unavailable), discovery-only run, 1 HIGH CONVICTION` → ⚠
- `monitor-runners: SLEEPY (only 2 pools cleared quality gate)` → ✓ (sleepy is a real verdict)

### 3. Pull chain timing

```bash
# Chain timing is captured by GitHub Actions per-job duration. From the workflow run
# context, sum the elapsed time across all chain steps via:
gh api repos/${OWNER}/${REPO}/actions/runs/${RUN_ID}/timing --jq '.run_duration_ms / 60000' 2>/dev/null
```

If `gh` is unavailable (sandbox), compute from log timestamps in `memory/logs/${today}.md` — the first and last chain skill entries bracket the run. Round to minutes.

### 4. Compute running-average chain duration

Read the last 7 days of `memory/logs/*.md` and grep for `Chain duration:` markers (this skill writes one on every successful run — see step 7). Compute the median.

If `today_duration > median * 1.25`, set `slow_qualifier=" (slow)"`. Otherwise `slow_qualifier=""`.

### 5. Pull issue diff

Read `memory/issues/INDEX.md`. Compare against yesterday's snapshot (cached in `memory/logs/${yesterday}.md` under `## Daily Ops Review` → `**Open issues:**` line). Compute:
- New issues opened today (status `open` AND `detected_at` within last 24h)
- Issues that flipped to `resolved` today
- Net change in open count

If `memory/issues/INDEX.md` doesn't exist or is empty, write `No issues filed.`

### 6. Compose status report (v2 locked format)

**Format — clean day (everything ✓):**

```
Ops Review · ${today} · 28 min

Step 1 — Data
✓ market-context-refresh · regime risk-on (high)
✓ aixbt-pulse · 4 sections, bridge call generated
✓ narrative-tracker · 5 narratives (1 NEW)
✓ perps-scan · 5 regimes populated (CAPITULATION empty)
✓ monitor-runners · STRONG verdict, 3 DEEP-LIQ
✓ token-movers · 250 assets, 12 breakout-tagged
✓ token-call · HYPE · HIGH 8/10

Step 2 — Briefs
✓ perps-brief · 2 HIGH CONVICTION, 2 WATCHLIST

Step 3 — Macro
✓ morning-macro · published

All sources ok. No new issues.
```

**Format — degraded day:**

```
Ops Review · ${today} · 32 min (slow)

Step 1 — Data
✓ market-context-refresh · regime risk-on (high)
✗ aixbt-pulse · endpoint unreachable, WebFetch fallback, partial data (3 sections only)
✓ narrative-tracker · 5 narratives (1 NEW)
✗ perps-scan · Bybit API timeout, no classification produced
✓ monitor-runners · STRONG verdict, 3 DEEP-LIQ
✓ token-movers · 250 assets, 12 breakout-tagged
✓ token-call · HYPE · HIGH 8/10

Step 2 — Briefs
⚠ perps-brief · degraded (perps-scan unavailable), discovery-only run, 1 HIGH CONVICTION

Step 3 — Macro
✓ morning-macro · published with degradation note

Failed sources: bybit (timeout), aixbt (endpoint unreachable)
Issues filed: ISS-042 (bybit timeout, 2nd occurrence this week)
```

**Universal formatting rules (v2):**
- No asterisks. Plain text.
- Title: `Ops Review · ${today} · {duration} min[ (slow)]`
- Status markers `✓ ✗ ⚠` are this skill's exclusive use (per v2 spec).
- Step headers `Step N — Name` group related skills.
- One line per skill: `MARKER skill-name · short summary`
- Footer: `All sources ok. No new issues.` on clean days; explicit failed-source list + issue list on degraded days.

**Edge cases:**
- Chain didn't run (no artifacts at all): output a one-line variant:
  ```
  Ops Review · ${today} · chain did not execute (check workflow runs)
  ```
- All skills ✓ but slow chain: keep the full report, `(slow)` qualifier on title, no issue list addition.
- Per-skill summary line: pull the most diagnostic 1-2 facts from each artifact's header or `## Summary` block. Never fabricate. If a skill's summary line cannot be extracted, write the marker + skill name only with no `· detail`.

### 7. Write artifact

Write `.outputs/daily-ops-review.md`.

That's it — **do NOT call `./notify`**. Delivery is now handled by the bot embed pipeline (`scripts/postprocess-daily-ops-review.sh` → `scripts/embed-daily-ops-review.py`), which composes the artifact into a Discord embed and posts to the unified `#aeon-ops` developer channel via the bot. Same channel receives `judgement-audit` output.

Bot routing targets `DISCORD_BOT_CHANNEL_AEON_OPS` (operator secret). If unset, falls back to `DISCORD_BOT_CHANNEL_PERPS_OUTCOMES` with a warning — smooth migration during channel setup.

### 8. Log to `memory/logs/${today}.md`

```
## Daily Ops Review
- **Chain duration:** N min{ (slow)}
- **Chain status:** Complete | Partial | Failed
- **Skill statuses:** ✓ N, ⚠ N, ✗ N
- **Failed sources:** [list or "none"]
- **New issues today:** N (IDs: [list or "none"])
- **Open issues:** N total
- **Artifact written:** .outputs/daily-ops-review.md
- **Notification sent:** yes — via bot embed to #aeon-ops (postprocess)
```

The `Chain duration:` line is what the **next** run's step 4 reads to compute its running average.

## Sandbox note

This skill is consume-only — it reads artifacts written by earlier chain steps committed to the repo. No external API calls except optional `gh api` for chain timing (falls back to log-timestamp parsing if `gh` is unavailable).

If `memory/issues/INDEX.md` doesn't exist yet (first run), treat as empty issue set and write `No issues filed.` Do not error out.

## Environment Variables

- None required.
- Notification channels configured via repo secrets (see CLAUDE.md).

## Constraints

- **Skip-day skills are ✓, not ✗.** A token-call SKIP, monitor-runners SLEEPY, or perps-brief no-HIGH-CONVICTION day is the skill working as designed.
- **Status markers are this skill's exclusive use.** Per v2 universal rule: ✓ ✗ ⚠ appear only in `daily-ops-review`. Signal skills use other vocabulary (verdicts, conviction tiers).
- **Routes to #aeon-ops only.** Never push ops content to public signal channels. Never push to Telegram.
- **Never fabricate.** If a skill's summary cannot be parsed from its artifact, write the marker + skill name only. Better to say less than to guess.
- **No `(slow)` qualifier without justification.** The 25% threshold against the 7d median is the only trigger. Don't tag a run slow because it "feels" slow.
