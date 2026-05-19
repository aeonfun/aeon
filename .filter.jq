[.[]
  | select((.id|ascii_downcase) as $i | (["tether","usd-coin","dai","first-digital-usd","usde","tusd","usdd","pyusd","fdusd","paxg","ethena-usde"] | index($i) | not))
  | select((.symbol|ascii_upcase) as $s | ($s|startswith("USD") or startswith("EUR") or startswith("GBP"))|not)
  | select((.name|ascii_downcase|contains("stablecoin"))|not)
  | select((.total_volume//0) >= 1000000)
  | select(.price_change_percentage_24h_in_currency != null)
] | sort_by(.price_change_percentage_24h_in_currency) | reverse
| . as $w
| ($w[0:10][] | "WIN|\(.symbol|ascii_upcase)|\(.name)|\(.market_cap_rank)|\(.current_price)|\(.price_change_percentage_24h_in_currency)|\(.price_change_percentage_7d_in_currency)|\(.price_change_percentage_1h_in_currency)|\(.total_volume)|\(.market_cap)"),
  ($w[-10:]|reverse|.[]| "LOSE|\(.symbol|ascii_upcase)|\(.name)|\(.market_cap_rank)|\(.current_price)|\(.price_change_percentage_24h_in_currency)|\(.price_change_percentage_7d_in_currency)|\(.price_change_percentage_1h_in_currency)|\(.total_volume)|\(.market_cap)")
