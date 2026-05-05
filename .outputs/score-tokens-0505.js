const fs = require('fs');

const dedup = ['APE','PENGU','XCN','RAY','DOGE','LUNC','PENDLE','UB','AKT','DASH'];

const markets = JSON.parse(fs.readFileSync('.outputs/cg-markets-0505.json','utf8'));
const trending = JSON.parse(fs.readFileSync('.outputs/cg-trending-0505.json','utf8'));
const dex = JSON.parse(fs.readFileSync('.outputs/dex-trending-0505.json','utf8'));

const trendingSyms = new Set((trending.coins||[]).map(c => (c.item.symbol||'').toUpperCase()));

// Cross-source DEX confirms — symbols showing up at top of dex search
const dexSyms = new Set();
for (const p of (dex.pairs||[]).slice(0,40)) {
  if (p.baseToken && p.baseToken.symbol) dexSyms.add(p.baseToken.symbol.toUpperCase());
}

const btc = markets.find(m => m.id === 'bitcoin');
const eth = markets.find(m => m.id === 'ethereum');
const btc7 = btc.price_change_percentage_7d_in_currency;
const eth7 = eth.price_change_percentage_7d_in_currency;
console.log('BTC 7d:', btc7?.toFixed(2), 'ETH 7d:', eth7?.toFixed(2));

// Filter: skip stables, wrapped, mcap < $20M
const skipPatterns = /stable|tether|usd-coin|dai|usdc|usdt|fdusd|tusd|usdd|frax|paxg|bridged|wrapped|staked|liquid-staked|^w?eth$|^wbtc$|wsteth|reth|cbeth/i;
const skipSyms = new Set(['USDT','USDC','DAI','FDUSD','TUSD','USDD','FRAX','BUSD','PYUSD','USDE','USDS','RLUSD','PAXG','XAUT','WBTC','WETH','STETH','WSTETH','CBETH','RETH','SUSDE','USD0','USD1','MUSD','EURC']);

const scored = [];
for (const m of markets) {
  const sym = (m.symbol||'').toUpperCase();
  if (skipSyms.has(sym)) continue;
  if (skipPatterns.test(m.id||'') || skipPatterns.test(m.name||'')) continue;
  if (!m.market_cap || m.market_cap < 20_000_000) continue;
  if (dedup.includes(sym)) continue;

  const ch24 = m.price_change_percentage_24h ?? 0;
  const ch7 = m.price_change_percentage_7d_in_currency ?? 0;
  const vol = m.total_volume || 0;
  const vmc = vol / m.market_cap;

  let score = 0;
  const breakdown = [];
  if (ch24 > 0) { score += 1; breakdown.push('24h+1'); }
  if (ch7 > 0) { score += 1; breakdown.push('7d+1'); }
  if (ch24 > 5 && ch7 > 5) { score += 2; breakdown.push('both>5%+2'); }
  if (trendingSyms.has(sym)) { score += 2; breakdown.push('cgtrend+2'); }
  if (vmc >= 0.20) { score += 3; breakdown.push('v/mc>=0.20+3'); }
  else if (vmc >= 0.10) { score += 2; breakdown.push('v/mc>=0.10+2'); }
  if (ch7 > btc7 && ch7 > eth7) { score += 2; breakdown.push('RS>BTC/ETH+2'); }
  if (dexSyms.has(sym)) { score += 1; breakdown.push('dex+1'); }

  scored.push({sym, name:m.name, price:m.current_price, ch24, ch7, mcap:m.market_cap, vol, vmc, score, breakdown:breakdown.join(', ')});
}

scored.sort((a,b) => b.score - a.score || b.vmc - a.vmc);
console.log('\nTop 20 by score:');
for (const t of scored.slice(0,20)) {
  console.log(`${t.sym.padEnd(10)} score=${t.score} 24h=${t.ch24.toFixed(1)}% 7d=${t.ch7.toFixed(1)}% mcap=$${(t.mcap/1e6).toFixed(0)}M vol=$${(t.vol/1e6).toFixed(0)}M v/mc=${t.vmc.toFixed(2)} [${t.breakdown}]`);
}

fs.writeFileSync('.outputs/scored-tokens-0505.json', JSON.stringify(scored.slice(0,30), null, 2));
console.log('\nDedup excluded:', dedup.join(', '));
