#!/usr/bin/env node
// Balance witness: token balances + native ETH for watched wallets.
// Cross-checks log-based "quiet" claims (see memory/topics/base-rpc-access.md).
'use strict';
const RPCS = { base: process.env.BASE_RPC_URL, robinhood: process.env.RH_RPC_URL };
const FALLBACK = { base: 'https://base.gateway.tenderly.co', robinhood: 'https://rpc.mainnet.chain.robinhood.com' };

const TOKENS = {
  base: { DEUS: '0x940A319B75861014A220D9c6c144d108552B089B', xDEUS: '0xe6d5f7439Bc236C40054e2275f765f59343D4431' },
  robinhood: { NOTE: '0xc4f730335Fb9e439ca5552f7b52B8E638c4245B0' },
};
const HOLDERS = {
  base: {
    'DEUS escrow': { tok: 'DEUS', addr: '0xA85A38796B951CE87B378538b32B3E6Ee3C4C373' },
    'xDEUS escrow': { tok: 'xDEUS', addr: '0xA85A38796B951CE87B378538b32B3E6Ee3C4C373' },
  },
  robinhood: {
    'NOTE owner EOA': { tok: 'NOTE', addr: '0x0b64b35c6dd23944d6d4029864d2ca2aa1b66422' },
    'NOTE staging 0x69bb': { tok: 'NOTE', addr: '0x69bb2e438b04109dc1ec0cc43f77f455649d7c63' },
    'NOTE timelock': { tok: 'NOTE', addr: '0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8' },
    'NOTE vesting': { tok: 'NOTE', addr: '0xfdd983c66d4da2ef64769b6a2eba9cd838289962' },
    'PoolManager': { tok: 'NOTE', addr: '0x8366a39cc670b4001a1121b8f6a443a643e40951' },
  },
};

async function rpc(chain, method, params) {
  for (const url of [RPCS[chain], FALLBACK[chain]]) {
    if (!url) continue;
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(20000),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { /* try next */ }
  }
  throw new Error(`${chain}:${method} failed`);
}

(async () => {
  const out = { at: new Date().toISOString(), holders: {}, supply: {}, meta: {} };
  for (const chain of Object.keys(TOKENS)) {
    for (const [symbol, addr] of Object.entries(TOKENS[chain])) {
      try {
        const dec = await rpc(chain, 'eth_call', [{ to: addr, data: '0x313ce567' }, 'latest']);
        const sym = await rpc(chain, 'eth_call', [{ to: addr, data: '0x95d89b41' }, 'latest']);
        const sup = await rpc(chain, 'eth_call', [{ to: addr, data: '0x18160ddd' }, 'latest']);
        out.meta[symbol] = { decimals: parseInt(dec, 16), symbolRaw: sym };
        out.supply[symbol] = sup;
      } catch (e) { out.meta[symbol] = { error: e.message }; }
    }
    for (const [label, h] of Object.entries(HOLDERS[chain] || {})) {
      const padded = '0x' + h.addr.replace(/^0x/, '').toLowerCase().padStart(64, '0');
      try {
        const bal = await rpc(chain, 'eth_call', [{ to: TOKENS[chain][h.tok], data: '0x70a08231' + padded.slice(2) }, 'latest']);
        let eth = null, nonce = null;
        try { eth = await rpc(chain, 'eth_getBalance', [h.addr, 'latest']); } catch {}
        try { nonce = await rpc(chain, 'eth_getTransactionCount', [h.addr, 'latest']); } catch {}
        out.holders[label] = { chain, token: h.tok, raw: bal, ethRaw: eth, nonceRaw: nonce };
      } catch (e) { out.holders[label] = { error: e.message }; }
    }
  }
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
