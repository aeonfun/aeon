import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
DEUS = "0x940A319B75861014A220D9c6c144d108552B089B"
A = "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
head = None
LO, HI = 53004000, 53016000


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
logs = []
lo = LO
while lo <= HI:
    hi = min(lo + 999, HI)
    logs.extend(rpc("eth_getLogs", [{
        "address": DEUS, "fromBlock": hex(lo), "toBlock": hex(hi),
        "topics": [TRANSFER, "0x" + pad + A[2:], None]}]))
    lo = hi + 1
    time.sleep(0.4)

print("DEUS transfers OUT of lifi diamond:", len(logs))
agg = {}
for L in logs:
    to = "0x" + L["topics"][2][-40:]
    agg[to] = agg.get(to, 0) + int(L["data"], 16) / 1e18
for k, v in sorted(agg.items(), key=lambda x: -x[1]):
    print(f"  -> {k} : {v:,.4f}")
print("total", f"{sum(agg.values()):,.4f}")
