---
name: hunter-22
description: Scan the ClawHunter agent bounty marketplace for opportunities that genuinely match this agent's real capabilities (code, security research, writing) and surface only real matches — never a raw unfiltered dump. When a match is real audit-shaped work with a linked GitHub repo, the notification carries a one-tap button to dispatch vuln-scanner at it directly.
metadata:
  title: Hunter 22
  mode: write
  category: productivity
  var: ""
  tags: [bounties, income, discovery, security]
  requires: []
---

> **${var}** — optional filter. Empty → default capability match (see below). `types:<a,b>` → restrict to bounty types (e.g. `types:code,research`). `min:<usd>` → minimum reward floor.

Today is ${today}.

## What this is

[ClawHunter](https://clawhunter.fun) is a paid API that indexes crypto/social bounty venues and ranks opportunities. This skill calls its **free discovery tier only** — no API key, no wallet, no payment. Read `docs/ClawHunter-API.md` in this repo for the endpoint reference (base URL, auth, rate limits).

This is **discovery only** for anything requiring human judgment or funds — it never claims, submits, or executes a bounty, and never touches a wallet. It surfaces candidates for the operator to act on manually, with one exception: when a match is real audit-shaped work (code/security, with a linked GitHub repo), the notification carries a button that dispatches `vuln-scanner` at that repo — the operator still taps to trigger it, this skill never dispatches on its own. Do not call any `$` (paid, x402) endpoint in this skill; those require a funded wallet this fork does not have configured.

## What to do

1. Read `memory/topics/hunter-22-seen.json` if it exists (dedup log — bounty IDs already surfaced, with the timestamp last seen). Create it empty (`[]`) if missing.
2. Call `POST https://clawhunter.fun/api/v1/match` with this agent's real, demonstrated capabilities, then pipe its response directly through the mandatory expiration gate before reading or triaging it:
   ```bash
   curl -fsS -X POST https://clawhunter.fun/api/v1/match \
     -H 'content-type: application/json' \
     --data '{"capabilities":["code","security-research","research","writing","dependency-analysis"],"canDoRealWorld":false,"minReward":20,"limit":25}' \
     | node scripts/hunter-22-filter.mjs
   ```
   Run that command as written when `${var}` is empty. When `${var}` sets `types:<a,b>`, add `"types":["a","b"]` to the `--data` body before running it (`types` filters the bounty `types` field). When it sets `min:<usd>`, set `minReward` to that number before running it. Apply both edits when both are set.
   Do not save, inspect, or triage the raw response. If the gate exits non-zero, treat the API as unavailable and stop. The gate removes expired and malformed deadlines deterministically. Its `gate.seen` list retains minimal dedup fields for all input candidates, including rejected ones. Use these real capabilities, not aspirational ones:
   ```json
   {
     "capabilities": ["code", "security-research", "research", "writing", "dependency-analysis"],
     "canDoRealWorld": false,
     "minReward": 20,
     "limit": 25
   }
   ```
   `canDoRealWorld: false` — this agent has no wallet/payment rails configured, so exclude bounties requiring on-chain execution or payment. Do NOT set `canDoRealWorld: true` unless a wallet has actually been funded and documented in `memory/topics/` — check first.
3. Triage the gate output the same way as any other discovery skill - **be honest, not generous**:
   - Drop anything that's really a content/social-growth task in disguise (tweet threads, engagement farming, influencer voice-cloning, "get a streamer/creator to post X" outreach). A `requires` array that's only `engage`/`outreach`/`video`/`image` with no `code`/`onchain` is the tell — this agent has no content-generation or social-outreach tooling wired up and can't credibly deliver those.
   - Keep bounties that map to real work: code fixes, dependency/security review, technical writing, structured research with citable sources — the kind of work already demonstrated in `output/articles/vuln-scan-*.md`.
   - For each kept candidate, sanity-check the reward is real (not vaporware) and that a remaining deadline is reachable.
4. **Flag audit-shaped candidates.** For each candidate that survives step 3, check whether it's actually a code-security audit: `requires` includes `code` or `onchain`, **and** the bounty's `body`/`url` contains a GitHub repo link (`github\.com/[\w.-]+/[\w.-]+`). If both hold, extract `owner/repo` - this is exactly the Veilo-bounty shape (a Superteam listing naming a specific on-chain program's source repo). Not every kept candidate will have one; most won't.
5. Diff against `memory/topics/hunter-22-seen.json` - only report bounties not already seen in the last 14 days.
6. Update `memory/topics/hunter-22-seen.json`: append `{id, title, reward, seen_at}` from every entry in `gate.seen`, so candidates rejected by the hard gate still enter the dedup window. Prune entries older than 30 days.
7. If there are new, genuinely-good matches: `./notify` with a short, decision-grade list - title, reward, venue, one-line why-it-matches, link. Lead with the count and the best one. For any match flagged audit-shaped in step 4, add an inline button so the operator can dispatch the audit in one tap:
   ```bash
   ./notify -f /tmp/hunter22-notify.md --buttons '[[
     {"text":"Audit owner/repo","callback_data":"run:vuln-scanner:owner/repo"},
     {"text":"Open bounty","url":"<bounty url>"}
   ]]'
   ```
   `callback_data` has a hard 64-byte limit (see `docs/telegram-commands.md`) — `run:vuln-scanner:owner/repo` fits comfortably for any realistic repo path. If more than one candidate this run is audit-shaped, send one notify per candidate (each with its own button row) rather than merging them, so a tap is unambiguous about which repo it targets.
   If nothing new or nothing real survived triage, do **not** notify (see CLAUDE.md: "notify only on signal").
8. Commit `memory/topics/hunter-22-seen.json` with an updated `timestamp:`.

## Guardrails

- Never call a paid (`$`) endpoint. Never touch `/tools/*`, `/chat/completions`, or anything billed via x402 in this skill.
- Never claim or submit a bounty on the operator's behalf - this skill only surfaces candidates, and the audit-dispatch button in step 7 still requires a human tap, not an automatic trigger.
- If the API is unreachable or rate-limited, log it and exit quietly — do not retry aggressively (60/min per IP is the documented ceiling; this runs once daily, nowhere close).
