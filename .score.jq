($trend | split(" ")) as $t |
-4.77126 as $btc7 | -6.93872 as $eth7 |
.[] | select((.market_cap // 0) >= 20000000) |
(.symbol | ascii_upcase) as $s |
(.price_change_percentage_24h_in_currency // 0) as $p24 |
(.price_change_percentage_7d_in_currency // 0) as $p7 |
(.total_volume // 0) as $vol |
(.market_cap) as $mc |
($vol / $mc) as $vmc |
( (if $p24>0 then 1 else 0 end)
+ (if $p7>0 then 1 else 0 end)
+ (if ($p24>5 and $p7>5) then 2 else 0 end)
+ (if ($t|index($s)) then 2 else 0 end)
+ (if $vmc>=0.20 then 3 elif $vmc>=0.10 then 2 else 0 end)
+ (if ($p7>$btc7 and $p7>$eth7) then 2 else 0 end) ) as $score |
"\($score)\t\($s)\t\(.current_price)\t\($p24|.*10|round/10)\t\($p7|.*10|round/10)\t\($mc/1000000|round)\t\($vol/1000000|round)\t\($vmc*1000|round/1000)"
