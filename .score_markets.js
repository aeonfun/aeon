const fs = require('fs');
const events = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.poly_events.json'));

console.log(`Total events: ${events.length}`);
const dedupQ = ['MegaETH FDV >$2B one day after launch'];

const top = events.slice(0, 25).map(e => ({
  title: e.title,
  vol24: e.volume24hr,
  endDate: e.endDate,
  startDate: e.startDate,
  liquidity: e.liquidity,
  marketsCount: (e.markets || []).length,
}));
for (const t of top) {
  console.log(`vol24=$${(t.vol24/1e6).toFixed(2)}M  ends=${t.endDate?.slice(0,10)}  mkts=${t.marketsCount}  liq=$${(t.liquidity/1e6).toFixed(2)}M  ${t.title}`);
}
