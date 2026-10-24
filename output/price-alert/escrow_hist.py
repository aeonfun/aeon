import json
import urllib.request

RPC = 'https://base.gateway.tenderly.co'
ESCROW = '0xa85a38796b951ce87b378538b32b3e6ee3c4c373'
DEUS = '0x940A319B75861014A220D9c6c144d108552B089B'


def call(block):
    data = '0x70a08231000000000000000000000000' + ESCROW[2:]
    body = json.dumps({
        'jsonrpc': '2.0', 'id': 1, 'method': 'eth_call',
        'params': [{'to': DEUS, 'data': data}, block],
    }).encode()
    req = urllib.request.Request(RPC, data=body, headers={'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=25))
    if 'error' in r:
        return None
    return int(r['result'], 16) / 1e18


cur_blk = 53014594
for label, back in [('now', 0), ('-2h', 3600), ('-6h', 10800), ('-24h', 43200)]:
    blk = cur_blk - back
    v = call(hex(blk))
    print(label, hex(blk), 'ERR' if v is None else round(v, 4))
