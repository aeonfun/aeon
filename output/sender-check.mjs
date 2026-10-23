const DEUS = '0x940A319B75861014A220D9c6c144d108552B089B';
const RPC = 'https://mainnet.base.org';

const pad = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');

async function rpc(method, params) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json();
    if (j.result !== undefined) return j.result;
    await new Promise((s) => setTimeout(s, 800 * 2 ** i));
  }
  return null;
}

const targets = [
  ['0x6e831ebc833edb0160ba874ae934ca0981ac8ebb', '17:05:25 buy $36.18 + 17:06:23 buy $53.15 (USDC pool x2)'],
  ['0x09b383a627c3d35daf38cd77af0064c1848833c6', '17:06:13 dual-pool same-second VIRTUAL $62.78 + USDC $72.64'],
  ['0x6abea4998f9ef34ee1cda5715ccca0e4d4efb730', 'known MM: 17:05:57 buy $40.01'],
  ['0x49a782c2660e77dded753bb88ac57619298ad50e', '17:06:17 sell $40.32'],
  ['0x999f938d97639e825dc963d375c69c78e5e03f38', '16:52:13 buy $197.97'],
  ['0xbe9306ddf2c0ddd69227adb2c7e7ef4d0b5697d5', '16:50:59 buy $99.83'],
  ['0x65a8f07bd9a8598e1b5b6c0a88f4779dbc077675', '16:52:11 buy $67.56'],
  ['0x96949fd549d0da5ca279662264085a93138bdb17', '16:52:17 sell $50.09 both pools'],
];

for (const [addr, note] of targets) {
  const res = await rpc('eth_call', [{ to: DEUS, data: '0x70a08231' + pad(addr) }, 'latest']);
  const bal = res ? (Number(BigInt(res)) / 1e18).toFixed(6) : 'ERR';
  const nonce = await rpc('eth_getTransactionCount', [addr, 'latest']);
  const code = await rpc('eth_getCode', [addr, 'latest']);
  console.log(addr.slice(0, 10), 'DEUS', bal, 'nonce', nonce ? parseInt(nonce, 16) : '?', 'code', code ? code.slice(0, 10) : '?', '|', note);
}
