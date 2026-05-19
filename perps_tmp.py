import json, os

C = ".coinglass-cache"
COINS = ["1000PEPE","ADA","BCH","BILL","BNB","BSB","BTC","CL","DOGE","EDEN","ZEC"]
TIER1 = {"BTC","ETH","SOL"}

def load(name):
    p = os.path.join(C, name + ".json")
    if not os.path.exists(p):
        return None
    try:
        d = json.load(open(p))
        return d.get("data")
    except Exception:
        return None

def f(x):
    try:
        return float(x)
    except Exception:
        return None

def mean(xs):
    xs = [v for v in xs if v is not None]
    return sum(xs)/len(xs) if xs else None

def pct(arr, key):
    return [f(r.get(key)) for r in arr]

def p75(xs):
    xs = sorted(v for v in xs if v is not None)
    if not xs:
        return None
    i = 0.75*(len(xs)-1)
    lo = int(i); hi = min(lo+1, len(xs)-1)
    return xs[lo] + (xs[hi]-xs[lo])*(i-lo)

res = {}
for c in COINS:
    price = load("price-"+c)
    oi = load("oi-"+c)
    funding = load("funding-"+c)
    if not price or not oi or not funding:
        print("DROP "+c+": missing critical")
        continue
    liq = load("liq-"+c)
    topls = load("topls-"+c)
    basis = load("basis-"+c)
    taker = load("taker-"+c)
    p1h = load("price-1h-"+c)

    m = {}
    cl = pct(price, "close")
    vol = pct(price, "volume_usd")
    hi = pct(price, "high")
    lo = pct(price, "low")
    m["current_price"] = cl[-1]
    m["pct_24h"] = (cl[-1]-cl[-2])/cl[-2]*100
    m["pct_7d"] = (cl[-1]-cl[0])/cl[0]*100
    m["vol_ratio"] = vol[-1]/mean(vol[:-1]) if mean(vol[:-1]) else None
    h7 = max(hi[-7:]); l7 = min(lo[-7:])
    m["range_7d_pct"] = (h7-l7)/l7*100
    oic = pct(oi, "close")
    m["oi_now"] = oic[-1]
    m["oi_24h_pct"] = (oic[-1]-oic[-2])/oic[-2]*100
    m["oi_7d_pct"] = (oic[-1]-oic[0])/oic[0]*100
    fc = pct(funding, "close")
    m["funding_now"] = fc[-1]
    m["funding_7d_avg"] = mean(fc)
    m["funding_delta"] = m["funding_now"]-m["funding_7d_avg"]

    if liq:
        ll = [f(r.get("aggregated_long_liquidation_usd")) for r in liq]
        sl = [f(r.get("aggregated_short_liquidation_usd")) for r in liq]
        tot = [(ll[i] or 0)+(sl[i] or 0) for i in range(len(liq))]
        m["liq_24h_total"] = tot[-1]
        m["liq_7d_p75"] = p75(tot)
        m["long_liqs_24h"] = ll[-1]
        m["short_liqs_24h"] = sl[-1]
        m["short_liqs_p75"] = p75(sl)
        m["liqs_4h"] = tot[-1]*4/24
    else:
        for k in ["liq_24h_total","liq_7d_p75","long_liqs_24h","short_liqs_24h","short_liqs_p75","liqs_4h"]:
            m[k] = None

    if topls:
        tr = pct(topls, "top_position_long_short_ratio")
        m["top_ls_now"] = tr[-1]
        m["top_ls_7d_avg"] = mean(tr[-7:])
        m["top_ls_delta_7d"] = tr[-1]-tr[0]
    else:
        m["top_ls_now"]=m["top_ls_7d_avg"]=m["top_ls_delta_7d"]=None

    if basis:
        bc = pct(basis, "close_basis")
        m["basis_now"] = bc[-1]
        m["basis_7d_avg"] = mean(bc[-7:])
    else:
        m["basis_now"]=m["basis_7d_avg"]=None

    if taker:
        b = f(taker[-1].get("taker_buy_volume_usd"))
        s = f(taker[-1].get("taker_sell_volume_usd"))
        m["taker_buy_pct_24h"] = b/(b+s)*100 if (b is not None and s is not None and b+s>0) else None
    else:
        m["taker_buy_pct_24h"] = None

    if p1h and len(p1h) >= 5:
        pc = pct(p1h, "close")
        m["pct_4h"] = (pc[-1]-pc[-5])/pc[-5]*100
    else:
        m["pct_4h"] = None

    m["tier"] = 1 if c in TIER1 else 2
    res[c] = m

btc = res.get("BTC")
for c,m in res.items():
    if btc:
        m["pct_24h_vs_btc"] = m["pct_24h"]-btc["pct_24h"]
        m["pct_7d_vs_btc"] = m["pct_7d"]-btc["pct_7d"]
    else:
        m["pct_24h_vs_btc"]=m["pct_7d_vs_btc"]=None

json.dump(res, open("perps_metrics_tmp.json","w"), indent=1)
for c,m in res.items():
    print("\n"+c+" T"+str(m['tier']))
    for k in ["current_price","pct_24h","pct_7d","pct_4h","range_7d_pct","vol_ratio","oi_24h_pct","oi_7d_pct","funding_now","funding_7d_avg","funding_delta","liq_24h_total","liq_7d_p75","long_liqs_24h","short_liqs_24h","short_liqs_p75","liqs_4h","top_ls_now","top_ls_7d_avg","top_ls_delta_7d","basis_now","basis_7d_avg","taker_buy_pct_24h","pct_24h_vs_btc","pct_7d_vs_btc"]:
        v = m.get(k)
        if v is None:
            print("  "+k+": None")
        elif abs(v) >= 1000:
            print("  "+k+": "+format(v,",.0f"))
        else:
            print("  "+k+": "+format(v,".4f"))
