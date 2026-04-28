// Token Movers analysis — 2026-04-28
const fs = require('fs');
const markets = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.outputs/cg-markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.outputs/cg-trending.json', 'utf8'));

// 1. Filter stablecoins/illiquid/wrapped
const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg',
  'ethena-usde','frax','usdp','pax-dollar','gho','crvusd','lusd','mim','susd',
  'staked-frax-ether','susds','ondo-us-dollar-yield','sky-dollar','usds',
  'aave-usdc','aethena-usde','bsc-usd','ripple-usd','rsr','blackrock-usd-institutional-digital-liquidity-fund',
  'usd1','usdz','m-by-m0','curve-usd','paypal-usd','ethena-staked-usde','sdai','susde'
]);
const WRAPPED_IDS = new Set([
  'wrapped-bitcoin','weth','staked-ether','wrapped-steth','rocket-pool-eth','liquid-staked-ethereum',
  'binance-bridged-usdt-bnb-smart-chain','wbeth','renbtc','tbtc','solv-btc','coinbase-wrapped-btc',
  'wrapped-eeth','liquid-staked-ether','lombard-staked-btc','ether-fi-staked-eth','wrapped-bitcoin-cbbtc',
  'kelp-dao-restaked-eth','jito-staked-sol','msol','blackrock-bitcoin-trust','staked-frax-ether',
  'renzo-restaked-eth','staked-bnb','wrapped-avax','restaked-swell-eth',
  'mev-capital-wrapped-eeth','wrapped-tao','origin-protocol-eth','wrapped-bittensor','wbnb',
  'binance-peg-eth','bridged-usdc-polygon-pos','bridged-wrapped-bitcoin','sweth','sfrax',
  'klima-dao','staked-tao','restaked-eth','sol2','staked-hype','staked-ondo','sthype',
  'binance-staked-sol','bnsol','sol-strategy','sky-strategy','wlfi-eth','wsteth'
]);
const FIAT_PEG_PREFIX = ['USD','EUR','GBP','JPY','CHF','CNY','BRL','TRY','RUB'];

function isStable(c) {
  if (STABLE_IDS.has(c.id)) return true;
  const sym = (c.symbol || '').toUpperCase();
  if (FIAT_PEG_PREFIX.some(p => sym.startsWith(p))) return true;
  const name = (c.name || '').toLowerCase();
  if (name.includes('stablecoin') || name.includes('usd ') || name.endsWith(' usd')) return true;
  // peg detector: price close to $1 with very low volatility
  if (Math.abs((c.current_price || 0) - 1) < 0.02 && Math.abs(c.price_change_percentage_24h || 0) < 0.5 && Math.abs(c.price_change_percentage_7d_in_currency || 0) < 1) return true;
  return false;
}
function isWrapped(c) {
  if (WRAPPED_IDS.has(c.id)) return true;
  const name = (c.name || '').toLowerCase();
  if (name.startsWith('wrapped ') || name.startsWith('staked ') || name.includes('liquid stak') || name.includes('restaked') || name.includes('bridged')) return true;
  return false;
}

const filtered = markets.filter(c => {
  if (!c) return false;
  if (isStable(c)) return false;
  if (isWrapped(c)) return false;
  if ((c.total_volume || 0) < 1_000_000) return false;
  return true;
});

console.log(`Markets total: ${markets.length}, after filter: ${filtered.length}`);

const by24h = filtered.filter(c => c.price_change_percentage_24h != null).sort((a,b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
const winners = by24h.slice(0, 10);
const losers = by24h.slice(-10).reverse();

const trendingCoins = (trending.coins || []).slice(0, 7).map(t => t.item);
const trendingIds = new Set(trendingCoins.map(t => t.id));

function tagsFor(c, isWinner, isLoser) {
  const tags = [];
  const ch24 = c.price_change_percentage_24h || 0;
  const ch7d = c.price_change_percentage_7d_in_currency || 0;
  const rank = c.market_cap_rank || 999;
  const mcap = c.market_cap || 0;
  const volMcap = c.market_cap ? c.total_volume / c.market_cap : 0;
  const inTrending = trendingIds.has(c.id);

  if (inTrending && isWinner) tags.push('TRENDING+UP');
  if (inTrending && isLoser) tags.push('TRENDING+DOWN');
  if (ch24 > 15 && ch7d > 25) tags.push('BREAKOUT');
  if (ch24 > 20 && ch7d < 0) tags.push('FADE');
  if (ch24 < -10 && volMcap > 0.25) tags.push('CAPITULATION');
  if (rank > 150 && ch24 > 30) tags.push('PUMP-RISK');
  if (mcap < 50_000_000) tags.push('MICROCAP');
  if (rank <= 20) tags.push('MAJOR');

  return tags.slice(0, 2);
}

// Pulse
const top100 = filtered.slice(0, 100);
const greenCount = top100.filter(c => (c.price_change_percentage_24h || 0) > 0).length;
const top50 = filtered.slice(0, 50);
const median24h = (() => {
  const vals = top50.map(c => c.price_change_percentage_24h || 0).sort((a,b) => a-b);
  const m = vals.length;
  return m % 2 ? vals[Math.floor(m/2)] : (vals[m/2-1] + vals[m/2]) / 2;
})();

const btc = markets.find(c => c.id === 'bitcoin');
const eth = markets.find(c => c.id === 'ethereum');
const sol = markets.find(c => c.id === 'solana');

console.log(`\n--- PULSE ---`);
console.log(`Top-100 green: ${greenCount}/100`);
console.log(`Median 24h (top 50): ${median24h.toFixed(2)}%`);
console.log(`BTC: $${btc.current_price.toLocaleString()} ${btc.price_change_percentage_24h.toFixed(2)}% / 7d ${btc.price_change_percentage_7d_in_currency.toFixed(1)}%`);
console.log(`ETH: $${eth.current_price.toLocaleString()} ${eth.price_change_percentage_24h.toFixed(2)}% / 7d ${eth.price_change_percentage_7d_in_currency.toFixed(1)}%`);
console.log(`SOL: $${sol.current_price.toLocaleString()} ${sol.price_change_percentage_24h.toFixed(2)}% / 7d ${sol.price_change_percentage_7d_in_currency.toFixed(1)}%`);

function fmtPrice(p) {
  if (p == null) return '$?';
  if (p < 0.0001) return '$' + p.toExponential(2);
  if (p < 0.01) return '$' + p.toFixed(6).replace(/0+$/,'').replace(/\.$/, '');
  if (p < 1) return '$' + p.toFixed(4);
  if (p < 100) return '$' + p.toFixed(3);
  return '$' + Math.round(p).toLocaleString();
}
function fmtAbbr(n) {
  if (n == null) return '?';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(0) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
  return '$' + Math.round(n);
}
function fmtPct(p) {
  if (p == null) return '?';
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
}

console.log(`\n--- WINNERS ---`);
winners.forEach((c, i) => {
  const tags = tagsFor(c, true, false);
  const volMcap = c.market_cap ? (c.total_volume / c.market_cap).toFixed(2) : '?';
  console.log(`${i+1}. ${c.symbol.toUpperCase()} (${c.name}) — ${fmtPrice(c.current_price)} ${fmtPct(c.price_change_percentage_24h)} / 7d ${fmtPct(c.price_change_percentage_7d_in_currency)} / 1h ${fmtPct(c.price_change_percentage_1h_in_currency)} • ${fmtAbbr(c.total_volume)} / #${c.market_cap_rank} • v/m=${volMcap} ${tags.length ? '['+tags.join(' / ')+']' : ''}`);
});

console.log(`\n--- LOSERS ---`);
losers.forEach((c, i) => {
  const tags = tagsFor(c, false, true);
  const volMcap = c.market_cap ? (c.total_volume / c.market_cap).toFixed(2) : '?';
  console.log(`${i+1}. ${c.symbol.toUpperCase()} (${c.name}) — ${fmtPrice(c.current_price)} ${fmtPct(c.price_change_percentage_24h)} / 7d ${fmtPct(c.price_change_percentage_7d_in_currency)} / 1h ${fmtPct(c.price_change_percentage_1h_in_currency)} • ${fmtAbbr(c.total_volume)} / #${c.market_cap_rank} • v/m=${volMcap} ${tags.length ? '['+tags.join(' / ')+']' : ''}`);
});

console.log(`\n--- TRENDING ---`);
trendingCoins.forEach((t, i) => {
  const c = markets.find(x => x.id === t.id);
  const ch24 = (c && c.price_change_percentage_24h != null) ? c.price_change_percentage_24h : (t.data && t.data.price_change_percentage_24h && t.data.price_change_percentage_24h.usd) ?? null;
  const price = (c && c.current_price) ?? (t.data && t.data.price) ?? null;
  const rank = t.market_cap_rank || (c && c.market_cap_rank) || '—';
  const tags = c ? tagsFor(c, false, false) : [];
  if (!c && rank && rank > 150 && ch24 > 30) tags.push('PUMP-RISK');
  console.log(`${i+1}. ${t.name} (${(t.symbol||'').toUpperCase()}) — #${rank}, ${price != null ? fmtPrice(price) : '$?'}, 24h ${ch24 != null ? fmtPct(ch24) : '?'} ${tags.length ? '['+tags.join(' / ')+']' : ''}`);
});

const out = {
  pulse: { greenCount, median24h, btc: btc.price_change_percentage_24h, eth: eth.price_change_percentage_24h, sol: sol.price_change_percentage_24h, btcPrice: btc.current_price, ethPrice: eth.current_price, solPrice: sol.current_price, btc7d: btc.price_change_percentage_7d_in_currency, eth7d: eth.price_change_percentage_7d_in_currency, sol7d: sol.price_change_percentage_7d_in_currency },
  winners: winners.map(c => ({ symbol: c.symbol.toUpperCase(), name: c.name, price: c.current_price, ch24: c.price_change_percentage_24h, ch7d: c.price_change_percentage_7d_in_currency, ch1h: c.price_change_percentage_1h_in_currency, vol: c.total_volume, mcap: c.market_cap, rank: c.market_cap_rank, tags: tagsFor(c, true, false) })),
  losers: losers.map(c => ({ symbol: c.symbol.toUpperCase(), name: c.name, price: c.current_price, ch24: c.price_change_percentage_24h, ch7d: c.price_change_percentage_7d_in_currency, ch1h: c.price_change_percentage_1h_in_currency, vol: c.total_volume, mcap: c.market_cap, rank: c.market_cap_rank, tags: tagsFor(c, false, true) })),
  trending: trendingCoins.map(t => {
    const c = markets.find(x => x.id === t.id);
    const ch24 = (c && c.price_change_percentage_24h != null) ? c.price_change_percentage_24h : (t.data && t.data.price_change_percentage_24h && t.data.price_change_percentage_24h.usd) ?? null;
    return { symbol: (t.symbol||'').toUpperCase(), name: t.name, id: t.id, rank: t.market_cap_rank, price: c?.current_price ?? t.data?.price, ch24, tags: c ? tagsFor(c, false, false) : [] };
  })
};
fs.writeFileSync('/home/runner/work/aeon/aeon/.outputs/movers.json', JSON.stringify(out, null, 2));
