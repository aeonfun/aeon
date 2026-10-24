import json
import urllib.request

RPC = 'https://base.gateway.tenderly.co'
POOL = '0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa'
VIRTUAL = '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b'


def call(to, data, block):
    body = json.dumps({
        'jsonrpc': '2.0', 'id': 1, 'method': 'eth_call',
        'params': [{'to': to, 'data': data}, block],
    }).encode()
    req = urllib.request.Request(RPC, data=body, headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=25))


bal = '0x70a08231000000000000000000000000' + POOL[2:].lower()

for blk, label in [('0x328cee6', 'before'), ('0x328cee7', 'after')]:
    v = int(call(VIRTUAL, bal, blk)['result'], 16) / 1e18
    d = int(call('0x940A319B75861014A220D9c6c144d108552B089B', bal, blk)['result'], 16) / 1e18
    print(label, 'DEUS', round(d, 4), 'VIRTUAL', round(v, 4), 'mark', round(v / d, 8))
