import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
DEUS = "0x940A319B75861014A220D9c6c144d108552B089B"
SINK = "0x939e398d2c31b0757d009222de99c6e461d3de15"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
# 00:24Z = block ~53006062, hours later
LO = 53004000
HI = 53016300


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    for a in range(5):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.loads(r.read())
            if "error" in d:
                raise RuntimeError(d["error"])
            return d["result"]
        except Exception:
            if a == 4:
                raise
            time.sleep(1 << a)


pad = "0" * 24
inside = pad + SINK[2:]
logs = []
lo = LO
while lo <= HI:
    hi = min(lo + 999, HI)
    chunk = rpc("eth_getLogs", [{
        "address": DEUS, "fromBlock": hex(lo), "toBlock": hex(hi),
        "topics": [TRANSFER, None, "0x" + inside],
    }])
    logs.extend(chunk)
    lo = hi + 1
    time.sleep(0.4)

print("transfers INTO sink:", len(logs))
tot = sum(int(L["data"], 16) for L in logs) / 1e18
print(f"total in: {tot:,.4f} DEUS")

# now where it goes out
out = []
lo = LO
while lo <= HI:
    hi = min(lo + 999, HI)
    chunk = rpc("eth_getLogs", [{
        "address": DEUS, "fromBlock": hex(lo), "toBlock": hex(hi),
        "topics": [TRANSFER, "0x" + inside, None],
    }])
    out.extend(chunk)
    lo = hi + 1
    time.sleep(0.4)

print("transfers OUT of sink:", len(out))
agg = {}
for L in out:
    to = "0x" + L["topics"][2][-40:]
    agg[to] = agg.get(to, 0) + int(L["data"], 16) / 1e18
tot_out = sum(agg.values())
print(f"total out: {tot_out:,.4f} DEUS")
for a, v in sorted(agg.items(), key=lambda x: -x[1]):
    print(f"  -> {a} : {v:,.4f}")

bal = rpc("eth_call", [{"to": DEUS, "data": "0x70a08231" + inside}, "latest"])
print(f"\nsink current DEUS balance: {int(bal,16)/1e18:,.4f}")
code = rpc("eth_getCode", [SINK, "latest"])
print(f"sink code: {code[:14]}... len={len(code)} ({'EOA' if code=='0x' else 'CONTRACT'})")
