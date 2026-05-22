#!/usr/bin/env node
const fs = require('fs');

const markets = JSON.parse(fs.readFileSync('.cache-token-movers/markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('.cache-token-movers/trending.json', 'utf8'));

// Stablecoins to exclude (by id)
const STABLE_IDS = new Set([
  'tether', 'usd-coin', 'dai', 'first-digital-usd', 'ethena-usde', 'usde',
  'true-usd', 'tusd', 'usdd', 'paypal-usd', 'pyusd', 'fdusd', 'paxg',
  'pax-gold', 'tether-gold', 'frax', 'usdy', 'ondo-us-dollar-yield',
  'binance-staked-sol', 'lido-staked-ether', 'rocket-pool-eth',
  'wrapped-steth', 'staked-frax-ether', 'wrapped-beacon-eth',
  'usds', 'sky-dollar', 'usd1-wlfi', 'world-liberty-financial-usd',
  'resolv-usr', 'usdt0', 'bridged-usdc-polygon-pos-bridge', 'binance-bridged-usdt-bnb-smart-chain',
  'reservoir-srusd', 'savings-dai', 'global-dollar', 'm-by-m0', 'falcon-finance',
  'usdf', 'falcon-usd', 'level-usd', 'lvlusd',
]);

// Wrapped/staked duplicates to exclude
const WRAPPED_PREFIXES = ['wrapped-', 'staked-', 'liquid-staked-'];
const WRAPPED_IDS = new Set([
  'wrapped-bitcoin', 'weth', 'wrapped-eeth', 'binance-bitcoin', 'coinbase-wrapped-btc',
  'cbeth', 'lido-staked-ether', 'rocket-pool-eth', 'mantle-staked-ether',
  'binance-peg-weth', 'wrapped-bnb', 'jito-staked-sol', 'marinade-staked-sol',
  'kelp-dao-restaked-eth', 'renzo-restaked-eth', 'wrapped-tron', 'wbtc',
]);

function isStablecoinName(c) {
  const sym = (c.symbol || '').toUpperCase();
  const name = (c.name || '').toLowerCase();
  if (STABLE_IDS.has(c.id)) return true;
  if (/^USD/.test(sym) || /^EUR/.test(sym) || /^GBP/.test(sym)) return true;
  if (name.includes('stablecoin')) return true;
  // Detect dollar-pegged by name pattern
  if (/usd\b/i.test(name) && Math.abs(c.current_price - 1) < 0.05) return true;
  return false;
}

function isWrapped(c) {
  if (WRAPPED_IDS.has(c.id)) return true;
  for (const p of WRAPPED_PREFIXES) {
    if (c.id.startsWith(p)) return true;
  }
  const sym = (c.symbol || '').toLowerCase();
  if (['wbtc','weth','wbnb','wtrx','wsol','steth','reth','cbeth','wbeth','weeth','jitosol','msol'].includes(sym)) return true;
  return false;
}

// Filter
const filtered = markets.filter(c => {
  if (!c) return false;
  if (isStablecoinName(c)) return false;
  if (isWrapped(c)) return false;
  if ((c.total_volume || 0) < 1_000_000) return false;
  if (c.price_change_percentage_24h == null) return false;
  return true;
});

// Compute market pulse (top 100 from filtered)
const top100 = filtered.slice(0, 100);
const top100_green = top100.filter(c => c.price_change_percentage_24h > 0).length;
const top50 = filtered.slice(0, 50);
const top50_sorted = [...top50].map(c => c.price_change_percentage_24h).sort((a,b)=>a-b);
const median50 = top50_sorted[Math.floor(top50_sorted.length/2)];

const btc = markets.find(c => c.id === 'bitcoin');
const eth = markets.find(c => c.id === 'ethereum');
const sol = markets.find(c => c.id === 'solana');

// Trending coins (lowercased ids)
const trendingIds = new Set(trending.coins.map(t => t.item.id));
const trendingSyms = new Set(trending.coins.map(t => (t.item.symbol || '').toUpperCase()));

// Tag computation
function tagsFor(c, opts) {
  const tags = [];
  const ch24 = c.price_change_percentage_24h;
  const ch7 = c.price_change_percentage_7d_in_currency;
  const rank = c.market_cap_rank;
  const vol = c.total_volume;
  const mcap = c.market_cap;
  const inTrend = trendingIds.has(c.id);
  const volRatio = vol / mcap;

  // PUMP-RISK first (must always surface per SKILL.md)
  if (rank > 150 && ch24 > 30) tags.push('[PUMP-RISK]');

  // TRENDING combos
  if (inTrend && opts && opts.list === 'winners' && ch24 > 0) tags.push('[TRENDING+UP]');
  if (inTrend && opts && opts.list === 'losers' && ch24 < 0) tags.push('[TRENDING+DOWN]');

  // BREAKOUT
  if (ch24 > 15 && ch7 != null && ch7 > 25) tags.push('[BREAKOUT]');

  // FADE
  if (ch24 > 20 && ch7 != null && ch7 < 0) tags.push('[FADE]');

  // CAPITULATION
  if (ch24 < -10 && volRatio > 0.25) tags.push('[CAPITULATION]');

  // MICROCAP
  if (mcap < 50_000_000) tags.push('[MICROCAP]');

  // MAJOR
  if (rank <= 20) tags.push('[MAJOR]');

  return tags.slice(0, 2);
}

// Winners and losers
const sortedByChange = [...filtered].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
const winners = sortedByChange.slice(0, 10);
const losers = [...filtered].sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h).slice(0, 10);

// Trending
const trendingTop = trending.coins.slice(0, 7).map(t => t.item);

function fmtPrice(p) {
  if (p == null) return 'n/a';
  if (p >= 1000) return '$' + p.toFixed(0);
  if (p >= 10) return '$' + p.toFixed(2);
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}

function fmtBig(n) {
  if (n == null) return 'n/a';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(0) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}

function fmtPct(p) {
  if (p == null || isNaN(p)) return 'n/a';
  const s = p >= 0 ? '+' : '';
  return s + p.toFixed(1) + '%';
}

function renderRow(c, tags) {
  const ch1 = c.price_change_percentage_1h_in_currency;
  const ch24 = c.price_change_percentage_24h;
  const ch7 = c.price_change_percentage_7d_in_currency;
  return `${c.symbol.toUpperCase()} (${c.name}) — ${fmtPrice(c.current_price)}  ${fmtPct(ch24)} / 7d ${fmtPct(ch7)} / 1h ${fmtPct(ch1)}  •  ${fmtBig(c.total_volume)} / #${c.market_cap_rank}  ${tags.join(' ')}`;
}

const result = {
  pulse: { top100_green, median50, btc_24h: btc?.price_change_percentage_24h, eth_24h: eth?.price_change_percentage_24h, sol_24h: sol?.price_change_percentage_24h, btc_7d: btc?.price_change_percentage_7d_in_currency, eth_7d: eth?.price_change_percentage_7d_in_currency, sol_7d: sol?.price_change_percentage_7d_in_currency },
  winners: winners.map(c => ({ row: renderRow(c, tagsFor(c, {list:'winners'})), tags: tagsFor(c, {list:'winners'}), c })),
  losers: losers.map(c => ({ row: renderRow(c, tagsFor(c, {list:'losers'})), tags: tagsFor(c, {list:'losers'}), c })),
  trending: trendingTop.map(t => {
    const cgM = markets.find(m => m.id === t.id);
    const ch24 = cgM ? cgM.price_change_percentage_24h : (t.data && t.data.price_change_percentage_24h && t.data.price_change_percentage_24h.usd);
    const tags = cgM ? tagsFor(cgM, {list:'trending'}) : [];
    return { name: t.name, sym: t.symbol, rank: t.market_cap_rank, price: t.data && t.data.price, ch24, tags, cgM };
  }),
  filter_count: filtered.length,
};

fs.writeFileSync('.cache-token-movers/out.json', JSON.stringify(result, null, 2));
console.log('wrote .cache-token-movers/out.json');
