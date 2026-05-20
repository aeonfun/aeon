def upcase: ascii_upcase;
def trending: ["ZEST","VVV","LIT","PENGU","AI","ONDO","ETH","KITE","HYPE","LUNC","RON","PEAQ","MON","POD","CHIP"];
def dedup: ["TRAC","BSB","INJ","NEAR","HYPE","CHZ","KAIA"];

.[]
| {
    symbol: (.symbol | upcase),
    name,
    price: .current_price,
    mcap: .market_cap,
    vol: .total_volume,
    c24: .price_change_percentage_24h_in_currency,
    c7d: .price_change_percentage_7d_in_currency,
  }
| select(.mcap != null and .mcap >= 20000000)
| select(.c24 != null and .c7d != null and .vol != null and .mcap > 0)
| . + {vol_mcap: (.vol / .mcap)}
| . + {
    s_24up: (if .c24 > 0 then 1 else 0 end),
    s_7up:  (if .c7d > 0 then 1 else 0 end),
    s_5pct: (if .c24 > 5 and .c7d > 5 then 2 else 0 end),
    s_trend: (if (trending | index(.symbol)) then 2 else 0 end),
    s_vm: (if .vol_mcap >= 0.20 then 3 elif .vol_mcap >= 0.10 then 2 else 0 end),
    s_rs:  (if .c7d > -4.761683971907803 and .c7d > -7.4656153244775885 then 2 else 0 end),
  }
| . + {score: (.s_24up + .s_7up + .s_5pct + .s_trend + .s_vm + .s_rs)}
| select((dedup | index(.symbol)) | not)
