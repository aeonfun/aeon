import json

p = 'memory/topics/price-alert-state.json'
s = json.load(open(p))
u = s['unstake_and_dump']

u['remaining_position'] = (
    'CRITICAL FORWARD SIGNAL: this wallet STILL HOLDS one more xDEUS NFT - tokenId 1396 (0x574), '
    'confirmed via tokenOfOwnerByIndex(owner, 0) on 0xe6d5f743. Note 1396 < 1492, so it was staked '
    'BEFORE the one it just burned: this is a multi-position staker unwinding in tranches, earliest '
    'first or by size, not a one-off. Size of #1396 NOT yet measured (escrow has no public per-token '
    'getter that resolved; do not assume it matches 319,562). Watch this address and the escrow Burn '
    'event for tokenId 1396 - that is the trigger for the next dump.'
)

u['xdeus_supply_note'] = (
    'xDEUS totalSupply 0x18160ddd: 1724 at -24h (0x3284782) -> 1727 pre-burn (0x328c61b) -> 1726 '
    'immediately post-burn (0x328c61c, the NFT #1492 burn removed exactly 1) -> 1727 now (0x328f042). '
    'So one NEW xDEUS position was minted shortly after this burn. Net 24h change is +3 NFTs, i.e. '
    'staking is still net ADDITIVE despite the record exit. Do not describe this event as an exodus.'
)

json.dump(s, open(p, 'w'), indent=2, ensure_ascii=False)
print('ok')
