const fs = require('fs');
const m = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.cache/markets.json'));
const t = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.cache/trending.json'));

// Stable / fiat / gold pegged exclusions
const stableIds = new Set(['tether','usd-coin','dai','first-digital-usd','ethena-usde','tether-usdt','tusd','true-usd','usdd','paypal-usd','pyusd','fdusd','paxg','pax-gold','sky-dollar-usds','susds','frax','liquity-usd','crypto-com-usd','tether-eurt','blackrock-usd-institutional-digital-liquidity-fund','usds','ondo-us-dollar-yield','eurc','tether-gold','usd1-wlfi','ethena-staked-usde','sky-dollar','usual-usd','usdy','susds-savings-dai','m','agora-dollar','usde','susd','susde','ousg','curve-usd','susda','blackrock-buidl','sdai','pyth-staked-usdc','ethena-usdtb','staked-usde','rseth','sUSDe']);
const stableSymPrefixes = ['usd','eur','gbp','jpy'];

function isStable(c) {
  if (stableIds.has(c.id)) return true;
  const s = (c.symbol||'').toLowerCase();
  if (stableSymPrefixes.some(p => s.startsWith(p))) return true;
  if ((c.name||'').toLowerCase().includes('stablecoin')) return true;
  // catch wrapped/staked majors? keep them — they're legitimate. But skip pure-peg.
  return false;
}

// Filter: drop stables and illiquid (<$1M vol)
const VOL_FLOOR = 1_000_000;
let filtered = m.filter(c => !isStable(c) && (c.total_volume||0) >= VOL_FLOOR && c.price_change_percentage_24h !== null);

// Drop wrapped dupes — keep one rep
const wrappedSyms = new Set(['wbtc','weth','steth','wsteth','wbeth','cbeth','reth','beth','sweth','rseth','meth','ezeth','pumpbtc','solvbtc','tbtc','msol','jitosol','bnsol','jupsol','wbnb','wmatic','wftm','wavax','sfrxeth','sfrxusd','frxeth','rsweth','retheth']);
filtered = filtered.filter(c => !wrappedSyms.has((c.symbol||'').toLowerCase()));

const sortedByPct = [...filtered].sort((a,b) => (b.price_change_percentage_24h||0) - (a.price_change_percentage_24h||0));
const winners = sortedByPct.slice(0, 10);
const losers = [...sortedByPct].reverse().slice(0, 10);

// Trending
const trendItems = (t.coins||[]).slice(0,7).map(x => x.item);

function fmtPrice(p) {
  if (p == null) return '?';
  if (p >= 1000) return '$'+p.toFixed(0);
  if (p >= 1) return '$'+p.toFixed(2);
  if (p >= 0.01) return '$'+p.toFixed(4);
  return '$'+p.toFixed(6);
}
function fmtBig(n) {
  if (n == null) return '?';
  if (n >= 1e9) return '$'+(n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return '$'+(n/1e6).toFixed(0)+'M';
  if (n >= 1e3) return '$'+(n/1e3).toFixed(0)+'K';
  return '$'+n.toFixed(0);
}
function pct(p) { if (p == null) return '?'; const s = p>=0?'+':''; return s+p.toFixed(1)+'%'; }

const trendingSyms = new Set(trendItems.map(x => (x.symbol||'').toLowerCase()));

function tagsFor(c, isWinner, isLoser) {
  const tags = [];
  const c24 = c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? 0;
  const c7 = c.price_change_percentage_7d_in_currency ?? 0;
  const c1h = c.price_change_percentage_1h_in_currency ?? 0;
  const sym = (c.symbol||'').toLowerCase();
  const rank = c.market_cap_rank || 999;
  const trending = trendingSyms.has(sym);
  if (trending && isWinner) tags.push('TRENDING+UP');
  if (trending && isLoser) tags.push('TRENDING+DOWN');
  if (c24 > 15 && c7 > 25) tags.push('BREAKOUT');
  if (c24 > 20 && c7 < 0) tags.push('FADE');
  const volMcap = (c.market_cap > 0) ? (c.total_volume / c.market_cap) : 0;
  if (c24 < -10 && volMcap > 0.25) tags.push('CAPITULATION');
  if (rank > 150 && c24 > 30) tags.push('PUMP-RISK');
  if ((c.market_cap||0) < 50e6) tags.push('MICROCAP');
  if (rank <= 20) tags.push('MAJOR');
  return tags.slice(0,2);
}

function row(c, isWinner, isLoser) {
  const c24 = c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? 0;
  const c7 = c.price_change_percentage_7d_in_currency ?? 0;
  const c1h = c.price_change_percentage_1h_in_currency ?? 0;
  const tags = tagsFor(c, isWinner, isLoser);
  return {
    sym: (c.symbol||'').toUpperCase(),
    name: c.name,
    price: fmtPrice(c.current_price),
    c24: pct(c24),
    c7: pct(c7),
    c1h: pct(c1h),
    vol: fmtBig(c.total_volume),
    rank: c.market_cap_rank,
    mcap: fmtBig(c.market_cap),
    tags,
    raw: { c24, c7, c1h, rank: c.market_cap_rank, sym: (c.symbol||'').toLowerCase(), vol: c.total_volume, mcap: c.market_cap }
  };
}

const winRows = winners.map(c => row(c, true, false));
const loseRows = losers.map(c => row(c, false, true));

// Trending rows — fetch from filtered list if matching, else use the trending payload data
function trendRow(item) {
  const sym = (item.symbol||'').toLowerCase();
  // attempt to find in filtered list
  const m_match = m.find(x => x.id === item.id);
  let c24 = item.data?.price_change_percentage_24h?.usd;
  let price = item.data?.price ?? null;
  let rank = item.market_cap_rank ?? null;
  if (m_match) {
    c24 = m_match.price_change_percentage_24h_in_currency ?? m_match.price_change_percentage_24h ?? c24;
    price = m_match.current_price ?? price;
    rank = m_match.market_cap_rank ?? rank;
  }
  return {
    name: item.name,
    sym: (item.symbol||'').toUpperCase(),
    rank: rank ?? '?',
    price: price ? fmtPrice(price) : '?',
    c24: pct(c24),
    market: m_match,
    tags: m_match ? tagsFor(m_match, (c24||0)>0, (c24||0)<0) : []
  };
}

const trendRows = trendItems.map(trendRow);

// Market pulse
const top100 = filtered.slice(0,100);
const greens = top100.filter(c => (c.price_change_percentage_24h||0) > 0).length;
const top50 = filtered.slice(0,50);
const sortedT50 = [...top50].sort((a,b) => (a.price_change_percentage_24h||0) - (b.price_change_percentage_24h||0));
const median = sortedT50.length ? sortedT50[Math.floor(sortedT50.length/2)].price_change_percentage_24h : 0;

console.log('--- PULSE ---');
console.log('greens (top100):', greens);
console.log('median 24h top50:', median.toFixed(2));
const btc = m.find(x=>x.id==='bitcoin');
const eth = m.find(x=>x.id==='ethereum');
const sol = m.find(x=>x.id==='solana');
console.log('BTC:', fmtPrice(btc.current_price), pct(btc.price_change_percentage_24h));
console.log('ETH:', fmtPrice(eth.current_price), pct(eth.price_change_percentage_24h));
console.log('SOL:', fmtPrice(sol.current_price), pct(sol.price_change_percentage_24h));

console.log('\n--- WINNERS ---');
console.log(JSON.stringify(winRows, null, 2));
console.log('\n--- LOSERS ---');
console.log(JSON.stringify(loseRows, null, 2));
console.log('\n--- TRENDING ---');
console.log(JSON.stringify(trendRows.map(r => ({name:r.name, sym:r.sym, rank:r.rank, price:r.price, c24:r.c24, tags:r.tags})), null, 2));

// Save for next step
fs.writeFileSync('/home/runner/work/aeon/aeon/.cache/processed.json', JSON.stringify({
  pulse: { greens, median, btc:{p:btc.current_price, c:btc.price_change_percentage_24h}, eth:{p:eth.current_price, c:eth.price_change_percentage_24h}, sol:{p:sol.current_price, c:sol.price_change_percentage_24h} },
  winners: winRows, losers: loseRows, trending: trendRows
}, null, 2));
