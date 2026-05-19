def clamp(lo;hi): if . < lo then lo elif . > hi then hi else . end;
def tonum: if . == null then null else (tonumber? // null) end;

[ .[] | (.data // [])[] |
  {
    name: (.attributes.name // "?"),
    network: (.relationships.network.data.id // "?"),
    bt: (.relationships.base_token.data.id // .attributes.address // .id // "?"),
    h24v: ((.attributes.volume_usd.h24 | tonum) // 0),
    h24p: (.attributes.price_change_percentage.h24 | tonum),
    h6p:  (.attributes.price_change_percentage.h6  | tonum),
    h1p:  (.attributes.price_change_percentage.h1  | tonum),
    reserve: ((.attributes.reserve_in_usd | tonum) // 0),
    mcap: (.attributes.market_cap_usd | tonum),
    fdv:  (.attributes.fdv_usd | tonum),
    buys: (.attributes.transactions.h24.buys // 0),
    sells:(.attributes.transactions.h24.sells // 0),
    created: .attributes.pool_created_at
  }
]
| group_by(.bt) | map(max_by(.h24v))
| . as $deduped
| ($deduped | length) as $pre
| (now) as $nowt
| ($deduped | map(. + {age_h: (if .created == null then null else (try (($nowt - (.created|fromdateiso8601))/3600) catch null) end)}))
| map(. + {rej:
    (if .h24v < 50000 then "thin-vol"
     elif (.h24p == null or .h24p <= 0) then "down/no-move"
     elif .reserve < 10000 then "thin-liq"
     elif (.buys > 0 and ((.sells/.buys) > 10)) then "dumping"
     elif (.sells > 0 and ((.buys/.sells) > 50)) then "honeypot"
     elif (.age_h != null and .age_h < 1 and .h24v < 100000) then "too-new"
     elif (.h24p > 10000) then "rug-like"
     else null end)})
| . as $gated_all
| ($gated_all | map(select(.rej != null)) | group_by(.rej) | map({key:.[0].rej, n:length})) as $rejbreak
| ($gated_all | map(select(.rej == null))) as $surv
| ($surv | map(
      ((.h24p / 500) | clamp(0;1)) as $pct
    | (((.h24v + 1)|log10)/7 | clamp(0;1)) as $vol
    | (((.reserve + 1)|log10)/6 | clamp(0;1)) as $liq
    | ((((.h1p // 0) + 50)/100) | clamp(0;1)) as $mom
    | (.buys + .sells) as $tot
    | ((if $tot > 0 then (.buys/$tot) else 0.5 end) | clamp(0;1)) as $skew
    | . + {score: (40*$pct + 25*$vol + 15*$liq + 10*$mom + 10*$skew),
           skewpct: (if $tot>0 then (.buys/$tot*100) else 50 end),
           tag:
        (if (.reserve >= 1000000 and .h24v >= 1000000) then "DEEP-LIQ"
         elif (.age_h != null and .age_h <= 48 and .h24v >= 250000) then "BREAKOUT"
         elif ((.h1p // 0) > 2 and .h24p > 50) then "CONTINUATION"
         elif ((.h1p // 0) < -5 and .h24p > 0) then "REVERSAL"
         else "MICRO-SPEC" end)}
  )) as $scored
| ($scored | sort_by(-.score)) as $sorted
| {pre: $pre, post: ($surv|length), rej: $rejbreak, top5: ($sorted[0:5])}
