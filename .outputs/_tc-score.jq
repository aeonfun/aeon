def score(t):
  ([
    (if (t.price_change_percentage_24h_in_currency // -1) > 0 then 1 else 0 end),
    (if (t.price_change_percentage_7d_in_currency // -1) > 0 then 1 else 0 end),
    (if ((t.price_change_percentage_24h_in_currency // 0) > 5) and ((t.price_change_percentage_7d_in_currency // 0) > 5) then 2 else 0 end),
    (if ($tr | index(t.symbol|ascii_upcase)) != null then 2 else 0 end),
    (if (t.total_volume // 0) / (t.market_cap // 1) >= 0.20 then 3
     elif (t.total_volume // 0) / (t.market_cap // 1) >= 0.10 then 2
     else 0 end),
    (if ((t.price_change_percentage_7d_in_currency // -100) > $btc7d) and ((t.price_change_percentage_7d_in_currency // -100) > $eth7d) and ((t.price_change_percentage_7d_in_currency // 0) > 0) then 2 else 0 end)
  ] | add);

[ .[]
  | select((.market_cap // 0) >= 20000000)
  | (.symbol | ascii_upcase) as $sym
  | select($dd | index($sym) | not)
  | {symbol: $sym, name: .name, price: .current_price, mcap: .market_cap, vol: .total_volume,
     vm: ((.total_volume // 0) / (.market_cap // 1)),
     p24: .price_change_percentage_24h_in_currency,
     p7d: .price_change_percentage_7d_in_currency,
     trending: (($tr | index($sym)) != null),
     score: score(.)}
] | sort_by(-.score, -.vm) | .[0:25]
