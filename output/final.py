#!/usr/bin/env python3
"""Final consolidated 24h decode for onchain-monitor: fixed counterparties + labels."""
import json, subprocess, statistics

TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
DEUS = "0x940a319b75861014a220d9c6c144d108552b089b"
XDEUS = "0xe6d5f7439bc236c40054e2275f765f59343d4431"
ESCROW = "0xa85a38796b951ce87b378538b32b3e6ee3c4c373"
PRICE = 0.01788122
ZERO = "0x" + "0" * 40

LABELS = {
    ZERO: "Zero (mint/burn)",
    DEUS: "DEUS 代币",
    XDEUS: "xDEUS 合约",
    ESCROW: "DEUS escrow",
}


def lbl(a):
    a = a.lower()
    return LABELS.get(a, a[:6] + "…" + a[-4:])


d = json.loads(subprocess.run(
    ["python3", "-I", "output/scan.py", "52847202", "52890402"],
    capture_output=True, text=True, check=True).stdout)

esc = [e for e in d["watches"]["DEUS escrow"]["events"] if e["token"] == DEUS]
nft = d["watches"]["xDEUS"]["events"]

rows = []
for e in esc:
    cp = e["from"] if e["direction"] == "in" else e["to"]
    e["cp"] = cp
    e["usd"] = e["amount"] * PRICE
    rows.append(e)
rows.sort(key=lambda x: x["block"])

print("### DEUS ERC-20 touching escrow (24h)")
tin = tout = 0.0
for e in rows:
    if e["direction"] == "in":
        tin += e["amount"]
    else:
        tout += e["amount"]
    if e["amount"] > 0:
        print(f"  {e['direction']:>3} {e['amount']:>13,.2f} DEUS ${e['usd']:>7,.0f}  "
              f"{lbl(e['cp']):<22} tx {e['tx'][:10]}… blk {e['block']}")
print(f"  TOTAL in {tin:,.2f} (${tin*PRICE:,.0f}) | out {tout:,.2f} (${tout*PRICE:,.0f}) | net {tin-tout:+,.2f} (${(tin-tout)*PRICE:+,.0f})")

print("\n### xDEUS ERC-721 (24h)")
for e in sorted(nft, key=lambda x: x["block"]):
    if e["direction"] == "mint":
        print(f"  MINT → {lbl(e['to'])}  tx {e['tx'][:10]}… blk {e['block']}")
    elif e["direction"] == "burn":
        print(f"  BURN ← {lbl(e['from'])}  tx {e['tx'][:10]}… blk {e['block']}")
print(f"  moves={sum(1 for e in nft if e['direction']=='move')} "
      f"mints={sum(1 for e in nft if e['direction']=='mint')} "
      f"burns={sum(1 for e in nft if e['direction']=='burn')}")

burn_deus = sum(e["amount"] for e in rows if e["direction"] == "out")
print(f"\nescrow DEUS balance now 29,362,657.94")
print(f"unstake outflow 24h = {burn_deus:,.2f} DEUS = {burn_deus/29362657.94*100:.4f}% of escrow")
print(f"net flow 24h        = {(tin-tout)/29362657.94*100:+.4f}% of escrow  (trigger: >5% outflow)")

sizes = [e["usd"] for e in rows if e["usd"] and e["usd"] > 0.10]
print(f"\nUSD event sizes n={len(sizes)} median=${statistics.median(sizes):,.0f} max=${max(sizes):,.0f}")
print(f"escrow threshold_usd=500 → survivors: {[round(s) for s in sizes if s>=500]}")
