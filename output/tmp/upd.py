import json, time

p = "memory/topics/price-alert-state.json"
s = json.load(open(p))
NOW = "2026-10-24T06:12:00Z"

s["last_run_at"] = NOW
s["last_price"] = {
    "price_usd": 0.0179,
    "h1_pct": None,
    "h6_pct": None,
    "h24_pct": 4.01,
    "pool": "aerodrome Slipstream DEUS/VIRTUAL",
    "pool_address": "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa",
    "liquidity_usd": 687124.22,
    "volume_24h_usd": 21997.46,
    "volume_1h_usd": 0.0,
    "txns_1h": "0 buy / 0 sell - MEASURED dead tape",
    "pool_url": "https://dexscreener.com/base/0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa",
    "observed_at": NOW,
    "h1_source": "onchain-verified-absent",
    "h1_note": "DexScreener omitted priceChange.h1 AGAIN (null) on all 5 base pairs except the shallow aero pool (+0.22%, liq $10.7k). GeckoTerminal pool endpoint returned h1=0 with volume1h=0.0 and 0 buys / 0 sells. eth_getLogs over the deepest pool for the last 2456 blocks (~82 min) returned ZERO Swap logs - and a CONTROL window (blocks 0x328ce0-0x328cff, the known 00:24Z dump) returned 9 swaps with the identical topic filter, so the zero is REAL, not a bad filter. LAST SWAP was block 53013718 / 2026-10-24T04:39:43Z (tx 0x7b71081f, $0.0093 dust sell). Tape is dead for 84 minutes at run time. h1 is therefore UNMEASURED, stored as null - NOT zero, NOT flat. All three secondary DEUS pools (0x58dBa34e, 0x1B2f3f5C, 0x75bc1495) also returned 0 swaps in the same 83-minute window, so this is a whole-market pause in DEUS trading, not a migration of flow to another venue.",
    "mark_source": "pool reserves",
    "mark_note": "Canonical mark from the deepest pool's own reserves, NOT the stale API print: DEUS 18,855,811.8533 / VIRTUAL 528,123.8274 = 0.02800854 VIRTUAL per DEUS; VIRTUAL $0.6454 (deepest VIRTUAL/WETH pool 0x21594b99, liq $3.34M) => DEUS = $0.017900. DexScreener's $0.01809 print is the last trade price from 04:39Z and is stale by 84 min. Constant-product k checks out (9.9582e12 both sides), so no rebase/fee-on-transfer distortion.",
}

s["escrow_snapshot"] = {
    "balance_deus": 29108661.675,
    "prior_balance_deus": 29418223.901,
    "change_deus": -309562.226,
    "change_pct": -1.052,
    "five_pct_line_deus": 1455433.08,
    "observed_at": NOW,
    "note": "The -309,562 DEUS is the xDEUS NFT #1492 unlock already documented under unstake_and_dump (23:09:15Z), NOT a new event. It is 1.05% of escrow, still ~4.7x below the 5%/day (~1.46M DEUS) unstake-pressure intel trigger. No new escrow Burn in the 82-minute window (both scan windows returned 0, control window around block 0x328c61b returned 1, so the filter is valid).",
}

s["claim_snapshot"] = {
    "balance_deus": 340083349.32,
    "prior_balance_deus": 340146039.82272434,
    "change_deus": -62690.50,
    "observed_at": NOW,
    "note": "CLAIM vault dripped -62,690 DEUS since the 2026-10-23T21:24Z snapshot (~8.7h), i.e. ~173k/day pace, in line with the 283k-350k/day 30d band. Routine emission, no regime change.",
}

s["xdeus_supply"] = {
    "total_supply": 1727,
    "prior": 1727,
    "change_24h": 0,
    "observed_at": NOW,
    "note": "Unchanged since the last run (1727). Staking side is flat, not bleeding - do not describe the #1492 exit as an exodus.",
}

s["deus_total_supply"] = {
    "total_supply": 876190001.50,
    "prior": 876206780.447562,
    "change": -16778.95,
    "observed_at": NOW,
    "note": "Slightly DOWN vs the last run, but a single-window totalSupply read is NOT a deflation signal - the 7d ledger is still net +65,380. See notes.",
}

s["post_dump_absorption"] = {
    "what": "THE HEADLINE FINDING: the 319,562 DEUS record dump at 00:24:17Z was NOT absorbed by the same-block bids alone - it was fully reversed within 2 hours by two REAL new-money buyers, and the pool mark is now HIGHER than before the dump.",
    "mark_pre_dump": 0.02769675352846641,
    "mark_now": 0.028008543546618584,
    "mark_change_pct": 1.126,
    "pool_deus_pre_dump": 18961647.3772,
    "pool_deus_now": 18855811.8533,
    "net_deus": -105835.52,
    "buyers": [
        {
            "addr": "0x7f6aba7563cb5d31980d440337d3d1a6e3db58f3",
            "type": "plain EOA, nonce 861",
            "bought_deus": 335249.4994,
            "final_balance_deus": 335249.4994,
            "history": "balanceOf EXACTLY 0 at -24h, -48h and -7d",
            "verdict": "REAL NEW MONEY, HELD. Passes tell #8 (all lookbacks zero) and tell #6 (terminal recipient keeps the balance)."
        },
        {
            "addr": "0x6a45ca8bb30f396f40721e105e0aa6cabf326657",
            "type": "plain EOA, nonce 615",
            "bought_deus": 70034.1403,
            "final_balance_deus": 70034.1403,
            "history": "0 at -24h and -48h; 29,079 at -7d",
            "verdict": "REAL BUY, HELD. An incumbent that fully exited and is now REBUYING at size - tell #7 applies, but the net position is a genuine 70k long."
        }
    ],
    "routing_note": "Both buyers reached the pool through a CONTRACT sink 0x939e398d2c31b0757d009222de99c6e461d3de15, not directly. Downstream chain: pool -> sink (451,627 DEUS over 17 transfers) -> LiFi diamond 0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae (405,284) -> back OUT to the same two EOAs (335,249 + 70,034). Total in == total out == 451,627.3741 exactly; both sink and diamond end at 0.0000. This is an aggregator/relay round-trip that RETURNS the tokens to the payer, so it is NOT a pass-through filling someone else's order (tell #6 does not apply) and NOT a wash (the EOAs' balances went from 0 to 335k/70k). Judge it by the EOA balances, not the router.",
    "significance": "This INVERTS the 2026-10-23 reading. Last run concluded '$2.8k notional per 1% of depth' and framed the record unstake as a large but survivable supply event. The follow-through now shows the opposite of distribution: 319,562 DEUS left a staker's hands and 405,283 DEUS were bought and HELD by two wallets with no prior position (one of them brand new on every lookback). Net effect on the pool is -105,836 DEUS, i.e. the pool is now TIGHTER than before the dump.",
    "observed_at": NOW,
}

json.dump(s, open(p, "w"), indent=2, ensure_ascii=False)
print("wrote", p)
