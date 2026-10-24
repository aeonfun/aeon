import json, subprocess, time

RPC = "https://base.gateway.tenderly.co"
TOPIC = "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b"
POOLS = {
    "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa": "deepest DEUS/VIRTUAL",
    "0x58dBa34e6ee6eb76Ef71A6ca0f18871CAE817D3b": "secondary aerodrome",
    "0x1B2f3f5C1B6037101FDD3EC14649E0d3F98fA642": "aero #3",
    "0x75bc14950Ab093cBd1f80BbbDf458596939180A3": "aero #4",
}
FINAL = 0x328fd78
START = FINAL - 999

def call(method, params):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
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
        time.sleep(2 ** attempt)
    return None

for addr, label in POOLS.items():
    logs = call("eth_getLogs", [{"address": addr, "fromBlock": hex(START),
                                 "toBlock": hex(FINAL), "topics": [TOPIC]}])
    print(f"{label:22s} {addr} swaps_33min={0 if logs is None else len(logs)}")
    time.sleep(0.3)

# escrow Burn over wider window: since 06:12Z run
for lo, hi in [(FINAL - 1999, FINAL - 1000), (START, FINAL)]:
    logs = call("eth_getLogs", [{"address": "0xA85A38796B951CE87B378538b32B3E6Ee3C4C373",
                                 "fromBlock": hex(lo), "toBlock": hex(hi),
                                 "topics": ["0xe08737ac48a1dab4b1a46c7dc9398bd5bfc6d7ad6fabb7cd8caa254de14def35"]}])
    print(f"escrow Burn {lo}-{hi}: {0 if logs is None else len(logs)}")
    time.sleep(0.3)
