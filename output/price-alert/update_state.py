import json
import shutil

p = 'memory/topics/price-alert-state.json'
shutil.copy(p, p + '.bak')
s = json.load(open(p))
now = '2026-10-24T05:08:55Z'
s['last_run_at'] = now
s['ath'] = {
    'price_usd': 0.06876,
    'observed_at': s['ath']['observed_at'],
    'announced_at': s['ath']['announced_at'],
}
s['last_price'] = {
    'price_usd': 0.01809,
    'h1_pct': -0.05,
    'h6_pct': None,
    'h24_pct': 4.01,
    'pool': 'aerodrome Slipstream DEUS/VIRTUAL',
    'liquidity_usd': 682345.24,
    'volume_24h_usd': 28372.8,
    'volume_1h_usd': 0.0093,
    'txns_1h': '0 buy / 1 sell (GeckoTerminal) - exactly 1 on-chain Swap log in the last hour, dust $0.0093',
    'pool_url': 'https://dexscreener.com/base/0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa',
    'observed_at': now,
    'h1_source': 'dexscreener-omitted;verified-onchain',
    'h1_note': (
        'DexScreener omitted priceChange.h1 again. GeckoTerminal pool endpoint returned h1=0 '
        'with volume1h=0.0093275 and exactly 1 sell; eth_getLogs on the deepest pool for the '
        'last hour returned exactly 1 Swap log (tx 0x7b71081f, block 0x328ecd6, $0.0093 dust). '
        'So this hour is MEASURED as flat (-0.05%), unlike the 2026-10-23 21:16Z run where the '
        'window was genuinely dead. The completed 04:00-05:00Z candle ran 0.0178546 -> 0.0180709 '
        '= +1.21%; the -0.05% is the dust-tape measurement.'
    ),
}
json.dump(s, open(p, 'w'), indent=2, ensure_ascii=False)
print('ok')
