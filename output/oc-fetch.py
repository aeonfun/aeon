#!/usr/bin/env python3
"""Fetch Base ERC-20/ERC-721 Transfer logs for onchain-monitor in 1000-block windows."""
import json, sys, time, urllib.request

RPC = "https://base.gateway.tenderly.co"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
DEUS = "0x940a319b75861014a220d9c6c144d108552b089b"
ESCROW = "0xa85a38796b951ce87b378538b32b3e6ee3c4c373"
XDEUS = "0xe6d5f7439bc236c40054e2275f765f59343d4431"


def rpc(method, params, tries=4):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    for a in range(tries):
        try:
            req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                d = json.loads(r.read())
            if "error" in d:
                raise RuntimeError(d["error"])
            return d["result"]
        except Exception as e:
            if a == tries - 1:
                raise
            time.sleep(1.5 * (a + 1))


def pad(addr):
    return "0x000000000000000000000000" + addr.lower().replace("0x", "")


def get_logs(address, lo, hi, topics):
    out = []
    cur = lo
    while cur <= hi:
        end = min(cur + 999, hi)
        res = rpc("eth_getLogs", [{
            "fromBlock": hex(cur), "toBlock": hex(end),
            "address": address, "topics": topics,
        }])
        out.extend(res)
        cur = end + 1
        time.sleep(0.15)
    return out


def main():
    lo, hi = int(sys.argv[1]), int(sys.argv[2])
    head = int(rpc("eth_blockNumber", []), 16)

    # 1. DEUS transfers involving escrow (in + out)
    esc = {}
    for direction, topics in (("in", [TRANSFER, None, pad(ESCROW)]),
                              ("out", [TRANSFER, pad(ESCROW)])):
        for lg in get_logs(DEUS, lo, hi, topics):
            h = lg["transactionHash"]
            e = esc.setdefault(h, {"tx": h, "block": int(lg["blockNumber"], 16),
                                   "in": [], "out": []})
            rec = {
                "from": "0x" + lg["topics"][1][-40:],
                "to": "0x" + lg["topics"][2][-40:],
                "raw": int(lg["data"], 16),
                "logIndex": int(lg["logIndex"], 16),
            }
            e[direction].append(rec)

    # 2. xDEUS ERC-721 Transfers
    xl = []
    for lg in get_logs(XDEUS, lo, hi, [TRANSFER]):
        xl.append({
            "tx": lg["transactionHash"],
            "block": int(lg["blockNumber"], 16),
            "from": "0x" + lg["topics"][1][-40:],
            "to": "0x" + lg["topics"][2][-40:],
            "tokenId": int(lg["topics"][3], 16) if len(lg["topics"]) > 3 else None,
            "logIndex": int(lg["logIndex"], 16),
        })

    result = {
        "lo": lo, "hi": hi, "head": head,
        "escrow_txs": list(esc.values()),
        "xdeus_transfers": xl,
    }
    with open("output/oc-raw.json", "w") as f:
        json.dump(result, f)
    print("wrote output/oc-raw.json escrow_txs=%d xdeus=%d" % (len(result["escrow_txs"]), len(xl)))


if __name__ == "__main__":
    main()
