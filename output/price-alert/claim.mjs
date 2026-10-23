const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const CLAIM = "0x5cbf5dfaa5336ce0456e24217e7911365100879a";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params) {
  for (let a = 1; a <= 6; a++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await r.json();
    if (!j.error) return j.result;
    if (j.error.code === -32005 || /rate limit/i.test(j.error.message || "")) { await sleep(1000 * 2 ** (a - 1)); continue; }
    throw new Error(JSON.stringify(j.error));
  }
  throw new Error("rate limited");
}
const pad = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

const head = parseInt(await rpc("eth_blockNumber", []), 16);
const headBlk = await rpc("eth_getBlockByNumber", ["0x" + head.toString(16), false]);
const headTs = parseInt(headBlk.timestamp, 16);

// 24h window: Base ~2s blocks -> 43200 blocks, chunked
const start = head - 43200;
async function scan(topics, fromB, toB) {
  const all = [];
  for (let b = fromB; b <= toB; b += 1000) {
    const to = Math.min(b + 999, toB);
    for (let a = 1; a <= 4; a++) {
      try {
        all.push(...await rpc("eth_getLogs", [{ address: DEUS, fromBlock: "0x" + b.toString(16), toBlock: "0x" + to.toString(16), topics }]));
        break;
      } catch (e) { if (a === 4) throw e; await sleep(800 * 2 ** (a - 1)); }
    }
    await sleep(90);
  }
  return all;
}

const outs = await scan([TRANSFER, pad(CLAIM), null], start, head);
const total = outs.reduce((s, l) => s + Number(BigInt(l.data)) / 1e18, 0);
const byDest = {};
for (const l of outs) {
  const d = "0x" + l.topics[2].slice(26);
  byDest[d] = (byDest[d] || 0) + Number(BigInt(l.data)) / 1e18;
}

const balHex = await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(CLAIM).slice(2) }, "latest"]);
const bal = Number(BigInt(balHex)) / 1e18;
const supplyHex = await rpc("eth_call", [{ to: DEUS, data: "0x18160ddd" }, "latest"]);
const supply = Number(BigInt(supplyHex)) / 1e18;

console.log(JSON.stringify({
  head, head_ts: new Date(headTs * 1000).toISOString(),
  window_blocks: [start, head], window_hours: +(43200 * 2 / 3600).toFixed(1),
  out_transfer_count_24h: outs.length,
  deus_out_24h: total,
  top_destinations: Object.entries(byDest).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ addr: k, deus: v })),
  claim_balance_now: bal,
  total_supply: supply,
  claim_pct_of_supply: +(bal / supply * 100).toFixed(2),
  daily_emission_pct_of_supply: +(total / supply * 100).toFixed(5),
}, null, 2));
