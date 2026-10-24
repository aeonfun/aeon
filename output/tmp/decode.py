import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"

def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as r:
        d = json.loads(r.read())
    if "error" in d:
        raise RuntimeError(d["error"])
    return d["result"]

tx = "0x156d9316ab040c0dd4c73ac02eafcfb9df2c58a930518dc8e476c5d9cbbaa762"
r = rpc("eth_getTransactionReceipt", [tx])
POOL = "0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa"
for L in r["logs"]:
    if L["address"].lower() == POOL:
        print("topics:", L["topics"])
        print("data:", L["data"])
        d = L["data"][2:]
        for i in range(0, len(d), 64):
            w = d[i:i+64]
            print(f"  word[{i//64}] hex={w} dec={int(w,16)}")
print()
print("target DEUS 319562.226531e18 =", 319562226531 * 10**12)
print("target VIRTUAL 8618.53151997545e18 =", int(8618.53151997545 * 1e18))
