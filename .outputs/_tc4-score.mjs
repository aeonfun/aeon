import fs from 'node:fs';

const markets = JSON.parse(fs.readFileSync('.outputs/_tc4-markets.json', 'utf8'));
const trendJson = JSON.parse(fs.readFileSync('.outputs/_tc4-trending.json', 'utf8'));

const TREND = trendJson.coins.map(c => c.item.symbol.toUpperCase());
const DEDUP = ["KAIA","TRAC","BSB","INJ","NEAR","HYPE","CHZ","LIT","VVV","DASH","ZEC","PENGU","GRASS","ONDO","WLD","BEAT","GENIUS","SKYAI"];
const BTC7D = -4.7122;
const ETH7D = -7.4608;

const scored = [];
for (const m of markets) {
  const sym = (m.symbol || '').toUpperCase();
  if (!sym) continue;
  if (DEDUP.includes(sym)) continue;
  const mcap = m.market_cap || 0;
  if (mcap < 20_000_000) continue;
  const vol = m.total_volume || 0;
  const vm = mcap > 0 ? vol / mcap : 0;
  const c24 = m.price_change_percentage_24h_in_currency ?? 0;
  const c7d = m.price_change_percentage_7d_in_currency ?? 0;

  const s_24p   = c24 > 0 ? 1 : 0;
  const s_7p    = c7d > 0 ? 1 : 0;
  const s_both5 = (c24 > 5 && c7d > 5) ? 2 : 0;
  const s_trend = TREND.includes(sym) ? 2 : 0;
  const s_vm    = vm >= 0.20 ? 3 : (vm >= 0.10 ? 2 : 0);
  const s_rs    = (c7d > BTC7D && c7d > ETH7D) ? 2 : 0;
  const score   = s_24p + s_7p + s_both5 + s_trend + s_vm + s_rs;

  scored.push({
    sym, name: m.name, price: m.current_price, mcap, vol, vm, c24, c7d,
    s_24p, s_7p, s_both5, s_trend, s_vm, s_rs, score
  });
}

scored.sort((a, b) => (b.score - a.score) || (b.vm - a.vm));

const top = scored.slice(0, 30);
for (const r of top) {
  console.log(
    `${String(r.score).padStart(2)}/10  ${r.sym.padEnd(10)}  24h=${r.c24.toFixed(2).padStart(7)}%  ` +
    `7d=${r.c7d.toFixed(2).padStart(7)}%  vm=${r.vm.toFixed(3)}  mcap=$${(r.mcap/1e6).toFixed(0)}m  ` +
    `$${r.price}  (${r.name})  [24p=${r.s_24p} 7p=${r.s_7p} b5=${r.s_both5} tr=${r.s_trend} vm=${r.s_vm} rs=${r.s_rs}]`
  );
}

fs.writeFileSync('.outputs/_tc4-leaderboard.json', JSON.stringify(top, null, 2));
console.log(`\n-- wrote ${top.length} rows to .outputs/_tc4-leaderboard.json --`);
console.log(`-- universe after dedup+mcap floor: ${scored.length} candidates --`);
console.log(`-- trending list (${TREND.length}): ${TREND.join(',')} --`);
