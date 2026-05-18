import json, math, glob, os
from datetime import datetime, timezone

NOW = datetime(2026,5,18,12,52,0,tzinfo=timezone.utc)
CACHE = "/home/runner/work/aeon/aeon/.gt-cache"

def num(x):
    try:
        if x is None: return None
        return float(x)
    except: return None

pools = []

# standard GeckoTerminal files
std_files = ["global.json","solana-trend.json","solana-vol.json","eth-trend.json","eth-vol.json",
             "base-trend.json","base-vol.json","bsc-trend.json","arbitrum-trend.json","arbitrum-vol.json","new.json"]
for fn in std_files:
    path = os.path.join(CACHE,fn)
    try:
        d = json.load(open(path))
    except Exception as e:
        print("SKIP",fn,e); continue
    data = d.get("data")
    if not isinstance(data,list):
        print("NODATA",fn); continue
    for p in data:
        a = p.get("attributes",{})
        rel = p.get("relationships",{})
        net = rel.get("network",{}).get("data",{}).get("id")
        base = rel.get("base_token",{}).get("data",{}).get("id")
        pcp = a.get("price_change_percentage",{}) or {}
        vol = a.get("volume_usd",{}) or {}
        tx = (a.get("transactions",{}) or {}).get("h24",{}) or {}
        pools.append(dict(
            network=net, name=a.get("name"), base=base,
            m5=num(pcp.get("m5")), h1=num(pcp.get("h1")), h6=num(pcp.get("h6")), h24=num(pcp.get("h24")),
            vol24=num(vol.get("h24")), liq=num(a.get("reserve_in_usd")),
            mcap=num(a.get("market_cap_usd")), fdv=num(a.get("fdv_usd")),
            created=a.get("pool_created_at"),
            buys=num(tx.get("buys")) or 0, sells=num(tx.get("sells")) or 0,
        ))

# bsc-vol simplified WebFetch file
try:
    d = json.load(open(os.path.join(CACHE,"bsc-vol-wf.json")))
    for p in d["data"]:
        pools.append(dict(
            network=p["network"], name=p["name"], base=p["base"],
            m5=num(p.get("m5")), h1=num(p.get("h1")), h6=num(p.get("h6")), h24=num(p.get("h24")),
            vol24=num(p.get("vol24")), liq=num(p.get("liq")),
            mcap=num(p.get("mcap")), fdv=num(p.get("fdv")),
            created=p.get("created"),
            buys=num(p.get("buys")) or 0, sells=num(p.get("sells")) or 0,
        ))
except Exception as e:
    print("SKIP bsc-vol-wf",e)

print("TOTAL raw pools:",len(pools))

# dedupe by base token, keep highest vol24
best = {}
for p in pools:
    b = p["base"]
    if not b: continue
    v = p["vol24"] or 0
    if b not in best or v > (best[b]["vol24"] or 0):
        best[b] = p
deduped = list(best.values())
print("PRE-GATE deduped:",len(deduped))

def age_hours(ts):
    if not ts: return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z","+00:00"))
        return (NOW-dt).total_seconds()/3600
    except: return None

rej = dict(thin=0,dump=0,honey=0,toonew=0,ruglike=0,nomove=0,thinliq=0)
gated = []
for p in deduped:
    h24=p["h24"]; vol=p["vol24"]; liq=p["liq"]; b=p["buys"]; s=p["sells"]
    if vol is None or vol < 50000: rej["thin"]+=1; continue
    if h24 is None or h24 <= 0: rej["nomove"]+=1; continue
    if liq is None or liq < 10000: rej["thinliq"]+=1; continue
    if b>0 and s/ max(b,1e-9) > 10: rej["dump"]+=1; continue
    if s>0 and b/ max(s,1e-9) > 50: rej["honey"]+=1; continue
    ah = age_hours(p["created"])
    if ah is not None and ah < 1 and vol < 100000: rej["toonew"]+=1; continue
    if h24 > 10000: rej["ruglike"]+=1; continue
    p["age_h"]=ah
    gated.append(p)

print("POST-GATE:",len(gated))
print("REJ:",rej)

def clamp(x,a,b): return max(a,min(b,x))

for p in gated:
    h24=p["h24"]; vol=p["vol24"]; liq=p["liq"]; h1=p["h1"] if p["h1"] is not None else 0
    b=p["buys"]; s=p["sells"]
    pct=clamp(h24/500,0,1)
    vp=clamp(math.log10(vol+1)/7,0,1)
    lp=clamp(math.log10(liq+1)/6,0,1)
    mp=clamp((h1+50)/100,0,1)
    sk=clamp(b/(b+s) if (b+s)>0 else 0.5,0,1)
    p["score"]=40*pct+25*vp+15*lp+10*mp+10*sk
    # tag
    if liq>=1_000_000 and vol>=1_000_000: tag="DEEP-LIQ"
    elif p["age_h"] is not None and p["age_h"]<=48 and vol>=250_000: tag="BREAKOUT"
    elif h1>2 and h24>50: tag="CONTINUATION"
    elif h1<-5 and h24>0: tag="REVERSAL"
    else: tag="MICRO-SPEC"
    p["tag"]=tag

gated.sort(key=lambda x:-x["score"])
top5 = gated[:5]

def fmt_usd(v):
    if v is None: return "n/a"
    if v>=1e6: return f"${v/1e6:.1f}m"
    if v>=1e3: return f"${v/1e3:.0f}k"
    return f"${v:.0f}"
def fmt_pct(v):
    if v is None: return "n/a"
    if abs(v)<10: return f"{'+' if v>=0 else ''}{v:.1f}%"
    return f"{'+' if v>=0 else ''}{v:.0f}%"

print("\n=== TOP 5 ===")
for i,p in enumerate(top5,1):
    sk = p["buys"]/(p["buys"]+p["sells"]) if (p["buys"]+p["sells"])>0 else 0
    print(f"{i}. [{p['tag']}] {p['name']} ({p['network']}) h24={fmt_pct(p['h24'])} "
          f"score={p['score']:.0f} vol={fmt_usd(p['vol24'])} liq={fmt_usd(p['liq'])} "
          f"h1={fmt_pct(p['h1'])} h6={fmt_pct(p['h6'])} buys={sk*100:.0f}% age_h={p['age_h']}")

# verdict
tags=[p["tag"] for p in top5]
deepliq=tags.count("DEEP-LIQ"); cont=tags.count("CONTINUATION")
if len(top5)<5: verdict="SLEEPY"
elif deepliq>=2: verdict="STRONG"
elif deepliq==1 or cont>=2: verdict="MIXED"
else: verdict="SPECULATIVE"
print("\nVERDICT:",verdict, "deepliq=",deepliq,"cont=",cont)
print("ALL TAGS:",tags)
