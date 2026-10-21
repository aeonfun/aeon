#!/usr/bin/env python3
"""Decode onchain-monitor 24h window with correct ERC-20 vs ERC-721 handling."""
import json, subprocess, statistics

TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

raw = subprocess.run(
    ["python3", "-I", "output/scan.py", "52847202", "52890402"],
    capture_output=True, text=True, check=True).stdout
d = json.loads(raw)

DEUS = "0x940a319b75861014a220d9c6c144d108552b089b"
XDEUS = "0xe6d5f7439bc236c40054e2275f765f59343d4431"
ESCROW = "0xa85a38796b951ce87b378538b32b3e6ee3c4c373"
PRICE_DEUS = 0.01788122
ERC721 = {XDEUS}

# escrow events from scan are ERC-20 shaped; re-tag NFT ones
esc = d["watches"]["DEUS escrow"]["events"]
nft = d["watches"]["xDEUS"]["events"]

deus_ev = [e for e in esc if e["token"] == DEUS]
nft_via_escrow = [e for e in esc if e["token"] == XDEUS]

print(f"window {d['range'][0]} → {d['range'][1]}  (24h on Base)")
print(f"DEUS price ${PRICE_DEUS}")
print()
print(f"=== DEUS ERC-20 transfers touching escrow: {len(deus_ev)}")
tot_in = tot_out = 0.0
for e in sorted(deus_ev, key=lambda x: x["block"]):
    usd = e["amount"] * PRICE_DEUS
    if e["direction"] == "in":
        tot_in += e["amount"]
    else:
        tot_out += e["amount"]
    print(f"  {e['direction']:>3} {e['amount']:>14,.2f} DEUS  ${usd:>10,.0f}  "
          f"{e['counterparty'][:10]}  tx {e['tx'][:14]}  blk {e['block']}")
print(f"  DEUS in  = {tot_in:,.2f}  (${tot_in*PRICE_DEUS:,.0f})")
print(f"  DEUS out = {tot_out:,.2f}  (${tot_out*PRICE_DEUS:,.0f})")
print(f"  net      = {tot_in-tot_out:+,.2f} DEUS (${(tot_in-tot_out)*PRICE_DEUS:+,.0f})")
print()

print(f"=== xDEUS NFT (ERC-721) transfers emitted by xDEUS contract: {len(nft)}")
from collections import Counter
print("  kinds:", dict(Counter(e["direction"] for e in nft)))
print(f"=== xDEUS NFT transfers where escrow is party: {len(nft_via_escrow)}")
print("  dirs:", dict(Counter(e["direction"] for e in nft_via_escrow)))

mints = [e for e in nft if e["direction"] == "mint"]
burns = [e for e in nft if e["direction"] == "burn"]
print()
print(f"mints (new xDEUS positions): {len(mints)}")
for e in mints:
    print(f"  → {e['to'][:14]}  tx {e['tx'][:14]}  blk {e['block']}")
print(f"burns (unstake/exit): {len(burns)}")
for e in burns:
    print(f"  ← {e['from'][:14]}  tx {e['tx'][:14]}  blk {e['block']}")

print()
print("=== event USD sizes (DEUS only, for median):")
sizes = [e["amount"] * PRICE_DEUS for e in deus_ev if e["amount"] * PRICE_DEUS > 0.10]
if len(sizes) >= 5:
    print(f"  n={len(sizes)} median=${statistics.median(sizes):,.0f} max=${max(sizes):,.0f}")
