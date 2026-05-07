#!/usr/bin/env python3
import json, sys, math

with open('/tmp/cg-markets.json') as f:
    markets = json.load(f)
with open('/tmp/cg-trending.json') as f:
    trending = json.load(f)

# Filter stablecoins
STABLE_IDS = {'tether', 'usd-coin', 'dai', 'first-digital-usd', 'usde',
              'tusd', 'usdd', 'pyusd', 'fdusd', 'paxg', 'frax',
              'binance-usd', 'true-usd', 'gemini-dollar', 'lusd',
              'ethena-usde', 'usds', 'paypal-usd', 'global-dollar',
              'ondo-us-dollar-yield', 'ousg', 'mountain-protocol-usdm',
              'ethena-staked-usde', 'sky-dollar', 'usd1-wlfi', 'ripple-usd',
              'magic-internet-money', 'stake-dao-frax', 'crvusd',
              'm0', 'falcon-usd', 'resolv-usr', 'savings-usds',
              'level-usd', 'liquity-usd', 'usd0', 'usual-usd0pp', 'pax-gold',
              'tether-gold'}
STABLE_PREFIXES = ('USD', 'EUR', 'GBP')

WRAPPED_DUPES = {'wrapped-bitcoin', 'wrapped-steth', 'weth', 'staked-ether',
                 'wrapped-eeth', 'rocket-pool-eth', 'msolana', 'jito-staked-sol',
                 'binance-staked-sol', 'wbeth', 'mantle-staked-ether',
                 'kelp-dao-restaked-eth', 'renzo-restaked-eth',
                 'lombard-staked-btc', 'coinbase-wrapped-btc',
                 'coinbase-wrapped-staked-eth', 'lido-staked-ether',
                 'wrapped-beacon-eth', 'mantle-meth', 'sky-bridged-usds-arbitrum',
                 'binance-bridged-usdt-bnb-smart-chain',
                 'arbitrum-bridged-wbtc-arbitrum-one',
                 'binance-peg-weth', 'wbnb', 'tbtc', 'lbtc', 'wsteth', 'cbbtc',
                 'cbeth', 'reth', 'bedrock-unibtc', 'solv-btc', 'solv-protocol-solvbtc-bbn',
                 'klend-jlp', 'jupiter-staked-sol', 'jupiter-perpetuals-liquidity-provider-token',
                 'usdt0'}

def is_stable(c):
    cid = c.get('id', '').lower()
    sym = c.get('symbol', '').upper()
    name = (c.get('name') or '').lower()
    if cid in STABLE_IDS:
        return True
    if 'stablecoin' in name:
        return True
    for p in STABLE_PREFIXES:
        if sym.startswith(p):
            return True
    return False

def is_wrapped_dupe(c):
    return c.get('id', '').lower() in WRAPPED_DUPES

filtered = []
for c in markets:
    if not c:
        continue
    if is_stable(c):
        continue
    if is_wrapped_dupe(c):
        continue
    vol = c.get('total_volume') or 0
    if vol < 1_000_000:
        continue
    if c.get('price_change_percentage_24h_in_currency') is None:
        continue
    filtered.append(c)

print(f"Filtered count: {len(filtered)}", file=sys.stderr)

# Sort
sort_24h = sorted(filtered, key=lambda x: x.get('price_change_percentage_24h_in_currency') or 0)
losers = sort_24h[:10]
winners = list(reversed(sort_24h[-10:]))

# Trending
trending_coins = trending.get('coins', [])[:7]
trending_ids = [t['item']['id'] for t in trending_coins]

# Build market pulse from top-100 by mcap (filtered already sorted by mcap from API)
top100 = filtered[:100]
green = sum(1 for c in top100 if (c.get('price_change_percentage_24h_in_currency') or 0) > 0)
top50 = filtered[:50]
top50_changes = sorted([c.get('price_change_percentage_24h_in_currency') or 0 for c in top50])
median_50 = top50_changes[len(top50_changes)//2] if top50_changes else 0

print(f"Green top100: {green}/100", file=sys.stderr)
print(f"Median top50 24h: {median_50:.2f}%", file=sys.stderr)

def fmt_price(p):
    if p is None:
        return "?"
    if p >= 1000:
        return f"${p:,.0f}"
    if p >= 100:
        return f"${p:.1f}"
    if p >= 1:
        return f"${p:.3f}"
    if p >= 0.01:
        return f"${p:.4f}"
    return f"${p:.6f}"

def fmt_money(v):
    if v is None:
        return "?"
    if v >= 1e12:
        return f"${v/1e12:.1f}T"
    if v >= 1e9:
        return f"${v/1e9:.1f}B"
    if v >= 1e6:
        return f"${v/1e6:.0f}M"
    if v >= 1e3:
        return f"${v/1e3:.0f}K"
    return f"${v:.0f}"

def fmt_pct(p):
    if p is None:
        return "n/a"
    sign = "+" if p >= 0 else ""
    return f"{sign}{p:.1f}%"

def compute_tags(c, is_winner=False, is_loser=False, is_trending_list=False):
    tags = []
    cid = c.get('id', '')
    sym = c.get('symbol', '').upper()
    rank = c.get('market_cap_rank') or 999
    mcap = c.get('market_cap') or 0
    vol = c.get('total_volume') or 0
    p24 = c.get('price_change_percentage_24h_in_currency') or 0
    p7 = c.get('price_change_percentage_7d_in_currency') or 0
    in_trending = cid in trending_ids

    # Priority order: TRENDING+UP/DOWN > BREAKOUT > FADE > CAPITULATION > PUMP-RISK > MAJOR > MICROCAP
    if in_trending and is_winner:
        tags.append("TRENDING+UP")
    elif in_trending and is_loser:
        tags.append("TRENDING+DOWN")

    if p24 > 15 and p7 > 25:
        tags.append("BREAKOUT")
    elif p24 > 20 and p7 < 0:
        tags.append("FADE")

    if p24 < -10 and mcap > 0 and (vol / mcap) > 0.25:
        tags.append("CAPITULATION")

    if rank > 150 and p24 > 30:
        tags.append("PUMP-RISK")

    if rank <= 20:
        if "MAJOR" not in tags and len(tags) < 2:
            tags.append("MAJOR")

    if mcap < 50_000_000 and mcap > 0:
        if "MICROCAP" not in tags and len(tags) < 2:
            tags.append("MICROCAP")

    return tags[:2]

# Yesterday's repeats to potentially skip (winners/losers from MEMORY)
YESTERDAY_NAMES = {'TON', 'ZEC', 'FIRO', 'BILL', 'SKYAI', 'LAB', 'DASH', 'NEAR', 'AR', 'GWEI'}

def coin_line(c, idx, is_winner=False, is_loser=False):
    sym = c.get('symbol', '').upper()
    name = c.get('name', '')
    rank = c.get('market_cap_rank') or '?'
    price = fmt_price(c.get('current_price'))
    p24 = c.get('price_change_percentage_24h_in_currency') or 0
    p7 = c.get('price_change_percentage_7d_in_currency') or 0
    p1h = c.get('price_change_percentage_1h_in_currency') or 0
    vol = fmt_money(c.get('total_volume'))
    tags = compute_tags(c, is_winner=is_winner, is_loser=is_loser)
    tag_str = f"  [{', '.join(tags)}]" if tags else ""
    return f"{idx}. {sym} ({name}) — {price}  {fmt_pct(p24)} / 7d {fmt_pct(p7)} / 1h {fmt_pct(p1h)}  •  {vol} / #{rank}{tag_str}"

# Build output
today = "2026-05-07"
out_lines = [f"*Token Movers — {today}*", ""]

# Market pulse
if green >= 60:
    pulse = f"Risk-on tape — {green}/100 top coins green, median 24h {median_50:+.1f}%."
elif green <= 35:
    pulse = f"Broad risk-off — only {green}/100 top coins green, median 24h {median_50:+.1f}%."
else:
    pulse = f"Mixed tape — {green}/100 top coins green, median 24h {median_50:+.1f}%."

out_lines.append(f"_{pulse}_")
out_lines.append("")

out_lines.append("*Top Winners (24h)*")
for i, c in enumerate(winners, 1):
    out_lines.append(coin_line(c, i, is_winner=True))
out_lines.append("")

out_lines.append("*Top Losers (24h)*")
for i, c in enumerate(losers, 1):
    out_lines.append(coin_line(c, i, is_loser=True))
out_lines.append("")

# Trending
out_lines.append("*Trending*")
filtered_by_id = {c['id']: c for c in filtered}
all_by_id = {c['id']: c for c in markets if c}
for i, t in enumerate(trending_coins, 1):
    item = t['item']
    tid = item['id']
    name = item.get('name', '')
    sym = (item.get('symbol') or '').upper()
    rank = item.get('market_cap_rank') or '?'
    # Get price from data field or from filtered coins
    price_usd = None
    p24 = None
    if 'data' in item and item['data']:
        price_usd = item['data'].get('price')
        change = item['data'].get('price_change_percentage_24h')
        if change and 'usd' in change:
            p24 = change['usd']
    if tid in filtered_by_id:
        cc = filtered_by_id[tid]
        if price_usd is None:
            price_usd = cc.get('current_price')
        if p24 is None:
            p24 = cc.get('price_change_percentage_24h_in_currency')
    elif tid in all_by_id:
        cc = all_by_id[tid]
        if price_usd is None:
            price_usd = cc.get('current_price')
        if p24 is None:
            p24 = cc.get('price_change_percentage_24h_in_currency')

    # Tags for trending (need data)
    tags = []
    if tid in filtered_by_id:
        cc = filtered_by_id[tid]
        # Check if also winner/loser
        is_w = any(w['id'] == tid for w in winners)
        is_l = any(l['id'] == tid for l in losers)
        tags = compute_tags(cc, is_winner=is_w, is_loser=is_l)

    tag_str = f"  [{', '.join(tags)}]" if tags else ""

    p_fmt = fmt_price(price_usd) if price_usd else "n/a"
    pct_fmt = fmt_pct(p24) if p24 is not None else "n/a"
    out_lines.append(f"{i}. {name} ({sym}) — #{rank}, {p_fmt}, 24h {pct_fmt}{tag_str}")
out_lines.append("")

# Notable
notable_lines = []
for c in winners:
    sym = c.get('symbol', '').upper()
    cid = c.get('id', '')
    p24 = c.get('price_change_percentage_24h_in_currency') or 0
    p7 = c.get('price_change_percentage_7d_in_currency') or 0
    rank = c.get('market_cap_rank') or 999
    vol = c.get('total_volume') or 0
    mcap = c.get('market_cap') or 0
    in_trending = cid in trending_ids

    if in_trending:
        notable_lines.append(f"• {sym}: trending and {fmt_pct(p24)} 24h on {fmt_money(vol)} vol — corroborated signal")
    elif p24 > 15 and p7 > 25:
        notable_lines.append(f"• {sym}: 24h {fmt_pct(p24)} on top of 7d {fmt_pct(p7)} — sustained breakout")
    elif rank > 150 and p24 > 30:
        notable_lines.append(f"• {sym}: rank #{rank} up {fmt_pct(p24)} — PUMP-RISK, low-cap manipulation probable")

for c in losers:
    sym = c.get('symbol', '').upper()
    cid = c.get('id', '')
    p24 = c.get('price_change_percentage_24h_in_currency') or 0
    rank = c.get('market_cap_rank') or 999
    vol = c.get('total_volume') or 0
    mcap = c.get('market_cap') or 0
    in_trending = cid in trending_ids

    if p24 < -10 and mcap > 0 and (vol/mcap) > 0.25:
        notable_lines.append(f"• {sym}: {fmt_pct(p24)} 24h with vol/mcap {(vol/mcap):.2f} — capitulation flush")

# Dedup notable
seen = set()
uniq = []
for line in notable_lines:
    if line in seen:
        continue
    seen.add(line)
    uniq.append(line)
notable_lines = uniq[:4]

if notable_lines:
    out_lines.append("*Notable*")
    out_lines.extend(notable_lines)
    out_lines.append("")

output = "\n".join(out_lines).rstrip() + "\n"
print(f"Char count: {len(output)}", file=sys.stderr)

with open('/home/runner/work/aeon/aeon/.outputs/token-movers.md', 'w') as f:
    f.write(output)

# Also write log entry
winner_strs = [f"{w['symbol'].upper()} ({fmt_pct(w.get('price_change_percentage_24h_in_currency') or 0)})" for w in winners[:6]]
loser_strs = [f"{l['symbol'].upper()} ({fmt_pct(l.get('price_change_percentage_24h_in_currency') or 0)})" for l in losers[:6]]
trending_syms = [t['item'].get('symbol', '').upper() for t in trending_coins]

log_entry = f"""
### token-movers
- Var: <none>
- Pulse: {pulse}
- Winners: {', '.join(winner_strs)}
- Losers: {', '.join(loser_strs)}
- Trending: {', '.join(trending_syms)}
- Notable: {len(notable_lines)} signals ({'; '.join(l[2:80] for l in notable_lines[:3]) if notable_lines else 'none'})
"""

with open('/home/runner/work/aeon/aeon/.outputs/_token_movers_log_v2.txt', 'w') as f:
    f.write(log_entry)

print("Done")
