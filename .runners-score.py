#!/usr/bin/env python3
import json, math, os, sys

REPO = "/home/runner/work/aeon/aeon"

# Inline solana volume data captured from WebFetch
SOLANA_VOL_INLINE = None  # filled by main if file absent

SOURCES = {
    "global":         f"{REPO}/.global.json",
    "solana-trend":   f"{REPO}/.solana-trend.json",
    "eth-trend":      f"{REPO}/.eth-trend.json",
    "base-trend":     f"{REPO}/.base-trend.json",
    "bsc-trend":      f"{REPO}/.bsc-trend.json",
    "arbitrum-trend": f"{REPO}/.arbitrum-trend.json",
    "solana-vol":     f"{REPO}/.solana-vol.json",
    "eth-vol":        f"{REPO}/.eth-vol.json",
    "base-vol":       f"{REPO}/.base-vol.json",
    "bsc-vol":        f"{REPO}/.bsc-vol.json",
    "arbitrum-vol":   f"{REPO}/.arbitrum-vol.json",
    "new":            f"{REPO}/.new.json",
}

def load(path):
    try:
        with open(path) as f:
            d = json.load(f)
        if isinstance(d, dict) and d.get("status", {}).get("error_code") == 429:
            return None, "429"
        if "data" not in d:
            return None, "no-data"
        return d["data"], "ok"
    except Exception as e:
        return None, f"err:{e}"

source_status = {}
all_pools = []
for name, path in SOURCES.items():
    pools, st = load(path)
    source_status[name] = st
    if pools:
        all_pools.extend(pools)

print(f"Sources: {source_status}", file=sys.stderr)
print(f"Total pool records: {len(all_pools)}", file=sys.stderr)

# Dedupe by base_token id, keep highest 24h volume
def vol(p):
    try:
        return float(p["attributes"]["volume_usd"]["h24"] or 0)
    except: return 0

dedup = {}
for p in all_pools:
    try:
        tok = p["relationships"]["base_token"]["data"]["id"]
    except:
        continue
    if tok not in dedup or vol(p) > vol(dedup[tok]):
        dedup[tok] = p

pre_gate = len(dedup)
print(f"Pre-gate unique tokens: {pre_gate}", file=sys.stderr)

# Gate
import datetime as dt
now = dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc)

def parse_dt(s):
    try:
        return dt.datetime.fromisoformat(s.replace("Z","+00:00"))
    except: return None

rejections = {"thin-vol":0,"dumping":0,"honeypot":0,"too-new":0,"rug-like":0,"neg":0,"low-liq":0}
survivors = []
for tok, p in dedup.items():
    a = p["attributes"]
    try:
        v24 = float(a["volume_usd"]["h24"] or 0)
        pct24 = float(a["price_change_percentage"]["h24"] or 0)
        liq = float(a["reserve_in_usd"] or 0)
        buys = int(a["transactions"]["h24"]["buys"] or 0)
        sells = int(a["transactions"]["h24"]["sells"] or 0)
        created = parse_dt(a["pool_created_at"])
    except Exception as e:
        continue

    if v24 < 50000:
        rejections["thin-vol"] += 1; continue
    if pct24 <= 0:
        rejections["neg"] += 1; continue
    if liq < 10000:
        rejections["low-liq"] += 1; continue
    if sells > 0 and buys / max(sells,1) > 50 and sells < 10:
        rejections["honeypot"] += 1; continue
    if buys > 0 and sells / max(buys,1) > 10:
        rejections["dumping"] += 1; continue
    if created and (now - created).total_seconds() < 3600 and v24 < 100000:
        rejections["too-new"] += 1; continue
    if pct24 > 10000:
        rejections["rug-like"] += 1; continue
    survivors.append(p)

post_gate = len(survivors)
print(f"Post-gate: {post_gate}, rejections: {rejections}", file=sys.stderr)

def clamp(x,a,b): return max(a, min(b, x))

def score(p):
    a = p["attributes"]
    pct24 = float(a["price_change_percentage"]["h24"] or 0)
    pct1 = float(a["price_change_percentage"]["h1"] or 0)
    v24 = float(a["volume_usd"]["h24"] or 0)
    liq = float(a["reserve_in_usd"] or 0)
    buys = int(a["transactions"]["h24"]["buys"] or 0)
    sells = int(a["transactions"]["h24"]["sells"] or 0)
    pct_pts = clamp(pct24/500, 0, 1)
    vol_pts = clamp(math.log10(v24+1)/7, 0, 1)
    liq_pts = clamp(math.log10(liq+1)/6, 0, 1)
    mom_pts = clamp((pct1+50)/100, 0, 1)
    skew_pts = clamp(buys/max(buys+sells,1), 0, 1)
    return 40*pct_pts + 25*vol_pts + 15*liq_pts + 10*mom_pts + 10*skew_pts

def tag(p):
    a = p["attributes"]
    pct24 = float(a["price_change_percentage"]["h24"] or 0)
    pct1 = float(a["price_change_percentage"]["h1"] or 0)
    v24 = float(a["volume_usd"]["h24"] or 0)
    liq = float(a["reserve_in_usd"] or 0)
    created = parse_dt(a["pool_created_at"])
    if liq >= 1_000_000 and v24 >= 1_000_000:
        return "DEEP-LIQ"
    if created and (now - created).total_seconds() < 48*3600 and v24 >= 250_000:
        return "BREAKOUT"
    if pct1 > 2 and pct24 > 50:
        return "CONTINUATION"
    if pct1 < -5 and pct24 > 0:
        return "REVERSAL"
    return "MICRO-SPEC"

ranked = sorted(survivors, key=score, reverse=True)
top = ranked[:5]

def fmt_dollar(x):
    if x is None: return "n/a"
    x = float(x)
    if x >= 1e9: return f"${x/1e9:.1f}b"
    if x >= 1e6: return f"${x/1e6:.1f}m"
    if x >= 1e3: return f"${x/1e3:.0f}k"
    return f"${x:.0f}"

def fmt_pct(x):
    if abs(x) < 10: return f"{x:+.1f}%"
    return f"{x:+.0f}%"

result = {"status": source_status, "pre_gate": pre_gate, "post_gate": post_gate,
         "rejections": rejections, "top": []}
for p in top:
    a = p["attributes"]
    chain = p["relationships"]["network"]["data"]["id"]
    name = a["name"]
    pct24 = float(a["price_change_percentage"]["h24"] or 0)
    pct1 = float(a["price_change_percentage"]["h1"] or 0)
    v24 = float(a["volume_usd"]["h24"] or 0)
    liq = float(a["reserve_in_usd"] or 0)
    fdv = a.get("fdv_usd")
    mcap = a.get("market_cap_usd")
    buys = int(a["transactions"]["h24"]["buys"] or 0)
    sells = int(a["transactions"]["h24"]["sells"] or 0)
    result["top"].append({
        "name": name, "chain": chain, "tag": tag(p), "score": round(score(p),1),
        "pct24": pct24, "pct1": pct1, "vol24": v24, "liq": liq,
        "fdv": float(fdv) if fdv else None, "mcap": float(mcap) if mcap else None,
        "buys": buys, "sells": sells, "created": a["pool_created_at"],
        "_fmt": {
            "vol": fmt_dollar(v24), "liq": fmt_dollar(liq),
            "fdv": fmt_dollar(float(fdv)) if fdv else None,
            "mcap": fmt_dollar(float(mcap)) if mcap else None,
            "pct24": fmt_pct(pct24), "pct1": fmt_pct(pct1),
        }
    })

print(json.dumps(result, indent=2))
