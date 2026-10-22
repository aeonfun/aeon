import json, os, shutil, tempfile, datetime

STATE = "memory/topics/price-alert-state.json"
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

shutil.copyfile(STATE, STATE + ".bak")

with open(STATE) as f:
    st = json.load(f)

st["last_run_at"] = now
st["last_price"] = {
    "price_usd": 0.01834,
    "h1_pct": -0.7,
    "h24_pct": 4.9,
    "pool": "aerodrome DEUS/VIRTUAL",
    "liquidity_usd": 709235.97,
    "observed_at": now,
}

d = os.path.dirname(os.path.abspath(STATE))
fd, tmp = tempfile.mkstemp(dir=d)
with os.fdopen(fd, "w") as f:
    json.dump(st, f, indent=2)
    f.write("\n")
os.replace(tmp, STATE)

with open(STATE) as f:
    json.load(f)  # validation
print("STATE_VALID", now)
