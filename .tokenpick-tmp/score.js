const fs = require('fs');
const markets = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/trending.json', 'utf8'));
const dex = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/dex.json', 'utf8'));

const trendingIds = new Set((trending.coins || []).map(c => c.item.id));
const trendingSyms = new Set((trending.coins || []).map(c => c.item.symbol.toUpperCase()));

const dexSyms = new Set();
(dex.pairs || []).slice(0, 60).forEach(p => {
  const b = (p.baseToken && p.baseToken.symbol || '').toUpperCase();
  if (b) dexSyms.add(b);
});

let btc7d = null, eth7d = null;
markets.forEach(m => {
  if (m.symbol.toLowerCase() === 'btc') btc7d = m.price_change_percentage_7d_in_currency;
  if (m.symbol.toLowerCase() === 'eth') eth7d = m.price_change_percentage_7d_in_currency;
});

const DEDUP = new Set(['PENGU', 'APE']);

const scored = [];
for (const m of markets) {
  const sym = m.symbol.toUpperCase();
  if (DEDUP.has(sym)) continue;
  const mcap = m.market_cap || 0;
  if (mcap < 20_000_000) continue;
  const vol = m.total_volume || 0;
  const p24 = m.price_change_percentage_24h_in_currency;
  const p7 = m.price_change_percentage_7d_in_currency;
  if (p24 === null || p7 === null || p24 === undefined || p7 === undefined) continue;
  let s = 0; const br = [];
  if (p24 > 0) { s += 1; br.push('24h>0:+1'); }
  if (p7 > 0) { s += 1; br.push('7d>0:+1'); }
  if (p24 > 5 && p7 > 5) { s += 2; br.push('both>5%:+2'); }
  if (trendingIds.has(m.id) || trendingSyms.has(sym)) { s += 2; br.push('cg-trending:+2'); }
  const vmc = mcap > 0 ? vol / mcap : 0;
  if (vmc >= 0.20) { s += 3; br.push('vol/mcap>=0.20:+3'); }
  else if (vmc >= 0.10) { s += 2; br.push('vol/mcap>=0.10:+2'); }
  if (btc7d !== null && eth7d !== null && p7 > btc7d && p7 > eth7d) { s += 2; br.push('RS>BTC&ETH:+2'); }
  if (dexSyms.has(sym)) { s += 1; br.push('dex-confirm:+1'); }
  scored.push({ sym, name: m.name, id: m.id, price: m.current_price, mcap, vol, vmc, p24, p7, score: s, br });
}

scored.sort((a, b) => b.score - a.score);
console.log(`BTC 7d: ${btc7d?.toFixed(2)}% | ETH 7d: ${eth7d?.toFixed(2)}%`);
console.log(`Trending CG IDs: ${trendingIds.size} | DexScreener bases: ${dexSyms.size}`);
console.log();
console.log('rank sym       score 24h     7d      vmc   mcap       breakdown');
scored.slice(0, 25).forEach((t, i) => {
  console.log(`${String(i+1).padStart(4)} ${t.sym.padEnd(9)} ${String(t.score).padStart(2)}   ${t.p24.toFixed(2).padStart(7)}% ${t.p7.toFixed(2).padStart(7)}% ${t.vmc.toFixed(2).padStart(4)} $${(t.mcap/1e9).toFixed(2).padStart(7)}B ${t.br.join(',')}`);
});
