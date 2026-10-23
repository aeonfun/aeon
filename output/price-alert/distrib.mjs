const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const SRC = {
  a_0ae9: "0x0ae95bd71d64e1d24d67f3cc293fb75f826c4a7b",
  b_5cbf: "0x5cbf5dfaa5336ce0456e24217e7911365100879a",
  c_d4c4: "0xd4c450ace519d33beaddf24e4c7e197f5d9c9409",
};

async function rpc(method, params) {
  for (let a = 1; a <= 6; a++) {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const j = await r.json();
    if (!j.error) return j.result;
    if (j.error.code === -32005 || /rate limit/i.test(j.error.message || "")) {
      await sleep(1000 * 2 ** (a - 1));
      continue;
    }
    throw new Error(JSON.stringify(j.error));
  }
  throw new Error("rate limited out");
}
const pad = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const head = parseInt(await rpc("eth_blockNumber", []), 16);
const start = head - 20000; // ~11h

async function outs(addr) {
  const all = [];
  for (let b = start; b <= head; b += 1000) {
    const to = Math.min(b + 999, head);
    for (let a = 1; a <= 3; a++) {
      try {
        all.push(...await rpc("eth_getLogs", [{
          address: DEUS, fromBlock: "0x" + b.toString(16), toBlock: "0x" + to.toString(16),
          topics: [TRANSFER, pad(addr), null],
        }]));
        break;
      } catch (e) { if (a === 3) throw e; await sleep(700 * 2 ** (a - 1)); }
    }
    await sleep(100);
  }
  return all;
}

const tsCache = new Map();
async function blkTs(h) {
  if (!tsCache.has(h)) { const b = await rpc("eth_getBlockByNumber", [h, false]); tsCache.set(h, parseInt(b.timestamp, 16)); }
  return tsCache.get(h);
}

const out = {};
for (const [k, addr] of Object.entries(SRC)) {
  const logs = await outs(addr);
  const rows = [];
  for (const l of logs) {
    rows.push({
      ts: new Date((await blkTs(l.blockNumber)) * 1000).toISOString(),
      to: "0x" + l.topics[2].slice(26),
      deus: Number(BigInt(l.data)) / 1e18,
    });
  }
  out[k] = {
    address: addr,
    out_transfers_11h: rows.length,
    total_deus_out: rows.reduce((s, r) => s + r.deus, 0),
    distinct_recipients: new Set(rows.map((r) => r.to)).size,
    sample: rows.slice(-8),
  };
}
console.log(JSON.stringify(out, null, 2));
