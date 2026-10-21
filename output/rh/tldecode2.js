const fs = require('fs');
const logs = JSON.parse(fs.readFileSync('tl_logs.json', 'utf8'));
function w(hex, i) { return hex.slice(2 + i * 64, 2 + (i + 1) * 64); }
function addr(word) { return '0x' + word.slice(24).toLowerCase(); }
function u(word) { return BigInt('0x' + word); }

function decodeInner(hex) {
  const s = hex.slice(0, 8);
  if (s === 'a9059cbb') {
    const to = '0x' + hex.slice(8 + 24, 8 + 64);
    const amt = BigInt('0x' + hex.slice(8 + 64, 8 + 128));
    return `transfer(${to}, ${(Number(amt) / 1e18).toLocaleString()} NOTE)`;
  }
  if (s === 'dd46508f') return 'modifyLiquidities (swap / LP)';
  if (s === '79ba5097') return 'acceptOwnership()';
  return 'sel ' + s;
}

for (const l of logs) {
  const t0 = l.topics[0], data = l.data;
  const blk = parseInt(l.blockNumber, 16);
  if (t0.startsWith('0x4cf4410c')) {
    const target = addr(w(data, 0));
    const off = Number(u(w(data, 2))) * 2;
    const len = Number(u('0x' + data.slice(2 + off, 2 + off + 64)));
    const inner = data.slice(2 + off + 64, 2 + off + 64 + len * 2);
    const delay = u(w(data, 5));
    console.log(`SCHEDULE blk=${blk} target=${target} delay=${delay}s eta~${new Date(Date.now() + Number(delay) * 1000).toISOString().slice(0, 16)} action=${decodeInner(inner)}`);
  } else if (t0.startsWith('0xc2617efa')) {
    const target = addr(w(data, 0));
    const off = Number(u(w(data, 2))) * 2;
    const len = Number(u('0x' + data.slice(2 + off, 2 + off + 64)));
    const inner = data.slice(2 + off + 64, 2 + off + 64 + len * 2);
    console.log(`EXECUTE  blk=${blk} target=${target} action=${decodeInner(inner)}`);
  }
}
