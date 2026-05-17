def stableids: ["tether","usd-coin","dai","first-digital-usd","usde","tusd","usdd","pyusd","fdusd","paxg","ethena-usde","binance-usd","frax"];
def isstable: (.id as $i | stableids | index($i)) != null
  or ((.symbol|ascii_upcase) | (startswith("USD") or startswith("EUR") or startswith("GBP")))
  or ((.name|ascii_downcase) | contains("stablecoin"));
map(select((isstable|not)
  and ((.total_volume // 0) >= 1000000)
  and (.price_change_percentage_24h_in_currency != null)))
