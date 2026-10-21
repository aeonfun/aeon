const fs = require('fs');
const logs = JSON.parse(fs.readFileSync('tl_logs.json', 'utf8'));
const NAMES = {
  '0x4cf4410cc57040e44862ef0f45f3dd5a5e02db8eb8add648d4b0e236f1d07dca': 'CallScheduled',
  '0xc2617efa69bab667d5f1f848fbc5b8d96cf1b0afb3a2a1a3f5c3a6e5a5a5a5a5': 'CallExecuted(guess)',
  '0x20fda5fd27a1ea7b3ba90ac7b0e5f1a3d1b0a0a0a0a0a0a0a0a0a0a0a0a0a0a': 'CallSalt?',
  '0xbaa1eb22f2a492ba0d1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c': 'Cancelled?',
};
function w(hex, i) { return hex.slice(2 + i * 64, 2 + (i + 1) * 64); }
function addr(word) { return '0x' + word.slice(24); }
function u(word) { return BigInt('0x' + word).toString(); }

for (const l of logs) {
  const t0 = l.topics[0];
  const data = l.data;
  let line = '';
  if (t0.startsWith('0x4cf4410c')) {
    const target = addr(w(data, 0));
    const delay = u(w(data, 5));
    // decode the inner transfer
    const inner = w(data, 6); // offset
    const bytesLen = parseInt(w(data, 7), 16);
    const innerData = data.slice(2 + 7 * 64, 2 + 7 * 64 + bytesLen * 2);
    let innerDesc = '';
    if (innerData.startsWith('a9059cbb')) {
      const to = '0x' + innerData.slice(8 + 24, 8 + 64);
      const amt = BigInt('0x' + innerData.slice(8 + 64, 8 + 128));
      innerDesc = `transfer(${to}, ${(Number(amt) / 1e18).toLocaleString()} NOTE)`;
    } else if (innerData.startsWith('dd46508f')) {
      innerDesc = 'modifyLiquidities(...)';
    } else if (innerData.startsWith('79ba5097')) {
      innerDesc = 'acceptOwnership()';
    } else {
      innerDesc = innerData.slice(0, 10);
    }
    line = `CallScheduled blk ${parseInt(l.blockNumber, 16)} target=${target} delay=${delay}s action=${innerDesc}`;
  } else if (t0.startsWith('0xc2617efa')) {
    const target = addr(w(data, 0));
    const bytesLen = parseInt(w(data, 3), 16);
    const innerData = data.slice(2 + 4 * 64, 2 + 4 * 64 + bytesLen * 2);
    let innerDesc = innerData.slice(0, 10);
    if (innerData.startsWith('a9059cbb')) {
      const to = '0x' + innerData.slice(8 + 24, 8 + 64);
      const amt = BigInt('0x' + innerData.slice(8 + 64, 8 + 128));
      innerDesc = `transfer(${to}, ${(Number(amt) / 1e18).toLocaleString()} NOTE)`;
    } else if (innerData.startsWith('dd46508f')) innerDesc = 'modifyLiquidities(swap/liquidity)';
    line = `CallExecuted  blk ${parseInt(l.blockNumber, 16)} target=${target} action=${innerDesc}`;
  } else {
    line = `topic ${t0.slice(0, 12)} blk ${parseInt(l.blockNumber, 16)}`;
  }
  console.log(line);
}
