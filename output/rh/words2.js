const fs = require('fs');
const logs = JSON.parse(fs.readFileSync('tl_logs.json', 'utf8'));
const w = (h, i) => h.slice(2 + i * 64, 2 + (i + 1) * 64);
const num = x => (x && /^[0-9a-fA-F]+$/.test(x) ? BigInt('0x' + x) : 0n);

for (const l of logs) {
  const blk = parseInt(l.blockNumber, 16);
  if (blk !== 93412762 && blk !== 94195015 && blk !== 91725736) continue;
  console.log('=== blk', blk, 't0', l.topics[0].slice(0, 10));
  const d = l.data.slice(2);
  for (let i = 0; i < d.length / 64; i++) console.log('  word', i, d.slice(i * 64, (i + 1) * 64));
  console.log('  full', l.data);
}
