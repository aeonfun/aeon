def to_num(x):
  if x == null then 0
  elif (x | type) == "number" then x
  elif (x | type) == "string" then (x | tonumber? // 0)
  else 0 end;

def now_epoch: ($now // (env.NOW | tonumber? // 0));

def pool_obj:
  {
    chain: (.relationships.network.data.id // (.id | split("_")[0])),
    token: .relationships.base_token.data.id,
    name: .attributes.name,
    pct24: (.attributes.price_change_percentage.h24 | to_num(.)),
    pct6: (.attributes.price_change_percentage.h6 | to_num(.)),
    pct1: (.attributes.price_change_percentage.h1 | to_num(.)),
    vol24: (.attributes.volume_usd.h24 | to_num(.)),
    vol6: (.attributes.volume_usd.h6 | to_num(.)),
    vol1: (.attributes.volume_usd.h1 | to_num(.)),
    liq: (.attributes.reserve_in_usd | to_num(.)),
    mcap: (.attributes.market_cap_usd | to_num(.)),
    fdv: (.attributes.fdv_usd | to_num(.)),
    created: .attributes.pool_created_at,
    buys: (.attributes.transactions.h24.buys // 0),
    sells: (.attributes.transactions.h24.sells // 0),
    addr: .attributes.address
  };

# Merge all pool arrays
[ .[] | .data[]? | pool_obj ]
# Dedupe by base token — keep highest volume
| group_by(.token)
| map(max_by(.vol24))
# Gate
| map(. + {
    age_h: (((now_epoch - (.created | fromdateiso8601? // 0)) / 3600) | floor),
    skew_b: (if (.buys + .sells) > 0 then (.buys / (.buys + .sells)) else 0.5 end),
    bs_ratio_sb: (if .buys > 0 then (.sells / .buys) else 999 end),
    bs_ratio_bs: (if .sells > 0 then (.buys / .sells) else 999 end)
  })
| map(
    .reject = (
      if .vol24 < 50000 then "thin-vol"
      elif .pct24 <= 0 then "down-no-move"
      elif .liq < 10000 then "thin-liq"
      elif .bs_ratio_sb > 10 then "dumping"
      elif .bs_ratio_bs > 50 then "honeypot"
      elif (.age_h < 1 and .vol24 < 100000) then "too-new"
      elif .pct24 > 10000 then "rug-like"
      else null end
    )
  )
