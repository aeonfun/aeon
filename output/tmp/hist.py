import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
DEUS = "0x940A319B75861014A220D9c6c144d108552B089B"
pad = "0" * 24
W = ["0x7f6aba7563cb5d31980d440337d3d1a6e3db58f3", "0x6a45ca8bb30f396f40721e105e0aa6cabf326657"]


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as r:
        d = json.loads(r.read())
    if "error" in d:
        raise RuntimeError(d["error"])
    return d["result"]


head = int(rpc("eth_blockNumber", []), 16)
for back_h, blocks in [("24h", 43200), ("7d", 302400), ("48h", 86400)]:
    b = head - blocks
    print(f"--- {back_h} ago, block {b} ---")
    for a in W:
        try:
            bal = int(rpc("eth_call", [{"to": DEUS, "data": "0x70a08231" + pad + a[2:]}, hex(b)]), 16) / 1e18
            print(f"  {a} DEUS = {bal:,.4f}")
        except Exception as e:
            print(f"  {a} ERR {e}")
        time.sleep(0.3)
