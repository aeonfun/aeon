[.[].data[]]
| map({
    id: .id,
    name: .attributes.name,
    network: .relationships.network.data.id,
    base_token: .relationships.base_token.data.id,
    vol_h24: (.attributes.volume_usd.h24 // "0" | tonumber),
    vol_h6: (.attributes.volume_usd.h6 // "0" | tonumber),
    vol_h1: (.attributes.volume_usd.h1 // "0" | tonumber),
    pct_h24: (.attributes.price_change_percentage.h24 // "0" | tonumber),
    pct_h6: (.attributes.price_change_percentage.h6 // "0" | tonumber),
    pct_h1: (.attributes.price_change_percentage.h1 // "0" | tonumber),
    reserve: (.attributes.reserve_in_usd // "0" | tonumber),
    mcap: (.attributes.market_cap_usd // null),
    fdv: (.attributes.fdv_usd // null),
    buys: (.attributes.transactions.h24.buys // 0),
    sells: (.attributes.transactions.h24.sells // 0),
    created: .attributes.pool_created_at
  })
| group_by(.base_token)
| map(max_by(.vol_h24))
| {pre_gate: length, pools: .}
| .pools as $all
| ($all | map(select(
      .vol_h24 >= 50000
      and .pct_h24 > 0
      and .reserve >= 10000
      and (.pct_h24 <= 10000)
      and (
        .buys == 0 or .sells == 0
        or (.sells / .buys) <= 10
      )
      and (
        .sells == 0 or .buys == 0
        or (.buys / .sells) <= 50
      )
    ))) as $survived
| ($all | length) as $pre
| ($survived | length) as $post
| ($all | map(select(.vol_h24 < 50000))) as $thin_vol
| ($all | map(select(.vol_h24 >= 50000 and .pct_h24 <= 0))) as $down_nomove
| ($all | map(select(.vol_h24 >= 50000 and .pct_h24 > 0 and .reserve < 10000))) as $thin_liq
| ($all | map(select(.vol_h24 >= 50000 and .pct_h24 > 0 and .reserve >= 10000 and .buys > 0 and (.sells / .buys) > 10))) as $dumping
| ($all | map(select(.vol_h24 >= 50000 and .pct_h24 > 0 and .reserve >= 10000 and .sells > 0 and (.buys / .sells) > 50))) as $honeypot
| ($all | map(select(.vol_h24 >= 50000 and .pct_h24 > 10000))) as $ruglike
| ($survived
    | map(
        . as $p
        | (
            (if $p.pct_h24 / 500 > 1 then 1 elif $p.pct_h24 / 500 < 0 then 0 else $p.pct_h24 / 500 end) as $pct_pts
            | ((($p.vol_h24 + 1) | log10) / 7) as $vol_pts_raw
            | (if $vol_pts_raw > 1 then 1 elif $vol_pts_raw < 0 then 0 else $vol_pts_raw end) as $vol_pts
            | ((($p.reserve + 1) | log10) / 6) as $liq_pts_raw
            | (if $liq_pts_raw > 1 then 1 elif $liq_pts_raw < 0 then 0 else $liq_pts_raw end) as $liq_pts
            | (($p.pct_h1 + 50) / 100) as $mom_raw
            | (if $mom_raw > 1 then 1 elif $mom_raw < 0 then 0 else $mom_raw end) as $mom_pts
            | (if ($p.buys + $p.sells) == 0 then 0.5 else $p.buys / ($p.buys + $p.sells) end) as $skew_pts
            | (40 * $pct_pts + 25 * $vol_pts + 15 * $liq_pts + 10 * $mom_pts + 10 * $skew_pts) as $score
            | . + {pct_pts: $pct_pts, vol_pts: $vol_pts, liq_pts: $liq_pts, mom_pts: $mom_pts, skew_pts: $skew_pts, score: $score}
          )
      )
    | sort_by(-.score)) as $scored
| {
    pre_gate: $pre,
    post_gate: $post,
    rejections: {
      thin_vol: ($thin_vol | length),
      down_nomove: ($down_nomove | length),
      thin_liq: ($thin_liq | length),
      dumping: ($dumping | length),
      honeypot: ($honeypot | length),
      ruglike: ($ruglike | length)
    },
    top: ($scored[0:10])
  }
