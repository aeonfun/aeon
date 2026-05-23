def banned: ["kaia","trac","bsb","inj","near","hype","chz","lit","vvv","dash","zec","pengu","grass","ondo","wld"];
def trending: ["uds","near","hype","btc","vvv","zec","eth","pengu","bill","ron","aster","kite","wlfi","sol","aero"];

map(
  . as $m
  | ($m.symbol // "") as $sym
  | ($m.market_cap // 0) as $mcap
  | ($m.total_volume // 0) as $vol
  | (if $mcap > 0 then $vol / $mcap else 0 end) as $vmc
  | ($m.price_change_percentage_24h_in_currency) as $c24
  | ($m.price_change_percentage_7d_in_currency) as $c7
  | (if ($c24 != null and $c24 > 0) then 1 else 0 end) as $s1
  | (if ($c7 != null and $c7 > 0) then 1 else 0 end) as $s2
  | (if ($c24 != null and $c7 != null and $c24 > 5 and $c7 > 5) then 2 else 0 end) as $s3
  | (if (trending | index($sym))  then 2 else 0 end) as $s4
  | (if $vmc >= 0.20 then 3 elif $vmc >= 0.10 then 2 else 0 end) as $s5
  | (if ($c7 != null and $c7 > -4.5122118616585825 and $c7 > -7.352113125298991) then 2 else 0 end) as $s6
  | ($s1 + $s2 + $s3 + $s4 + $s5 + $s6) as $score
  | select($mcap >= 20000000)
  | select((banned | index($sym)) | not)
  | select($c24 != null and $c7 != null)
  | { sym: $sym, name: $m.name, price: $m.current_price, mcap: $mcap, vol: $vol, vmc: $vmc, chg24: $c24, chg7: $c7, score: $score, trending: ((trending | index($sym)) != null) }
)
| sort_by(-(.score), -(.chg7))
| .[0:25]
| .[]
| "\(.sym|ascii_upcase|.[0:8])\t score=\(.score)\t 24h=\(.chg24|tostring|.[0:6])%\t 7d=\(.chg7|tostring|.[0:6])%\t vmc=\(.vmc|tostring|.[0:5])\t mcap=\(.mcap/1000000000|tostring|.[0:5])B\t vol=\(.vol/1000000|tostring|.[0:5])M\t trend=\(.trending)\t \(.name)"
