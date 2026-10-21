#!/usr/bin/env python3
"""Rolling 24h escrow + xDEUS flow summary for onchain-monitor."""
import json, sys, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
ESCROW = "0xa85a38796b951ce87b378538b32b3e6ee3c4c373"
XDEUS = "0xe6d5f7439bc236c40054e2275f765f59343d4431"
DEUS = "0x940a319b75861014a220d9c6c144d108552b089b"
ZERO = "0x" + "0" * 40


def rpc(method, params, tries=4):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                out = json.loads(r.read().decode())
            if "error" in out:
                raise RuntimeError(out["error"])
            return out["result"]
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"{method}: {last}")


def pad(a):
    return "0x" + "0" * 24 + a[2:].lower()


def scan(lo, hi, topics, address=None, window=951):
    logs, n = [], lo
    while n <= hi:
        end = min(n + window - 1, hi)
        for attempt in range(3):
            try:
                q = {"fromBlock": hex(n), "toBlock": hex(end), "topics": topics}
                if address:
                    q["address"] = address
                logs.extend(rpc("eth_getLogs", [q]))
                break
            except Exception as e:  # noqa: BLE001
                print(f"WARN {n}-{end} try{attempt}: {e}", file=sys.stderr)
                time.sleep(2)
        n = end + 1
    return logs


cur = int(rpc("eth_blockNumber", []), 16)
lo = cur - 43200  # ~24h at 2s blocks
print(f"scanning {lo} -> {cur}", file=sys.stderr)

ins = scan(lo, cur, [TRANSFER, None, pad(ESCROW)], DEUS)
outs = scan(lo, cur, [TRANSFER, pad(ESCROW)], DEUS)
xd = scan(lo, cur, [TRANSFER], XDEUS)

# dedupe by (txhash, logIndex)
def key(l):
    return (l["transactionHash"], l["logIndex"])

seen, merged = set(), []
for l in ins + outs:
    k = key(l)
    if k in seen:
        continue
    seen.add(k)
    merged.append(l)


def amt(l):
    return int(l["data"], 16) / 1e18


total_in = sum(amt(l) for l in merged if l["topics"][2].lower().endswith(ESCROW[2:]))
total_out = sum(amt(l) for l in merged if l["topics"][1].lower().endswith(ESCROW[2:]))

mints = [l for l in xd if l["topics"][1].lower().endswith(ZERO[2:])]
burns = [l for l in xd if l["topics"][2].lower().endswith(ZERO[2:])]

res = {
    "window": [lo, cur],
    "escrow_transfers": len(merged),
    "in_deus": round(total_in, 2),
    "out_deus": round(total_out, 2),
    "net_deus": round(total_in - total_out, 2),
    "xdeus_logs": len(xd),
    "xdeus_mints": len(mints),
    "xdeus_burns": len(burns),
    "xdeus_moves": len(xd) - len(mints) - len(burns),
}
print(json.dumps(res, indent=2))

# detail of the non-dust escrow events for the log
det = []
for l in sorted(merged, key=lambda x: -amt(x)):
    a = amt(l)
    direction = "in" if l["topics"][2].lower().endswith(ESCROW[2:]) else "out"
    cp = l["topics"][1] if direction == "in" else l["topics"][2]
    det.append({"dir": direction, "amount": round(a, 2), "tx": l["transactionHash"],
                "block": int(l["blockNumber"], 16), "counterparty": "0x" + cp[-40:]})
print(json.dumps(det, indent=2))
