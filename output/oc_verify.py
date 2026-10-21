#!/usr/bin/env python3
"""Control checks + balance decoding for onchain-monitor."""
import json, sys, urllib.request, time, statistics

RPC = "https://base.gateway.tenderly.co"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
ESCROW = "0xa85a38796b951ce87b378538b32b3e6ee3c4c373"
XDEUS = "0xe6d5f7439bc236c40054e2275f765f59343d4431"
DEUS = "0x940a319b75861014a220d9c6c144d108552b089b"


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


def call(to, data):
    return rpc("eth_call", [{"to": to, "data": data}, "latest"])


cur = int(rpc("eth_blockNumber", []), 16)
out = {"current_block": cur}

# Control window: the rolling-24h open (52847241) .. 52848200, known to hold activity
print("control window 52847241-52848200 ...", file=sys.stderr)
ctrl = scan(52847241, 52848200, [TRANSFER, None, pad(ESCROW)], DEUS)
out["control_escrow_in_24h_ago"] = len(ctrl)
ctrl2 = scan(52847241, 52848200, [TRANSFER], XDEUS)
out["control_xdeus_logs"] = len(ctrl2)

# Network-wide DEUS transfers in a recent window — proves eth_getLogs is returning data now
netw = scan(max(1, cur - 200), cur, [TRANSFER], DEUS)
out["network_deus_logs_recent_200"] = len(netw)

# Balances
b = int(call(DEUS, "0x70a08231" + pad(ESCROW)[2:]), 16)
s = int(call(DEUS, "0x18160ddd"), 16)
xs = int(call(XDEUS, "0x18160ddd"), 16)
xb = int(call(XDEUS, "0x70a08231" + pad(ESCROW)[2:]), 16)
out["escrow_deus_raw"] = str(b)
out["escrow_deus"] = b / 1e18
out["deus_total_supply"] = s / 1e18
out["escrow_pct_of_supply"] = b / s * 100
out["xdeus_supply"] = xs
out["xdeus_held_by_escrow"] = xb

print(json.dumps(out, indent=2))
