Skill aborted per spec. The token-report skill expects a `## Tracked Token` section in MEMORY.md with `Contract` and `Chain` columns (e.g. an AEON token on Base). The current MEMORY.md has `## Tracked Tokens` with BTC/ETH/SOL via CoinGecko IDs — that format is for a different skill.

To activate token-report, either:
1. Add a section to MEMORY.md: `## Tracked Token` with `| Token | Contract | Chain |` and a Base chain contract address.
2. Pass a contract address via `var:` in the workflow dispatch.
