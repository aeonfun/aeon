#!/usr/bin/env python3
import json

# === Chains ===
chains = json.load(open('.chains.json'))
total_tvl = sum(c.get('tvl',0) or 0 for c in chains)
print(f"TVL_TOTAL: ${total_tvl/1e9:.2f}B")
chains_sorted = sorted(chains, key=lambda c: c.get('tvl',0) or 0, reverse=True)
print("Top 10 chains:")
for c in chains_sorted[:10]:
    print(f"  {c.get('name')}: ${(c.get('tvl',0)/1e9):.2f}B 1d={c.get('change_1d')}% 7d={c.get('change_7d')}%")

sum_w = sum((c.get('tvl',0) or 0)*((c.get('change_1d') or 0))/100 for c in chains)
tvl_d_pct = (sum_w/total_tvl)*100 if total_tvl else 0
print(f"TVL_1D_PCT: {tvl_d_pct:.2f}%")
sum_w7 = sum((c.get('tvl',0) or 0)*((c.get('change_7d') or 0))/100 for c in chains)
tvl_7d_pct = (sum_w7/total_tvl)*100 if total_tvl else 0
print(f"TVL_7D_PCT: {tvl_7d_pct:.2f}%")

print()
print("=== Chain Movers (|1d|>=5%, tvl>=$500M) ===")
movers = [c for c in chains if (c.get('tvl',0) or 0) >= 500e6 and abs(c.get('change_1d') or 0) >= 5]
movers_sorted = sorted(movers, key=lambda c: c.get('change_1d',0))
print("DOWN candidates:")
for c in movers_sorted[:5]:
    print(f"  {c.get('name')}: ${(c.get('tvl',0)/1e9):.2f}B 1d={c.get('change_1d')}% 7d={c.get('change_7d')}%")
print("UP candidates:")
for c in sorted(movers, key=lambda c: -c.get('change_1d',0))[:5]:
    print(f"  {c.get('name')}: ${(c.get('tvl',0)/1e9):.2f}B 1d={c.get('change_1d')}% 7d={c.get('change_7d')}%")

# === Protocols ===
print()
prots = json.load(open('.protocols.json'))
print(f"PROTOCOLS_COUNT: {len(prots)}")
mp = [p for p in prots if (p.get('tvl',0) or 0) >= 100e6 and abs(p.get('change_1d') or 0) >= 10]
print("Protocol movers (|1d|>=10%, tvl>=$100M):")
for p in sorted(mp, key=lambda p: -abs(p.get('change_1d',0)))[:10]:
    print(f"  {p.get('name')} ({p.get('category')}/{p.get('chain')}): ${(p.get('tvl',0)/1e9):.3f}B 1d={p.get('change_1d')}% 7d={p.get('change_7d')}%")

# === Fees ===
print()
fees = json.load(open('.fees.json'))
print(f"FEES_TOTAL_24H: ${fees.get('total24h',0)/1e6:.1f}M  total7d=${fees.get('total7d',0)/1e6:.1f}M  change_1d={fees.get('change_1d')}%  change_7d={fees.get('change_7d')}%")
fps = fees.get('protocols',[])
fps_sorted = sorted(fps, key=lambda p: -(p.get('total24h',0) or 0))
print("Top 10 fees protocols (24h):")
for p in fps_sorted[:10]:
    t24 = p.get('total24h',0) or 0
    t7 = p.get('total7d',0) or 0
    avg7d = t7/7 if t7 else 0
    delta = ((t24 - avg7d) / avg7d * 100) if avg7d else 0
    print(f"  {p.get('name')}: 24h=${t24/1e6:.2f}M 7d=${t7/1e6:.1f}M  vs7d_avg={delta:+.1f}%  c1d={p.get('change_1d')}%  c7d={p.get('change_7d')}%")

# Fees beating TVL: fees change_7d > +20% AND TVL change_7d < +5%
print()
print("=== Fees beating TVL (fees 7d>+20% AND TVL 7d<+5%) ===")
# Match fees protocols to /protocols by name
prot_by_name = {p['name']: p for p in prots}
candidates = []
for fp in fps:
    n = fp.get('name')
    pp = prot_by_name.get(n)
    if not pp: continue
    fc7 = fp.get('change_7d')
    tc7 = pp.get('change_7d')
    if fc7 is None or tc7 is None: continue
    if fc7 > 20 and tc7 < 5 and (fp.get('total24h',0) or 0) >= 1e6:
        candidates.append((n, fc7, tc7, fp.get('total24h',0), pp.get('tvl',0)))
for c in sorted(candidates, key=lambda x: -x[1])[:10]:
    print(f"  {c[0]}: fees_7d={c[1]:+.1f}% / tvl_7d={c[2]:+.1f}% / 24h_fees=${c[3]/1e6:.2f}M / tvl=${c[4]/1e9:.2f}B")

# === DEX vols ===
print()
dexs = json.load(open('.dexs.json'))
print(f"DEX_TOTAL_24H: ${dexs.get('total24h',0)/1e9:.2f}B  c1d={dexs.get('change_1d')}%  c7d={dexs.get('change_7d')}%")
dps = dexs.get('protocols',[])
dps_sorted = sorted(dps, key=lambda p: -(p.get('total24h',0) or 0))
print("Top DEXes 24h:")
for p in dps_sorted[:6]:
    print(f"  {p.get('name')}: ${(p.get('total24h',0)/1e9):.2f}B  c1d={p.get('change_1d')}%  c7d={p.get('change_7d')}%")

# === Stables ===
print()
stables = json.load(open('.stables.json'))
peggs = stables.get('peggedAssets',[])
total_supply = 0
for s in peggs:
    cc = s.get('circulating',{}) or {}
    total_supply += cc.get('peggedUSD',0) or 0
total_prev = 0
for s in peggs:
    cp = s.get('circulatingPrevDay',{}) or {}
    total_prev += cp.get('peggedUSD',0) or 0
total_prevw = 0
for s in peggs:
    cpw = s.get('circulatingPrevWeek',{}) or {}
    total_prevw += cpw.get('peggedUSD',0) or 0

stable_d_pct = ((total_supply - total_prev)/total_prev*100) if total_prev else 0
stable_w_pct = ((total_supply - total_prevw)/total_prevw*100) if total_prevw else 0
print(f"STABLES_TOTAL: ${total_supply/1e9:.1f}B  1d={stable_d_pct:+.2f}%  7d={stable_w_pct:+.2f}%")

# Top stables by movement
print("Top stables by 1d change (|1d|>=1%, supply>=$500M):")
movers_s = []
for s in peggs:
    cc = (s.get('circulating',{}) or {}).get('peggedUSD',0) or 0
    cp = (s.get('circulatingPrevDay',{}) or {}).get('peggedUSD',0) or 0
    if cc < 500e6 or not cp: continue
    pct = (cc-cp)/cp*100
    if abs(pct) >= 1:
        movers_s.append((s.get('symbol'), cc, pct))
for m in sorted(movers_s, key=lambda x: -abs(x[2]))[:8]:
    print(f"  {m[0]}: ${m[1]/1e9:.2f}B  1d={m[2]:+.2f}%")

# === Yields ===
print()
pools = json.load(open('.pools.json'))['data']
print(f"POOLS_TOTAL: {len(pools)}")
# Real yield filter
real = []
for p in pools:
    if p.get('outlier'): continue
    if (p.get('apyBase') or 0) <= 0: continue
    apy = p.get('apy') or 0
    apyR = p.get('apyReward') or 0
    apyB = p.get('apyBase') or 0
    if apy and (apyR/apy) >= 0.5: continue
    pred = p.get('predictions',{}) or {}
    bc = pred.get('predictedProbability') and pred.get('binnedConfidence')
    if (pred.get('binnedConfidence') or 0) < 2: continue
    if (p.get('apyMean30d') or 0) < apy * 0.5: continue
    if (p.get('tvlUsd') or 0) < 10e6: continue
    real.append(p)
real_sorted = sorted(real, key=lambda p: -(p.get('apyBase') or 0))
print("Real yield candidates (top 10 by apyBase):")
for p in real_sorted[:10]:
    print(f"  {p.get('symbol')} ({p.get('project')}/{p.get('chain')}): apyBase={p.get('apyBase'):.2f}% apyReward={p.get('apyReward')} tvl=${(p.get('tvlUsd',0)/1e6):.0f}M apyMean30d={p.get('apyMean30d')} bc={p.get('predictions',{}).get('binnedConfidence')}")

# Incentive yield
print()
inc = []
for p in pools:
    if p.get('outlier'): continue
    if (p.get('apyReward') or 0) <= 0: continue
    if (p.get('tvlUsd') or 0) < 25e6: continue
    inc.append(p)
inc_sorted = sorted(inc, key=lambda p: -(p.get('apy') or 0))
print("Incentive yield top 10 by apy:")
for p in inc_sorted[:10]:
    rt = p.get('rewardTokens') or []
    print(f"  {p.get('symbol')} ({p.get('project')}/{p.get('chain')}): apy={p.get('apy'):.1f}% apyReward={p.get('apyReward'):.1f}% tvl=${(p.get('tvlUsd',0)/1e6):.0f}M reward_count={len(rt)}")
