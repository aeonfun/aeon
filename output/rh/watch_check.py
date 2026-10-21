#!/usr/bin/env python3
"""Check Robinhood Chain NOTE-related addresses for fresh activity."""
import json, urllib.request, sys

RPC = "https://rpc.mainnet.chain.robinhood.com"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
NOTE = "0xc4f730335fb9e439ca5552f7b52b8e638c4245b0"

def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())

def topic_addr(a):
    return "0x" + "0" * 24 + a.lower().replace("0x", "")

def main():
    cur = int(rpc("eth_blockNumber", [])["result"], 16)
    print(f"current_block={cur}")

    targets = {
        "owner_EOA": "0x0b64b35c6dd23944d6d4029864d2ca2aa1b66422",
        "drain_EOA_1": "0x6f62b43d8dfc378d3e2e8f8b1095919282691789",
        "drain_EOA_2": "0xd000b458f6a194b10e3ff516b00b94f7234695d3",
    }
    since = 94197434  # morning report window end

    for label, addr in targets.items():
        out = {}
        for direction, topics in (("in", [TRANSFER, None, topic_addr(addr)]),
                                  ("out", [TRANSFER, topic_addr(addr)])):
            try:
                res = rpc("eth_getLogs", [{"address": NOTE,
                                           "fromBlock": hex(since),
                                           "toBlock": "latest",
                                           "topics": topics}])["result"]
            except Exception as e:
                out[direction] = f"ERR {e}"
                continue
            out[direction] = len(res)
            for lg in res[:10]:
                amt = int(lg["data"], 16) / 1e18
                other = lg["topics"][2] if direction == "out" else lg["topics"][1]
                print(f"  {label} {direction} {amt:,.2f} NOTE  other={other[-40:]} blk={int(lg['blockNumber'],16)} tx={lg['transactionHash'][:18]}")
        print(f"{label} {addr[:10]} in={out.get('in')} out={out.get('out')}")

    # note balance of drain addresses
    for label, addr in targets.items():
        data = "0x70a08231" + topic_addr(addr)[2:]
        try:
            bal = int(rpc("eth_call", [{"to": NOTE, "data": data}, "latest"])["result"], 16) / 1e18
            print(f"balance {label} = {bal:,.4f} NOTE")
        except Exception as e:
            print(f"balance {label} ERR {e}")

if __name__ == "__main__":
    main()
