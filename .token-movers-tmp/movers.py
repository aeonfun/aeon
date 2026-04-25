import json, statistics

import os
HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, 'markets.json')) as f:
    markets = json.load(f)
with open(os.path.join(HERE, 'trending.json')) as f:
    trending = json.load(f)

STABLE_IDS = {
    'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd',
    'fdusd','paxg','ethena-usde','frax','lusd','susd','crvusd','gho','susde',
    'usds','ousd','usd1','xaut','tether-gold','usdy','usdf','m0-dollar','usdq',
    'global-dollar','sky-dollar','blackrock-usd-institutional-digital-liquidity-fund',
    'savings-dai','sdai','tether-eurt','staked-frax','staked-usde','ousg','buidl',
    'falcon-finance','resolv-usr','usual-usd','first-digital-usd-stablecoin',
    'paypal-usd','blackrock-buidl','elixir-deusd','usdx-money','staked-usdx',
}

def is_stable(c):
    cid = (c.get('id') or '').lower()
    name = (c.get('name') or '').lower()
    sym = (c.get('symbol') or '').upper()
    if cid in STABLE_IDS:
        return True
    if 'stablecoin' in name:
        return True
    if 'dollar' in name and 'usd' in name:
        return True
    if sym.startswith(('USD','EUR','GBP')) and len(sym) <= 6:
        return True
    return False

WRAPPED_DUPES = {
    'wrapped-bitcoin','wrapped-steth','wrapped-eeth','wrapped-beacon-eth',
    'lido-staked-ether','rocket-pool-eth','staked-ether','renbtc','hbtc',
    'binance-bridged-usdt','binance-bridged-usdc','liquid-staked-ethereum',
    'mantle-staked-ether','jito-staked-sol','marinade-staked-sol',
    'binance-peg-busd','wbeth','weth','reth','meth','steth','rseth','cbeth',
    'binance-staked-sol','solv-protocol-solvbtc','solv-btc','coinbase-wrapped-btc',
    'tbtc','btc-b','wbnb','kelp-dao-restaked-eth',
}

filtered = []
for c in markets:
    if is_stable(c):
        continue
    if c.get('id') in WRAPPED_DUPES:
        continue
    if (c.get('total_volume') or 0) < 1_000_000:
        continue
    if c.get('price_change_percentage_24h') is None:
        continue
    filtered.append(c)

print(f"after filter: {len(filtered)} coins (from {len(markets)})")

filtered.sort(key=lambda c: c['price_change_percentage_24h'])
losers = filtered[:10]
winners = sorted(filtered, key=lambda c: -c['price_change_percentage_24h'])[:10]

trending_coins = []
for item in trending.get('coins', []):
    item = item.get('item', {})
    trending_coins.append({
        'id': item.get('id'),
        'name': item.get('name'),
        'symbol': item.get('symbol'),
        'rank': item.get('market_cap_rank'),
        'price_btc': item.get('price_btc'),
        'data': item.get('data', {}),
    })
trending_coins = trending_coins[:7]

mkt_by_id = {c['id']: c for c in markets}

top100 = [c for c in filtered if (c.get('market_cap_rank') or 999) <= 100]
top50 = [c for c in filtered if (c.get('market_cap_rank') or 999) <= 50]
green100 = sum(1 for c in top100 if c['price_change_percentage_24h'] > 0)
median50 = statistics.median([c['price_change_percentage_24h'] for c in top50]) if top50 else 0
median100 = statistics.median([c['price_change_percentage_24h'] for c in top100]) if top100 else 0

def fmt_price(p):
    if p is None: return '?'
    if isinstance(p, str):
        try: p = float(p)
        except: return p
    if p >= 1000: return f"${p:,.0f}"
    if p >= 10: return f"${p:,.2f}"
    if p >= 1: return f"${p:.3f}"
    if p >= 0.01: return f"${p:.4f}"
    return f"${p:.6f}"

def fmt_big(v):
    if v is None or v == 0: return '?'
    if v >= 1e9: return f"${v/1e9:.1f}B"
    if v >= 1e6: return f"${v/1e6:.0f}M"
    if v >= 1e3: return f"${v/1e3:.0f}K"
    return f"${v:.0f}"

def tags_for(c, trending_ids, is_winner):
    tags = []
    p24 = c.get('price_change_percentage_24h') or 0
    p7d = c.get('price_change_percentage_7d_in_currency') or 0
    rank = c.get('market_cap_rank') or 999
    mcap = c.get('market_cap') or 0
    vol = c.get('total_volume') or 0
    in_trending = c['id'] in trending_ids

    if in_trending and is_winner and p24 > 5:
        tags.append('TRENDING+UP')
    if in_trending and not is_winner and p24 < -5:
        tags.append('TRENDING+DOWN')
    if p24 > 15 and p7d > 25:
        tags.append('BREAKOUT')
    if p24 > 20 and p7d < 0:
        tags.append('FADE')
    if p24 < -10 and mcap > 0 and (vol/mcap) > 0.25:
        tags.append('CAPITULATION')
    if rank > 150 and p24 > 30:
        tags.append('PUMP-RISK')
    if mcap > 0 and mcap < 50_000_000:
        tags.append('MICROCAP')
    if rank <= 20:
        tags.append('MAJOR')
    return tags[:2]

trending_ids = {t['id'] for t in trending_coins}

print("")
print("=== PULSE ===")
print(f"top-100 green: {green100}/100, median top-50: {median50:.2f}%, median top-100: {median100:.2f}%")

def render_row(c, idx, is_winner):
    tags = tags_for(c, trending_ids, is_winner=is_winner)
    p24 = c['price_change_percentage_24h']
    p7 = c.get('price_change_percentage_7d_in_currency') or 0
    p1 = c.get('price_change_percentage_1h_in_currency') or 0
    rank = c.get('market_cap_rank') or '?'
    tag_str = f"  [{','.join(tags)}]" if tags else ""
    return f"{idx}. {c['symbol'].upper()} ({c['name']}) {fmt_price(c['current_price'])}  {p24:+.1f}% / 7d {p7:+.1f}% / 1h {p1:+.1f}%  - {fmt_big(c['total_volume'])} / #{rank}{tag_str}"

print("")
print("=== WINNERS ===")
for i, c in enumerate(winners, 1):
    print(render_row(c, i, True))

print("")
print("=== LOSERS ===")
for i, c in enumerate(losers, 1):
    print(render_row(c, i, False))

print("")
print("=== TRENDING ===")
for i, t in enumerate(trending_coins, 1):
    m = mkt_by_id.get(t['id']) or {}
    p24 = m.get('price_change_percentage_24h')
    if p24 is None:
        p24 = t.get('data',{}).get('price_change_percentage_24h',{}).get('usd')
    price = m.get('current_price') or t.get('data',{}).get('price')
    is_winner = (p24 or 0) > 0
    if m:
        tags = tags_for(m, trending_ids, is_winner=is_winner)
    else:
        tags = []
    p24s = f"{p24:+.1f}%" if p24 is not None else "n/a"
    rank = t.get('rank') or m.get('market_cap_rank') or '?'
    rank_str = f"#{rank}" if rank != '?' else 'unranked'
    tag_str = f"  [{','.join(tags)}]" if tags else ""
    print(f"{i}. {t['name']} ({t['symbol']}) {rank_str}, {fmt_price(price)}, 24h {p24s}{tag_str}")

print("")
print("=== NOTABLE ===")
notable_seen = set()
flags_set = {'TRENDING+UP','TRENDING+DOWN','BREAKOUT','CAPITULATION','PUMP-RISK','FADE'}
for c in winners + losers:
    is_w = c['price_change_percentage_24h'] > 0
    tags = tags_for(c, trending_ids, is_winner=is_w)
    hit = [t for t in tags if t in flags_set]
    if hit and c['id'] not in notable_seen:
        notable_seen.add(c['id'])
        p24 = c['price_change_percentage_24h']
        rank = c.get('market_cap_rank') or '?'
        vol = c.get('total_volume') or 0
        mcap = c.get('market_cap') or 0
        vm = (vol/mcap) if mcap else 0
        print(f"- {c['symbol'].upper()} ({c['name']}, #{rank}): {p24:+.1f}% 24h, vol/mcap {vm:.2f}, tags={hit}")
