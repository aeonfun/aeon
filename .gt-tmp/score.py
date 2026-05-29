#!/usr/bin/env python3
import json, math, os, glob, sys
from datetime import datetime, timezone

TMPDIR = "/home/runner/work/aeon/aeon/.gt-tmp"
NOW = datetime(2026, 5, 29, 22, 14, 0, tzinfo=timezone.utc)

# Load all pool files
FILES = {
    "gt-global.json": "global",
    "gt-new.json": "new",
    "gt-solana-trend.json": "sol-trend",
    "gt-solana-vol.json": "sol-vol",
    "gt-eth-trend.json": "eth-trend",
    "gt-eth-vol.json": "eth-vol",
    "gt-base-trend.json": "base-trend",
    "gt-base-vol.json": "base-vol",
    "gt-bsc-trend.json": "bsc-trend",
    "gt-bsc-vol.json": "bsc-vol",
    "gt-arbitrum-trend.json": "arb-trend",
    "gt-arbitrum-vol.json": "arb-vol",
}

all_pools = []
src_status = {}
for fname, label in FILES.items():
    path = os.path.join(TMPDIR, fname)
    if not os.path.exists(path):
        src_status[label] = "missing"
        continue
    try:
        with open(path) as f:
            data = json.load(f)
        if "data" not in data:
            src_status[label] = "fail"
            continue
        for p in data["data"]:
            p["_source"] = label
            all_pools.append(p)
        src_status[label] = "ok"
    except Exception as e:
        src_status[label] = f"err: {e}"

print(f"Loaded {len(all_pools)} raw pool entries from {len([s for s in src_status.values() if s=='ok'])}/{len(FILES)} sources")

def fnum(d, *keys, default=0.0):
    cur = d
    for k in keys:
        if cur is None or not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    if cur is None: return default
    try: return float(cur)
    except: return default

def inum(d, *keys, default=0):
    v = fnum(d, *keys, default=None)
    if v is None: return default
    try: return int(v)
    except: return default

# Dedup by base_token id, keep highest volume_usd.h24
by_token = {}
for p in all_pools:
    attrs = p.get("attributes", {})
    rels = p.get("relationships", {})
    bt = rels.get("base_token", {}).get("data", {}).get("id")
    if not bt:
        continue
    vol = fnum(attrs, "volume_usd", "h24")
    if bt not in by_token or vol > fnum(by_token[bt].get("attributes", {}), "volume_usd", "h24"):
        by_token[bt] = p

print(f"After dedup: {len(by_token)} unique tokens")
pre_gate = len(by_token)

# Gate
gate_rejections = {"thin-vol":0, "negative":0, "thin-liq":0, "dumping":0, "honeypot":0, "too-new":0, "rug-like":0}
survivors = []
for bt, p in by_token.items():
    a = p.get("attributes", {})
    vol_h24 = fnum(a, "volume_usd", "h24")
    pct_h24 = fnum(a, "price_change_percentage", "h24")
    liq = fnum(a, "reserve_in_usd")
    buys = inum(a, "transactions", "h24", "buys")
    sells = inum(a, "transactions", "h24", "sells")
    pca = a.get("pool_created_at")
    age_h = 9999.0
    if pca:
        try:
            dt = datetime.fromisoformat(pca.replace("Z", "+00:00"))
            age_h = (NOW - dt).total_seconds() / 3600.0
        except: pass

    if vol_h24 < 50000: gate_rejections["thin-vol"] += 1; continue
    if pct_h24 <= 0: gate_rejections["negative"] += 1; continue
    if liq < 10000: gate_rejections["thin-liq"] += 1; continue
    if buys > 0 and sells / max(buys, 1) > 10: gate_rejections["dumping"] += 1; continue
    if sells > 0 and buys / max(sells, 1) > 50: gate_rejections["honeypot"] += 1; continue
    if age_h < 1.0 and vol_h24 < 100000: gate_rejections["too-new"] += 1; continue
    if pct_h24 > 10000: gate_rejections["rug-like"] += 1; continue

    p["_meta"] = dict(vol_h24=vol_h24, pct_h24=pct_h24, liq=liq, buys=buys, sells=sells, age_h=age_h)
    survivors.append(p)

print(f"Post-gate: {len(survivors)} pools")
print(f"Gate rejections: {gate_rejections}")

# Score
def clamp(x, lo, hi): return max(lo, min(hi, x))

for p in survivors:
    a = p.get("attributes", {})
    m = p["_meta"]
    pct = m["pct_h24"]
    vol = m["vol_h24"]
    liq = m["liq"]
    pct_h1 = fnum(a, "price_change_percentage", "h1")
    buys = m["buys"]; sells = m["sells"]

    pct_pts = clamp(pct / 500.0, 0, 1)
    vol_pts = clamp(math.log10(vol + 1) / 7.0, 0, 1)
    liq_pts = clamp(math.log10(liq + 1) / 6.0, 0, 1)
    mom_pts = clamp((pct_h1 + 50.0) / 100.0, 0, 1)
    skew_pts = clamp(buys / max(buys + sells, 1), 0, 1)

    score = 40*pct_pts + 25*vol_pts + 15*liq_pts + 10*mom_pts + 10*skew_pts
    p["_meta"]["score"] = score
    p["_meta"]["pct_h1"] = pct_h1
    p["_meta"]["pct_h6"] = fnum(a, "price_change_percentage", "h6")

# Tag
def tag(p):
    m = p["_meta"]
    if m["liq"] >= 1_000_000 and m["vol_h24"] >= 1_000_000:
        return "DEEP-LIQ"
    if m["age_h"] <= 48 and m["vol_h24"] >= 250_000:
        return "BREAKOUT"
    if m["pct_h1"] > 2 and m["pct_h24"] > 50:
        return "CONTINUATION"
    if m["pct_h1"] < -5 and m["pct_h24"] > 0:
        return "REVERSAL"
    return "MICRO-SPEC"

for p in survivors:
    p["_meta"]["tag"] = tag(p)

# Sort by score
survivors.sort(key=lambda p: -p["_meta"]["score"])

# Verdict from top 5
top5 = survivors[:5]
deep_count = sum(1 for p in top5 if p["_meta"]["tag"] == "DEEP-LIQ")
cont_count = sum(1 for p in top5 if p["_meta"]["tag"] == "CONTINUATION")
micro_count = sum(1 for p in top5 if p["_meta"]["tag"] in ("MICRO-SPEC", "BREAKOUT"))

if len(survivors) < 5:
    verdict = "SLEEPY"
elif deep_count >= 2:
    verdict = "STRONG"
elif deep_count == 1 or cont_count >= 2:
    verdict = "MIXED"
else:
    verdict = "SPECULATIVE"

print(f"\n=== VERDICT: {verdict} ===")
print(f"Top 5 tags: deep_liq={deep_count}, continuation={cont_count}, micro+breakout={micro_count}")

print("\n=== TOP 15 ===")
for i, p in enumerate(survivors[:15], 1):
    a = p.get("attributes", {})
    m = p["_meta"]
    name = a.get("name", "?")
    network = p.get("relationships", {}).get("network", {}).get("data", {}).get("id") or (p.get("id","").split("_")[0] if "_" in p.get("id","") else "?")
    pool_id = p.get("id", "?")
    print(f"{i:2d}. [{m['tag']:12s}] {name:35s} ({network:9s}) +{m['pct_h24']:.0f}% — score {m['score']:.1f}, vol ${m['vol_h24']/1e6:.1f}m, liq ${m['liq']/1000:.0f}k, h1 {m['pct_h1']:+.1f}%, h6 {m['pct_h6']:+.1f}%, buys {m['buys']}/{m['buys']+m['sells']}={100*m['buys']/max(m['buys']+m['sells'],1):.0f}%, age {m['age_h']:.1f}h, pool {pool_id}")

# Save summary
out = {
    "verdict": verdict,
    "pre_gate": pre_gate,
    "post_gate": len(survivors),
    "gate_rejections": gate_rejections,
    "src_status": src_status,
    "top15": [
        {
            "rank": i+1,
            "name": p["attributes"].get("name"),
            "network": p.get("relationships", {}).get("network", {}).get("data", {}).get("id") or (p.get("id","").split("_")[0] if "_" in p.get("id","") else None),
            "pool_id": p.get("id"),
            "tag": p["_meta"]["tag"],
            "score": round(p["_meta"]["score"], 2),
            "pct_h24": round(p["_meta"]["pct_h24"], 1),
            "pct_h1": round(p["_meta"]["pct_h1"], 1),
            "pct_h6": round(p["_meta"]["pct_h6"], 1),
            "vol_h24": int(p["_meta"]["vol_h24"]),
            "liq": int(p["_meta"]["liq"]),
            "buys": p["_meta"]["buys"],
            "sells": p["_meta"]["sells"],
            "age_h": round(p["_meta"]["age_h"], 1),
        }
        for i, p in enumerate(survivors[:15])
    ]
}
with open(os.path.join(TMPDIR, "summary.json"), "w") as f:
    json.dump(out, f, indent=2)
print("\nWrote summary.json")
