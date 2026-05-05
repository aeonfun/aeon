const fs = require('fs');
const coins = JSON.parse(fs.readFileSync('.outputs/cg-markets-0505.json'));
const tr = JSON.parse(fs.readFileSync('.outputs/cg-trending-0505.json'));

const stables = new Set(['tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg','frax','lusd','usds','susds','susde','ondo-us-dollar-yield','wrapped-bitcoin','staked-ether','wrapped-steth','tbtc','wrapped-eeth','rocket-pool-eth','renbtc','weth','lido-staked-ether']);

const isStable = (c) => {
  if (stables.has(c.id)) return true;
  const s = (c.symbol || '').toUpperCase();
  const n = (c.name || '').toLowerCase();
  if (s.startsWith('USD') || s.startsWith('EUR') || s.startsWith('GBP')) return true;
  if (n.includes('stablecoin')) return true;
  if (['PAXG','XAUT','WBTC','WETH','STETH','WSTETH'].includes(s)) return true;
  return false;
};

const filtered = coins.filter(c => !isStable(c) && (c.total_volume || 0) >= 1_000_000);

const fmtNum = (x) => {
  if (x == null) return 'n/a';
  if (x >= 1e9) return `$${(x/1e9).toFixed(1)}B`;
  if (x >= 1e6) return `$${Math.round(x/1e6)}M`;
  if (x >= 1e3) return `$${Math.round(x/1e3)}K`;
  return `$${x.toFixed(0)}`;
};

const fmtPrice = (p) => {
  if (p == null) return 'n/a';
  if (p >= 1000) return `$${p.toLocaleString('en-US',{maximumFractionDigits:0})}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
};

const tagsFn = (c) => {
  const out = [];
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const p7d = c.price_change_percentage_7d_in_currency || 0;
  const rank = c.market_cap_rank || 999;
  const mc = c.market_cap || 0;
  const vol = c.total_volume || 0;
  if (p24 > 15 && p7d > 25) out.push('BREAKOUT');
  if (p24 > 20 && p7d < 0) out.push('FADE');
  if (p24 < -10 && mc && vol/mc > 0.25) out.push('CAPITULATION');
  if (rank > 150 && p24 > 30) out.push('PUMP-RISK');
  if (mc < 50_000_000) out.push('MICROCAP');
  if (rank <= 20) out.push('MAJOR');
  return out.slice(0, 2);
};

const top100 = filtered.slice(0, 100);
const green = top100.filter(c => (c.price_change_percentage_24h_in_currency || 0) > 0).length;
const top50 = filtered.slice(0, 50);
const top50Changes = top50.map(c => c.price_change_percentage_24h_in_currency || 0).sort((a,b)=>a-b);
const median = top50Changes[Math.floor(top50Changes.length/2)] || 0;

const find = id => filtered.find(c => c.id === id);
const btc = find('bitcoin'), eth = find('ethereum'), sol = find('solana');

console.log(`PULSE: ${green}/100 top coins green, top-50 median 24h ${median.toFixed(2)}%`);
if (btc) console.log(`BTC: $${btc.current_price.toLocaleString('en-US',{maximumFractionDigits:0})} (${btc.price_change_percentage_24h_in_currency.toFixed(2)}%)`);
if (eth) console.log(`ETH: $${eth.current_price.toLocaleString('en-US',{maximumFractionDigits:0})} (${eth.price_change_percentage_24h_in_currency.toFixed(2)}%)`);
if (sol) console.log(`SOL: $${sol.current_price.toFixed(2)} (${sol.price_change_percentage_24h_in_currency.toFixed(2)}%)`);

const winners = [...filtered].sort((a,b) => (b.price_change_percentage_24h_in_currency||0) - (a.price_change_percentage_24h_in_currency||0)).slice(0,10);
const losers = [...filtered].sort((a,b) => (a.price_change_percentage_24h_in_currency||0) - (b.price_change_percentage_24h_in_currency||0)).slice(0,10);

console.log('\nWINNERS:');
for (const c of winners) {
  const s = c.symbol.toUpperCase(), n = c.name;
  const p = fmtPrice(c.current_price);
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const p7d = c.price_change_percentage_7d_in_currency || 0;
  const p1h = c.price_change_percentage_1h_in_currency || 0;
  const rank = c.market_cap_rank || '?';
  const mc = fmtNum(c.market_cap);
  const vol = fmtNum(c.total_volume);
  const t = tagsFn(c).map(x => `[${x}]`).join('');
  console.log(`  ${s} (${n}) — ${p}  +${p24.toFixed(1)}% / 7d ${p7d>=0?'+':''}${p7d.toFixed(1)}% / 1h ${p1h>=0?'+':''}${p1h.toFixed(1)}%  •  vol ${vol} mc ${mc} #${rank}  ${t}`);
}

console.log('\nLOSERS:');
for (const c of losers) {
  const s = c.symbol.toUpperCase(), n = c.name;
  const p = fmtPrice(c.current_price);
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const p7d = c.price_change_percentage_7d_in_currency || 0;
  const p1h = c.price_change_percentage_1h_in_currency || 0;
  const rank = c.market_cap_rank || '?';
  const mc = fmtNum(c.market_cap);
  const vol = fmtNum(c.total_volume);
  const t = tagsFn(c).map(x => `[${x}]`).join('');
  console.log(`  ${s} (${n}) — ${p}  ${p24.toFixed(1)}% / 7d ${p7d>=0?'+':''}${p7d.toFixed(1)}% / 1h ${p1h>=0?'+':''}${p1h.toFixed(1)}%  •  vol ${vol} mc ${mc} #${rank}  ${t}`);
}

console.log('\nTRENDING:');
for (const item of (tr.coins || []).slice(0, 7)) {
  const c = item.item || {};
  const n = c.name, s = (c.symbol || '').toUpperCase(), rank = c.market_cap_rank || '?';
  const data = c.data || {};
  const price = data.price;
  const p24obj = data.price_change_percentage_24h;
  const p24 = p24obj && typeof p24obj === 'object' ? p24obj.usd : null;
  console.log(`  ${n} (${s}) — #${rank}, price=${price}, 24h=${p24 != null ? p24.toFixed(1)+'%' : 'n/a'}`);
}
