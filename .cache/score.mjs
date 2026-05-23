import fs from 'fs';

const markets = JSON.parse(fs.readFileSync('.cache/cg-markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('.cache/cg-trending.json', 'utf8'));
const dex = JSON.parse(fs.readFileSync('.cache/dex-trending.json', 'utf8'));

const BTC_7D = -4.596;
const ETH_7D = -7.413;

const DEDUP = new Set(['KAIA','TRAC','BSB','INJ','NEAR','HYPE','CHZ','LIT','VVV','DASH','ZEC','PENGU','GRASS','ONDO','WLD','BEAT']);

const SKIP_PREFIX = ['USD','EUR','GBP','JPY','BRZ'];
const SKIP_EXACT = new Set([
  'USDT','USDC','DAI','USDE','FDUSD','TUSD','PYUSD','BUSD','GUSD','LUSD','FRAX','SUSDS','USDS','USDL','USD1','RUSD','AUSD','USDT0','USDD','USTC','USDP','XAUT','PAXG','XAU','USD0','USDX','USDB','SUSDE','USYC','BUIDL','OUSG','USR','USDH','USDM','GHO','USDF','USDR','SUSD','EURC','EURS','EURT','USDA','SDAI',
  'WBTC','WETH','WBNB','WSOL','WMATIC','WAVAX','WTRX','WBETH','WEETH','WSTETH','STETH','METH','RETH','CBETH','LSETH','CBBTC','TBTC','LBTC','SOLVBTC','BSOL','JITOSOL','JUPSOL','MSOL','BNSOL','ETHX','OSETH','RSETH','STAFI','RSWETH','EZETH','PUFETH','RBNB','BBTC','WHBAR','SBTC','XSOLVBTC',
  'U'
]);

function isStableOrWrap(sym) {
  if (SKIP_EXACT.has(sym)) return true;
  for (const p of SKIP_PREFIX) if (sym.startsWith(p) && sym.length <= 5) return true;
  return false;
}

const trendingSet = new Set(trending.coins.map(c => c.item.symbol.toUpperCase()));

const dexSet = new Set();
if (dex.pairs) {
  for (const p of dex.pairs.slice(0, 40)) {
    if (p.baseToken && p.baseToken.symbol) dexSet.add(p.baseToken.symbol.toUpperCase());
  }
}

const scored = [];
for (const m of markets) {
  if (!m.symbol) continue;
  const sym = m.symbol.toUpperCase();
  if (isStableOrWrap(sym)) continue;
  const mcap = m.market_cap || 0;
  if (mcap < 20_000_000) continue;
  const vol = m.total_volume || 0;
  const vmc = mcap > 0 ? vol / mcap : 0;
  const p24 = m.price_change_percentage_24h_in_currency ?? m.price_change_percentage_24h ?? 0;
  const p7 = m.price_change_percentage_7d_in_currency ?? 0;

  let s = 0;
  const sigs = [];
  if (p24 > 0) { s += 1; sigs.push('24h+'); }
  if (p7 > 0) { s += 1; sigs.push('7d+'); }
  if (p24 > 5 && p7 > 5) { s += 2; sigs.push('both>+5'); }
  if (trendingSet.has(sym)) { s += 2; sigs.push('trending'); }
  if (vmc >= 0.20) { s += 3; sigs.push('vmc>=0.20(' + vmc.toFixed(2) + ')'); }
  else if (vmc >= 0.10) { s += 2; sigs.push('vmc>=0.10(' + vmc.toFixed(2) + ')'); }
  if (p7 > BTC_7D && p7 > ETH_7D) { s += 2; sigs.push('RS>BTC&ETH 7d'); }
  if (dexSet.has(sym)) { s += 1; sigs.push('dex-confirm'); }

  const dedup = DEDUP.has(sym);
  scored.push({ sym, name: m.name, price: m.current_price, mcap, vol, vmc, p24, p7, score: s, sigs, dedup });
}

scored.sort((a, b) => b.score - a.score || b.vmc - a.vmc);

console.log('=== TOP 30 (excluding dedup) ===');
let n = 0;
for (const r of scored) {
  if (r.dedup) continue;
  if (n++ >= 30) break;
  console.log([r.score, r.sym, r.name, '$' + r.price, '24h=' + r.p24.toFixed(2), '7d=' + r.p7.toFixed(2), 'mc=$' + (r.mcap/1e6).toFixed(0) + 'M', 'vol=$' + (r.vol/1e6).toFixed(0) + 'M', 'vmc=' + r.vmc.toFixed(3), r.sigs.join('|')].join('\t'));
}
console.log('\n=== TOP 15 OVERALL (incl dedup) ===');
for (const r of scored.slice(0, 15)) {
  console.log([r.score, r.sym + (r.dedup ? '[DD]' : ''), r.name, '$' + r.price, '24h=' + r.p24.toFixed(2), '7d=' + r.p7.toFixed(2), 'mc=$' + (r.mcap/1e6).toFixed(0) + 'M', 'vmc=' + r.vmc.toFixed(3)].join('\t'));
}
