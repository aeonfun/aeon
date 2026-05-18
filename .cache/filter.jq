def stable($c):
  ([ "tether","usd-coin","dai","first-digital-usd","usde","tusd","usdd",
     "pyusd","fdusd","paxg","ethena-usde","usds","blackrock-usd",
     "binance-bridged-usdt-bnb-smart-chain","susds","usd1-wlfi",
     "bridged-usdc-polygon-pos-bridge","ripple-usd","global-dollar",
     "binance-bridged-usdc-bnb-smart-chain","usdt0","blackrock-usd-institutional-digital-liquidity-fund"
   ] | index($c.id)) != null
  or ($c.symbol | ascii_upcase | (startswith("USD") or startswith("EUR") or startswith("GBP")))
  or ($c.name | ascii_downcase | contains("stablecoin"));
def wrapped($c):
  ([ "wbtc","weth","steth","wsteth","weeth","wbeth","reth","cbbtc","lbtc",
     "binance-staked-sol","jito-staked-sol","coinbase-wrapped-btc","msol",
     "rocket-pool-eth","wrapped-bitcoin","wrapped-steth","solv-btc","mantle-staked-ether",
     "bedrock-unieth","clbtc","tbtc","renzo-restaked-eth","wrapped-eeth",
     "kelp-dao-restaked-eth","liquid-staked-ethereum","wrapped-beacon-eth",
     "ether-fi-staked-eth","wrapped-avax","wrapped-hype","staked-hype"
   ] | index($c.id)) != null;
[ .[] | select(
    (stable(.) | not) and (wrapped(.) | not)
    and ((.total_volume // 0) >= 1000000)
    and (.price_change_percentage_24h_in_currency != null)
  ) ]
