#!/usr/bin/env python3
"""24h escrow DEUS flows + xDEUS mint/burn counts."""
import importlib.util, json

spec = importlib.util.spec_from_file_location("oc", "output/oc-fetch.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

LO, HI = int(__import__("sys").argv[1]), int(__import__("sys").argv[2])
p = m.pad(m.ESCROW)

txs = {}
for direction, topics in (("in", [m.TRANSFER, None, p]), ("out", [m.TRANSFER, p])):
    for lg in m.get_logs(m.DEUS, LO, HI, topics):
        h = lg["transactionHash"]
        e = txs.setdefault(h, {"tx": h, "block": int(lg["blockNumber"], 16),
                               "in": 0, "out": 0})
        amt = int(lg["data"], 16)
        e[direction] += amt

xl = [{"tx": lg["transactionHash"], "block": int(lg["blockNumber"], 16),
       "topics": lg["topics"],
       "tokenId": int(lg["topics"][3], 16) if len(lg["topics"]) > 3 else None}
      for lg in m.get_logs(m.XDEUS, LO, HI, [m.TRANSFER])]
ZERO = "0x0000000000000000000000000000000000000000"
mints = [x for x in xl if x["topics"][1][-40:] == ZERO[2:]]
burns = [x for x in xl if x["topics"][2][-40:] == ZERO[2:]]

esc_in = sum(e["in"] for e in txs.values())
esc_out = sum(e["out"] for e in txs.values())

bal = int(m.rpc("eth_call", [{"to": m.DEUS, "data": "0x70a08231" + p[2:]}, "latest"]), 16)
tot = int(m.rpc("eth_call", [{"to": m.DEUS, "data": "0x18160ddd"}, "latest"]), 16)
xs = int(m.rpc("eth_call", [{"to": m.XDEUS, "data": "0x18160ddd"}, "latest"]), 16)
xb = int(m.rpc("eth_call", [{"to": m.XDEUS, "data": "0x70a08231" + p[2:]}, "latest"]), 16)

out = {
    "lo": LO, "hi": HI, "head": m.rpc_blocks if False else None,
    "n_txs": len(txs),
    "escrow_in_wei": esc_in, "escrow_out_wei": esc_out,
    "escrow_in": esc_in / 1e18, "escrow_out": esc_out / 1e18,
    "net": (esc_in - esc_out) / 1e18,
    "balance": bal / 1e18, "total_supply": tot / 1e18,
    "pct_of_supply": bal / tot * 100,
    "out_pct_of_balance": (esc_out / bal * 100) if bal else 0,
    "in_pct_of_balance": (esc_in / bal * 100) if bal else 0,
    "xdeus_supply": xs, "xdeus_escrow": xb,
    "xdeus_mints": len(mints), "xdeus_burns": len(burns),
    "xdeus_moves": len(xl),
    "xdeus_other": len(xl) - len(mints) - len(burns),
    "txs": sorted(txs.values(), key=lambda e: -max(e["in"], e["out"]))[:25],
    "mint_txs": [{"tx": x["tx"], "block": x["block"], "to": x["topics"][2], "id": x["tokenId"]} for x in mints],
    "burn_txs": [{"tx": x["tx"], "block": x["block"], "from": x["topics"][1], "id": x["tokenId"]} for x in burns],
}
with open("output/oc-24h.json", "w") as f:
    json.dump(out, f, indent=1)
print(json.dumps({k: v for k, v in out.items() if k not in ("txs", "mint_txs", "burn_txs")}, indent=1))
for e in out["txs"]:
    print("tx", e["tx"][:14], "block", e["block"], "in %.2f" % (e["in"] / 1e18), "out %.2f" % (e["out"] / 1e18))
