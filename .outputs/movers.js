#!/usr/bin/env node
// Token movers analysis
const fs = require('fs');

const markets = JSON.parse(fs.readFileSync('.outputs/cg-markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('.outputs/cg-trending.json', 'utf8'));

// Stablecoin/peg exclusion list
const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg',
  'true-usd','frax','usds','liquity-usd','gho','crvusd','susd','usdo','usdy','usdg','m-by-m0',
  'ethena-usde','ethena-staked-usde','sky-dollar','usd0','blackrock-usd-institutional-digital-liquidity-fund',
  'ondo-us-dollar-yield','tether-gold','pax-gold','xaut'
]);
const STABLE_SYMBOL_PREFIXES = ['USD','EUR','GBP','XAU'];

// Wrapped/staked dupes — keep one representative per underlying
const WRAPPED_DUPES = new Set([
  'wrapped-bitcoin','tbtc','bitcoin-bep2','bitcoin-avalanche-bridged-btc-b','wbtc','rocket-pool-eth',
  'lido-staked-ether','wrapped-steth','staked-ether','wrapped-eeth','ether-fi-staked-eth','renzo-restaked-eth',
  'mantle-staked-ether','swell-restaked-eth','jupiter-staked-sol','jito-staked-sol','marinade-staked-sol',
  'binance-staked-sol','blackrock-eth','wrapped-eth','wrapped-solana','msol','jitosol','jupsol','meth',
  'kelp-dao-restaked-eth','restaked-swell-eth','wrapped-beacon-eth','coinbase-wrapped-staked-eth'
]);

function isStable(c) {
  if (STABLE_IDS.has(c.id)) return true;
  const sym = (c.symbol || '').toUpperCase();
  if (STABLE_SYMBOL_PREFIXES.some(p => sym.startsWith(p))) return true;
  const name = (c.name || '').toLowerCase();
  if (name.includes('stablecoin') || name.includes('pegged') || name.includes('us dollar')) return true;
  return false;
}

function isWrappedDupe(c) {
  return WRAPPED_DUPES.has(c.id);
}

// Filter
const filtered = markets.filter(c => {
  if (!c) return false;
  if (isStable(c)) return false;
  if (isWrappedDupe(c)) return false;
  if (!c.total_volume || c.total_volume < 1_000_000) return false;
  if (c.price_change_percentage_24h == null) return false;
  return true;
});

console.error(`Filtered ${markets.length} -> ${filtered.length}`);

// Sort
const winners = [...filtered].sort((a,b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0,10);
const losers  = [...filtered].sort((a,b) => a.price_change_percentage_24h - b.price_change_percentage_24h).slice(0,10);

// Trending
const trendingCoins = (trending.coins || []).slice(0,7).map(t => {
  const item = t.item || t;
  const dat = item.data || {};
  return {
    id: item.id,
    name: item.name,
    symbol: item.symbol,
    market_cap_rank: item.market_cap_rank,
    price_usd: dat.price ?? null,
    change_24h: (dat.price_change_percentage_24h && dat.price_change_percentage_24h.usd) ?? null,
  };
});

// Tag computation
function tagsFor(c, trendingIds, isWinner, isLoser) {
  const t = [];
  const ch24 = c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h;
  const ch7d = c.price_change_percentage_7d_in_currency ?? c.price_change_percentage_7d;
  const rank = c.market_cap_rank ?? 999;
  const mcap = c.market_cap ?? 0;
  const inTrending = trendingIds.has(c.id);

  if (inTrending && isWinner) t.push('TRENDING+UP');
  if (inTrending && isLoser) t.push('TRENDING+DOWN');

  if (ch24 != null && ch7d != null) {
    if (ch24 > 15 && ch7d > 25) t.push('BREAKOUT');
    else if (ch24 > 20 && ch7d < 0) t.push('FADE');
  }

  if (ch24 != null && ch24 < -10 && mcap > 0 && (c.total_volume / mcap) > 0.25) {
    t.push('CAPITULATION');
  }

  if (rank > 150 && ch24 != null && ch24 > 30) t.push('PUMP-RISK');
  if (mcap < 50_000_000 && mcap > 0) t.push('MICROCAP');
  if (rank <= 20) t.push('MAJOR');

  return t.slice(0,2);
}

const trendingIdSet = new Set(trendingCoins.map(t => t.id));

function fmtPrice(p) {
  if (p == null) return 'n/a';
  if (p >= 1000) return '$' + Math.round(p).toLocaleString();
  if (p >= 100) return '$' + p.toFixed(2);
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  if (p >= 0.0001) return '$' + p.toFixed(6);
  return '$' + p.toExponential(2);
}
function fmtPct(p) {
  if (p == null) return 'n/a';
  const sign = p > 0 ? '+' : '';
  return sign + p.toFixed(1) + '%';
}
function fmtAbbr(n) {
  if (n == null) return 'n/a';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(0) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}

function row(c, isWinner, isLoser) {
  const ch24 = c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h;
  const ch7d = c.price_change_percentage_7d_in_currency ?? c.price_change_percentage_7d;
  const ch1h = c.price_change_percentage_1h_in_currency ?? c.price_change_percentage_1h;
  const tags = tagsFor(c, trendingIdSet, isWinner, isLoser);
  return {
    name: c.name,
    symbol: (c.symbol || '').toUpperCase(),
    rank: c.market_cap_rank,
    price: c.current_price,
    ch24, ch7d, ch1h,
    vol: c.total_volume,
    mcap: c.market_cap,
    tags,
    line: `${(c.symbol||'').toUpperCase()} (${c.name}) — ${fmtPrice(c.current_price)}  ${fmtPct(ch24)} / 7d ${fmtPct(ch7d)} / 1h ${fmtPct(ch1h)}  •  ${fmtAbbr(c.total_volume)} / #${c.market_cap_rank}${tags.length ? '  [' + tags.join(',') + ']' : ''}`,
  };
}

const winnersOut = winners.map(c => row(c, true, false));
const losersOut = losers.map(c => row(c, false, true));

const top100 = filtered.slice(0,100);
const greenCount = top100.filter(c => (c.price_change_percentage_24h ?? 0) > 0).length;
const top50 = filtered.slice(0,50);
const top50Sorted = top50.map(c => c.price_change_percentage_24h).filter(x => x != null).sort((a,b)=>a-b);
const median50 = top50Sorted.length ? (top50Sorted[Math.floor(top50Sorted.length/2)] + top50Sorted[Math.ceil(top50Sorted.length/2-0.5)])/2 : 0;

const btc = filtered.find(c => c.id === 'bitcoin');
const eth = filtered.find(c => c.id === 'ethereum');
const sol = filtered.find(c => c.id === 'solana');

let pulse;
if (greenCount >= 70) pulse = `Broad risk-on — ${greenCount}/100 top coins green, median 24h ${fmtPct(median50)}`;
else if (greenCount <= 30) pulse = `Broad risk-off — ${greenCount}/100 top coins green, median 24h ${fmtPct(median50)}`;
else if (Math.abs(median50) < 1) pulse = `Quiet tape — ${greenCount}/100 top coins green, median 24h ${fmtPct(median50)}`;
else pulse = `Mixed tape — ${greenCount}/100 top coins green, median 24h ${fmtPct(median50)}`;

if (btc) pulse += `; BTC ${fmtPrice(btc.current_price)} ${fmtPct(btc.price_change_percentage_24h)}`;
if (eth) pulse += `, ETH ${fmtPrice(eth.current_price)} ${fmtPct(eth.price_change_percentage_24h)}`;
if (sol) pulse += `, SOL ${fmtPrice(sol.current_price)} ${fmtPct(sol.price_change_percentage_24h)}`;
pulse += '.';

const trendingOut = trendingCoins.map(t => {
  const inWinners = winnersOut.find(w => w.symbol.toLowerCase() === (t.symbol||'').toLowerCase());
  const inLosers = losersOut.find(w => w.symbol.toLowerCase() === (t.symbol||'').toLowerCase());
  const tags = [];
  if (inWinners) tags.push('TRENDING+UP');
  if (inLosers) tags.push('TRENDING+DOWN');
  if (t.market_cap_rank && t.market_cap_rank <= 20) tags.push('MAJOR');
  return {
    ...t,
    tags: tags.slice(0,2),
    line: `${t.name} (${(t.symbol||'').toUpperCase()}) — #${t.market_cap_rank ?? '?'}, ${fmtPrice(t.price_usd)}, 24h ${fmtPct(t.change_24h)}${tags.length ? '  [' + tags.join(',') + ']' : ''}`,
  };
});

const notable = [];
for (const w of winnersOut) {
  if (w.tags.includes('PUMP-RISK')) notable.push(`${w.symbol}: #${w.rank} rank up ${fmtPct(w.ch24)} on ${fmtAbbr(w.vol)} — PUMP-RISK, low cap`);
  else if (w.tags.includes('TRENDING+UP')) notable.push(`${w.symbol}: trending + up ${fmtPct(w.ch24)} (7d ${fmtPct(w.ch7d)}) — strong signal`);
  else if (w.tags.includes('BREAKOUT')) notable.push(`${w.symbol}: breakout — 24h ${fmtPct(w.ch24)} on top of 7d ${fmtPct(w.ch7d)}`);
}
for (const l of losersOut) {
  if (l.tags.includes('CAPITULATION')) notable.push(`${l.symbol}: capitulation — 24h ${fmtPct(l.ch24)} on ${fmtAbbr(l.vol)} (vol/mcap ${(l.vol/l.mcap).toFixed(2)})`);
  else if (l.tags.includes('TRENDING+DOWN')) notable.push(`${l.symbol}: trending + down ${fmtPct(l.ch24)}`);
}

const out = {
  pulse,
  greenCount,
  median50,
  winners: winnersOut,
  losers: losersOut,
  trending: trendingOut,
  notable: notable.slice(0,4),
  filteredCount: filtered.length,
  totalCount: markets.length,
};

fs.writeFileSync('.outputs/movers.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
