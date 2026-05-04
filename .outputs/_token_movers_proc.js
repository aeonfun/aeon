const fs = require('fs');

const markets = JSON.parse(fs.readFileSync('/tmp/cg_markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('/tmp/cg_trending.json', 'utf8'));

console.log(`Markets count: ${markets.length}`);
console.log(`Trending count: ${(trending.coins || []).length}`);

const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg',
  'staked-ether','wrapped-bitcoin','wrapped-steth','weth','susds',
  'blackrock-usd-institutional-digital-liquidity-fund','ethena-usde','ethena-staked-usde',
  'sky-dollar','dai-savings-rate-token','usds','sky-savings-rate','wrapped-eeth',
  'wrapped-beacon-eth','renzo-restaked-eth','rocket-pool-eth','mantle-staked-ether',
  'jito-staked-sol','liquid-staked-ethereum','cbeth','wbeth','solv-protocol-solvbtc',
  'lombard-staked-btc','susde','usual-usd','origin-dollar',
  'bridged-usd-coin-polygon-pos-bridge','sky-stablecoin','ondo-us-dollar-yield',
  'frax','frax-share','liquid-collective-eth','tbtc','wrapped-eth','rocket-pool-staked-eth',
  'kelp-dao-restaked-eth','restaked-swell-eth'
]);
const WRAPPED_SYMS = new Set([
  'WBTC','WETH','STETH','WBETH','CBETH','RETH','METH','LSETH','EZETH','WEETH','SOLVBTC','LBTC',
  'JITOSOL','MSOL','BSOL','SUSDE','OUSD','TBTC','RENZO','SUSDS','USDS','SKY','PAXG','XAUT','XAUM',
  'BUIDL','BENJI','OUSG','USDM','RSETH','SWETH','RSWETH'
]);

function isStableOrWrap(c) {
  const cid = (c.id || '').toLowerCase();
  const sym = (c.symbol || '').toUpperCase();
  const name = (c.name || '').toLowerCase();
  if (STABLE_IDS.has(cid)) return true;
  if (name.includes('stablecoin')) return true;
  if (name.includes('wrapped')) return true;
  if (name.includes('staked ')) return true;
  if (name.startsWith('wrapped')) return true;
  if (sym.startsWith('USD') || sym.startsWith('EUR') || sym.startsWith('GBP')) return true;
  if (WRAPPED_SYMS.has(sym)) return true;
  return false;
}

const filtered = markets.filter(c =>
  c.total_volume && c.total_volume >= 1_000_000 &&
  c.price_change_percentage_24h_in_currency != null &&
  !isStableOrWrap(c)
);
console.log(`After filter: ${filtered.length}`);

const by24h = [...filtered].sort((a,b) =>
  (b.price_change_percentage_24h_in_currency || 0) - (a.price_change_percentage_24h_in_currency || 0));
const winners = by24h.slice(0, 10);
const losers = by24h.slice(-10).reverse();

const trendingCoins = (trending.coins || []).slice(0, 7);
const trendingIds = new Set((trending.coins || []).map(tc => tc.item.id));
const trendingSyms = new Set((trending.coins || []).map(tc => tc.item.symbol.toUpperCase()));

const top100 = filtered.slice(0, 100);
const green = top100.filter(c => (c.price_change_percentage_24h_in_currency || 0) > 0).length;
const top50pct = filtered.slice(0, 50).map(c => c.price_change_percentage_24h_in_currency || 0).sort((a,b)=>a-b);
const median50 = top50pct[Math.floor(top50pct.length / 2)];
console.log(`\nPulse: ${green}/100 green; median top50 24h: ${median50.toFixed(2)}%`);

// majors
console.log('\nMAJORS:');
for (const c of markets.slice(0, 30)) {
  if (['btc','eth','sol','xrp','bnb','ada','doge','hype','tao'].includes(c.symbol.toLowerCase())) {
    const p = c.current_price;
    const p24 = c.price_change_percentage_24h_in_currency || 0;
    const p7 = c.price_change_percentage_7d_in_currency || 0;
    const p1 = c.price_change_percentage_1h_in_currency || 0;
    console.log(`${c.symbol.toUpperCase()}: $${p.toLocaleString()}  24h ${p24.toFixed(2)}%  7d ${p7.toFixed(2)}%  1h ${p1.toFixed(2)}%  mc $${(c.market_cap/1e9).toFixed(1)}B`);
  }
}

function fmt(c) {
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const p7 = c.price_change_percentage_7d_in_currency || 0;
  const p1 = c.price_change_percentage_1h_in_currency || 0;
  const inTrend = trendingIds.has(c.id);
  return `  ${(c.symbol||'').toUpperCase().padEnd(10)} (${(c.name||'').slice(0,25).padEnd(25)}) #${c.market_cap_rank}  $${c.current_price}  24h ${p24.toFixed(1)}% / 7d ${p7.toFixed(1)}% / 1h ${p1.toFixed(1)}%  vol $${(c.total_volume/1e6).toFixed(1)}M  mc $${(c.market_cap/1e6).toFixed(1)}M  trend=${inTrend}`;
}

console.log('\nWINNERS (top 10 by 24h):');
winners.forEach(c => console.log(fmt(c)));

console.log('\nLOSERS (bottom 10 by 24h):');
losers.forEach(c => console.log(fmt(c)));

console.log('\nTRENDING (top 7):');
const mktById = Object.fromEntries(markets.map(c => [c.id, c]));
for (const tc of trendingCoins) {
  const item = tc.item;
  const sym = item.symbol.toUpperCase();
  const name = item.name;
  const rank = item.market_cap_rank ?? '?';
  const cid = item.id;
  const m = mktById[cid];
  if (m) {
    const p24 = m.price_change_percentage_24h_in_currency || 0;
    console.log(`  ${sym.padEnd(10)} (${name.slice(0,25).padEnd(25)}) #${rank}  $${m.current_price}  24h ${p24.toFixed(1)}%  vol $${(m.total_volume/1e6).toFixed(1)}M  mc $${(m.market_cap/1e6).toFixed(1)}M`);
  } else {
    const data = item.data || {};
    const priceUsd = data.price || 0;
    const pctObj = data.price_change_percentage_24h || {};
    const pct = pctObj.usd || 0;
    const mcStr = data.market_cap || '?';
    const volStr = data.total_volume || '?';
    console.log(`  ${sym.padEnd(10)} (${name.slice(0,25).padEnd(25)}) #${rank}  $${priceUsd}  24h ${pct.toFixed(1)}%  vol ${volStr}  mc ${mcStr}  [outside top-250]`);
  }
}
