import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa"
TOPIC = "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b"

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
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(1 << attempt)

head = int(rpc("eth_blockNumber", []), 16)
print("head", head)

# walk backwards in 1000-block windows until we find swaps
start = head
found = None
for _ in range(30):
    lo = max(0, start - 999)
    logs = rpc("eth_getLogs", [{
        "address": POOL, "fromBlock": hex(lo), "toBlock": hex(start), "topics": [TOPIC]
    }])
    if logs:
        found = logs
        print("window", hex(lo), hex(start), "swaps", len(logs))
        break
    print("window", hex(lo), hex(start), "swaps 0")
    start = lo - 1

if found:
    last = found[-1]
    b = rpc("eth_getBlockByNumber", [last["blockNumber"], False])
    ts = int(b["timestamp"], 16)
    print("LAST_SWAP_BLOCK", int(last["blockNumber"], 16))
    print("LAST_SWAP_TS", ts)
    print("LAST_SWAP_TX", last["transactionHash"])
    print("NOW_TS", int(time.time()))
    print("AGE_MIN", round((int(time.time()) - ts) / 60, 2))
