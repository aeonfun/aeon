import json

rows = json.load(open("output/tmp/flows.json"))
CUT = 1792818535  # 2026-10-24T05:08:55Z

after = [r for r in rows if r["ts"] > CUT]
print("swaps after 05:08:55Z:", len(after))
for r in after:
    print(" ", r["tx"], r["net_deus_into_pool"])

print()
print("--- window 00:24:17Z -> 02:11Z (post-dump absorption) ---")
lo, hi = 1792801457, 1792808000
win = [r for r in rows if lo <= r["ts"] <= hi]
sold = sum(r["net_deus_into_pool"] for r in win if r["net_deus_into_pool"] > 0)
bought = -sum(r["net_deus_into_pool"] for r in win if r["net_deus_into_pool"] < 0)
print(f"DEUS sold into pool : {sold:,.2f}")
print(f"DEUS bought out     : {bought:,.2f}")
print(f"net                 : {sold-bought:,.2f}")
big = sorted([r for r in win if r["net_deus_into_pool"] < 0], key=lambda x: x["net_deus_into_pool"])[:5]
print("\ntop buys:")
for r in big:
    print(f"  {r['tx'][:18]} {-r['net_deus_into_pool']:>12,.2f} DEUS")
