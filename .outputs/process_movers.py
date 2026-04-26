import json
import statistics

with open('/tmp/cg-markets.json') as f:
    data = json.load(f)
with open('/tmp/cg-trending.json') as f:
    trending = json.load(f)

stables = {'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg','susd','crvusd','frax','lusd','gusd','usdy','usds','rlusd','usd0','susds','blackrock-usd','ondo-us-dollar-yield','m-by-m-0','usdt0','sky-dollar','wsteth','staked-ether','wrapped-bitcoin','wrapped-eeth','rocket-pool-eth','wrapped-steth','reth','weth','jupiter-staked-sol','binance-staked-sol','jito-staked-sol','marinade-staked-sol','lido-staked-ether','coinbase-wrapped-staked-eth','renzo-restaked-eth','ether-fi-staked-eth','kelp-dao-restaked-eth','restaked-swell-eth'}

def is_stable(c):
    cid = (c.get('id') or '').lower()
    sym = (c.get('symbol') or '').upper()
    name = (c.get('name') or '').lower()
    if cid in stables: return True
    if sym.startswith('USD') or sym.startswith('EUR') or sym.startswith('GBP'): return True
    if 'stablecoin' in name or 'wrapped' in name or 'staked' in name: return True
    return False

filtered = [c for c in data if not is_stable(c) and (c.get('total_volume') or 0) >= 1_000_000 and c.get('price_change_percentage_24h_in_currency') is not None]

winners = sorted(filtered, key=lambda x: x.get('price_change_percentage_24h_in_currency') or -999, reverse=True)[:10]
losers = sorted(filtered, key=lambda x: x.get('price_change_percentage_24h_in_currency') or 999)[:10]
trend_coins = trending.get('coins', [])[:7]

top100 = filtered[:100]
green = sum(1 for c in top100 if (c.get('price_change_percentage_24h_in_currency') or 0) > 0)
top50 = filtered[:50]
median50 = statistics.median([(c.get('price_change_percentage_24h_in_currency') or 0) for c in top50]) if top50 else 0

def fmt_price(p):
    if p is None: return 'n/a'
    if p < 0.01: return f"${p:.6f}"
    if p < 1: return f"${p:.4f}"
    if p < 100: return f"${p:.2f}"
    return f"${p:,.0f}"

def fmt_vol(v):
    if v is None: return 'n/a'
    if v >= 1e9: return f"${v/1e9:.1f}B"
    if v >= 1e6: return f"${v/1e6:.0f}M"
    if v >= 1e3: return f"${v/1e3:.0f}K"
    return f"${v:.0f}"

btc = next((c for c in data if c.get('id')=='bitcoin'), None)
btc_price = btc.get('current_price') if btc else None
btc_24h = btc.get('price_change_percentage_24h_in_currency') if btc else 0

print(f"PULSE: BTC {fmt_price(btc_price)} ({btc_24h:+.1f}%), {green}/100 top-100 green, median top-50 24h {median50:+.2f}%")
print()
print("WINNERS:")
for i, c in enumerate(winners, 1):
    p1h = c.get('price_change_percentage_1h_in_currency') or 0
    p24h = c.get('price_change_percentage_24h_in_currency') or 0
    p7d = c.get('price_change_percentage_7d_in_currency') or 0
    rank = c.get('market_cap_rank')
    rank_str = f"#{rank}" if rank else '#n/a'
    mcap = c.get('market_cap') or 0
    tags = []
    if p24h > 15 and p7d > 25: tags.append('BREAKOUT')
    if p24h > 20 and p7d < 0: tags.append('FADE')
    if rank and rank > 150 and p24h > 30: tags.append('PUMP-RISK')
    if mcap and mcap < 50_000_000: tags.append('MICROCAP')
    if rank and rank <= 20: tags.append('MAJOR')
    tagstr = f" [{'+'.join(tags[:2])}]" if tags else ''
    print(f"{i}. {c['symbol'].upper()} ({c['name']}) - {fmt_price(c.get('current_price'))}  {p24h:+.1f}% / 7d {p7d:+.1f}% / 1h {p1h:+.1f}%  *  {fmt_vol(c.get('total_volume'))} / {rank_str}{tagstr}")

print()
print("LOSERS:")
for i, c in enumerate(losers, 1):
    p1h = c.get('price_change_percentage_1h_in_currency') or 0
    p24h = c.get('price_change_percentage_24h_in_currency') or 0
    p7d = c.get('price_change_percentage_7d_in_currency') or 0
    rank = c.get('market_cap_rank')
    rank_str = f"#{rank}" if rank else '#n/a'
    mcap = c.get('market_cap') or 0
    vol = c.get('total_volume') or 0
    tags = []
    if p24h < -10 and mcap and (vol/mcap) > 0.25: tags.append('CAPITULATION')
    if mcap and mcap < 50_000_000: tags.append('MICROCAP')
    if rank and rank <= 20: tags.append('MAJOR')
    tagstr = f" [{'+'.join(tags[:2])}]" if tags else ''
    print(f"{i}. {c['symbol'].upper()} ({c['name']}) - {fmt_price(c.get('current_price'))}  {p24h:+.1f}% / 7d {p7d:+.1f}% / 1h {p1h:+.1f}%  *  {fmt_vol(vol)} / {rank_str}{tagstr}")

print()
print("TRENDING:")
winner_syms = {w['symbol'].upper() for w in winners}
loser_syms = {l['symbol'].upper() for l in losers}
for i, t in enumerate(trend_coins, 1):
    item = t.get('item', {})
    sym = (item.get('symbol') or '').upper()
    name = item.get('name', '')
    rank = item.get('market_cap_rank') or 'n/a'
    p = item.get('data', {}).get('price') or 0
    p24h_d = item.get('data', {}).get('price_change_percentage_24h', {})
    p24h = p24h_d.get('usd', 0) if p24h_d else 0
    tags = []
    if sym in winner_syms: tags.append('TRENDING+UP')
    if sym in loser_syms: tags.append('TRENDING+DOWN')
    tagstr = f" [{'+'.join(tags[:2])}]" if tags else ''
    print(f"{i}. {name} ({sym}) - #{rank}, {fmt_price(p)}, 24h {p24h:+.1f}%{tagstr}")
