import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
DEUS = "0x940A319B75861014A220D9c6c144d108552B089B"
POOL = "0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa"

BIG = {
    "0xaf660b551a52923fa5": ("2026-10-24T00:41:21Z", 146303.30),
    "0x5af0ce07f5001404f4": ("2026-10-24T02:10:37Z", 120836.38),
    "0x43426af594db5c07b5": ("2026-10-24T01:50:21Z", 39849.45),
    "0x215f75a71dec11e1ed": ("2026-10-24T00:24:31Z", 11529.69),
}
FULL = {
    "0xaf660b551a52923fa5": "0xaf660b551a52923fa5",
    "0x5af0ce07f5001404f4": "0x5af0ce07f5001404f4",
    "0x43426af594db5c07b5": "0x43426af594db5c07b5",
    "0x215f75a71dec11e1ed": "0x215f75a71dec11e1ed",
}


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


flows = json.load(open("output/tmp/flows.json"))
by = {r["tx"]: r for r in flows}

# find full tx hashes
targets = []
for r in flows:
    for p in BIG:
        if r["tx"].startswith(p):
            targets.append(r)

for r in sorted(targets, key=lambda x: x["ts"]):
    tx = rpc("eth_getTransactionByHash", [r["tx"]])
    rc = rpc("eth_getTransactionReceipt", [tx["hash"]])
    frm = tx["from"].lower()
    print(f"\n{r['tx']}")
    print(f"  ts={time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(r['ts']))} block={r['block']}")
    print(f"  BOUGHT {(-r['net_deus_into_pool']):,.2f} DEUS out of pool")
    print(f"  tx.from = {frm}")
    fcode = rpc("eth_getCode", [frm, "latest"])
    print(f"  from code = {fcode[:12]}... ({'EOA' if fcode == '0x' else 'CONTRACT/EIP7702'})")
    nonce = rpc("eth_getTransactionCount", [frm, "latest"])
    print(f"  from nonce = {int(nonce,16)}")

    # who received the DEUS out of the pool
    TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    recips = {}
    for L in rc["logs"]:
        if L["address"].lower() != DEUS.lower() or L["topics"][0] != TRANSFER:
            continue
        if "0x" + L["topics"][1][-40:] == POOL:
            to = "0x" + L["topics"][2][-40:]
            recips[to] = recips.get(to, 0) + int(L["data"], 16) / 1e18
    for a, v in recips.items():
        print(f"  DEUS out of pool -> {a} : {v:,.4f}")
        bal = rpc("eth_call", [{"to": DEUS, "data": "0x70a08231" + "0" * 24 + a[2:]}, "latest"])
        print(f"     current DEUS balance = {int(bal,16)/1e18:,.4f}")
    time.sleep(0.3)
