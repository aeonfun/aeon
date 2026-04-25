def num(x): (x // "0") | tonumber? // 0;
def clamp(x;a;b): if x < a then a elif x > b then b else x end;
def now_ts: now;
def parse_iso(s): (s | sub("Z$"; "+00:00") | fromdateiso8601);
def age_secs(s):
  if s == null then 1e12 else now_ts - parse_iso(s) end;
def fmt_dollar(x):
  if x == null then "n/a"
  elif x >= 1e9 then "$\((x/1e9*10|floor)/10)b"
  elif x >= 1e6 then "$\((x/1e6*10|floor)/10)m"
  elif x >= 1e3 then "$\((x/1e3|floor))k"
  else "$\(x|floor)" end;
def fmt_pct(x):
  if (x|fabs) < 10 then "\(if x>=0 then "+" else "" end)\((x*10|floor)/10)%"
  else "\(if x>=0 then "+" else "" end)\(x|floor)%" end;

[ .[] | .data[]? ]
| map(. + {_v: num(.attributes.volume_usd.h24)})
| group_by(.relationships.base_token.data.id)
| map(max_by(._v))
| . as $all
| ($all | length) as $pre_gate
| map(
    . as $p
    | (num(.attributes.volume_usd.h24)) as $v24
    | (num(.attributes.volume_usd.h1)) as $v1
    | (num(.attributes.price_change_percentage.h24)) as $pct24
    | (num(.attributes.price_change_percentage.h1)) as $pct1
    | (num(.attributes.reserve_in_usd)) as $liq
    | ((.attributes.transactions.h24.buys // 0)) as $buys
    | ((.attributes.transactions.h24.sells // 0)) as $sells
    | (age_secs(.attributes.pool_created_at)) as $age
    | . + {_v24: $v24, _pct24: $pct24, _pct1: $pct1, _liq: $liq, _buys: $buys, _sells: $sells, _age: $age,
           _reject:
             ( if $v24 < 50000 then "thin-vol"
               elif $pct24 <= 0 then "neg"
               elif $liq < 10000 then "low-liq"
               elif ($sells > 0 and ($buys/$sells) > 50 and $sells < 10) then "honeypot"
               elif ($buys > 0 and ($sells/$buys) > 10) then "dumping"
               elif ($age < 3600 and $v24 < 100000) then "too-new"
               elif $pct24 > 10000 then "rug-like"
               else null end )
          }
  )
| . as $tagged
| ($tagged | map(select(._reject != null)) | group_by(._reject) | map({key: .[0]._reject, value: length}) | from_entries) as $rej
| ($tagged | map(select(._reject == null))) as $surv
| ($surv | length) as $post_gate
| $surv
| map(
    . as $p
    | (clamp(._pct24/500;0;1)) as $pct_pts
    | (clamp((._v24+1|log10)/7;0;1)) as $vol_pts
    | (clamp((._liq+1|log10)/6;0;1)) as $liq_pts
    | (clamp((._pct1+50)/100;0;1)) as $mom_pts
    | (clamp(._buys / ((._buys+._sells) | if .==0 then 1 else . end);0;1)) as $skew_pts
    | . + {_score: (40*$pct_pts + 25*$vol_pts + 15*$liq_pts + 10*$mom_pts + 10*$skew_pts)}
    | . + {_tag:
        ( if (._liq >= 1000000 and ._v24 >= 1000000) then "DEEP-LIQ"
          elif (._age < 172800 and ._v24 >= 250000) then "BREAKOUT"
          elif (._pct1 > 2 and ._pct24 > 50) then "CONTINUATION"
          elif (._pct1 < -5 and ._pct24 > 0) then "REVERSAL"
          else "MICRO-SPEC" end )}
  )
| sort_by(-._score)
| .[0:5] as $top
| {
    pre_gate: $pre_gate,
    post_gate: $post_gate,
    rejections: $rej,
    top: ($top | map({
      name: .attributes.name,
      chain: .relationships.network.data.id,
      tag: ._tag,
      score: ((._score*10|floor)/10),
      pct24: ._pct24,
      pct1: ._pct1,
      vol24: ._v24,
      liq: ._liq,
      fdv: (.attributes.fdv_usd | tonumber? // null),
      mcap: (.attributes.market_cap_usd | tonumber? // null),
      buys: ._buys,
      sells: ._sells,
      pool_created_at: .attributes.pool_created_at,
      age_h: ((._age/3600*10|floor)/10),
      f_vol: fmt_dollar(._v24),
      f_liq: fmt_dollar(._liq),
      f_fdv: (if .attributes.fdv_usd != null then fmt_dollar(.attributes.fdv_usd|tonumber) else null end),
      f_mcap: (if .attributes.market_cap_usd != null then fmt_dollar(.attributes.market_cap_usd|tonumber) else null end),
      f_pct24: fmt_pct(._pct24),
      f_pct1: fmt_pct(._pct1)
    }))
  }
