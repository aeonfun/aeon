const fs = require('fs');
const logs = JSON.parse(fs.readFileSync('tl_logs.json', 'utf8'));
const w = (h, i) => h.slice(2 + i * 64, 2 + (i + 1) * 64);
const num = x => (x && /^[0-9a-fA-F]+$/.test(x) ? BigInt('0x' + x) : 0n);
const addr = x => '0x' + x.slice(24).toLowerCase();

function decodeInner(bytesHex) {
  // bytesHex: continuous calldata hex without 0x
  const sel = bytesHex.slice(0, 8);
  if (sel === 'a9059cbb') {
    const to = '0x' + bytesHex.slice(8 + 24, 8 + 64);
    const amt = BigInt('0x' + bytesHex.slice(8 + 64, 8 + 128));
    return { name: 'transfer', to, amt };
  }
  return { name: sel, raw: bytesHex.slice(0, 80) };
}

const rows = [];
for (const l of logs) {
  const t0 = l.topics[0], d = l.data, blk = parseInt(l.blockNumber, 16);
  if (t0.startsWith('0x4cf4410c')) {
    const target = addr(w(d, 0));
    const delay = Number(num(w(d, 4)));
    const byteLen = Number(num(w(d, 5)));
    const start = 6 * 64;
    const bytesHex = d.slice(2 + start, 2 + start + byteLen * 2);
    rows.push({ kind: 'SCHEDULE', blk, target, delay, inner: decodeInner(bytesHex) });
  } else if (t0.startsWith('0xc2617efa')) {
    const target = addr(w(d, 0));
    const byteLen = Number(num(w(d, 3)));
    const start = 4 * 64;
    const bytesHex = d.slice(2 + start, 2 + start + byteLen * 2);
    rows.push({ kind: 'EXECUTE', blk, target, inner: decodeInner(bytesHex) });
  }
}
for (const r of rows) {
  const a = r.inner;
  const desc = a.name === 'transfer'
    ? `transfer(${a.to}, ${(Number(a.amt) / 1e18).toLocaleString('en-US')} NOTE)`
    : a.name + ' ' + (a.raw || '');
  console.log(`${r.kind.padEnd(8)} blk=${r.blk} ${r.kind === 'SCHEDULE' ? 'delay=' + r.delay + 's(' + (r.delay / 3600) + 'h)' : '               '} target=${r.target} -> ${desc}`);
}
