---
name: Schema-extension commits should be end-to-end, not layered
description: When adding a new field to an event/log/row schema, ship field + write path + aggregate + verification + one mocked test in a single commit before touching consumers — catches null-default and missing-key bugs while the fix is tiny
type: feedback
originSessionId: 4f921160-aa7e-467c-9307-6a6401ab65ac
---
**Rule:** For schema-extension changes (e.g. adding `agent_id` to `CostEvent`, adding a new column to a trade record), bundle the following into one commit before building any consumer (API endpoint, UI tab, allocator lookup):
1. The field on the dataclass / row type with a safe default
2. Every write path that produces these rows (log helpers, signal recorders, adapter instrumentation)
3. The aggregate/summarize layer that buckets by the new field
4. One verification run (dry-run of the main loop, or a scripted producer) showing real rows land with the new field populated
5. One mocked test asserting default behavior + non-default behavior

**Why:** Landed 2026-04-21 during Stage 1 of the 250-agent swarm build. Shipping `agent_id` plumbing in one commit (costs.py + scanner + HL adapter + CalibrationGap + API endpoint + tests) meant the dry-run immediately proved 5 variant agents each produced distinct-`agent_id` rows. Any null-default or missed call site would have shown up as a blank column in the rollup, fixable in the same context without mental reload. Splitting would have produced a 2-hour "why is by_agent empty?" hunt a day later.

**How to apply:** Before writing any code on a schema change, list the write sites (grep for the event type) and consumer sites. Put every write site in the first commit. Put consumers in subsequent commits only once the rollup is proven to contain the field at scale.
