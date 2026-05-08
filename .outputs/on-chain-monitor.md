Logged the no-config exit per spec.

## Summary

- Ran `on-chain-monitor` for 2026-05-08 (var empty). `memory/on-chain-watches.yml` is present but `watches: []` and `protocols: []`, so per skill spec the skill exits cleanly with `ON_CHAIN_NO_CONFIG` — no fetch, no notify (empty config is not an error).
- No external API calls (Alchemy / Etherscan v2 / CoinGecko), no state file created (`memory/on-chain-state.json` does not exist and was not written, since no watch fetch succeeded), no notification sent.
- Files modified: `memory/logs/2026-05-08.md` (appended an `### on-chain-monitor` entry + summary).
- Follow-up: operator action — populate `memory/on-chain-watches.yml` with at least one `{label, address, chain, type}` entry to activate the skill. Already tracked under MEMORY.md `## Next Priorities` → "Operator config sweep (BLOCKED)".
