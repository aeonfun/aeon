import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa"
TOPIC = "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b"
TXIN = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.loads(r.read())
                if "error" in d:
                    raise RuntimeError(d["error"])
                return d["result"]
        except Exception:
            if attempt == 4:
                raise
            time.sleep(1 << attempt)


# last run snapshot block was ~0x328cee7 (53006055); scan from there
lo0 = 0x328cee8
head = int(rpc("eth_blockNumber", []), 16)
now = int(time.time())
logs = []
lo = lo0
while lo <= head:
    hi = min(lo + 999, head)
    chunk = rpc("eth_getLogs", [{"address": POOL, "fromBlock": hex(lo), "toBlock": hex(hi), "topics": [TOPIC]}])
    logs.extend(chunk)
    lo = hi + 1
    time.sleep(0.4)

print("total swaps since last run:", len(logs))

# decode: Swap event (Slipstream) - data words per prior note = 4 words
rows = []
for L in logs:
    d = L["data"][2:]
    words = [d[i:i+64] for i in range(0, len(d), 64)]
    rows.append((int(L["blockNumber"], 16), L["transactionHash"], words))

# get timestamps in bulk
blks = sorted(set(r[0] for r in rows))
tsmap = {}
for b in blks:
    bd = rpc("eth_getBlockByNumber", [hex(b), False])
    tsmap[b] = int(bd["timestamp"], 16)

print(f"{'block':>10} {'utc':>20} {'tx':<20}")
for b, tx, w in rows:
    t = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(tsmap[b]))
    print(f"{b:>10} {t:>20} {tx[:20]}")
    print("   words:", w)

json.dump([{"block": b, "tx": tx, "words": w, "ts": tsmap[b]} for b, tx, w in rows],
          open("output/tmp/since_last_run.json", "w"), indent=1)
