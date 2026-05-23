#!/usr/bin/env python3
import json

with open(".outputs/_tc-markets.json") as f:
    markets = json.load(f)
with open(".outputs/_tc-trending-syms.json") as f:
    trending = set(json.load(f))
with open(".outputs/_tc-dedup.json") as f:
    dedup = set(json.load(f))

# BTC + ETH 7d from markets
btc7d = next(c["price_change_percentage_7d_in_currency"] for c in markets if c["symbol"].upper() == "BTC")
eth7d = next(c["price_change_percentage_7d_in_currency"] for c in markets if c["symbol"].upper() == "ETH")

def score(t):
    p24 = t.get("price_change_percentage_24h_in_currency") or 0
    p7d = t.get("price_change_percentage_7d_in_currency") or 0
    vol = t.get("total_volume") or 0
    mcap = t.get("market_cap") or 1
    vm = vol / mcap if mcap else 0
    sym = (t.get("symbol") or "").upper()
    s = 0
    if p24 > 0: s += 1
    if p7d > 0: s += 1
    if p24 > 5 and p7d > 5: s += 2
    if sym in trending: s += 2
    if vm >= 0.20: s += 3
    elif vm >= 0.10: s += 2
    if p7d > btc7d and p7d > eth7d and p7d > 0: s += 2
    return s, vm

results = []
for t in markets:
    sym = (t.get("symbol") or "").upper()
    mcap = t.get("market_cap") or 0
    if mcap < 20_000_000:
        continue
    if sym in dedup:
        continue
    s, vm = score(t)
    results.append({
        "symbol": sym,
        "name": t.get("name"),
        "price": t.get("current_price"),
        "mcap": mcap,
        "vol": t.get("total_volume"),
        "vm": vm,
        "p24": t.get("price_change_percentage_24h_in_currency"),
        "p7d": t.get("price_change_percentage_7d_in_currency"),
        "trending": sym in trending,
        "score": s,
    })

results.sort(key=lambda r: (-r["score"], -r["vm"]))

print(f"BTC 7d: {btc7d:.2f}%, ETH 7d: {eth7d:.2f}%")
print(f"Universe: {len(results)} (after mcap and dedup filters)")
print()
print(f"{'rk':>3} {'sym':<10} {'sc':>3} {'price':>12} {'24h%':>7} {'7d%':>7} {'mcap':>10} {'vol':>10} {'v/m':>5} {'tr':>3}  name")
for i, r in enumerate(results[:25]):
    print(f"{i+1:>3} {r['symbol']:<10} {r['score']:>3} {r['price']:>12.4g} {r['p24']:>7.2f} {r['p7d']:>7.2f} {r['mcap']/1e6:>9.1f}m {r['vol']/1e6:>9.1f}m {r['vm']:>5.2f} {'Y' if r['trending'] else 'n':>3}  {r['name']}")
