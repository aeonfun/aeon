const data = require('./cg_markets.json');
const btc = data.find(d => d.symbol === 'btc');
const eth = data.find(d => d.symbol === 'eth');
console.log(`BTC: $${btc.current_price} 24h=${btc.price_change_percentage_24h_in_currency.toFixed(2)}% 7d=${btc.price_change_percentage_7d_in_currency.toFixed(2)}%`);
console.log(`ETH: $${eth.current_price} 24h=${eth.price_change_percentage_24h_in_currency.toFixed(2)}% 7d=${eth.price_change_percentage_7d_in_currency.toFixed(2)}%`);
console.log();

const fmt = (d) => {
  const p24 = d.price_change_percentage_24h_in_currency || 0;
  const p7 = d.price_change_percentage_7d_in_currency || 0;
  const mc = (d.market_cap || 0) / 1e6;
  const vol = (d.total_volume || 0) / 1e6;
  const vmc = mc > 0 ? vol / mc : 0;
  const sym = d.symbol.toUpperCase();
  return `${sym.padStart(10)} 24h=${p24.toFixed(1).padStart(6)}% 7d=${p7.toFixed(1).padStart(6)}% mc=$${mc.toFixed(0)}M vol=$${vol.toFixed(0)}M v/mc=${vmc.toFixed(2)} rank=${d.market_cap_rank}`;
};

const eligible = data.filter(d => (d.market_cap || 0) >= 20e6);

console.log('TOP 24h gainers (mcap >= $20M):');
eligible.slice().sort((a,b) => (b.price_change_percentage_24h_in_currency||0) - (a.price_change_percentage_24h_in_currency||0)).slice(0, 30).forEach(d => console.log(fmt(d)));

console.log('\nTOP by 7d (both 24h and 7d positive):');
eligible.filter(d => (d.price_change_percentage_24h_in_currency||0) > 0 && (d.price_change_percentage_7d_in_currency||0) > 0)
  .sort((a,b) => (b.price_change_percentage_7d_in_currency||0) - (a.price_change_percentage_7d_in_currency||0)).slice(0, 25).forEach(d => console.log(fmt(d)));

console.log('\nHIGH vol/mcap (>= 0.10):');
eligible.filter(d => (d.total_volume||0) / (d.market_cap||1) >= 0.10)
  .sort((a,b) => ((b.total_volume||0)/(b.market_cap||1)) - ((a.total_volume||0)/(a.market_cap||1))).slice(0, 25).forEach(d => console.log(fmt(d)));

console.log('\nBoth 24h and 7d > +5% AND mcap >= $20M:');
eligible.filter(d => (d.price_change_percentage_24h_in_currency||0) > 5 && (d.price_change_percentage_7d_in_currency||0) > 5)
  .sort((a,b) => (b.price_change_percentage_7d_in_currency||0) - (a.price_change_percentage_7d_in_currency||0)).slice(0, 25).forEach(d => console.log(fmt(d)));
