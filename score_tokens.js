const m = require('./markets.json');
const t = require('./trending.json');
const d = require('./dex.json');
const trendingSyms = new Set((t.coins||[]).map(c=>(c.item.symbol||'').toLowerCase()));
const dexSyms = new Set((d.pairs||[]).map(p=>(p.baseToken?.symbol||'').toLowerCase()));
const btc = m.find(c=>c.symbol==='btc');
const eth = m.find(c=>c.symbol==='eth');
const btc7 = btc.price_change_percentage_7d_in_currency;
const eth7 = eth.price_change_percentage_7d_in_currency;

const scored = [];
for (const c of m) {
  const sym = (c.symbol||'').toLowerCase();
  const name = c.name||'';
  const mcap = c.market_cap || 0;
  const vol = c.total_volume || 0;
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const p7 = c.price_change_percentage_7d_in_currency || 0;
  if (mcap < 20_000_000) continue;
  if (sym === 'ape') continue; // dedup
  let score = 0;
  const bd = [];
  if (p24 > 0) { score += 1; bd.push('24h+1'); }
  if (p7 > 0) { score += 1; bd.push('7d+1'); }
  if (p24 > 5 && p7 > 5) { score += 2; bd.push('both>5%+2'); }
  if (trendingSyms.has(sym)) { score += 2; bd.push('trending+2'); }
  const vm = mcap ? vol/mcap : 0;
  if (vm >= 0.20) { score += 3; bd.push(`vm${vm.toFixed(2)}+3`); }
  else if (vm >= 0.10) { score += 2; bd.push(`vm${vm.toFixed(2)}+2`); }
  if (p7 > btc7 && p7 > eth7) { score += 2; bd.push('RS+2'); }
  if (dexSyms.has(sym)) { score += 1; bd.push('dex+1'); }
  scored.push({ score, sym, name, price: c.current_price, p24, p7, mcap, vol, vm, bd });
}
scored.sort((a,b) => (b.score - a.score) || (b.vm - a.vm));
console.log('TOP 20:');
for (const s of scored.slice(0,20)) {
  console.log(`  ${s.sym.toUpperCase().padEnd(10)} ${(s.name||'').slice(0,22).padEnd(22)} score=${s.score} px=${s.price} 24h=${s.p24.toFixed(1)}% 7d=${s.p7.toFixed(1)}% mc=$${(s.mcap/1e6).toFixed(0)}M vol=$${(s.vol/1e6).toFixed(0)}M vm=${s.vm.toFixed(2)} | ${s.bd.join(',')}`);
}
