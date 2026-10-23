const RPC = "https://base.gateway.tenderly.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => "0x" + n.toString(16);

async function rpc(method, params, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = await r.json();
      if (j.error) {
        if (/rate limit|exceeded|429/i.test(j.error.message)) { await sleep(2000 * (i + 1)); continue; }
        return { err: j.error.message };
      }
      return { ok: j.result };
    } catch (e) { await sleep(2000 * (i + 1)); }
  }
  return { err: "retries-exhausted" };
}

const POOLS = [
  ["0x3E97 DEUS/VIRTUAL", "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa", 0],
  ["0x58dB DEUS/USDC", "0x58dBa34e6ee6eb76Ef71A6ca0f18871CAE817D3b", 1],
  ["0x1B2f DEUS/USDC", "0x1B2f3f5C1B6037101FDD3EC14649E0d3F98fA642", 1],
];
const V3SWAP = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

const headRes = await rpc("eth_blockNumber", []);
const head = parseInt(headRes.ok, 16);
const from = head - 2100;
console.log("head", head, "| window", from, "-", head);

for (const [label, pool, deusIsToken0] of POOLS) {
  const rows = [];
  for (let s = from; s <= head; s += 950) {
    const e = Math.min(s + 949, head);
    const r = await rpc("eth_getLogs", [{ address: pool, fromBlock: hex(s), toBlock: hex(e), topics: [V3SWAP] }]);
    if (r.ok) rows.push(...r.ok); else console.log("  err", label, s, r.err);
    await sleep(800);
  }
  rows.sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16));
  console.log(`\n=== ${label}  swaps=${rows.length}`);
  for (const l of rows) {
    const d = l.data;
    // int256 decode
    const w = [];
    for (let i = 0; i < 5; i++) w.push(d.slice(2 + i * 64, 2 + (i + 1) * 64));
    const s256 = (h) => { const v = BigInt("0x" + h); return v >= 1n << 255n ? v - (1n << 256n) : v; };
    const amt0 = s256(w[0]), amt1 = s256(w[1]);
    const deusAmt = deusIsToken0 ? amt0 : amt1;
    console.log(`  blk=${parseInt(l.blockNumber, 16)} sender=${"0x" + l.topics[1].slice(26)} DEUS_delta=${(Number(deusAmt) / 1e18).toFixed(4)} (${deusAmt > 0n ? "pool GAINED = user SOLD" : "pool LOST = user BOUGHT"})`);
  }
}
