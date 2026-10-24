import json, urllib.request

RPC = "https://base.gateway.tenderly.co"
A = "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae"


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as r:
        d = json.loads(r.read())
    if "error" in d:
        raise RuntimeError(d["error"])
    return d["result"]


code = rpc("eth_getCode", [A, "latest"])
print("code len", len(code), code[:20])
DEUS = "0x940A319B75861014A220D9c6c144d108552B089B"
pad = "0" * 24
bal = rpc("eth_call", [{"to": DEUS, "data": "0x70a08231" + pad + A[2:]}, "latest"])
print("router current DEUS balance", int(bal, 16) / 1e18)
nonce = rpc("eth_getTransactionCount", [A, "latest"])
print("nonce", int(nonce, 16))
