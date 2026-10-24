import json

p = 'memory/topics/price-alert-state.json'
s = json.load(open(p))
now = '2026-10-24T05:08:55Z'

s['unstake_and_dump'] = {
    'wallet': '0xbb0f753321e2b5fd29bd1d14b532f5b54959ae63',
    'what': (
        'THE FIRST RECORDED UNSTAKE-AND-DUMP. Plain EOA (code 0x, nonce 105). At '
        '2026-10-23T23:09:15Z (block 53002812, tx 0xb62d28fafa1454fb26d84ee5146483319941fb96eb2baabe8c969321b5c54dfd) '
        'escrow 0xA85A3879 BURNED xDEUS NFT #1492 held by this wallet and released '
        '319,562.226531 DEUS to it. 75 minutes later at 2026-10-24T00:24:17Z (block 53006055, '
        'tx 0x156d9316ab040c0dd4c73ac02eafcfb9df2c58a930518dc8e476c5d9cbbaa762) it sold the '
        'ENTIRE 319,562.226531 DEUS into the deepest pool for 8,618.5315 VIRTUAL (~$5,488 at $0.6368/VIRTUAL). '
        'Post-sale DEUS balance: 0.000000 exactly. This is 3.49x the previous largest single dump on record '
        '(91,566 DEUS, 2026-10-23 00:32Z).'
    ),
    'unstake_tx': '0xb62d28fafa1454fb26d84ee5146483319941fb96eb2baabe8c969321b5c54dfd',
    'unstake_block': 53002812,
    'unstake_ts': '2026-10-23T23:09:15Z',
    'xdeus_nft_id': 1492,
    'released_deus': 319562.226531,
    'dump_tx': '0x156d9316ab040c0dd4c73ac02eafcfb9df2c58a930518dc8e476c5d9cbbaa762',
    'dump_block': 53006055,
    'dump_ts': '2026-10-24T00:24:17Z',
    'latency_seconds': 4502,
    'proceeds_virtual': 8618.53151997545,
    'proceeds_usd_approx': 5488.10,
    'price_before': 0.0179584527229686,
    'price_after': 0.0171737950710244,
    'price_impact_pct': -4.37,
    'pool_reserve_before_deus': 18961647.3772,
    'pool_reserve_after_deus': 19152146.2397,
    'impact_note': (
        'Price impact measured from the pool reserve move: 18,961,647.3772 -> 19,152,146.2397 DEUS '
        '(+190,498.8625 = +1.005% of reserve). Mark fell 0.0179585 -> 0.0171738 = -4.37%. '
        'RECALIBRATED ABSORPTION: 319,562 DEUS of selling moved the mark 4.37%, i.e. the pool absorbs '
        '~7.3k USD of notional per 2.2% of price at this depth - far better than the ~$1.7k/1% implied '
        'by the 91.5k dump. A record-sized unstake no longer collapses the book.'
    ),
    'absorbed_in_block': (
        'The dump did NOT sit on the book: 7 buys printed in the SAME block 53006055 totalling '
        '137,397.44 DEUS ($1,933.90), led by 0x6011b76b (62,825 DEUS / $1,093) and 0x6abea499 '
        '(29,739 DEUS / $514). Net DEUS into the pool after the block = 178,969.17. This is why the '
        '-4.37% did not become a -10% cascade.'
    ),
    'remaining_position': (
        'CRITICAL FORWARD SIGNAL: this wallet STILL HOLDS 1 more xDEUS NFT (tokenId 1493 / 0x574, '
        'confirmed via tokenOfOwnerByIndex(owner,0)). It sold out of one NFT and kept the other, so a '
        'second identical dump of similar size is queued and unstaked-or-unstaking. Watch this address; '
        'the next escrow Burn of its NFT is the trigger. xDEUS totalSupply 1,727 -> 1,714 (-13) over the '
        'period, consistent with this burn plus other churn.'
    ),
    'read': (
        'This is the first time the 5-day xDEUS cooldown has actually been PAID and then converted to '
        'market selling in the observable record. It validates the STRATEGY premise: the cooldown is the '
        'real cost of the multiplier, and someone did pay it to exit. It is NOT routine CLAIM emission - '
        'the DEUS came out of escrow, via an NFT burn, not from the 0x5cbf vesting vault. So this is '
        'existing staked float leaving, not new supply.'
    ),
    'observed_at': now,
}

s['notes'] = s['notes'] + (
    ' TELL 12 (NEW, 2026-10-24 run): AN UNSTAKE IS NOT A PRICE EVENT UNTIL IT IS SOLD, AND THE SALE CAN '
    'COME BATCHED AND DELAYED. The escrow Burn event on 0xA85A3879 (topic0 '
    '0xe08737ac48a1dab4b1a46c7dc9398bd5bfc6d7ad6fabb7cd8caa254de14def35, indexed[1]=owner, '
    'indexed[2]=tokenId, data = [amount, timestamp, escrowBalanceAfter]) tells you who just unlocked and '
    'how much - treat it as a LEADING indicator, because the operator of that position then chooses when '
    'to hit the book (here: 75 min later, all at once). Conversely, the escrow balance falling is NOT '
    'itself bearish until matched to a pool Swap from the same address. Measure impact from the POOL '
    'RESERVE move (balanceOf of the pool on the token, block before vs after), not from the swap event '
    'data alone - reserve delta / reserve = the true fractional depth used. TELL 13 (NEW): A LARGE DUMP '
    'INTO THIS POOL GETS ABSORBED IN THE SAME BLOCK. 319,562 DEUS produced -4.37%, but 137,397 DEUS of '
    'same-block buying took a third of it back and net inflow to the pool was only 178,969 DEUS. So do '
    'NOT extrapolate a linear "X DEUS = Y%" from one print; always net the same-block counterparties. '
    'The $0.012 gate now needs ~4.36M DEUS dumped with no offsetting bids (13.7x this record dump, or '
    '15.4 days of the entire CLAIM drip) - it remains a deliberate-whale event, not an emission drift.'
)

json.dump(s, open(p, 'w'), indent=2, ensure_ascii=False)
print('ok')
