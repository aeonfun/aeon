import json, urllib.request, time

RPC = "https://rpc.mainnet.chain.robinhood.com"

def rpc(method, params, timeout=30):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            last = str(e)
            time.sleep(1)
    return {"error": {"message": last}}

latest = int(rpc("eth_blockNumber", [])["result"], 16)
for n in (latest, latest - 1000, latest - 10000, latest - 50000):
    b = rpc("eth_getBlockByNumber", [hex(n), False])
    ts = int(b["result"]["timestamp"], 16)
    print(n, ts, time.strftime("%Y-%m-%d %H:%M:%SZ", time.gmtime(ts)))
