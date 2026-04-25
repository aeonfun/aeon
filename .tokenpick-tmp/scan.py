#!/usr/bin/env python3
import json

# Load trending
with open('/tmp/trending.json') as f:
    trending = json.load(f)

# Load markets
with open('/tmp/markets.json') as f:
    markets = json.load(f)

# Load dex
with open('/tmp/dex.json') as f:
    dex = json.load(f)

# Build trending symbol set
trending_symbols = set()
trending_names = []
for c in trending.get('coins', []):
    sym = c['item']['symbol'].upper()
    trending_symbols.add(sym)
    trending_names.append(f"{sym} (rank {c['item'].get('market_cap_rank')})")

print("===TRENDING===")
print(", ".join(trending_names))

# BTC and ETH for relative strength
btc_7d = eth_7d = 0
for m in markets:
    if m.get('symbol', '').lower() == 'btc':
        btc_7d = m.get('price_change_percentage_7d_in_currency') or 0
        btc_24h = m.get('price_change_percentage_24h_in_currency') or 0
    if m.get('symbol', '').lower() == 'eth':
        eth_7d = m.get('price_change_percentage_7d_in_currency') or 0
        eth_24h = m.get('price_change_percentage_24h_in_currency') or 0

print(f"\nBENCHMARK: BTC 24h={btc_24h:+.2f}% / 7d={btc_7d:+.2f}%  |  ETH 24h={eth_24h:+.2f}% / 7d={eth_7d:+.2f}%")

# DexScreener trending symbols
dex_trending = set()
for p in dex.get('pairs', [])[:50]:
    base = p.get('baseToken', {}).get('symbol', '').upper()
    if base:
        dex_trending.add(base)

# Score each token
scored = []
for m in markets:
    sym = m.get('symbol', '').upper()
    mcap = m.get('market_cap') or 0
    vol = m.get('total_volume') or 0
    p24 = m.get('price_change_percentage_24h_in_currency') or 0
    p7 = m.get('price_change_percentage_7d_in_currency') or 0
    if mcap < 20_000_000:
        continue
    if sym in ('BTC', 'ETH', 'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDE', 'FDUSD', 'PYUSD', 'USDP', 'USDS'):
        continue
    if 'usd' in m.get('id', '').lower() and m.get('id') not in ('uniswap',):
        continue
    score = 0
    breakdown = []
    if p24 > 0:
        score += 1
        breakdown.append('24h+')
    if p7 > 0:
        score += 1
        breakdown.append('7d+')
    if p24 > 5 and p7 > 5:
        score += 2
        breakdown.append('both>5%+2')
    if sym in trending_symbols:
        score += 2
        breakdown.append('trending+2')
    vmc = vol / mcap if mcap > 0 else 0
    if vmc >= 0.20:
        score += 3
        breakdown.append(f'vol/mcap{vmc:.2f}+3')
    elif vmc >= 0.10:
        score += 2
        breakdown.append(f'vol/mcap{vmc:.2f}+2')
    if p7 > btc_7d and p7 > eth_7d:
        score += 2
        breakdown.append('RS+2')
    if sym in dex_trending:
        score += 1
        breakdown.append('dex+1')
    scored.append({
        'sym': sym,
        'name': m.get('name'),
        'price': m.get('current_price'),
        'mcap': mcap,
        'vol': vol,
        'p24': p24,
        'p7': p7,
        'vmc': vmc,
        'score': score,
        'breakdown': breakdown,
    })

scored.sort(key=lambda x: -x['score'])
print("\n===TOP 20 BY SCORE===")
for t in scored[:20]:
    print(f"  {t['sym']:8s} {t['name']:25s} score={t['score']} 24h={t['p24']:+.1f}% 7d={t['p7']:+.1f}% vmc={t['vmc']:.2f} mcap=${t['mcap']/1e9:.2f}B vol=${t['vol']/1e6:.0f}M [{','.join(t['breakdown'])}]")

# Also list the trending coins specifically
print("\n===TRENDING COINS (CG) WITH MARKET DATA===")
for t in scored:
    if t['sym'] in trending_symbols:
        print(f"  {t['sym']:8s} score={t['score']} 24h={t['p24']:+.1f}% 7d={t['p7']:+.1f}% vmc={t['vmc']:.2f} mcap=${t['mcap']/1e6:.0f}M [{','.join(t['breakdown'])}]")
