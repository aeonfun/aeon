`token-report` aborted silently — seventh consecutive skip. No article written, no notification sent.

Condition: `memory/MEMORY.md` "Tracked Tokens" has BTC/ETH/SOL via CoinGecko IDs only. The skill requires a Base-chain contract address (`Contract | Chain` columns). `var` is empty. Per skill spec: no tracked token + empty var = silent exit.

To activate: add a row to MEMORY.md under `## Tracked Token` (singular) with format `| TOKEN | 0x... | base |`.
