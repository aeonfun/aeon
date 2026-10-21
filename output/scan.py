#!/usr/bin/env python3
"""Full onchain-monitor fetch: both watches over a block window, decoded + USD-enriched."""
import json, sys, time, urllib.request, statistics

RPC = "https://base.gateway.tenderly.co"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
ESCROW = "0xa85a38796b951ce87b378538b32b3e6ee3c4c373"
XDEUS = "0xe6d5f7439bc236c40054e2275f765f59343d4431"
DEUS = "0x940a319b75861014a220d9c6c144d108552b089b"
PRICE = {DEUS: 0.01788122}
DECIMALS = {DEUS: 18, XDEUS: 18}


def rpc(method, params, timeout=30, attempt=0):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            out = json.loads(r.read().decode())
    except Exception:
        if attempt < 3:
            time.sleep(2 * (attempt + 1))
            return rpc(method, params, timeout, attempt + 1)
        raise
    if "error" in out:
        raise RuntimeError(json.dumps(out["error"]))
    return out.get("result")


def get_logs(lo, hi, address=None, topics=None):
    p = {"fromBlock": hex(lo), "toBlock": hex(hi)}
    if address:
        p["address"] = address
    if topics:
        p["topics"] = topics
    try:
        return rpc("eth_getLogs", [p]) or []
    except RuntimeError as e:
        if hi - lo > 100:
            mid = (lo + hi) // 2
            time.sleep(0.3)
            return get_logs(lo, mid, address, topics) + get_logs(mid + 1, hi, address, topics)
        raise


def window_logs(lo, hi, address, topics):
    out, cur, step = [], lo, 1000
    while cur <= hi:
        end = min(cur + step - 1, hi)
        out += get_logs(cur, end, address, topics)
        cur = end + 1
        time.sleep(0.3)
    return out


def pad(addr):
    return "0x" + "0" * 24 + addr.lower().replace("0x", "")


def decode(lg, watch):
    t = lg["topics"]
    frm = "0x" + t[1][-40:]
    to = "0x" + t[2][-40:]
    raw = int(lg["data"], 16) if lg["data"] not in ("0x", "") else 0
    token = lg["address"].lower()
    dec = DECIMALS.get(token, 18)
    amt = raw / (10 ** dec)
    usd = amt * PRICE[token] if token in PRICE else None
    return {
        "token": token,
        "from": frm.lower(),
        "to": to.lower(),
        "amount": amt,
        "usd": usd,
        "direction": "in" if to.lower() == watch.lower() else "out",
        "counterparty": (to if to.lower() == watch.lower() else frm).lower(),
        "tx": lg["transactionHash"],
        "block": int(lg["blockNumber"], 16),
        "ts": int(lg.get("blockTimestamp", "0x0"), 16),
        "logIndex": int(lg["logIndex"], 16),
    }


def main():
    lo, hi = int(sys.argv[1]), int(sys.argv[2])
    result = {"range": [lo, hi], "rpc": RPC, "watches": {}, "errors": []}

    # Watch 1: DEUS escrow wallet — all ERC-20 transfers in/out
    try:
        lg_in = window_logs(lo, hi, None, [TRANSFER, None, pad(ESCROW)])
        lg_out = window_logs(lo, hi, None, [TRANSFER, pad(ESCROW)])
        evs = [decode(x, ESCROW) for x in lg_in + lg_out]
        seen, uniq = set(), []
        for e in evs:
            k = (e["tx"], e["logIndex"])
            if k in seen:
                continue
            seen.add(k)
            uniq.append(e)
        result["watches"]["DEUS escrow"] = {
            "source": "tenderly-rpc",
            "block": hi,
            "events": uniq,
        }
    except Exception as e:
        result["errors"].append({"watch": "DEUS escrow", "error": str(e)})

    # Watch 2: xDEUS contract — Transfer logs emitted by the contract
    try:
        lgs = window_logs(lo, hi, XDEUS, [TRANSFER])
        evs = []
        for lg in lgs:
            t = lg["topics"]
            frm = "0x" + t[1][-40:]
            to = "0x" + t[2][-40:]
            raw = int(lg["data"], 16) if lg["data"] not in ("0x", "") else 0
            evs.append({
                "from": frm.lower(), "to": to.lower(),
                "amount": raw / 1e18, "usd": None,
                "direction": "mint" if frm == "0x" + "0" * 40 else ("burn" if to == "0x" + "0" * 40 else "move"),
                "tx": lg["transactionHash"], "block": int(lg["blockNumber"], 16),
                "ts": int(lg.get("blockTimestamp", "0x0"), 16),
                "logIndex": int(lg["logIndex"], 16),
            })
        result["watches"]["xDEUS"] = {"source": "tenderly-rpc", "block": hi, "events": evs}
    except Exception as e:
        result["errors"].append({"watch": "xDEUS", "error": str(e)})

    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    main()
