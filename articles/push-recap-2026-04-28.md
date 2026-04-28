# Push Recap — 2026-04-28

## Verdict
> SHIPPING — public status page now renders a daily Token Pulse table

**Shape:** 1 user-visible commit · 0 internal · 0 infra · 0 bot-filtered
**Volume:** 2 files changed, +31/-3 lines across 1 commit by 1 author
**Merged PRs:** 1 (#146 feat(heartbeat): add Token Pulse section to public status page)

---

## aaronjmars/aeon

### Token Pulse on the public status page (PR #146)

**What this is:** The public `/status/` GitHub Pages dashboard now carries a per-token row (price, 24h, liquidity, 24h volume, FDV) lifted from the most recent `articles/token-report-*.md`. Every fork inherits the new section automatically — no extra config, no new API calls, no new secrets. The plumbing lives entirely in the existing heartbeat run that already auto-commits `docs/status.md`.

**Shipped to users**
- `4782c4a` — feat(heartbeat): add Token Pulse section to public status page (#146)
  - `docs/status.md`: new `## Token pulse` heading is seeded with a placeholder table, the page intro now advertises "a daily pulse on the tracked token," and the data-sources footer adds `articles/token-report-*.md` to its list (+6/−2).
  - `skills/heartbeat/SKILL.md`: the rendered status template gains a populated Token Pulse table (today's seed shows AEON $0.0000032626 / −11.16% / $223.4K liq / $41.3K vol / $326.3K FDV with verdict `SLIDING`), and a new `Token pulse rules` block defines: pick latest `token-report-*.md` by filename date; render a stale-data fallback if the file is >24h old; omit the section entirely when no report exists; pull the symbol from MEMORY.md's Tracked Token table; tolerant regex for both the legacy `Value | 24h Change` layout and the new `Now | 24h Δ` layout; render `—` for any field whose row or `$` value cannot be located; append `· verdict: LABEL` only when the source article carries a `**Verdict:**` line. The "never expose values from .env or secrets" line is widened to include token-report files in the allowed-public set (+25/−1).

---

## Developer notes
- **New dependencies:** none.
- **Breaking changes:** none. Status page renders cleanly when no `articles/token-report-*.md` exists (section is omitted entirely); old reports using `Value | 24h Change` layout still extract correctly.
- **New public surface:** `## Token pulse` heading on `https://<owner>.github.io/aeon/status/` (and every fork's equivalent). New skill-spec contract: heartbeat now reads `articles/token-report-*.md` and `memory/MEMORY.md`'s "Tracked Token" table.
- **Tech debt added:** none. Regex extraction is the only bit that could rot if `token-report` changes table layout again — the spec already names both layouts it tolerates.

## Open threads
- Today's status.md still carries the placeholder _"Populated on the first heartbeat run after a `token-report` article exists"_ — the next heartbeat run is expected to overwrite it with the populated table that the skill spec demonstrates. Worth a confirmation glance after the 14:00 / 20:00 UTC heartbeats land.
- Spec says the symbol column reads from MEMORY.md "Tracked Token" (singular). The current MEMORY.md section is plural ("Tracked Tokens") with three rows (BTC / ETH / SOL via CoinGecko IDs). If heartbeat lifts row 1, the public page will say BTC even though the seeded example uses an `AEON` token contract — first heartbeat that runs the new template will resolve which way this lands.
- No other branches pushed in the window beyond `main`.

## Sources
- aaronjmars/aeon: ok
- gh api events: ok (events returned with empty `commits` arrays — events API truncated push payloads; commits API used as primary source instead)
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 0
- diff-truncated: 0
