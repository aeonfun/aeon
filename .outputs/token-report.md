No tracked token is configured in `memory/MEMORY.md` (no `## Tracked Token` table) and no contract address was passed via `var`. The skill spec requires a silent abort in this case — no article, no notification.

## Summary

- Ran `skills/token-report/SKILL.md` for 2026-04-25.
- Found no `Tracked Token` in `MEMORY.md`; `${var}` is empty.
- Aborted silently per skill spec — no article written, no notification sent.
- Logged the abort in `memory/logs/2026-04-25.md`.

To activate this skill, add a `## Tracked Token` section to `memory/MEMORY.md` with the token contract address and chain, or pass the contract address as `var` when dispatching.
