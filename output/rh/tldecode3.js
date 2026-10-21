const fs = require('fs');
const logs = JSON.parse(fs.readFileSync('tl_logs.json', 'utf8'));
const w = (h, i) => h.slice(2 + i * 64, 2 + (i + 1) * 64);
const addr = x => '0x' + x.slice(24).toLowerCase();
const num = x => (x && /^[0-9a-fA-F]+$/.test(x) ? BigInt('0x' + x) : 0n);

function inner(hex) {
  const s = hex.slice(0, 8);
  if (s === 'a9059cbb') {
    const to = '0x' + hex.slice(32, 72);
    const a = BigInt('0x' + hex.slice(72, 136));
    return 'transfer(' + to + ', ' + (Number(a) / 1e18).toLocaleString() + ' NOTE)';
  }
  if (s === 'dd46508f') return 'modifyLiquidities (swap/LP)';
  if (s === '79ba5097') return 'acceptOwnership()';
  return 'sel ' + s;
}

for (const l of logs) {
  const t0 = l.topics[0], d = l.data, blk = parseInt(l.blockNumber, 16);
  try {
    if (t0.startsWith('0x4cf4410c')) {
      if (d.length < 2 + 7 * 64) continue;
      const target = addr(w(d, 0));
      const off = Number(num(w(d, 6))) * 2;
      const len = Number(num(d.slice(2 + off, 2 + off + 64)));
      const inn = d.slice(2 + off + 64, 2 + off + 64 + len * 2);
      const delay = num(w(d, 5));
      console.log('SCHEDULE blk', blk, 'target', target, 'delay', delay.toString() + 's', 'action', inner(inn));
    } else if (t0.startsWith('0xc2617efa')) {
      if (d.length < 2 + 4 * 64) continue;
      const target = addr(w(d, 0));
      const off = Number(num(w(d, 3))) * 2;
      const len = Number(num(d.slice(2 + off, 2 + off + 64)));
      const inn = d.slice(2 + off + 64, 2 + off + 64 + len * 2);
      console.log('EXECUTE  blk', blk, 'target', target, 'action', inner(inn));
    }
  } catch (e) { console.log('skip', blk, e.message); }
}
