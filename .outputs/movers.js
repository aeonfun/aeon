const fs = require('fs');
const data = JSON.parse(fs.readFileSync('.outputs/cg-markets.json'));
const trending = JSON.parse(fs.readFileSync('.outputs/cg-trending.json'));

const stables = new Set(['tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg','susd','crvusd','frax','lusd','gusd','usdy','usds','rlusd','susds','blackrock-usd','ondo-us-dollar-yield','m-by-m-0','usdt0','sky-dollar','wsteth','staked-ether','wrapped-bitcoin','wrapped-eeth','rocket-pool-eth','wrapped-steth','reth','weth','wbnb','wsol','jupiter-staked-sol','binance-staked-sol','jito-staked-sol','marinade-staked-sol','lido-staked-ether','coinbase-wrapped-staked-eth','renzo-restaked-eth','ether-fi-staked-eth','kelp-dao-restaked-eth','restaked-swell-eth','wbeth']);

function isStable(c) {
  const cid = (c.id || '').toLowerCase();
  const sym = (c.symbol || '').toUpperCase();
  const name = (c.name || '').toLowerCase();
  if (stables.has(cid)) return true;
  if (sym.startsWith('USD') || sym.startsWith('EUR') || sym.startsWith('GBP')) return true;
  if (name.includes('stablecoin') || name.includes('wrapped') || name.includes('staked')) return true;
  return false;
}

const filtered = data.filter(c =>
  !isStable(c) &&
  (c.total_volume || 0) >= 1_000_000 &&
  c.price_change_percentage_24h_in_currency != null
);

const winners = [...filtered].sort((a,b) => (b.price_change_percentage_24h_in_currency||0) - (a.price_change_percentage_24h_in_currency||0)).slice(0, 10);
const losers = [...filtered].sort((a,b) => (a.price_change_percentage_24h_in_currency||0) - (b.price_change_percentage_24h_in_currency||0)).slice(0, 10);

const top100 = filtered.slice(0, 100);
const green = top100.filter(c => (c.price_change_percentage_24h_in_currency || 0) > 0).length;
const top50pct = filtered.slice(0, 50).map(c => c.price_change_percentage_24h_in_currency || 0).sort((a,b)=>a-b);
const median50 = top50pct.length ? (top50pct[Math.floor(top50pct.length/2 - 1)] + top50pct[Math.floor(top50pct.length/2)]) / 2 : 0;

const btc = data.find(c => c.id === 'bitcoin');
const eth = data.find(c => c.id === 'ethereum');
const sol = data.find(c => c.id === 'solana');

function fmtPrice(p) {
  if (p == null) return 'n/a';
  if (p < 0.01) return '$' + p.toFixed(6);
  if (p < 1) return '$' + p.toFixed(4);
  if (p < 100) return '$' + p.toFixed(2);
  return '$' + Math.round(p).toLocaleString();
}
function fmtVol(v) {
  if (v == null) return 'n/a';
  if (v >= 1e9) return '$' + (v/1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + Math.round(v/1e6) + 'M';
  if (v >= 1e3) return '$' + Math.round(v/1e3) + 'K';
  return '$' + v.toFixed(0);
}

console.log(`PULSE: BTC ${fmtPrice(btc.current_price)} (${btc.price_change_percentage_24h_in_currency.toFixed(1)}%), ETH ${fmtPrice(eth.current_price)} (${eth.price_change_percentage_24h_in_currency.toFixed(1)}%), SOL ${fmtPrice(sol.current_price)} (${sol.price_change_percentage_24h_in_currency.toFixed(1)}%); ${green}/100 top-100 green, median top-50 24h ${median50.toFixed(2)}%`);
console.log();
console.log('WINNERS:');
winners.forEach((c, i) => {
  const p1 = c.price_change_percentage_1h_in_currency || 0;
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const p7 = c.price_change_percentage_7d_in_currency || 0;
  const rank = c.market_cap_rank;
  const mcap = c.market_cap || 0;
  const tags = [];
  if (p24 > 15 && p7 > 25) tags.push('BREAKOUT');
  if (p24 > 20 && p7 < 0) tags.push('FADE');
  if (rank && rank > 150 && p24 > 30) tags.push('PUMP-RISK');
  if (mcap && mcap < 50_000_000) tags.push('MICROCAP');
  if (rank && rank <= 20) tags.push('MAJOR');
  const tagstr = tags.length ? ` [${tags.slice(0,2).join('+')}]` : '';
  const sign24 = p24 >= 0 ? '+' : '';
  const sign7 = p7 >= 0 ? '+' : '';
  const sign1 = p1 >= 0 ? '+' : '';
  console.log(`${i+1}. ${c.symbol.toUpperCase()} (${c.name}) - ${fmtPrice(c.current_price)}  ${sign24}${p24.toFixed(1)}% / 7d ${sign7}${p7.toFixed(1)}% / 1h ${sign1}${p1.toFixed(1)}%  *  ${fmtVol(c.total_volume)} / #${rank||'n/a'}${tagstr}`);
});
console.log();
console.log('LOSERS:');
losers.forEach((c, i) => {
  const p1 = c.price_change_percentage_1h_in_currency || 0;
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const p7 = c.price_change_percentage_7d_in_currency || 0;
  const rank = c.market_cap_rank;
  const mcap = c.market_cap || 0;
  const vol = c.total_volume || 0;
  const tags = [];
  if (p24 < -10 && mcap && (vol/mcap) > 0.25) tags.push('CAPITULATION');
  if (mcap && mcap < 50_000_000) tags.push('MICROCAP');
  if (rank && rank <= 20) tags.push('MAJOR');
  const tagstr = tags.length ? ` [${tags.slice(0,2).join('+')}]` : '';
  const sign24 = p24 >= 0 ? '+' : '';
  const sign7 = p7 >= 0 ? '+' : '';
  const sign1 = p1 >= 0 ? '+' : '';
  console.log(`${i+1}. ${c.symbol.toUpperCase()} (${c.name}) - ${fmtPrice(c.current_price)}  ${sign24}${p24.toFixed(1)}% / 7d ${sign7}${p7.toFixed(1)}% / 1h ${sign1}${p1.toFixed(1)}%  *  ${fmtVol(vol)} / #${rank||'n/a'}${tagstr}`);
});
console.log();
console.log('TRENDING:');
const winnerSyms = new Set(winners.map(w => w.symbol.toUpperCase()));
const loserSyms = new Set(losers.map(l => l.symbol.toUpperCase()));
(trending.coins || []).slice(0, 7).forEach((t, i) => {
  const item = t.item || {};
  const sym = (item.symbol || '').toUpperCase();
  const name = item.name || '';
  const rank = item.market_cap_rank || 'n/a';
  const p = item.data?.price || 0;
  const p24 = item.data?.price_change_percentage_24h?.usd || 0;
  const tags = [];
  if (winnerSyms.has(sym)) tags.push('TRENDING+UP');
  if (loserSyms.has(sym)) tags.push('TRENDING+DOWN');
  const tagstr = tags.length ? ` [${tags.slice(0,2).join('+')}]` : '';
  const sign = p24 >= 0 ? '+' : '';
  console.log(`${i+1}. ${name} (${sym}) - #${rank}, ${fmtPrice(p)}, 24h ${sign}${p24.toFixed(1)}%${tagstr}`);
});
