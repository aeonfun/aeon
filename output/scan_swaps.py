import json, subprocess, sys, time

RPC = "https://base.gateway.tenderly.co"
POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa"
TOPIC = "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b"

def rpc(from_b, to_b):
    payload = json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": "eth_getLogs",
        "params": [{"address": POOL, "fromBlock": hex(from_b),
                    "toBlock": hex(to_b), "topics": [TOPIC]}],
    })
    for attempt in range(4):
        p = subprocess.run(["curl", "-sS", "--max-time", "25", "-X", "POST", RPC,
                            "-H", "Content-Type: application/json", "-d", payload],
                           capture_output=True, text=True)
        try:
            j = json.loads(p.stdout)
        except Exception:
            time.sleep(2 ** attempt); continue
        if "result" in j:
            return j["result"]
        if "error" in j:
            msg = j["error"].get("message", "")
            if "rate" in msg.lower():
                time.sleep(2 ** attempt); continue
            raise RuntimeError(msg)
        time.sleep(2 ** attempt)
    raise RuntimeError("rpc failed")

def ts(block):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "eth_getBlockByNumber",
                          "params": [hex(block), False]})
    p = subprocess.run(["curl", "-sS", "--max-time", "20", "-X", "POST", RPC,
                        "-H", "Content-Type: application/json", "-d", payload],
                       capture_output=True, text=True)
    j = json.loads(p.stdout)
    return int(j["result"]["timestamp"], 16)

end = int(sys.argv[1], 16)
start = int(sys.argv[2], 16)
found = []
cur = end
while cur > start:
    lo = max(start, cur - 999)
    logs = rpc(lo, cur)
    if logs:
        found.extend(logs)
        print(f"window {lo}-{cur}: {len(logs)} swaps", flush=True)
    cur = lo - 1
print(f"TOTAL {len(found)} swaps in {start}-{end}")
if found:
    first = found[0]; last = found[-1]
    print("first", first["blockNumber"], ts(int(first["blockNumber"], 16)))
    print("last", last["blockNumber"], ts(int(last["blockNumber"], 16)), last["transactionHash"])
