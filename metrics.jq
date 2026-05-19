def tn: if type=="string" then tonumber else . end;
def avg(xs): (xs|map(select(.!=null))) as $v | (if ($v|length)>0 then (($v|add)/($v|length)) else null end);
def p75(xs): (xs|map(select(.!=null))|sort) as $v
  | (if ($v|length)==0 then null
     else (0.75*(($v|length)-1)) as $i
     | ($i|floor) as $lo
     | ([$lo+1,($v|length)-1]|min) as $hi
     | ($v[$lo] + ($v[$hi]-$v[$lo])*($i-$lo))
     end);

($price[0].data) as $P |
($oi[0].data) as $O |
($funding[0].data) as $F |
($liq[0].data) as $L |
($topls[0].data) as $T |
($basis[0].data) as $B |
($taker[0].data) as $K |
($p1h[0].data) as $H |

($P|map(.close|tn)) as $cl |
($P|map(.volume_usd|tn)) as $vol |
($P|map(.high|tn)) as $hi |
($P|map(.low|tn)) as $lo |
($O|map(.close|tn)) as $oic |
($F|map(.close|tn)) as $fc |
($L|map(.aggregated_long_liquidation_usd|tn)) as $ll |
($L|map(.aggregated_short_liquidation_usd|tn)) as $sl |
($L|[range(0;($L|length))] | map(($ll[.]//0)+($sl[.]//0))) as $ltot |
($T|map(.top_position_long_short_ratio|tn)) as $tr |
($B|map(.close_basis|tn)) as $bc |

{
  coin: $coin,
  tier: $tier,
  current_price: $cl[-1],
  pct_24h: (($cl[-1]-$cl[-2])/$cl[-2]*100),
  pct_7d: (($cl[-1]-$cl[0])/$cl[0]*100),
  vol_ratio: ($vol[-1] / (avg($vol[0:-1]))),
  range_7d_pct: (((($hi[-7:])|max) - (($lo[-7:])|min)) / (($lo[-7:])|min) * 100),
  oi_now: $oic[-1],
  oi_24h_pct: (($oic[-1]-$oic[-2])/$oic[-2]*100),
  oi_7d_pct: (($oic[-1]-$oic[0])/$oic[0]*100),
  funding_now: $fc[-1],
  funding_7d_avg: avg($fc),
  funding_delta: ($fc[-1] - avg($fc)),
  liq_24h_total: (if ($L|length)>0 then $ltot[-1] else null end),
  liq_7d_p75: (if ($L|length)>0 then p75($ltot) else null end),
  long_liqs_24h: (if ($L|length)>0 then $ll[-1] else null end),
  short_liqs_24h: (if ($L|length)>0 then $sl[-1] else null end),
  short_liqs_p75: (if ($L|length)>0 then p75($sl) else null end),
  liqs_4h: (if ($L|length)>0 then ($ltot[-1]*4/24) else null end),
  top_ls_now: (if ($T|length)>0 then $tr[-1] else null end),
  top_ls_7d_avg: (if ($T|length)>0 then avg($tr[-7:]) else null end),
  top_ls_delta_7d: (if ($T|length)>0 then ($tr[-1]-$tr[0]) else null end),
  basis_now: (if ($B|length)>0 then $bc[-1] else null end),
  basis_7d_avg: (if ($B|length)>0 then avg($bc[-7:]) else null end),
  taker_buy_pct_24h: (if ($K|length)>0 then (($K[-1].taker_buy_volume_usd|tn) as $b | ($K[-1].taker_sell_volume_usd|tn) as $s | ($b/($b+$s)*100)) else null end),
  pct_4h: (if ($H|length)>=5 then (($H|map(.close|tn)) as $pc | (($pc[-1]-$pc[-5])/$pc[-5]*100)) else null end)
}
