import json
import urllib.request

RPC = 'https://base.gateway.tenderly.co'
txs = [
    '0x215f75a71dec11e1edfa7dc8d98ff279c748b1f4c7cfd65802972d47423dc466',
    '0xfce1df1e65425ad07e426e7a4bba899e353ff4730d0a3099b519d7ca95d18e08',
    '0xefb764c4edff6053035d817413f6068f820c61477c25af1df803482b31f66e5e',
    '0xbd958583fc40f96a23188e88889748830634f0040827b6e93e99b47078d8285d',
    '0x92bf04e6f06f3651794afba34aa4445f5bcda7b382c2d2de06b69f628f60f863',
    '0x5fa22b46edd1e4d603b1e047535b086e50bd66a3bf14b91af27867c1698a6434',
    '0x50c4e81c2b318bf118cedc13ee58d42ae4559377e4a67cfd98d459412553fd98',
]
for tx in txs:
    body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'eth_getTransactionReceipt', 'params': [tx]}).encode()
    req = urllib.request.Request(RPC, data=body, headers={'Content-Type': 'application/json'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=20))
        print(tx[:12], r.get('result', {}).get('blockNumber'), r.get('error'))
    except Exception as e:
        print(tx[:12], 'ERR', e)
