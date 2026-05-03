import json, sys

STABLES = {"tether","usd-coin","dai","first-digital-usd","usde","tusd","usdd","pyusd","fdusd","paxg","usds","usdt","usdc","staked-ether","wrapped-bitcoin","wrapped-steth","wrapped-eth"}
WRAP_PREFIX = ("wrapped","staked")

def is_stable(c):
    sym = (c.get("symbol") or "").upper()
    name = (c.get("name") or "").lower()
    cid = (c.get("id") or "").lower()
    if cid in STABLES: return True
    if sym.startswith(("USD","EUR","GBP")): return True
    if "stablecoin" in name: return True
    return False

def is_wrapped(c):
    name = (c.get("name") or "").lower()
    sym = (c.get("symbol") or "").lower()
    if name.startswith(WRAP_PREFIX): return True
    if sym in ("wbtc","weth","steth","cbeth","wsteth","wbeth","reth"): return True
    return False

with open("/home/runner/work/aeon/aeon/.outputs/cg-markets-2.json") as f:
    data = json.load(f)
with open("/home/runner/work/aeon/aeon/.outputs/cg-trending-2.json") as f:
    trending = json.load(f)

filtered = []
for c in data:
    if is_stable(c): continue
    if is_wrapped(c): continue
    if not c.get("total_volume") or c.get("total_volume",0) < 1_000_000: continue
    if c.get("price_change_percentage_24h") is None: continue
    filtered.append(c)

# market pulse top 100
top100 = filtered[:100]
green = sum(1 for c in top100 if (c.get("price_change_percentage_24h") or 0) > 0)
top50 = filtered[:50]
top50_changes = sorted([c.get("price_change_percentage_24h") or 0 for c in top50])
median = top50_changes[len(top50_changes)//2] if top50_changes else 0.0

# majors lookup
def find_sym(sym):
    for c in data:
        if (c.get("symbol") or "").lower() == sym.lower():
            return c
    return None
btc = find_sym("BTC"); eth = find_sym("ETH"); sol = find_sym("SOL")
def chg(c): return c.get("price_change_percentage_24h") if c else None
def price(c): return c.get("current_price") if c else None

print(f"PULSE: {green}/100 green, top50 median={median:+.1f}%; BTC ${price(btc):,.0f} {chg(btc):+.1f}%, ETH ${price(eth):,.0f} {chg(eth):+.1f}%, SOL ${price(sol):.2f} {chg(sol):+.1f}%")

# winners and losers
winners = sorted(filtered, key=lambda c: c.get("price_change_percentage_24h") or 0, reverse=True)[:12]
losers = sorted(filtered, key=lambda c: c.get("price_change_percentage_24h") or 0)[:12]

def tags(c):
    t = []
    rank = c.get("market_cap_rank") or 9999
    p24 = c.get("price_change_percentage_24h") or 0
    p7 = c.get("price_change_percentage_7d_in_currency") or 0
    p1 = c.get("price_change_percentage_1h_in_currency") or 0
    vol = c.get("total_volume") or 0
    mc = c.get("market_cap") or 1
    sym = (c.get("symbol") or "").upper()
    is_trend = sym in trending_syms
    if is_trend and p24 > 0:
        t.append("TRENDING+UP")
    if is_trend and p24 < -3:
        t.append("TRENDING+DOWN")
    if p24 > 15 and p7 > 25 and "TRENDING+UP" not in t:
        t.append("BREAKOUT")
    if p24 > 20 and p7 < 0:
        t.append("FADE")
    if p24 < -10 and (vol/mc) > 0.25:
        t.append("CAPITULATION")
    if rank > 150 and p24 > 30:
        t.append("PUMP-RISK")
    if mc < 50_000_000:
        t.append("MICROCAP")
    if rank <= 20:
        t.append("MAJOR")
    return t[:2]

trending_data = trending.get("coins", [])
trending_syms = set()
for tc in trending_data[:7]:
    item = tc.get("item", {})
    sym = (item.get("symbol") or "").upper()
    trending_syms.add(sym)

def fmt(c):
    sym = (c.get("symbol") or "").upper()
    name = c.get("name") or ""
    p = c.get("current_price") or 0
    if p < 0.01: ps = f"${p:.6f}"
    elif p < 1: ps = f"${p:.4f}"
    else: ps = f"${p:,.4g}"
    p24 = c.get("price_change_percentage_24h") or 0
    p7 = c.get("price_change_percentage_7d_in_currency") or 0
    p1 = c.get("price_change_percentage_1h_in_currency") or 0
    vol = c.get("total_volume") or 0
    mc = c.get("market_cap") or 0
    rank = c.get("market_cap_rank") or "?"
    if mc >= 1e9: mcs = f"${mc/1e9:.1f}B"
    elif mc >= 1e6: mcs = f"${mc/1e6:.0f}M"
    else: mcs = f"${mc/1e3:.0f}K"
    tg = tags(c)
    tgstr = (" [" + ",".join(tg) + "]") if tg else ""
    return f"{sym} ({name}) {ps} {p24:+.1f}% / 7d {p7:+.0f}% / 1h {p1:+.1f}% • {mcs} #{rank}{tgstr}"

print("\nWINNERS:")
for c in winners[:10]:
    print(fmt(c))

print("\nLOSERS:")
for c in losers[:10]:
    print(fmt(c))

print("\nTRENDING:")
for tc in trending_data[:7]:
    item = tc.get("item", {})
    sym = (item.get("symbol") or "").upper()
    name = item.get("name") or ""
    rank = item.get("market_cap_rank") or "?"
    price_btc = item.get("data", {}).get("price")
    p24 = item.get("data", {}).get("price_change_percentage_24h", {}).get("usd")
    pchg = f"{p24:+.1f}%" if p24 is not None else "n/a"
    print(f"{sym} ({name}) #{rank} 24h {pchg}")
