# Helper definitions
def is_stable($c):
  ($c.id // "" | ascii_downcase) as $cid
  | ($c.name // "" | ascii_downcase) as $name
  | ($c.symbol // "" | ascii_upcase) as $sym
  | ([
      "tether","usd-coin","dai","first-digital-usd","usde","tusd","usdd","pyusd",
      "fdusd","paxg","ethena-usde","frax","lusd","susd","crvusd","gho","susde",
      "usds","ousd","usd1","xaut","tether-gold","usdy","usdf","m0-dollar","usdq",
      "global-dollar","sky-dollar","blackrock-usd-institutional-digital-liquidity-fund",
      "savings-dai","sdai","tether-eurt","staked-frax","staked-usde","ousg","buidl",
      "falcon-finance","resolv-usr","usual-usd","first-digital-usd-stablecoin",
      "paypal-usd","blackrock-buidl","elixir-deusd","usdx-money","staked-usdx",
      "ethena-staked-usde","usdb","crvusd-stablecoin"
    ] | index($cid) != null)
  or ($name | contains("stablecoin"))
  or (($name | contains("dollar")) and ($name | contains("usd")))
  or (($sym | startswith("USD") or startswith("EUR") or startswith("GBP")) and ($sym | length) <= 6);

def is_wrapped($c):
  ([
    "wrapped-bitcoin","wrapped-steth","wrapped-eeth","wrapped-beacon-eth",
    "lido-staked-ether","rocket-pool-eth","staked-ether","renbtc","hbtc",
    "binance-bridged-usdt","binance-bridged-usdc","liquid-staked-ethereum",
    "mantle-staked-ether","jito-staked-sol","marinade-staked-sol",
    "binance-peg-busd","wbeth","weth","reth","meth","steth","rseth","cbeth",
    "binance-staked-sol","solv-protocol-solvbtc","solv-btc","coinbase-wrapped-btc",
    "tbtc","btc-b","wbnb","kelp-dao-restaked-eth"
  ] | index($c.id) != null);

def keep_coin($c):
  ($c.total_volume // 0) >= 1000000
  and ($c.price_change_percentage_24h != null)
  and (is_stable($c) | not)
  and (is_wrapped($c) | not);

# Read both inputs as a single object {markets:..., trending:...}
.
| .markets as $markets
| .trending as $trending
| ($markets | map(select(keep_coin(.)))) as $filtered
| ($filtered | sort_by(-.price_change_percentage_24h) | .[0:10]) as $winners
| ($filtered | sort_by(.price_change_percentage_24h) | .[0:10]) as $losers
| ($trending.coins[0:7] | map(.item)) as $trending_items
| ($trending_items | map(.id)) as $trending_ids
| ($filtered | map(select((.market_cap_rank // 999) <= 100))) as $top100
| ($filtered | map(select((.market_cap_rank // 999) <= 50))) as $top50
| ($top100 | map(select(.price_change_percentage_24h > 0)) | length) as $green100
| ($top100 | length) as $top100_n
| ($top50 | map(.price_change_percentage_24h) | sort | .[(length/2 | floor)]) as $median50
| ($top100 | map(.price_change_percentage_24h) | sort | .[(length/2 | floor)]) as $median100
| {
    pulse: { green100: $green100, top100_n: $top100_n, median50: $median50, median100: $median100 },
    winners: $winners,
    losers: $losers,
    trending: $trending_items,
    trending_ids: $trending_ids,
    filtered_count: ($filtered | length)
  }
