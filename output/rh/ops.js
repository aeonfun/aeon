const fs = require('fs');
const logs = JSON.parse(fs.readFileSync('tl_logs.json', 'utf8'));
const w = (h, i) => h.slice(2 + i * 64, 2 + (i + 1) * 64);
const num = x => (x && /^[0-9a-fA-F]+$/.test(x) ? BigInt('0x' + x) : 0n);
const addr = x => '0x' + x.slice(24).toLowerCase();

function inner(hex) {
  const s = hex.slice(0, 8);
  if (s === 'a9059cbb') {
    const to = '0x' + hex.slice(32, 72);
    const a = BigInt('0x' + hex.slice(72, 136));
    return `transfer(${to}, ${(Number(a) / 1e18).toLocaleString('en-US')} NOTE)`;
  }
  if (s === 'dd46508f') return 'modifyLiquidities';
  if (s === '79ba5097') return 'acceptOwnership';
  return 'sel ' + s;
}

const ops = new Map();
for (const l of logs) {
  const t0 = l.topics[0], d = l.data, blk = parseInt(l.blockNumber, 16);
  const id = l.topics[1];
  if (t0.startsWith('0x4cf4410c')) {
    const target = addr(w(d, 0));
    const byteLen = Number(num(w(d, 5)));
    const bh = d.slice(2 + 6 * 64, 2 + 6 * 64 + byteLen * 2);
    ops.set(id, { id, blk, target, action: inner(bh), status: 'scheduled' });
  } else if (t0.startsWith('0xc2617efa')) {
    const target = addr(w(d, 0));
    const byteLen = Number(num(w(d, 3)));
    const bh = d.slice(2 + 4 * 64, 2 + 4 * 64 + byteLen * 2);
    const o = ops.get(id) || { id, target, action: inner(bh) };
    o.status = 'executed'; o.execBlk = blk; o.target = target; o.action = inner(bh);
    ops.set(id, o);
  } else if (t0.startsWith('0xbaa1eb22')) {
    const o = ops.get(id);
    if (o) o.status = 'CANCELLED';
  }
}
for (const o of ops.values()) console.log(`${o.status.padEnd(10)} schedBlk=${o.blk} execBlk=${o.execBlk || '-'} ${o.action}`);
