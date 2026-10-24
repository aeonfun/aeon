import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
TOPIC = "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b"

POOLS = {
    "aerodrome-deepest DEUS/VIRTUAL": "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa",
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
# ~82 min back: 2456 blocks at ~2s
lo = head - 2500
print("window", hex(lo), hex(head), "now", now)

for name, addr in POOLS.items():
    try:
        logs = rpc("eth_getLogs", [{"address": addr, "fromBlock": hex(lo), "toBlock": hex(head), "topics": [TOPIC]}])
        print(f"{name:34s} {addr} swaps_last_82m={len(logs)}")
        if logs:
            b = rpc("eth_getBlockByNumber", [logs[-1]["blockNumber"], False])
            print("   last block", int(logs[-1]["blockNumber"], 16), "age_min", round((now - int(b["timestamp"], 16)) / 60, 1))
    except Exception as e:
        print(f"{name:34s} ERROR {e}")
    time.sleep(1)
