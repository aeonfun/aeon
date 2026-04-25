#!/usr/bin/env python3
import json

with open('.outputs/chains.json') as f:
    chains = json.load(f)

total_tvl = sum(c.get('tvl', 0) or 0 for c in chains)
yesterday_tvl = 0
for c in chains:
    tvl = c.get('tvl', 0) or 0
    cd = c.get('change_1d')
    if cd is not None and (1 + cd/100) > 0:
        yesterday_tvl += tvl/(1 + cd/100)
    else:
        yesterday_tvl += tvl

week_ago = 0
for c in chains:
    tvl = c.get('tvl', 0) or 0
    cw = c.get('change_7d')
    if cw is not None and (1 + cw/100) > 0:
        week_ago += tvl/(1 + cw/100)
    else:
        week_ago += tvl

tvl_d = (total_tvl - yesterday_tvl) / yesterday_tvl * 100
tvl_w = (total_tvl - week_ago) / week_ago * 100

print(f'Total TVL: ${total_tvl/1e9:.2f}B')
print(f'TVL change 1d: {tvl_d:+.2f}%')
print(f'TVL change 7d: {tvl_w:+.2f}%')

sorted_chains = sorted(chains, key=lambda x: x.get('tvl', 0) or 0, reverse=True)
print('\nTop 10 chains:')
for c in sorted_chains[:10]:
    tvl_b = (c.get('tvl', 0) or 0)/1e9
    cd = c.get('change_1d')
    cw = c.get('change_7d')
    cd_s = f'{cd:+.2f}%' if cd is not None else 'n/a'
    cw_s = f'{cw:+.2f}%' if cw is not None else 'n/a'
    print(f"  {c.get('name')}: ${tvl_b:.2f}B  c1d={cd_s}  c7d={cw_s}")

movers = [c for c in chains if (c.get('tvl', 0) or 0) >= 500e6 and c.get('change_1d') is not None and abs(c.get('change_1d')) >= 5]
movers_up = sorted([c for c in movers if c.get('change_1d') > 0], key=lambda x: x.get('change_1d'), reverse=True)
movers_dn = sorted([c for c in movers if c.get('change_1d') < 0], key=lambda x: x.get('change_1d'))
print('\nMover chains UP (top 5):')
for c in movers_up[:5]:
    tvl_b = (c.get('tvl', 0) or 0)/1e9
    print(f"  {c.get('name')}: ${tvl_b:.2f}B  c1d={c.get('change_1d'):+.2f}%")
print('\nMover chains DOWN (top 5):')
for c in movers_dn[:5]:
    tvl_b = (c.get('tvl', 0) or 0)/1e9
    print(f"  {c.get('name')}: ${tvl_b:.2f}B  c1d={c.get('change_1d'):+.2f}%")
