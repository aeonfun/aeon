const fs = require('fs');

const markets = JSON.parse(fs.readFileSync('.outputs/_tc-markets-today.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('.outputs/_tc-trending-today.json', 'utf8'));
const dex = JSON.parse(fs.readFileSync('.outputs/_tc-dex-today.json', 'utf8'));

const dedup7d = new Set([
  // Last 7 calendar days 2026-05-24 → 2026-05-30
  'EIGEN','RAIL','AKT','ASTER','RENDER','SEI','ICP','XLM','INJ','FET',
  // Plus current open positions worth excluding from dupes
]);

const btc = markets.find(x => x.symbol.toLowerCase() === 'btc');
const eth = markets.find(x => x.symbol.toLowerCase() === 'eth');
const BTC7 = btc?.price_change_percentage_7d_in_currency ?? 0;
const ETH7 = eth?.price_change_percentage_7d_in_currency ?? 0;
const BTC24 = btc?.price_change_percentage_24h ?? 0;
const ETH24 = eth?.price_change_percentage_24h ?? 0;

const trendingSyms = new Set(
  (trending.coins || []).map(c => (c.item?.symbol || '').toUpperCase())
);

// DEX trending: pull symbols from baseToken
const dexSyms = new Set();
if (Array.isArray(dex.pairs)) {
  for (const p of dex.pairs) {
    if (p?.baseToken?.symbol) dexSyms.add(p.baseToken.symbol.toUpperCase());
  }
}

// Stablecoin/wrapped-style filter
const STABLE = /^(USDT|USDC|DAI|BUSD|TUSD|USDS|USDE|FRAX|FDUSD|PYUSD|GUSD|USDD|USDP|USDL|LUSD|EURC|EURT|EURS|XAU|PAXG|XAUT|USDB|USDX|USDF|USR|USDM|RLUSD|USDN|USTC|USD1|USDY|USDG|DEUSD|RUSD|USD\\+|CRVUSD|GHO|MIM|CUSD|JPYC|BRZ|UST)$/i;
const WRAP = /^(WBTC|WETH|WSTETH|STETH|WBETH|RETH|CBETH|EZETH|WEETH|METH|RSETH|MSETH|LBTC|TBTC|SWBTC|CBBTC|SOLVBTC|JITOSOL|JUPSOL|BNSOL|BSOL|MSOL|HBETH|RENBTC|WRBTC)$/i;

const scored = [];
for (const m of markets) {
  const sym = (m.symbol || '').toUpperCase();
  if (!sym) continue;
  if (STABLE.test(sym)) continue;
  if (WRAP.test(sym)) continue;
  const mcap = m.market_cap || 0;
  if (mcap < 20e6) continue;
  const c24 = m.price_change_percentage_24h ?? null;
  const c7 = m.price_change_percentage_7d_in_currency ?? null;
  const vol = m.total_volume || 0;
  const vm = mcap ? vol / mcap : 0;
  let pts = 0;
  const reasons = [];
  if (c24 != null && c24 > 0) { pts += 1; reasons.push('24h>0'); }
  if (c7 != null && c7 > 0) { pts += 1; reasons.push('7d>0'); }
  if (c24 != null && c7 != null && c24 > 5 && c7 > 5) { pts += 2; reasons.push('both>+5%'); }
  if (trendingSyms.has(sym)) { pts += 2; reasons.push('on-trending'); }
  if (vm >= 0.20) { pts += 3; reasons.push(`vmc${vm.toFixed(2)}>=0.20`); }
  else if (vm >= 0.10) { pts += 2; reasons.push(`vmc${vm.toFixed(2)}>=0.10`); }
  if (c7 != null && c7 > BTC7 && c7 > ETH7) { pts += 2; reasons.push('RS>BTC&ETH-7d'); }
  if (dexSyms.has(sym)) { pts += 1; reasons.push('dex-confirm'); }
  scored.push({
    sym, name: m.name, price: m.current_price, c24, c7, mcap, vol, vm, pts, reasons,
    rank: m.market_cap_rank, dedup_blocked: dedup7d.has(sym)
  });
}
scored.sort((a, b) => b.pts - a.pts || b.vm - a.vm);

console.log('BTC 24h/7d:', BTC24.toFixed(2), '/', BTC7.toFixed(2));
console.log('ETH 24h/7d:', ETH24.toFixed(2), '/', ETH7.toFixed(2));
console.log('Trending count:', trendingSyms.size, 'DEX count:', dexSyms.size);
console.log('\nTop 20 candidates (incl. dedup-blocked):');
for (const s of scored.slice(0, 20)) {
  console.log(
    `${s.dedup_blocked ? 'X' : ' '} ${String(s.pts).padStart(2)}  ${s.sym.padEnd(10)} #${String(s.rank).padStart(3)}  $${s.price}  24h ${(s.c24 ?? 0).toFixed(1)}%  7d ${(s.c7 ?? 0).toFixed(1)}%  vmc ${s.vm.toFixed(3)}  mcap $${(s.mcap/1e6).toFixed(0)}M  vol $${(s.vol/1e6).toFixed(0)}M  | ${s.reasons.join(' ')}`
  );
}
console.log('\nTop 10 NOT dedup-blocked:');
for (const s of scored.filter(x => !x.dedup_blocked).slice(0, 10)) {
  console.log(
    `  ${String(s.pts).padStart(2)}  ${s.sym.padEnd(10)} #${String(s.rank).padStart(3)}  $${s.price}  24h ${(s.c24 ?? 0).toFixed(1)}%  7d ${(s.c7 ?? 0).toFixed(1)}%  vmc ${s.vm.toFixed(3)}  mcap $${(s.mcap/1e6).toFixed(0)}M  vol $${(s.vol/1e6).toFixed(0)}M  | ${s.reasons.join(' ')}`
  );
}
console.log('\nTrending tickers:', [...trendingSyms].join(', '));
