#!/usr/bin/env node
const fs = require('fs');
const dir = '/home/runner/work/aeon/aeon/.cache-token-call';

const trending = JSON.parse(fs.readFileSync(`${dir}/cg-trending.json`));
const markets = JSON.parse(fs.readFileSync(`${dir}/cg-markets.json`));

const trendingSyms = new Set(trending.coins.map(c => c.item.symbol.toUpperCase()));

const STABLES = new Set([
  'USDT','USDC','DAI','USDS','USDE','USD1','PYUSD','USDG','USDY','USDF','BUIDL',
  'FIGR_HELOC','USYC','XAUT','PAXG','WBTC','STETH','WSTETH','WETH','WEETH','CBBTC',
  'TBTC','HBTC','RETH','LBTC','BTCB','BNSOL','MSOL','JITOSOL','JUPSOL','JLP','LEO','WBT'
]);
const DEDUP = new Set(['LIT','INJ','NEAR','HYPE','CHZ','TRAC','BSB','KAIA']);

const btc = markets.find(c => c.id === 'bitcoin');
const eth = markets.find(c => c.id === 'ethereum');
const btc7d = btc.price_change_percentage_7d_in_currency;
const eth7d = eth.price_change_percentage_7d_in_currency;
const btc24h = btc.price_change_percentage_24h;
const eth24h = eth.price_change_percentage_24h;

console.log(`BTC: $${btc.current_price.toFixed(0)} ${btc24h.toFixed(2)}%24h ${btc7d.toFixed(2)}%7d`);
console.log(`ETH: $${eth.current_price.toFixed(2)} ${eth24h.toFixed(2)}%24h ${eth7d.toFixed(2)}%7d`);
console.log('');

const cands = [];
for (const c of markets) {
  const sym = c.symbol.toUpperCase();
  if (!c.market_cap || c.market_cap < 20e6) continue;
  if (STABLES.has(sym)) continue;
  if (DEDUP.has(sym)) continue;
  if (c.price_change_percentage_24h == null || c.price_change_percentage_7d_in_currency == null) continue;

  const d24 = c.price_change_percentage_24h;
  const d7 = c.price_change_percentage_7d_in_currency;
  const ratio = c.total_volume > 0 ? c.total_volume / c.market_cap : 0;

  let score = 0;
  const why = [];
  if (d24 > 0) { score += 1; why.push('24h+'); }
  if (d7 > 0) { score += 1; why.push('7d+'); }
  if (d24 > 5 && d7 > 5) { score += 2; why.push('both>5%'); }
  if (ratio >= 0.20) { score += 3; why.push('v/m>=0.20'); }
  else if (ratio >= 0.10) { score += 2; why.push('v/m>=0.10'); }
  if (d7 > btc7d && d7 > eth7d) { score += 2; why.push('beats BTC+ETH 7d'); }
  if (trendingSyms.has(sym)) { score += 2; why.push('CG trending'); }

  cands.push({ sym, px: c.current_price, mc: c.market_cap, vol: c.total_volume, d24, d7, ratio, score, why, id: c.id });
}

cands.sort((a, b) => b.score - a.score || b.ratio - a.ratio || b.d7 - a.d7);

for (const c of cands.slice(0, 30)) {
  console.log(
    `${c.score.toString().padStart(2)} | ${c.sym.padEnd(10)} | $${c.px.toString().padEnd(10)} | ` +
    `24h ${c.d24.toFixed(2).padStart(6)}% | 7d ${c.d7.toFixed(2).padStart(6)}% | ` +
    `mc $${(c.mc/1e9).toFixed(2)}b | vol $${(c.vol/1e6).toFixed(0)}m | v/m ${c.ratio.toFixed(3)} | ${c.why.join(',')} | ${c.id}`
  );
}
