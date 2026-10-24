import json, shutil, datetime

P = "/home/runner/work/aeon-token/aeon-token/memory/topics/price-alert-state.json"
shutil.copy(P, P + ".bak")
st = json.load(open(P))

NOW = "2026-10-24T07:05:00Z"

st["last_run_at"] = NOW
st["last_price"] = {
    "price_usd": 0.017931,
    "h1_pct": None,
    "h6_pct": 1.45,
    "h24_pct": 4.04,
    "pool": "aerodrome Slipstream DEUS/VIRTUAL",
    "pool_address": "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa",
    "liquidity_usd": 682345.24,
    "volume_24h_usd": 28346.62,
    "volume_1h_usd": 0.0,
    "txns_1h": "0 buy / 0 sell - MEASURED dead tape",
    "pool_url": "https://dexscreener.com/base/0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa",
    "observed_at": NOW,
    "h1_source": "onchain-verified-absent",
    "h1_note": (
        "DexScreener omitted priceChange.h1 (null) on ALL FIVE base pairs again this run. "
        "eth_getLogs over the deepest pool for blocks 0x328ecd7-0x328fd78 (last 1000 blocks, ~33 min) "
        "returned ZERO Swap logs; a wider walk back to block 53010600 (~95 min) found exactly ONE swap, "
        "the block 0x328ecd6 / 2026-10-24T04:39:43Z tx 0x7b71081f $0.0093 dust sell. So the LAST TRADE is "
        "now 143 minutes old at run time (07:02Z). CONTROL window 0x328cec0-0x328cef0 (the known 00:24Z dump) "
        "returned 9 swaps with the identical topic filter - the zero is REAL, not a bad filter. "
        "ALL THREE secondary DEUS pools (0x58dBa34e, 0x1B2f3f5C, 0x75bc1495) also returned 0 swaps in the "
        "same 33-minute window, so this is a whole-market pause in DEUS trading, not flow migrating venues. "
        "h1 is UNMEASURED, stored as null - NOT zero, NOT flat."
    ),
    "mark_source": "pool reserves",
    "mark_note": (
        "Canonical DEUS/VIRTUAL ratio from the deepest pool's own reserves: DEUS 18,855,811.85328747 / "
        "VIRTUAL 528,123.8273770272 = 0.028008543545418863 VIRTUAL per DEUS. This is BYTE-IDENTICAL to the "
        "06:12Z snapshot - no swap, no reserve change in 53 minutes. Constant-product k checks out. "
        "VIRTUAL->USD leg: the deepest VIRTUAL/WETH pool 0x21594b99 (aerodrome, liq $3.34M) holds "
        "2,586,540.29 VIRTUAL / 701.2515 WETH = 3,688.46 VIRTUAL per WETH; at WETH $2,379.18 (deepest Base "
        "WETH/USDC uniswap, liq $156M) that is VIRTUAL $0.6450. BUT that pool printed v1h=0 and 0 trades, so "
        "its ratio is stale. The ACTIVELY trading VIRTUAL pools (aero 0x792f465e v1h $30,270; uniswap "
        "v1h $8,475) all print VIRTUAL $0.6402-0.6404 with real volume, so the live leg is $0.6402. "
        "=> DEUS = 0.02800854 x 0.6402 = $0.017931. Honest band: $0.01789 (VIRTUAL 0.6389) to $0.01807 "
        "(VIRTUAL 0.6454). DexScreener's $0.01809 print is the 04:39Z last trade, stale by 143 min."
    ),
}

st["escrow_snapshot"] = {
    "balance_deus": 29108661.674663614,
    "prior_balance_deus": 29108661.675,
    "change_deus": -0.0003,
    "change_pct": -0.0,
    "five_pct_line_deus": 1455433.08,
    "observed_at": NOW,
    "note": (
        "UNCHANGED to the wei (delta is 3.4e-4, i.e. rounding). No unstake. Two 1000-block windows "
        "(53015977-53016976 and 53016977-53017976) returned 0 escrow Burn events (topic0 0xe08737ac). "
        "The xDEUS NFT #1396 held by record-unsaker 0xbb0f7533 is STILL UNSTAKED this run "
        "(tokenOfOwnerByIndex(owner,0) = 1396) - the trigger for the next dump has NOT fired."
    ),
}

st["claim_snapshot"] = {
    "balance_deus": 340082386.3812717,
    "prior_balance_deus": 340083349.32,
    "change_deus": -962.94,
    "observed_at": NOW,
    "note": (
        "Only -963 DEUS in ~53 min. NOTE: this is a much SLOWER pace than the prior run's ~173k/day "
        "reading, but a single short window cannot establish a regime change in the drip - the 30d band "
        "is 283k-350k/day. Do not call this a slowdown off 53 minutes."
    ),
}

st["xdeus_supply"] = {
    "total_supply": 1727,
    "prior": 1727,
    "change_24h": 0,
    "observed_at": NOW,
    "note": "Unchanged at 1727. Staking side flat. No new mint, no new burn.",
}

st["deus_total_supply"] = {
    "total_supply": 876190001.500193,
    "prior": 876190001.5,
    "change": 0.000193,
    "observed_at": NOW,
    "note": "Unchanged (delta 1.9e-4). Single-window totalSupply is NOT a deflation signal - 7d ledger is net +65,380.",
}

st["holder_check"] = {
    "observed_at": NOW,
    "note": (
        "Both new-money buyers from the 2026-10-24 05-06Z discovery STILL HOLD their full positions, "
        "unchanged to the wei: 0x7f6aba75 = 335,249.4994426125 (was 335,249.4994); "
        "0x6a45ca8b = 70,034.14033726917 (was 70,034.1403). Neither has sold into the dead tape. "
        "Record unsaker 0xbb0f7533 DEUS balance = 0.000000 exactly, still holding xDEUS #1396."
    ),
    "buyers": [
        {"addr": "0x7f6aba7563cb5d31980d440337d3d1a6e3db58f3", "balance_deus": 335249.4994426125, "status": "HELD"},
        {"addr": "0x6a45ca8bb30f396f40721e105e0aa6cabf326657", "balance_deus": 70034.14033726917, "status": "HELD"},
    ],
    "pending_unstake": {
        "wallet": "0xbb0f753321e2b5fd29bd1d14b532f5b54959ae63",
        "xdeus_nft_id": 1396,
        "status": "NOT YET BURNED - trigger has not fired",
    },
}

st["notes"] = st["notes"] + (
    " TELL 15 (NEW, 2026-10-24 07:05Z run): A DEAD TAPE SURVIVING A SECOND CONSECUTIVE RUN IS ITSELF "
    "INFORMATION, BUT ONLY AS AN ABSENCE - and it must be re-verified every time, not inherited. This run "
    "re-confirmed the 06:12Z finding independently: 143 minutes with zero swaps across all four DEUS pools, "
    "byte-identical pool reserves, and a control window returning 9 swaps. The read is that the post-dump "
    "buyers are NOT distributing into strength and the record unsaker is NOT continuing to unwind - both "
    "sides have simply stopped. Do NOT translate 'no trades' into 'price is stable': the mark is stale, not "
    "tested. Also: when converting DEUS->USD through a VIRTUAL leg, take VIRTUAL from the pool that is "
    "ACTUALLY TRADING, not the deepest one - here the deepest VIRTUAL/WETH pool (liq $3.34M) had v1h=0 and a "
    "stale ratio ($0.6450) while the live pools printed $0.6402, a 0.8% swing on the final USD number. "
    "Liquidity depth != freshness. Both still inside the same band, so no gate moved."
)

json.dump(st, open(P, "w"), indent=2, ensure_ascii=False)
print("written")
