import json
import urllib.request

RPC = 'https://base.gateway.tenderly.co'
XDEUS = '0xe6d5f7439bc236c40054e2275f765f59343d4431'


def supply(block):
    body = json.dumps({
        'jsonrpc': '2.0', 'id': 1, 'method': 'eth_call',
        'params': [{'to': XDEUS, 'data': '0x18160ddd'}, block],
    }).encode()
    req = urllib.request.Request(RPC, data=body, headers={'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=25))
    if 'error' in r:
        return 'ERR ' + str(r['error'].get('message'))
    return int(r['result'], 16)


for label, blk in [
    ('-24h', '0x3284782'),
    ('pre-burn (0x328c61b)', '0x328c61b'),
    ('post-burn (0x328c61c)', '0x328c61c'),
    ('now', '0x328f042'),
]:
    print(label, blk, supply(blk))
