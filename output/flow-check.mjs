const DEUS = '0x940A319B75861014A220D9c6c144d108552B089B';
const RPCS = ['https://mainnet.base.org', 'https://base.gateway.tenderly.co'];

const pad = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');

let ep = 0;
async function rpc(method, params) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(RPCS[ep], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.result !== undefined) return j.result;
    ep = (ep + 1) % RPCS.length;
    await new Promise((s) => setTimeout(s, 900 * 2 ** i));
  }
  return null;
}

const watch = {
  escrow: '0xA85A38796B951CE87B378538b32B3E6Ee3C4C373',
  w1: '0x259f962e77262ee8d97cc6a112d0e0321323ea0d',
  w2: '0xa2f42a10a8eb9089ac51108af68fa202bf2c3130',
  newBuyerA: '0x999f938d97639e825dc963d375c69c78e5e03f38',
  newBuyerB: '0xbe9306ddf2c0ddd69227adb2c7e7ef4d0b5697d5',
  seller49a7: '0x49a782c2660e77dded753bb88ac57619298ad50e',
};

const head = parseInt(await rpc('eth_blockNumber', []), 16);
console.log('head', head);

const now = Math.floor(Date.now() / 1000);
const stamps = [
  ['now', head],
  ['-1h', head - 1800],
  ['-6h', head - 10800],
  ['-24h', head - 43200],
  ['-48h', head - 86400],
];

for (const [label, addr] of Object.entries(watch)) {
  const row = [];
  for (const [tag, blk] of stamps) {
    const res = await rpc('eth_call', [{ to: DEUS, data: '0x70a08231' + pad(addr) }, '0x' + blk.toString(16)]);
    row.push(tag + '=' + (res ? (Number(BigInt(res)) / 1e18).toFixed(2) : 'ERR'));
  }
  console.log(label.padEnd(12), addr.slice(0, 10), row.join('  '));
  await new Promise((s) => setTimeout(s, 150));
}
