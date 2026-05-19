import json, os, glob, math, datetime
from collections import Counter

CACHE = "/home/runner/work/aeon/aeon/.gt-cache"
NOW = datetime.datetime.now(datetime.timezone.utc)

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def fnum(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

files = glob.glob(os.path.join(CACHE, "*.json"))
pools = {}
raw_count = 0

for f in files:
    try:
        data = json.load(open(f))
    except Exception:
        continue
    if not isinstance(data, dict) or not isinstance(data.get("data"), list):
        continue
    for p in data["data"]:
        a = p.get("attributes", {})
        rel = p.get("relationships", {})
        raw_count += 1
        bt = rel.get("base_token", {}).get("data", {})
        net = rel.get("network", {}).get("data", {})
        bt_id = (bt.get("id") if bt else None) or a.get("address")
        vol = a.get("volume_usd", {}) or {}
        pcp = a.get("price_change_percentage", {}) or {}
        txn = (a.get("transactions", {}) or {}).get("h24", {}) or {}
        rec = {
            "name": a.get("name", "?"),
            "network": (net.get("id") if net else "?"),
            "h24v": fnum(vol.get("h24")) or 0.0,
            "h24p": fnum(pcp.get("h24")),
            "h6p": fnum(pcp.get("h6")),
            "h1p": fnum(pcp.get("h1")),
            "reserve": fnum(a.get("reserve_in_usd")) or 0.0,
            "mcap": fnum(a.get("market_cap_usd")),
            "fdv": fnum(a.get("fdv_usd")),
            "buys": int(txn.get("buys") or 0),
            "sells": int(txn.get("sells") or 0),
            "created": a.get("pool_created_at"),
            "bt_id": bt_id,
        }
        prev = pools.get(bt_id)
        if prev is None or rec["h24v"] > prev["h24v"]:
            pools[bt_id] = rec

deduped = list(pools.values())
pre_gate = len(deduped)
rej = {"thin-vol":0,"down/no-move":0,"thin-liq":0,"dumping":0,"honeypot":0,"too-new":0,"rug-like":0}
survivors = []

for r in deduped:
    h24p = r["h24p"]
    if r["h24v"] < 50000:
        rej["thin-vol"] += 1; continue
    if h24p is None or h24p <= 0:
        rej["down/no-move"] += 1; continue
    if r["reserve"] < 10000:
        rej["thin-liq"] += 1; continue
    b, s = r["buys"], r["sells"]
    if b > 0 and s / b > 10:
        rej["dumping"] += 1; continue
    if s > 0 and b / s > 50:
        rej["honeypot"] += 1; continue
    age_h = None
    if r["created"]:
        try:
            ct = datetime.datetime.fromisoformat(r["created"].replace("Z","+00:00"))
            age_h = (NOW - ct).total_seconds() / 3600.0
        except Exception:
            age_h = None
    r["age_h"] = age_h
    if age_h is not None and age_h < 1 and r["h24v"] < 100000:
        rej["too-new"] += 1; continue
    if h24p > 10000:
        rej["rug-like"] += 1; continue
    survivors.append(r)

post_gate = len(survivors)

for r in survivors:
    h24p = r["h24p"]
    h1p = r["h1p"] if r["h1p"] is not None else 0.0
    h6p = r["h6p"] if r["h6p"] is not None else 0.0
    pct_pts = clamp(h24p / 500.0, 0, 1)
    vol_pts = clamp(math.log10(r["h24v"] + 1) / 7.0, 0, 1)
    liq_pts = clamp(math.log10(r["reserve"] + 1) / 6.0, 0, 1)
    mom_pts = clamp((h1p + 50.0) / 100.0, 0, 1)
    tot = r["buys"] + r["sells"]
    skew_pts = clamp(r["buys"] / tot, 0, 1) if tot > 0 else 0.5
    r["score"] = 40*pct_pts + 25*vol_pts + 15*liq_pts + 10*mom_pts + 10*skew_pts
    r["skew"] = (r["buys"] / tot * 100) if tot > 0 else 0
    age_h = r.get("age_h")
    if r["reserve"] >= 1_000_000 and r["h24v"] >= 1_000_000:
        r["tag"] = "DEEP-LIQ"
    elif age_h is not None and age_h <= 48 and r["h24v"] >= 250_000:
        r["tag"] = "BREAKOUT"
    elif h1p > 2 and h24p > 50:
        r["tag"] = "CONTINUATION"
    elif h1p < -5 and h24p > 0:
        r["tag"] = "REVERSAL"
    else:
        r["tag"] = "MICRO-SPEC"

survivors.sort(key=lambda r: r["score"], reverse=True)
top = survivors[:5]

print("RAW_OBJECTS:", raw_count)
print("PRE_GATE:", pre_gate)
print("POST_GATE:", post_gate)
print("REJECTIONS:", json.dumps(rej))
print("TOP5:")
for i, r in enumerate(top, 1):
    age = ("%.0fh" % r["age_h"]) if r.get("age_h") is not None else "n/a"
    print(f"  {i}. [{r['tag']}] {r['name']} ({r['network']}) h24={r['h24p']:.0f}% "
          f"score={r['score']:.1f} vol={r['h24v']:.0f} liq={r['reserve']:.0f} "
          f"h1={r['h1p']} h6={r['h6p']} buys={r['buys']} sells={r['sells']} "
          f"skew={r['skew']:.0f}% mcap={r['mcap']} fdv={r['fdv']} age={age}")
tc = Counter(r["tag"] for r in top)
print("TOP5_TAGS:", json.dumps(tc))
