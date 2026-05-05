import json

with open('.outputs/cg-markets-0505.json') as f:
    coins = json.load(f)

stables = {'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg','frax','lusd','usds','susds','susde','ondo-us-dollar-yield','wrapped-bitcoin','staked-ether','wrapped-steth','tbtc','wrapped-eeth','rocket-pool-eth','renbtc','weth','lido-staked-ether'}
def is_stable(c):
    if c.get('id') in stables: return True
    s = c.get('symbol','').upper()
    n = (c.get('name') or '').lower()
    if s.startswith('USD') or s.startswith('EUR') or s.startswith('GBP'): return True
    if 'stablecoin' in n: return True
    if s in ('PAXG','XAUT','WBTC','WETH','STETH','WSTETH'): return True
    return False

filtered = [c for c in coins if not is_stable(c) and (c.get('total_volume') or 0) >= 1_000_000]

def fmt_num(x):
    if x is None: return 'n/a'
    if x >= 1e9: return f"${x/1e9:.1f}B"
    if x >= 1e6: return f"${x/1e6:.0f}M"
    if x >= 1e3: return f"${x/1e3:.0f}K"
    return f"${x:.0f}"

def fmt_price(p):
    if p is None: return 'n/a'
    if p >= 1000: return f"${p:,.0f}"
    if p >= 1: return f"${p:.2f}"
    if p >= 0.01: return f"${p:.4f}"
    return f"${p:.6f}"

def tags(c):
    out = []
    p24 = c.get('price_change_percentage_24h_in_currency') or 0
    p7d = c.get('price_change_percentage_7d_in_currency') or 0
    rank = c.get('market_cap_rank') or 999
    mc = c.get('market_cap') or 0
    vol = c.get('total_volume') or 0
    if p24 > 15 and p7d > 25: out.append('BREAKOUT')
    if p24 > 20 and p7d < 0: out.append('FADE')
    if p24 < -10 and mc and vol/mc > 0.25: out.append('CAPITULATION')
    if rank > 150 and p24 > 30: out.append('PUMP-RISK')
    if mc < 50_000_000: out.append('MICROCAP')
    if rank <= 20: out.append('MAJOR')
    return out[:2]

top100 = filtered[:100]
green = sum(1 for c in top100 if (c.get('price_change_percentage_24h_in_currency') or 0) > 0)
top50 = filtered[:50]
top50_changes = sorted([(c.get('price_change_percentage_24h_in_currency') or 0) for c in top50])
median = top50_changes[len(top50_changes)//2] if top50_changes else 0

btc = next((c for c in filtered if c['id']=='bitcoin'), None)
eth = next((c for c in filtered if c['id']=='ethereum'), None)
sol = next((c for c in filtered if c['id']=='solana'), None)

print(f"PULSE: {green}/100 top coins green, top-50 median 24h {median:+.2f}%")
if btc: print(f"BTC: ${btc['current_price']:,.0f} ({btc.get('price_change_percentage_24h_in_currency'):.2f}%)")
if eth: print(f"ETH: ${eth['current_price']:,.0f} ({eth.get('price_change_percentage_24h_in_currency'):.2f}%)")
if sol: print(f"SOL: ${sol['current_price']:.2f} ({sol.get('price_change_percentage_24h_in_currency'):.2f}%)")

winners = sorted(filtered, key=lambda c: -(c.get('price_change_percentage_24h_in_currency') or 0))[:10]
losers = sorted(filtered, key=lambda c: (c.get('price_change_percentage_24h_in_currency') or 0))[:10]

print("\nWINNERS:")
for c in winners:
    s = c['symbol'].upper()
    n = c['name']
    p = fmt_price(c['current_price'])
    p24 = c.get('price_change_percentage_24h_in_currency') or 0
    p7d = c.get('price_change_percentage_7d_in_currency') or 0
    p1h = c.get('price_change_percentage_1h_in_currency') or 0
    rank = c.get('market_cap_rank') or '?'
    mc = fmt_num(c.get('market_cap'))
    vol = fmt_num(c.get('total_volume'))
    t = tags(c)
    tag_str = ''.join(f"[{x}]" for x in t)
    print(f"  {s} ({n}) — {p}  +{p24:.1f}% / 7d {p7d:+.1f}% / 1h {p1h:+.1f}%  •  vol {vol} mc {mc} #{rank}  {tag_str}")

print("\nLOSERS:")
for c in losers:
    s = c['symbol'].upper()
    n = c['name']
    p = fmt_price(c['current_price'])
    p24 = c.get('price_change_percentage_24h_in_currency') or 0
    p7d = c.get('price_change_percentage_7d_in_currency') or 0
    p1h = c.get('price_change_percentage_1h_in_currency') or 0
    rank = c.get('market_cap_rank') or '?'
    mc = fmt_num(c.get('market_cap'))
    vol = fmt_num(c.get('total_volume'))
    t = tags(c)
    tag_str = ''.join(f"[{x}]" for x in t)
    print(f"  {s} ({n}) — {p}  {p24:.1f}% / 7d {p7d:+.1f}% / 1h {p1h:+.1f}%  •  vol {vol} mc {mc} #{rank}  {tag_str}")

with open('.outputs/cg-trending-0505.json') as f:
    tr = json.load(f)

print("\nTRENDING:")
for item in tr.get('coins', [])[:7]:
    c = item.get('item', {})
    n = c.get('name')
    s = c.get('symbol', '').upper()
    rank = c.get('market_cap_rank') or '?'
    data = c.get('data', {}) or {}
    price = data.get('price')
    p24 = data.get('price_change_percentage_24h', {}).get('usd') if isinstance(data.get('price_change_percentage_24h'), dict) else None
    print(f"  {n} ({s}) — #{rank}, price={price}, 24h={p24}")
