import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
POOL = "0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa"
DEUS = "0x940A319B75861014A220D9c6c144d108552B089B"
VIRT = "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b"
SWAP = "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


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


rows = json.load(open("output/tmp/since_last_run.json"))
out = []
for row in rows:
    tx = row["tx"]
    rc = rpc("eth_getTransactionReceipt", [tx])
    deus_in = deus_out = virt_in = virt_out = 0
    for L in rc["logs"]:
        t0 = L["topics"][0]
        if t0 != TRANSFER or len(L["topics"]) != 3:
            continue
        amt = int(L["data"], 16)
        frm = "0x" + L["topics"][1][-40:]
        to = "0x" + L["topics"][2][-40:]
        addr = L["address"].lower()
        if addr == DEUS.lower():
            if to.lower() == POOL:
                deus_in += amt
            if frm.lower() == POOL:
                deus_out += amt
        elif addr == VIRT.lower():
            if to.lower() == POOL:
                virt_in += amt
            if frm.lower() == POOL:
                virt_out += amt
    out.append({
        "tx": tx, "block": row["block"], "ts": row["ts"],
        "deus_in": deus_in / 1e18, "deus_out": deus_out / 1e18,
        "virt_in": virt_in / 1e18, "virt_out": virt_out / 1e18,
        "net_deus_into_pool": (deus_in - deus_out) / 1e18,
    })
    time.sleep(0.35)

json.dump(out, open("output/tmp/flows.json", "w"), indent=1)

print(f"{'utc':>21} {'netDEUS_to_pool':>18} {'VIRT_to_pool':>14}  side")
tot_sell = tot_buy = 0.0
for r in sorted(out, key=lambda x: x["ts"]):
    net = r["net_deus_into_pool"]
    side = "SELL" if net > 0 else ("BUY" if net < 0 else "flat")
    if net > 0:
        tot_sell += net
    else:
        tot_buy += -net
    print(f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(r['ts'])):>21} {net:>18.4f} {r['virt_in']-r['virt_out']:>14.4f}  {side}")
print()
print(f"total DEUS sold into pool : {tot_sell:,.4f}")
print(f"total DEUS bought out     : {tot_buy:,.4f}")
print(f"net DEUS into pool        : {tot_sell - tot_buy:,.4f}")
