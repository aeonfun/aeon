const fs = require('fs');
const dex = JSON.parse(fs.readFileSync('dex.json', 'utf8'));
for (const p of dex.pairs) {
  console.log([
    p.dexId, p.labels ? p.labels.join('/') : '', 'base=' + p.baseToken.symbol, 'quote=' + p.quoteToken.symbol,
    'price=' + p.priceUsd, 'liq=$' + (p.liquidity?.usd || 0), 'v24=$' + p.volume.h24,
    'ch24=' + p.priceChange.h24 + '%', 'created=' + new Date(p.pairCreatedAt).toISOString(),
    'fdv=$' + p.fdv,
  ].join(' | '));
}
console.log('\npairs:', dex.pairs.length);
const tot = dex.pairs.reduce((s, p) => s + (p.liquidity?.usd || 0), 0);
const v = dex.pairs.reduce((s, p) => s + (p.volume?.h24 || 0), 0);
console.log('total liq $' + tot.toFixed(0), 'total v24 $' + v.toFixed(0));
