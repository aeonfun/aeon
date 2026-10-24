import json, urllib.request

RPC = "https://base.gateway.tenderly.co"
DEUS = "0x940A319B75861014A220D9c6c144d108552B089B"
pad = "0" * 24
ADDRS = {
    "0x7f6aba7563cb5d31980d440337d3d1a6e3db58f3": "bought 267,140 from pool via sink",
    "0x6a45ca8bb30f396f40721e105e0aa6cabf326657": "bought 39,849 from pool via sink",
    "0x09b383a627c3d35daf38cd77af0064c1848833c6": "old whale, kept the DEUS",
    "0x939e398d2c31b0757d009222de99c6e461d3de15": "sink contract",
    "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae": "LiFi diamond",
}


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as r:
        d = json.loads(r.read())
    if "error" in d:
        raise RuntimeError(d["error"])
    return d["result"]


for a, note in ADDRS.items():
    bal = int(rpc("eth_call", [{"to": DEUS, "data": "0x70a08231" + pad + a[2:]}, "latest"]), 16) / 1e18
    n = int(rpc("eth_getTransactionCount", [a, "latest"]), 16)
    print(f"{a}  bal={bal:>16,.4f}  nonce={n:<6} {note}")
