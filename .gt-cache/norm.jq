.data[] | {
  network: (.relationships.network.data.id),
  name: (.attributes.name),
  base: (.relationships.base_token.data.id),
  m5: (.attributes.price_change_percentage.m5 // null | if . == null then null else tonumber end),
  h1: (.attributes.price_change_percentage.h1 // null | if . == null then null else tonumber end),
  h6: (.attributes.price_change_percentage.h6 // null | if . == null then null else tonumber end),
  h24: (.attributes.price_change_percentage.h24 // null | if . == null then null else tonumber end),
  vol24: (.attributes.volume_usd.h24 // null | if . == null then null else tonumber end),
  liq: (.attributes.reserve_in_usd // null | if . == null then null else tonumber end),
  mcap: (.attributes.market_cap_usd // null | if . == null then null else tonumber end),
  fdv: (.attributes.fdv_usd // null | if . == null then null else tonumber end),
  created: (.attributes.pool_created_at),
  buys: (.attributes.transactions.h24.buys // 0),
  sells: (.attributes.transactions.h24.sells // 0)
}
