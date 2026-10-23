const DEUS = '0x940A319B75861014A220D9c6c144d108552B089B';
const RPC = 'https://mainnet.base.org';
const W = '0x09b383a627c3d35daf38cd77af0064c1848833c6';

const pad = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');

async function rpc(method, params) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.result !== undefined) return j.result;
    await new Promise((s) => setTimeout(s, 800 * 2 ** i));
  }
  return null;
}

const head = parseInt(await rpc('eth_blockNumber', []), 16);
const now = Math.floor(Date.now() / 1000);
let prev = null;
// every 30 min back 6h
for (let m = 0; m <= 360; m += 30) {
  const blk = head - Math.round((m * 60) / 2);
  const res = await rpc('eth_call', [{ to: DEUS, data: '0x70a08231' + pad(W) }, '0x' + blk.toString(16)]);
  const v = res ? Number(BigInt(res)) / 1e18 : null;
  const t = new Date((now - m * 60) * 1000).toISOString().slice(11, 19);
  const d = prev !== null && v !== null ? (v - prev).toFixed(2) : '';
  console.log('T-' + m + 'm', t + 'Z', 'block', blk, 'bal', v === null ? 'ERR' : v.toFixed(4), 'delta', d);
  prev = v;
}

const eth = await rpc('eth_getBalance', [W, 'latest']);
console.log('ETH', (Number(BigInt(eth)) / 1e18).toFixed(6));
