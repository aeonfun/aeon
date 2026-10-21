#!/usr/bin/env python3
"""Incremental Base log scan for onchain-monitor. Reads only; prints JSON."""
import json, sys, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
ESCROW = "0xa85a38796b951ce87b378538b32b3e6ee3c4c373"
XDEUS = "0xe6d5f7439bc236c40054e2275f765f59343d4431"
DEUS = "0x940a319b75861014a220d9c6c144d108552b089b"


def rpc(method, params, tries=3):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(
                RPC, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=25) as r:
                out = json.loads(r.read().decode())
            if "error" in out:
                last = out["error"]
                raise RuntimeError(out["error"])
            return out["result"]
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"{method} failed: {last}")


def pad(addr):
    return "0x" + "0" * 24 + addr[2:].lower()


def get_logs(lo, hi, topics, address=None):
    q = {"fromBlock": hex(lo), "toBlock": hex(hi), "topics": topics}
    if address:
        q["address"] = address
    return rpc("eth_getLogs", [q])


def scan(lo, hi, topics, address=None, window=1000):
    """Walk [lo,hi] in <=1000-block windows."""
    logs = []
    n = lo
    while n <= hi:
        end = min(n + window - 1, hi)
        try:
            logs.extend(get_logs(n, end, topics, address))
        except Exception as e:  # noqa: BLE001
            print(f"WARN window {n}-{end}: {e}", file=sys.stderr)
        n = end + 1
    return logs


def eth_call(to, data):
    return rpc("eth_call", [{"to": to, "data": data}, "latest"])


def main():
    last = int(sys.argv[1])
    cur = int(rpc("eth_blockNumber", []), 16)
    print(json.dumps({"current_block": cur, "last_block": last}), file=sys.stderr)

    lo, hi = last + 1, cur
    res = {"from_block": lo, "to_block": hi}

    if hi >= lo:
        res["escrow_in"] = scan(lo, hi, [TRANSFER, None, pad(ESCROW)], DEUS)
        res["escrow_out"] = scan(lo, hi, [TRANSFER, pad(ESCROW)], DEUS)
        res["xdeus_logs"] = scan(lo, hi, [TRANSFER], XDEUS)
    else:
        res["escrow_in"] = []
        res["escrow_out"] = []
        res["xdeus_logs"] = []

    # balances / supply witnesses
    res["escrow_deus_balance"] = eth_call(DEUS, "0x70a08231" + pad(ESCROW)[2:])
    res["deus_total_supply"] = eth_call(DEUS, "0x18160ddd")
    res["xdeus_total_supply"] = eth_call(XDEUS, "0x18160ddd")
    res["xdeus_escrow_balance"] = eth_call(XDEUS, "0x70a08231" + pad(ESCROW)[2:])
    print(json.dumps(res))


if __name__ == "__main__":
    main()
