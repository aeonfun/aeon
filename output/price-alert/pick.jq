.pairs
| map(select(.chainId == "base"))
| sort_by(-(.liquidity.usd // 0))
| .[]
| {
    sym: .baseToken.symbol,
    price: .priceUsd,
    h1: .priceChange.h1,
    h6: .priceChange.h6,
    h24: .priceChange.h24,
    liq: .liquidity.usd,
    v24: .volume.h24,
    v1: .volume.h1,
    url: .url,
    pair: .pairAddress,
    dex: .dexId
  }
