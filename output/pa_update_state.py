import json, os, shutil, datetime, sys

p = "memory/topics/price-alert-state.json"
st = json.load(open(p))
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

price = float(sys.argv[1])
h1 = float(sys.argv[2])
h24 = float(sys.argv[3])

st["last_run_at"] = now
st["last_price"] = {
    "price_usd": price,
    "h1_pct": h1,
    "h24_pct": h24,
    "pool": "aerodrome DEUS/VIRTUAL",
    "liquidity_usd": 709256.10,
    "observed_at": now,
}

shutil.copyfile(p, p + ".bak")
tmp = p + ".tmp"
with open(tmp, "w") as f:
    json.dump(st, f, indent=2)
    f.write("\n")
os.replace(tmp, p)
json.load(open(p))
print("STATE_VALID", now)
