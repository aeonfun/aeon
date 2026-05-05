// Token-movers processor for 2026-05-05
const fs = require('fs');
const markets = JSON.parse(fs.readFileSync('.outputs/cg-markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('.outputs/cg-trending.json', 'utf8'));

const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','ethena-usde','tusd','true-usd','usdd','pyusd','fdusd','paxg',
  'paypal-usd','frax','usdp','gho','crvusd','lusd','susds','sky-dollar-usds','usds','ondo-us-dollar-yield',
  'binance-usd','tether-gold','m0-by-m0','blackrock-usd-institutional-digital-liquidity-fund','usd0','resolv-usr','usdtb',
  'falcon-finance','bitcoin-cash-eth','jpyc','ena','ethena','ethena-staked-usde','susde','sky','sky-protocol',
  'string-finance','reservoir','xaut','tether-eurt','euro-coin','eurc','eurs','jpy-coin','tron-usdd','agdai',
  'savings-dai','usual-usd','usual','olympus','vaulta','aave-usd-coin','aave-tether','tether-eurt-eurt',
  'savings-usd-coin','sdai','origin-dollar','origin-defi','reserve-rights-token','wrapped-usdr','usd-coin-pos',
  'wrapped-frax-share','frax-share','sfrax','frax-ether','staked-frax','staked-frax-ether','usd1','wlfi-usd-1','aethir-usd1'
]);
const STABLE_SYMBOL_PREFIXES = ['USD','EUR','GBP','JPY','CHF','CAD','AUD'];

function isStable(c) {
  const id = (c.id||'').toLowerCase();
  const sym = (c.symbol||'').toUpperCase();
  const name = (c.name||'').toLowerCase();
  if (STABLE_IDS.has(id)) return true;
  if (STABLE_SYMBOL_PREFIXES.some(p => sym.startsWith(p))) return true;
  if (name.includes('stablecoin')) return true;
  if (name.includes('staked usd') || name.includes('savings usd') || name.includes('savings dai')) return true;
  // wrapped/synthetic stables
  if (name.includes(' usd ') || name.endsWith(' usd')) return true;
  // gold-pegged
  if (id.includes('paxg') || sym === 'XAUT' || sym === 'PAXG') return true;
  return false;
}

const WRAPPED_DUPES = new Set(['wbtc','weth','steth','wsteth','reth','cbeth','wbeth','tbtc','cbbtc','solv-protocol-solvbtc','wrapped-eeth','renzo-restaked-eth','sfraxeth','msteth','msol','jitosol','bnsol','jupsol']);
function isWrappedDupe(c) {
  return WRAPPED_DUPES.has(c.id);
}

const filtered = markets.filter(c => {
  if (isStable(c)) return false;
  if ((c.total_volume || 0) < 1_000_000) return false;
  return true;
});

// Build set of trending coin ids for tag
const trendingItems = (trending.coins || []).slice(0, 7).map(t => t.item);
const trendingIds = new Set(trendingItems.map(t => t.id));

function pct(x, dp=1) {
  if (x == null || isNaN(x)) return 'n/a';
  return (x>=0?'+':'') + x.toFixed(dp) + '%';
}

function tagsFor(c) {
  const ch24 = c.price_change_percentage_24h ?? c.price_change_percentage_24h_in_currency ?? 0;
  const ch7d = c.price_change_percentage_7d_in_currency ?? 0;
  const tags = [];
  if (trendingIds.has(c.id)) {
    if (ch24 >= 5) tags.push('TRENDING+UP');
    else if (ch24 <= -5) tags.push('TRENDING+DOWN');
    else tags.push('TRENDING');
  }
  if (ch24 > 15 && ch7d > 25) tags.push('BREAKOUT');
  if (ch24 > 20 && ch7d < 0) tags.push('FADE');
  const volMcRatio = (c.total_volume || 0) / (c.market_cap || 1);
  if (ch24 < -10 && volMcRatio > 0.25) tags.push('CAPITULATION');
  if ((c.market_cap_rank ?? 999) > 150 && ch24 > 30) tags.push('PUMP-RISK');
  if ((c.market_cap || 0) < 50_000_000) tags.push('MICROCAP');
  if ((c.market_cap_rank ?? 999) <= 20) tags.push('MAJOR');
  return tags.slice(0, 2);
}

function fmtPrice(p) {
  if (p == null) return 'n/a';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', {maximumFractionDigits:0});
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}
function fmtBig(x) {
  if (x == null) return 'n/a';
  if (x >= 1e12) return '$' + (x/1e12).toFixed(2) + 'T';
  if (x >= 1e9) return '$' + (x/1e9).toFixed(2) + 'B';
  if (x >= 1e6) return '$' + (x/1e6).toFixed(1) + 'M';
  if (x >= 1e3) return '$' + (x/1e3).toFixed(0) + 'K';
  return '$' + x.toFixed(0);
}

const sorted24 = [...filtered].sort((a,b) => (b.price_change_percentage_24h ?? -999) - (a.price_change_percentage_24h ?? -999));

// Dedupe wrapped dupes within picked lists
function pickList(arr, n) {
  const out = [];
  const seenWrapBucket = new Set();
  for (const c of arr) {
    if (isWrappedDupe(c)) {
      // map to base
      const sym = (c.symbol||'').toLowerCase();
      const base = sym.replace(/^w/, '').replace(/^st/, '').replace(/^cb/, '').replace(/^r/,'');
      if (seenWrapBucket.has(base)) continue;
      seenWrapBucket.add(base);
    }
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

const winners = pickList(sorted24, 10);
const losers = pickList([...sorted24].reverse(), 10);

// Trending enrich
const trendingMarkets = trendingItems.map(t => {
  const market = markets.find(m => m.id === t.id);
  return {
    id: t.id,
    name: t.name,
    symbol: (t.symbol||'').toUpperCase(),
    rank: t.market_cap_rank,
    price: market?.current_price ?? (t.data?.price ?? null),
    ch24: market?.price_change_percentage_24h ?? (t.data?.price_change_percentage_24h?.usd ?? null),
    ch7d: market?.price_change_percentage_7d_in_currency ?? null,
    market_cap: market?.market_cap ?? null,
    total_volume: market?.total_volume ?? null,
    tags: market ? tagsFor(market) : (() => {
      const ch24 = t.data?.price_change_percentage_24h?.usd ?? 0;
      const out = ['TRENDING'];
      if ((t.market_cap_rank ?? 999) > 150 && ch24 > 30) out.push('PUMP-RISK');
      return out;
    })()
  };
});

// Market pulse: top 100 by mcap (filtered)
const top100 = filtered.slice(0, 100);
const greenCount = top100.filter(c => (c.price_change_percentage_24h ?? 0) > 0).length;
const top50 = filtered.slice(0, 50);
const top50Sorted = [...top50].map(c => c.price_change_percentage_24h ?? 0).sort((a,b)=>a-b);
const median50 = top50Sorted.length ? (top50Sorted[Math.floor((top50Sorted.length-1)/2)] + top50Sorted[Math.ceil((top50Sorted.length-1)/2)]) / 2 : 0;

// BTC/ETH/SOL refs
const btc = markets.find(m=>m.id==='bitcoin');
const eth = markets.find(m=>m.id==='ethereum');
const sol = markets.find(m=>m.id==='solana');

const result = {
  date: '2026-05-05',
  filteredCount: filtered.length,
  pulse: {
    greenTop100: greenCount,
    redTop100: 100 - greenCount,
    medianTop50: median50,
    btc: btc ? {price: btc.current_price, ch24: btc.price_change_percentage_24h, ch7d: btc.price_change_percentage_7d_in_currency} : null,
    eth: eth ? {price: eth.current_price, ch24: eth.price_change_percentage_24h, ch7d: eth.price_change_percentage_7d_in_currency} : null,
    sol: sol ? {price: sol.current_price, ch24: sol.price_change_percentage_24h, ch7d: sol.price_change_percentage_7d_in_currency} : null,
  },
  winners: winners.map(c => ({
    id: c.id, name: c.name, symbol: c.symbol.toUpperCase(), rank: c.market_cap_rank,
    price: c.current_price, ch1h: c.price_change_percentage_1h_in_currency,
    ch24: c.price_change_percentage_24h, ch7d: c.price_change_percentage_7d_in_currency,
    volume: c.total_volume, market_cap: c.market_cap, tags: tagsFor(c),
    volMc: (c.total_volume||0)/(c.market_cap||1)
  })),
  losers: losers.map(c => ({
    id: c.id, name: c.name, symbol: c.symbol.toUpperCase(), rank: c.market_cap_rank,
    price: c.current_price, ch1h: c.price_change_percentage_1h_in_currency,
    ch24: c.price_change_percentage_24h, ch7d: c.price_change_percentage_7d_in_currency,
    volume: c.total_volume, market_cap: c.market_cap, tags: tagsFor(c),
    volMc: (c.total_volume||0)/(c.market_cap||1)
  })),
  trending: trendingMarkets,
};

fs.writeFileSync('.outputs/movers-0505.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
