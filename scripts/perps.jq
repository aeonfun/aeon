def tn: if . == null then null else (tonumber? // null) end;
def avg: map(select(. != null)) | if length==0 then null else (add/length) end;
def pq($q):
  map(select(. != null)) | sort
  | if length==0 then null
    elif length==1 then .[0]
    else ($q*(length-1)) as $pos
       | ($pos|floor) as $lo
       | ($pos-$lo) as $f
       | (if $lo+1 < length then .[$lo] + $f*(.[$lo+1]-.[$lo]) else .[$lo] end)
    end;

# gather all inputs keyed by coin -> type -> data array
[ inputs | {fn: input_filename, data: .data} ]
| reduce .[] as $x ({};
    ($x.fn | sub("^.*/";"") | sub("\\.json$";"")) as $base
    | ($base | capture("^(?<t>price-1h|price|oi|funding|liq|topls|basis|taker)-(?<c>.+)$")) as $m
    | .[$m.c] = ((.[$m.c] // {}) | .[$m.t] = $x.data)
  )
| . as $by
| (["BTC","ETH","SOL","HYPE","ZEC","DOGE","XRP","BILL","LAB","ONDO","RONIN","SUI","TON","EDEN","BCH","BSB","XAU","BNB","NEAR","INJ","1000PEPE","LINK","XAG","ADA","FIDA"]) as $assets
| ($assets | map(. as $a | {key:$a, value:(
    $by[$a] as $d
    | ($d.price) as $p | ($d.oi) as $oi | ($d.funding) as $fnd
    | (if ($p|type)!="array" or ($p|length)<2 or ($oi|type)!="array" or ($oi|length)<2 or ($fnd|type)!="array" or ($fnd|length)<1 then {drop:true} else
        ($p|map(.close|tn)) as $c
        | ($p|map(.volume_usd|tn)) as $v
        | ($oi|map(.close|tn)) as $oc
        | ($fnd|map(.close|tn)) as $fc
        | ($p[-7:]) as $win
        | ($d.liq) as $lq | ($d.topls) as $tl | ($d.basis) as $bs | ($d.taker) as $tk | ($d["price-1h"]) as $h
        | ($v[0:-1]|map(select(. != null))) as $pv
        | {
            tier: (if ($a=="BTC" or $a=="ETH" or $a=="SOL") then 1 else 2 end),
            current_price: $c[-1],
            pct_24h: (($c[-1]-$c[-2])/$c[-2]*100),
            pct_7d: ((($c[-1]) - (if ($c|length)>=8 then $c[-8] else $c[0] end)) / (if ($c|length)>=8 then $c[-8] else $c[0] end) * 100),
            vol_ratio: (if ($v[-1]!=null and ($pv|length)>0) then ($v[-1]/($pv|add/($pv|length))) else null end),
            range_7d_pct: ((($win|map(.high|tn)|max) - ($win|map(.low|tn)|min)) / ($win|map(.low|tn)|min) * 100),
            oi_now: $oc[-1],
            oi_24h_pct: (($oc[-1]-$oc[-2])/$oc[-2]*100),
            oi_7d_pct: ((($oc[-1]) - (if ($oc|length)>=8 then $oc[-8] else $oc[0] end)) / (if ($oc|length)>=8 then $oc[-8] else $oc[0] end) * 100),
            funding_now: $fc[-1],
            funding_7d_avg: ($fc|avg),
            funding_delta: ($fc[-1] - ($fc|avg)),
            liq_24h_total: (if ($lq|type)=="array" then ($lq|map((.aggregated_long_liquidation_usd|tn // 0)+(.aggregated_short_liquidation_usd|tn // 0)))[-1] else null end),
            liq_7d_p75: (if ($lq|type)=="array" then ($lq|map((.aggregated_long_liquidation_usd|tn // 0)+(.aggregated_short_liquidation_usd|tn // 0))|pq(0.75)) else null end),
            long_liqs_24h: (if ($lq|type)=="array" then ($lq[-1].aggregated_long_liquidation_usd|tn) else null end),
            short_liqs_24h: (if ($lq|type)=="array" then ($lq[-1].aggregated_short_liquidation_usd|tn) else null end),
            short_liqs_p75: (if ($lq|type)=="array" then ($lq|map(.aggregated_short_liquidation_usd|tn)|pq(0.75)) else null end),
            liqs_4h: (if ($lq|type)=="array" then (($lq|map((.aggregated_long_liquidation_usd|tn // 0)+(.aggregated_short_liquidation_usd|tn // 0)))[-1] * 4/24) else null end),
            top_ls_now: (if ($tl|type)=="array" then ($tl[-1].top_position_long_short_ratio|tn) else null end),
            top_ls_7d_avg: (if ($tl|type)=="array" then ($tl[-7:]|map(.top_position_long_short_ratio|tn)|avg) else null end),
            top_ls_delta_7d: (if ($tl|type)=="array" then (($tl[-1].top_position_long_short_ratio|tn) - (if ($tl|length)>=8 then ($tl[-8].top_position_long_short_ratio|tn) else ($tl[0].top_position_long_short_ratio|tn) end)) else null end),
            basis_now: (if ($bs|type)=="array" then ($bs[-1].close_basis|tn) else null end),
            basis_7d_avg: (if ($bs|type)=="array" then ($bs[-7:]|map(.close_basis|tn)|avg) else null end),
            taker_buy_pct_24h: (if ($tk|type)=="array" then (($tk[-1].taker_buy_volume_usd|tn) as $b | ($tk[-1].taker_sell_volume_usd|tn) as $s | (if ($b!=null and $s!=null and ($b+$s)>0) then ($b/($b+$s)*100) else null end)) else null end),
            pct_4h: (if ($h|type)=="array" and ($h|length)>=5 then (($h|map(.close|tn)) as $hc | ($hc[-1]-$hc[-5])/$hc[-5]*100) else null end)
          }
      end)
  )}) | from_entries)
| . as $base
| ($base.BTC) as $btc
| ($base | to_entries | map(.value as $m | .value = (
    if ($m.drop // false) then $m else
      $m + {
        pct_24h_vs_btc: (if $btc.pct_24h then ($m.pct_24h - $btc.pct_24h) else null end),
        pct_7d_vs_btc: (if $btc.pct_7d then ($m.pct_7d - $btc.pct_7d) else null end)
      }
    end)) | from_entries)
| to_entries | map(.value as $m | .key as $a | .value = (
    if ($m.drop // false) then $m else
      ($m.tier==1) as $t1
      | (if $t1 then 8 else 20 end) as $breakout
      | (if $t1 then 5 else 10 end) as $squeeze
      | (if $t1 then 8 else 15 end) as $mom7
      | (if $t1 then 3 else 5 end) as $comprange
      | (if $t1 then 0.06 else 0.08 end) as $distf
      | (if $t1 then -6 else -10 end) as $capdd
      | (if $t1 then -8 else -10 end) as $capoi
      | (
        if ($m.pct_24h <= $capdd and $m.funding_now < 0 and $m.oi_24h_pct <= $capoi and $m.liq_24h_total != null and $m.liq_7d_p75 != null and $m.liq_24h_total >= $m.liq_7d_p75)
          then "CAPITULATION"
        elif ($m.short_liqs_24h != null and $m.short_liqs_p75 != null and $m.taker_buy_pct_24h != null and $m.pct_24h > $squeeze and $m.oi_24h_pct < 0 and $m.short_liqs_24h >= $m.short_liqs_p75 and $m.taker_buy_pct_24h < 52)
          then "SHORT-SQUEEZE"
        elif ((($m.funding_now > $distf) or ($m.funding_7d_avg > 0.06)) and ($m.pct_24h < ($m.pct_7d/7)) and ($m.oi_24h_pct > 5))
          then "DISTRIBUTION"
        elif (($m.pct_24h > $breakout) and ($m.vol_ratio != null and $m.vol_ratio > 2.0) and ($m.oi_24h_pct > 10) and ($m.taker_buy_pct_24h != null and $m.taker_buy_pct_24h > 52))
          then "CATALYST-BREAKOUT"
        elif (($m.oi_7d_pct > 10) and (($m.funding_7d_avg|fabs) < 0.04) and ($m.pct_7d > 0) and ($m.range_7d_pct < 25))
          then "ACCUMULATION"
        elif (($m.pct_7d > $mom7) and ($m.oi_24h_pct >= 0) and ($m.funding_now > 0.03) and ($m.funding_now <= 0.07))
          then "MOMENTUM"
        elif (($m.range_7d_pct < $comprange) and ($m.oi_7d_pct > 5) and (($m.funding_now|fabs) < 0.02) and (($m.pct_24h|fabs) < 2))
          then "COMPRESSION"
        else "NEUTRAL" end
      ) as $regime
      | ([
          if $regime=="DISTRIBUTION" then (
            (if ($m.top_ls_now!=null and $m.basis_now!=null and $m.top_ls_now>2.0 and $m.basis_now>0) then "REAL-CROWDED-LONG" else empty end),
            (if ($m.top_ls_now!=null and $m.top_ls_now<1.5) then "RETAIL-ANOMALY" else empty end),
            (if ($m.pct_24h<0 and $m.oi_24h_pct>=0) then "LONG-TRAP" else empty end)
          ) else empty end,
          if $regime=="CAPITULATION" then (
            (if ($m.liqs_4h!=null and $m.liq_24h_total!=null and $m.liq_24h_total>0) then ((($m.liqs_4h/$m.liq_24h_total)) as $r | if $r>0.4 then "IN-PROGRESS" elif $r<0.15 then "CLEARED" else empty end) else empty end)
          ) else empty end,
          if $regime=="COMPRESSION" then (
            (if ($m.vol_ratio!=null) then (if $m.vol_ratio>1.0 then "ACTIVE" elif $m.vol_ratio<0.9 then "QUIET" else empty end) else empty end)
          ) else empty end,
          if $regime=="ACCUMULATION" then (
            (if ($m.taker_buy_pct_24h!=null and $m.top_ls_delta_7d!=null and $m.taker_buy_pct_24h>50 and $m.top_ls_delta_7d>0) then "CONFIRMED"
             elif ($m.taker_buy_pct_24h!=null and $m.taker_buy_pct_24h<50) then "DIVERGENT" else empty end)
          ) else empty end,
          if $regime=="CATALYST-BREAKOUT" then (
            (if ($m.pct_4h!=null and $m.pct_24h!=0) then (($m.pct_4h/$m.pct_24h) as $rr | if $rr>0.5 then "FRESH" elif $rr<0.2 then "STALE" else empty end) else empty end)
          ) else empty end
        ]) as $subs
      | (0.06 + (if $t1 then 0 else 0.02 end)) as $ltthr
      | ([
          (if ($m.funding_now>$distf and $m.top_ls_now!=null and $m.top_ls_now>2.0 and $m.basis_now!=null and $m.basis_now>0.3) then "REAL-CROWDED-LONG" else empty end),
          (if (($m.funding_now>$distf and $m.top_ls_now!=null and $m.top_ls_now<1.5) and (($m.funding_now>$distf and $m.top_ls_now!=null and $m.top_ls_now>2.0 and $m.basis_now!=null and $m.basis_now>0.3)|not)) then "RETAIL-ANOMALY" else empty end),
          (if ($m.funding_now>$ltthr and $m.pct_24h<0 and $m.oi_24h_pct>=-3) then "LONG-TRAP" else empty end),
          (if ($m.top_ls_delta_7d!=null and $m.top_ls_delta_7d>0.4 and $m.range_7d_pct<5 and $m.oi_7d_pct<5) then "STEALTH-POSITIONING" else empty end),
          (if ($m.basis_now!=null and $m.basis_now>0.2 and ($m.funding_delta|fabs)<0.01 and $m.oi_7d_pct>5 and $m.taker_buy_pct_24h!=null and $m.taker_buy_pct_24h>48 and $m.taker_buy_pct_24h<52) then "CASH-AND-CARRY" else empty end),
          (if (($m.tier==2) and $m.short_liqs_24h!=null and $m.short_liqs_p75!=null and $m.pct_24h>10 and $m.oi_24h_pct<0 and $m.short_liqs_24h>=$m.short_liqs_p75 and $regime!="SHORT-SQUEEZE") then "SHORT-SQUEEZE" else empty end)
        ]) as $pat
      | $m + {regime:$regime, sub_tags:$subs, pattern_tags:$pat}
    end)) | from_entries
