const fs = require('fs');
const markets = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/markets.json'));
const trending = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/trending.json'));
const trendingIds = new Set(trending.coins.map(c => c.item.id));
const trendingSyms = new Set(trending.coins.map(c => c.item.symbol.toUpperCase()));

// dedup gate (last 7d)
const dedupTokens = new Set(['APE','PENGU','XCN','RAY','DOGE','LUNC','PENDLE','APECOIN','ONYXCOIN','RAYDIUM','TERRALUNACLASSIC','PUDGYPENGUINS']);

const btc = markets.find(m => m.id === 'bitcoin');
const eth = markets.find(m => m.id === 'ethereum');
const btc7d = btc.price_change_percentage_7d_in_currency;
const eth7d = eth.price_change_percentage_7d_in_currency;
const btc24h = btc.price_change_percentage_24h_in_currency;
const eth24h = eth.price_change_percentage_24h_in_currency;
console.log(`BTC 24h ${btc24h?.toFixed(2)}% / 7d ${btc7d?.toFixed(2)}%`);
console.log(`ETH 24h ${eth24h?.toFixed(2)}% / 7d ${eth7d?.toFixed(2)}%`);

const scored = [];
for (const m of markets) {
  if (!m.market_cap || m.market_cap < 20_000_000) continue;
  const sym = (m.symbol || '').toUpperCase();
  if (dedupTokens.has(sym)) continue;
  if (dedupTokens.has((m.id || '').toUpperCase().replace(/-/g,''))) continue;
  const c24 = m.price_change_percentage_24h_in_currency ?? 0;
  const c7 = m.price_change_percentage_7d_in_currency ?? 0;
  const vol = m.total_volume || 0;
  const mcap = m.market_cap;
  const vmc = vol / mcap;

  let score = 0;
  const reasons = [];
  if (c24 > 0) { score += 1; reasons.push('24h+1'); }
  if (c7 > 0) { score += 1; reasons.push('7d+1'); }
  if (c24 > 5 && c7 > 5) { score += 2; reasons.push('both>5%+2'); }
  if (trendingIds.has(m.id) || trendingSyms.has(sym)) { score += 2; reasons.push('cgtrend+2'); }
  if (vmc >= 0.20) { score += 3; reasons.push('v/mc>=0.20+3'); }
  else if (vmc >= 0.10) { score += 2; reasons.push('v/mc>=0.10+2'); }
  if (c7 > btc7d && c7 > eth7d) { score += 2; reasons.push('RS>BTC&ETH+2'); }

  scored.push({
    sym, id: m.id, name: m.name, price: m.current_price,
    c24: c24.toFixed(2), c7: c7.toFixed(2),
    mcap: (mcap/1e6).toFixed(0)+'M', vol: (vol/1e6).toFixed(1)+'M',
    vmc: vmc.toFixed(3),
    score, reasons: reasons.join(', ')
  });
}

scored.sort((a,b) => b.score - a.score || parseFloat(b.vmc) - parseFloat(a.vmc));
console.log('\nTop 20:');
for (const s of scored.slice(0, 20)) {
  console.log(`${s.sym.padEnd(8)} ${s.name.slice(0,20).padEnd(20)} $${s.price.toFixed(s.price < 0.01 ? 6 : 4)} 24h ${s.c24}% 7d ${s.c7}% mcap ${s.mcap} vol ${s.vol} v/mc ${s.vmc} | ${s.score}/10 [${s.reasons}]`);
}
