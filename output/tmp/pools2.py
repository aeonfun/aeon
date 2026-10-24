import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
TOPIC = "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b"

POOLS = {
    "aerodrome DEUS/USDC": "0x58dBa34e6ee6eb76Ef71A6ca0f18871CAE817D3b",
    "aero DEUS/USDC": "0x1B2f3f5C1B6037101FDD3EC14649E0d3F98fA642",
    "aerodrome DEUS/USDC 2": "0x75bc14950Ab093cBd1f80BbbDf458596939180A3",
}

def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                d = json.loads(r.read())
                if "error" in d:
                    raise RuntimeError(d["error"])
                return d["result"]
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1 << attempt)

head = int(rpc("eth_blockNumber", []), 16)
now = int(time.time())
start = head - 2456

for name, addr in POOLS.items():
    total = 0
    last_blk = None
    lo = start
    ok = True
    while lo <= head:
        hi = min(lo + 999, head)
        try:
            logs = rpc("eth_getLogs", [{"address": addr, "fromBlock": hex(lo), "toBlock": hex(hi), "topics": [TOPIC]}])
            total += len(logs)
            if logs:
                last_blk = int(logs[-1]["blockNumber"], 16)
        except Exception as e:
            ok = False
            print(f"{name}: ERR {e}")
            break
        lo = hi + 1
        time.sleep(0.4)
    age = ""
    if last_blk:
        b = rpc("eth_getBlockByNumber", [hex(last_blk), False])
        age = f" last_age_min={round((now-int(b['timestamp'],16))/60,1)}"
    if ok:
        print(f"{name:26s} {addr} swaps_83m={total}{age}")
