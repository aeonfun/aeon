---
name: Hardware analysis revisit at $5M AUM
description: When fund AUM crosses $5M, re-run §2 of the Naval-thesis hardware analysis (build-vs-rent math, peer-fund silicon scan, inference $/Mtok curve)
type: project
originSessionId: d37891a9-a95b-408b-b17c-bc8bcfec1ad3
---
When fund AUM crosses $5M, re-run §2 of `~/.claude/plans/how-does-this-change-precious-twilight.md`. Specifically: rebenchmark inference $/Mtok against current providers (NVIDIA / TPU / Trainium / Groq / Cerebras / Etched / Tenstorrent), scan peer funds at $5M–$50M AUM for any custom silicon investment, recompute build-vs-rent threshold against current annual LLM spend (today: $50/mo per-agent cap, ADR-057 + ADR-058), and check whether Hyperliquid co-location has become possible (still an L1 chain as of 2026-04-30 — colo doesn't help while consensus matching persists).

**Why:** Founder explicitly chose AUM-trigger over time-trigger to avoid wasting cycles re-checking quarterly while NAV is sub-$1M (NAV was $65 unified on 2026-04-29). The original plan §2C concluded "self-host arrives at 2027–28 if at $5M+/yr inference spend" — $5M AUM is the rough threshold where that math starts to shift, well below the $100M+ threshold where it actually flips.

**How to apply:** Surface this when (a) the user reports AUM crossing $5M, (b) the user discusses hardware / colo / silicon / FPGA investments, (c) a fundraise is imminent that would push AUM past the threshold, or (d) the user asks about long-term compute strategy or inference cost. Do NOT surface on routine LLM/cost discussions while AUM remains below $5M — the answer at sub-$5M AUM is fixed: rent compute, no silicon.
