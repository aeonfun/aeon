#!/usr/bin/env python3
"""Classify each escrow counterparty (EOA vs contract) and probe its DEUS/xDEUS footprint."""
import json, urllib.request, time

RPC = "https://base.gateway.tenderly.co"
DEUS = "0x940a319b75861014a220d9c6c144d108552b089b"
XDEUS = "0xe6d5f7439bc236c40054e2275f765f59343d4431"
ESCROW = "0xa85a38796b951ce87b378538b32b3e6ee3c4c373"

CP = [
    ("0x79016f576376cc3bdfbc02642211828471760185", "two 25,000 DEUS stakes"),
    ("0x6e5f7bd9b940287f6c9ae8a2ecfb93224a09cba5", "13,385 in / 7,560+5,020 out"),
    ("0xf196ccd7eda28574ce2acd93f1b358f49c0d437b", "18,512.68 unstake"),
    ("0xd5ff53f48f14e9409b581e41a4cddfe0e97dc724", "12,419.81 unstake"),
    ("0x1a80c6e191302e3dbbe779057b35de29d3665ebc", "1,529.53 stake"),
    ("0x63970cabfa4543e7c84ec1ef957dbe8957030066", "817.89 stake"),
    ("0x89d11c7c7bd8699ac6e089c79b2faac66509ccbf", "417.80 stake"),
]


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    for i in range(3):
        try:
            req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=25) as r:
                o = json.loads(r.read().decode())
            if "error" in o:
                raise RuntimeError(o["error"])
            return o["result"]
        except Exception:  # noqa: BLE001
            time.sleep(1.5 * (i + 1))
    return None


def pad(a):
    return "0x" + "0" * 24 + a[2:].lower()


def bal(token, holder):
    r = rpc("eth_call", [{"to": token, "data": "0x70a08231" + pad(holder)[2:]}, "latest"])
    if not r:
        return None
    return int(r, 16)


for addr, note in CP:
    code = rpc("eth_getCode", [addr, "latest"]) or "0x"
    kind = "contract" if len(code) > 2 else "EOA"
    d = bal(DEUS, addr)
    x = bal(XDEUS, addr)
    print(f"{addr}  {kind:8s}  DEUS={d/1e18 if d is not None else '?':>16,.2f}  "
          f"xDEUS={x if x is not None else '?':>4}   ({note})")
