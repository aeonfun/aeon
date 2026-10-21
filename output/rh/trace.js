const fs = require('fs');
const evs = JSON.parse(fs.readFileSync('evs.json', 'utf8'));
for (const a of ['0xd000b458f6a194b10e3ff516b00b94f7234695d3', '0x6f62b43d8dfc378d3e2e8f8b1095919282691789']) {
  console.log('### ' + a);
  for (const e of evs.filter(x => x.from === a || x.to === a).sort((x, y) => x.block - y.block)) {
    console.log('  blk', e.block, e.amt.toFixed(2), e.from === a ? 'OUT ->' + e.to : 'IN  <-' + e.from, e.tx);
  }
}
