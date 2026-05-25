import json
d=json.load(open('.outputs/_perps_compute.json'))
print('dropped:',d['dropped'])
for a,m in d['metrics'].items():
    vol = m['vol_ratio'] if m['vol_ratio'] is None else round(m['vol_ratio'],2)
    tb = m['taker_buy_pct_24h'] and round(m['taker_buy_pct_24h'],2)
    print(f"{a:10s} t{m['tier']} regime={m['regime']:18s} p24={m['pct_24h']:7.2f} p7={m['pct_7d']:7.2f} oi24={m['oi_24h_pct']:7.2f} oi7={m['oi_7d_pct']:7.2f} fn={m['funding_now']:8.4f} fa={m['funding_7d_avg']:8.4f} fd={m['funding_delta']:8.4f} rng={m['range_7d_pct']:6.2f} vol={vol} tb={tb} tls={m['top_ls_now']} bsis={m['basis_now']} sub={m.get('sub_tags',[])} tags={m.get('pattern_tags',[])}")
