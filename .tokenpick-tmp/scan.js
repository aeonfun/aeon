const trending = require('/tmp/trending.json');
const markets = require('/tmp/markets.json');
let dex = {};
try { dex = require('/tmp/dex.json'); } catch(e) {}

const trendingSymbols = new Set(trending.coins.map(c => c.item.symbol.toUpperCase()));
const trendingNames = trending.coins.map(c => `${c.item.symbol.toUpperCase()}(r${c.item.market_cap_rank})`);

let btc24=0, btc7=0, eth24=0, eth7=0;
for (const m of markets) {
  if (m.symbol === 'btc') { btc24 = m.price_change_percentage_24h_in_currency || 0; btc7 = m.price_change_percentage_7d_in_currency || 0; }
  if (m.symbol === 'eth') { eth24 = m.price_change_percentage_24h_in_currency || 0; eth7 = m.price_change_percentage_7d_in_currency || 0; }
}
console.log('TRENDING:', trendingNames.join(', '));
console.log(`BENCH: BTC 24h=${btc24.toFixed(2)}% 7d=${btc7.toFixed(2)}% | ETH 24h=${eth24.toFixed(2)}% 7d=${eth7.toFixed(2)}%`);

const dexSyms = new Set();
if (dex.pairs) {
  for (const p of dex.pairs.slice(0, 60)) {
    const b = (p.baseToken && p.baseToken.symbol) ? p.baseToken.symbol.toUpperCase() : '';
    if (b) dexSyms.add(b);
  }
}

const stables = new Set(['BTC','ETH','USDT','USDC','DAI','BUSD','TUSD','USDE','FDUSD','PYUSD','USDP','USDS','WBTC','WETH','STETH','WSTETH','WEETH','WBETH','SUSDE','USDD','USDX','RLUSD','LBTC','TBTC','EZETH','RSETH','METH','RETH','CBBTC','CBETH','SOLVBTC','BNSOL']);

const scored = [];
for (const m of markets) {
  const sym = m.symbol.toUpperCase();
  if (stables.has(sym)) continue;
  const mcap = m.market_cap || 0;
  if (mcap < 20_000_000) continue;
  const vol = m.total_volume || 0;
  const p24 = m.price_change_percentage_24h_in_currency || 0;
  const p7 = m.price_change_percentage_7d_in_currency || 0;
  let score = 0;
  const bd = [];
  if (p24 > 0) { score += 1; bd.push('24h+'); }
  if (p7 > 0) { score += 1; bd.push('7d+'); }
  if (p24 > 5 && p7 > 5) { score += 2; bd.push('both>5%'); }
  if (trendingSymbols.has(sym)) { score += 2; bd.push('trending'); }
  const vmc = mcap > 0 ? vol/mcap : 0;
  if (vmc >= 0.20) { score += 3; bd.push(`vmc${vmc.toFixed(2)}+3`); }
  else if (vmc >= 0.10) { score += 2; bd.push(`vmc${vmc.toFixed(2)}+2`); }
  if (p7 > btc7 && p7 > eth7) { score += 2; bd.push('RS+2'); }
  if (dexSyms.has(sym)) { score += 1; bd.push('dex+1'); }
  scored.push({ sym, name: m.name, price: m.current_price, mcap, vol, p24, p7, vmc, score, bd });
}

scored.sort((a,b) => b.score - a.score);
console.log('\n===TOP 25 BY SCORE===');
for (const t of scored.slice(0, 25)) {
  console.log(`  ${t.sym.padEnd(10)} ${(''+t.name).padEnd(25)} sc=${t.score} 24h=${t.p24.toFixed(1)}% 7d=${t.p7.toFixed(1)}% vmc=${t.vmc.toFixed(2)} mcap=$${(t.mcap/1e9).toFixed(2)}B vol=$${(t.vol/1e6).toFixed(0)}M [${t.bd.join(',')}]`);
}
console.log('\n===TRENDING COINS (CG) WITH MARKET DATA===');
for (const t of scored) {
  if (trendingSymbols.has(t.sym)) {
    console.log(`  ${t.sym.padEnd(10)} sc=${t.score} 24h=${t.p24.toFixed(1)}% 7d=${t.p7.toFixed(1)}% vmc=${t.vmc.toFixed(2)} mcap=$${(t.mcap/1e6).toFixed(0)}M [${t.bd.join(',')}]`);
  }
}
console.log('\nDEX_TRENDING:', [...dexSyms].slice(0,30).join(','));
