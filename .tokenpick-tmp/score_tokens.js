const fs = require('fs');
const dir = '/home/runner/work/aeon/aeon/.tokenpick-tmp';

const markets = JSON.parse(fs.readFileSync(dir + '/markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync(dir + '/trending.json', 'utf8'));
const dex = JSON.parse(fs.readFileSync(dir + '/dex.json', 'utf8'));

// Excluded tokens (last 7 days picks)
const excluded = new Set(['ape','pengu','xcn','ray','doge','lunc','pendle','ub']);

// Stables/wrapped
const stableLike = /USD|USDT|USDC|DAI|FRAX|TUSD|FDUSD|USDe|USDS|RLUSD|PYUSD|GUSD/i;

// Trending list symbols
const trendingSyms = new Set((trending.coins || []).map(c => (c.item.symbol || '').toLowerCase()));

// DexScreener trending tokens (extract baseToken symbols)
const dexSyms = new Set();
if (dex.pairs) {
  for (const p of dex.pairs) {
    if (p.baseToken && p.baseToken.symbol) dexSyms.add(p.baseToken.symbol.toLowerCase());
  }
}

// BTC and ETH 7d for relative-strength
const btc = markets.find(m => m.id === 'bitcoin');
const eth = markets.find(m => m.id === 'ethereum');
const btc7d = btc?.price_change_percentage_7d_in_currency ?? 0;
const eth7d = eth?.price_change_percentage_7d_in_currency ?? 0;
const btc24 = btc?.price_change_percentage_24h ?? 0;
const eth24 = eth?.price_change_percentage_24h ?? 0;

console.log(`BTC: 24h ${btc24.toFixed(2)}%, 7d ${btc7d.toFixed(2)}%`);
console.log(`ETH: 24h ${eth24.toFixed(2)}%, 7d ${eth7d.toFixed(2)}%`);
console.log(`Trending syms: ${[...trendingSyms].slice(0,15).join(',')}`);

const scored = [];
for (const c of markets) {
  const sym = (c.symbol || '').toLowerCase();
  if (excluded.has(sym)) continue;
  if (stableLike.test(c.symbol)) continue;
  // wrapped / staked
  if (/wrapped|staked|liquid|lido|jito|coinbase wrapped/i.test(c.name || '')) continue;
  if (/wbtc|cbbtc|tbtc|wbeth|wsteth|reth|steth|cbeth|jitosol|msol|jupsol|bnsol|bb-eth|ezeth|weeth|wseth/i.test(c.symbol || '')) continue;
  if (!c.market_cap || c.market_cap < 20_000_000) continue;

  const ch24 = c.price_change_percentage_24h ?? 0;
  const ch7d = c.price_change_percentage_7d_in_currency ?? 0;
  const vol = c.total_volume ?? 0;
  const mcap = c.market_cap;
  const vmc = vol / mcap;

  let score = 0;
  const breakdown = [];

  if (ch24 > 0) { score += 1; breakdown.push('24h+'); }
  if (ch7d > 0) { score += 1; breakdown.push('7d+'); }
  if (ch24 > 5 && ch7d > 5) { score += 2; breakdown.push('both>5%+2'); }
  if (trendingSyms.has(sym)) { score += 2; breakdown.push('cgtrend+2'); }
  if (vmc >= 0.20) { score += 3; breakdown.push('v/mc>=0.20+3'); }
  else if (vmc >= 0.10) { score += 2; breakdown.push('v/mc>=0.10+2'); }
  if (ch7d > btc7d && ch7d > eth7d) { score += 2; breakdown.push('RS+2'); }
  if (dexSyms.has(sym)) { score += 1; breakdown.push('dex+1'); }

  scored.push({
    sym: c.symbol,
    name: c.name,
    id: c.id,
    price: c.current_price,
    ch24, ch7d, mcap, vol, vmc,
    score, breakdown
  });
}

scored.sort((a,b) => b.score - a.score || b.vmc - a.vmc);
console.log('\nTop 20:');
for (const s of scored.slice(0, 20)) {
  console.log(`${s.score}/10 ${s.sym.padEnd(8)} $${s.price.toString().padStart(10)} 24h ${s.ch24.toFixed(1).padStart(6)}% 7d ${s.ch7d.toFixed(1).padStart(6)}% mc $${(s.mcap/1e6).toFixed(0)}M vol $${(s.vol/1e6).toFixed(0)}M v/mc ${s.vmc.toFixed(2)} [${s.breakdown.join(',')}]`);
}

fs.writeFileSync(dir + '/scored_tokens.json', JSON.stringify(scored.slice(0, 30), null, 2));
