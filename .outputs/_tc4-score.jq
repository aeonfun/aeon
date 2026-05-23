def TREND: ["UDS","NEAR","HYPE","SOL","SUI","PENGU","ZEC","BTC","BSB","NEX","ASTER","VVV","PI","TAO","PEPE"];
def DEDUP: ["KAIA","TRAC","BSB","INJ","NEAR","HYPE","CHZ","LIT","VVV","DASH","ZEC","PENGU","GRASS","ONDO","WLD","BEAT","GENIUS","SKYAI"];
def BTC7D: -4.7122;
def ETH7D: -7.4608;

[
  .[]
  | {
      sym:   (.symbol | ascii_upcase),
      name:  .name,
      price: .current_price,
      mcap:  .market_cap,
      vol:   .total_volume,
      c24:   (.price_change_percentage_24h_in_currency // 0),
      c7d:   (.price_change_percentage_7d_in_currency  // 0)
    }
  | . + { vm: (if .mcap > 0 then .vol / .mcap else 0 end) }
  | select(.mcap >= 20000000)
  | select((DEDUP | index(.sym)) | not)
  | . + {
      s_24p:   (if .c24 > 0 then 1 else 0 end),
      s_7p:    (if .c7d > 0 then 1 else 0 end),
      s_both5: (if (.c24 > 5 and .c7d > 5) then 2 else 0 end),
      s_trend: (if (TREND | index(.sym)) then 2 else 0 end),
      s_vm:    (if .vm >= 0.20 then 3 elif .vm >= 0.10 then 2 else 0 end),
      s_rs:    (if (.c7d > BTC7D and .c7d > ETH7D) then 2 else 0 end)
    }
  | . + { score: (.s_24p + .s_7p + .s_both5 + .s_trend + .s_vm + .s_rs) }
]
| sort_by(-.score, -.vm)
| (.[0:30])
| .[]
| [
    (.score|tostring), .sym,
    ("24h=" + (.c24|tostring)),
    ("7d=" + (.c7d|tostring)),
    ("vm=" + (.vm|tostring)),
    ("mcap=" + (.mcap|tostring)),
    ("price=" + (.price|tostring)),
    .name
  ]
| join(" | ")
