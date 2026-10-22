import fs from "node:fs";
const p = "memory/logs/2026-10-22.md";
const entry = `
### onchain-monitor (21:00Z)
- Run: 2026-10-22T21:05:00Z UTC | var: (none) | all 5 watches | window = per-watch \`last_block\`+1
- Sources: alchemy=skipped (key unset) | etherscan=skipped (key unset) | coingecko=skipped (key unset, USD from DexScreener) | base=base.gateway.tenderly.co ok (22 calls, 0 retries) | robinhood=rpc.mainnet.chain.robinhood.com ok (18 calls/job, 0 retries)
- **Provider regression found and worked around**: \`$BASE_RPC_URL\` / \`$RH_RPC_URL\` now resolve to Infura free tier and reject \`eth_getLogs\` above a **10-block range** ("Free tier ... up to a 10 block range"). A windowed scan against them halves forever and stalls. \`memory/rpc.sh\` inherits the same env and would hit it too. Public endpoints (Tenderly Base 1,000-blk cap, RH public 24k) worked with zero retries.
- Base: 52935166 → 52956772 (21,607 blocks ≈ 11.5h) · Robinhood: 94992965 → 95407836 (414,872 blocks ≈ 11.8h)
- Result: ON_CHAIN_OK (n_watches=5, n_raw=6,129, n_kept=6) — notified CRITICAL
- **Watch: DEUS escrow (base)** — 3 in = 3,195.317 DEUS / **ZERO out**. Balance 29,403,096.571 → 29,406,291.888 (+3,195.317, byte-consistent). All three inflows are stake-ins that minted xDEUS in the same tx. Unstake 0.000% vs 5%/day trigger 1,470,315 → no escalation. Escrow share 3.357% of 876,234,926.
- **Watch: xDEUS (base)** — 3 mints (2471→0xcc97bef8, 2472→0xba0bd0c9, 2473→0x718d16fe), **0 burns**, 2 moves into escrow (2435, 69). totalSupply 1,721 → 1,724; escrow 59 → 61. Pure accumulation, no cooldown started.
- **Watch: NOTE timelock** — 0 raw. FULL unfiltered scan: ZERO events of ANY topic. 1.2M schedule (opId 0x77a7b0d6…6974da) still no Cancelled / no Executed → executable **2026-10-23T09:57:36Z, ~13h out**; getMinDelay re-confirmed 172,800s; balance 15,254,442.02 unchanged.
- **Watch: NOTE owner EOA | 1 in / 2 out — OWNER WOKE UP (nonce 365 → 368, first action since 10-21T11:09Z)**
- Event: OUT 100,000 NOTE → \`0x3ace8e0a\` 18:09:12Z blk 95308399 — tx 0x01cbf451…a9c6 — recipient **nonce 0, ETH 0.055798, ZERO outgoing, still holds 100,000**
- Event: IN **+401,682.037 NOTE** from vesting 0xfdd9 18:33:25Z blk 95322436 — tx 0x1ce12022…6420 — selector \`0x20c5429b\` arg **25** = owner self-claiming **schedule 25, the 600k**
- Event: OUT 50,000 NOTE → \`0xe4bf6f7e\` 18:51:42Z blk 95332921 — tx 0x230c5b40…0e07 — recipient **nonce 0, ETH 0.010764, ZERO outgoing, still holds 50,000**
- Balance reconciliation: 120,000 − 100,000 + 401,682.037 − 50,000 = **371,682.037** exact. ETH 0.013980
- **Watch: NOTE vesting | 0 in / 3 out = 596,411.69 NOTE** — balance 1,978,879.584 → **1,382,467.892** (exact)
- Event: release 191,792.830 → 0x67f5b99e, scheduleId 18, 09:22:38Z (already reported at 14:35Z)
- Event: release 2,936.821 → 0xbd0719c4, scheduleId 8, 10:55:43Z, tx.from = beneficiary (normal claim)
- Event: release **401,682.037 → owner EOA**, scheduleId **25**, 18:33:25Z, tx.from = owner, selector 0x20c5429b
- **CORRECTION**: schedule 25's beneficiary is the **owner EOA itself** (not 0x2807de7a as prior notes claimed). \`eth_call owner()\` on 0xfdd9 = 0x0b64. The "600k one-block risk" has now **partially materialised** and proceeds are staged.
- NOTE 24h flow (blk 94992965→95407836): 3,980 Transfer, **1,192 sells / 885 buys**, in 4,773,249 / out 4,301,014 → **net +472,236 into pool (0.79% supply)** — third consecutive net-sell window. 0 mint / 0 burn, supply 60,000,000.
- Top net sellers: 0xfdd9 −596,412 (the vesting) · 0xb65814f3 −299,998 · 0xba0f2bac −242,095 (nonce 1, bal 0) · 0xb96d94e0 −150,000 (nonce 4, bal 0) · 0xd8b5dc95 −148,013 (nonce 521, still holds 250,000)
- Top net buyers: 0x384ea1fd +229,755 (contract) · 0x5431363c +186,788 (**nonce 0 EOA, ETH only 0.0020**) · 0xdde05da1 +171,335 · 0x3ace8e0a +100,000 (an armed wallet)
- Price: DEUS $0.01742 (1h +0.09%, 24h −5.49%, liq $673,571) — none of 0.012/0.025/0.032/0.041 hit
- Price: NOTE $0.04059 (1h −2.44%, 6h −5.10%, **24h −27.4%**, liq $402,288, vol24 $487,739) — 60.6% below the 10-03 high of $0.1030
- State: \`memory/on-chain-state.json\` rewritten atomically (5/5, last_block → 52956772 / 95407836, alerted_tx 3 owner + 3 vesting); \`JSON.parse\` → STATE_VALID
- Writes: \`memory/on-chain-state.json\`, \`memory/topics/tokens/note-systems.md\`, \`memory/MEMORY.md\`, \`memory/known-addresses.yml\`, \`output/onchain-alert-2026-10-22-21.md\`
- Notified: yes — \`./notify -f output/onchain-alert-2026-10-22-21.md --title "🔴 NOTE owner 拆 15 万进两个新钱包 · 13h 后 120 万解锁" --severity critical\` → queued f3f468ac
- Dedup: the 14:35Z entry covered the four independent 09:1x sellers and the schedule-18 release. This run's signal is new (owner's first action in 34h, the schedule-25 self-claim, and two armed wallets) — not a repeat.
`;
fs.appendFileSync(p, entry);
console.log("LOG_APPENDED");
