import json, urllib.request, time

RPC = "https://rpc.mainnet.chain.robinhood.com"
A = "0xc4f730335fb9e439ca5552f7b52b8e638c4245b0"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

def rpc(method, params, timeout=30):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"error": {"message": str(e)}}

latest = int(rpc("eth_blockNumber", [])["result"], 16)
print("latest_block", latest)
print("supply_raw", int(rpc("eth_call", [{"to": A, "data": "0x18160ddd"}, "latest"])["result"], 16))
print("supply_tokens", int(rpc("eth_call", [{"to": A, "data": "0x18160ddd"}, "latest"])["result"], 16) / 1e18)

# probe a few windows for logs
for span in (1000, 5000, 30000):
    lo = latest - span
    res = rpc("eth_getLogs", [{"address": A, "fromBlock": hex(lo), "toBlock": hex(latest)}])
    if "error" in res:
        print("span", span, "ERR", str(res["error"])[:160])
    else:
        print("span", span, "logs", len(res.get("result", [])))
