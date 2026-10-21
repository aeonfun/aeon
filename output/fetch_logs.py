#!/usr/bin/env python3
"""Page Base eth_getLogs through Tenderly's public gateway (1000-block windows)."""
import json, sys, time, urllib.request

RPC = "https://base.gateway.tenderly.co"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


def rpc(method, params, timeout=30):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def get_logs(lo, hi, address=None, topics=None, attempt=0):
    p = {"fromBlock": hex(lo), "toBlock": hex(hi)}
    if address:
        p["address"] = address
    if topics:
        p["topics"] = topics
    try:
        out = rpc("eth_getLogs", [p])
    except Exception as e:
        if attempt < 3:
            time.sleep(2 * (attempt + 1))
            return get_logs(lo, hi, address, topics, attempt + 1)
        raise
    if "error" in out:
        err = out["error"]
        # Tenderly names the max sub-range it will accept
        data = err.get("data") or ""
        if "maximum" in str(data) and hi - lo > 100:
            mid = (lo + hi) // 2
            time.sleep(0.3)
            return get_logs(lo, mid, address, topics) + get_logs(mid + 1, hi, address, topics)
        raise RuntimeError(json.dumps(err))
    return out.get("result") or []


def main():
    lo, hi = int(sys.argv[1]), int(sys.argv[2])
    address = sys.argv[3]
    mode = sys.argv[4]          # "topic-addr <0x..>" for transfers to/from a wallet, "contract" for a contract
    logs, dropped = [], 0
    step = 1000
    cur = lo
    while cur <= hi:
        end = min(cur + step - 1, hi)
        if mode == "contract":
            logs += get_logs(cur, end, address, [TRANSFER])
        else:
            topic_addr = sys.argv[5].lower().replace("0x", "")
            padded = "0x" + "0" * 24 + topic_addr
            logs += get_logs(cur, end, address, [TRANSFER, None, padded])
            logs += get_logs(cur, end, address, [TRANSFER, padded])
        cur = end + 1
        time.sleep(0.3)
    seen, uniq = set(), []
    for lg in logs:
        key = (lg.get("transactionHash"), lg.get("logIndex"))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(lg)
    print(json.dumps({"logs": uniq, "count": len(uniq), "range": [lo, hi], "rpc": RPC}))


if __name__ == "__main__":
    main()
