const RPC = "https://base.gateway.tenderly.co";
const POOLS = [
  ["VIRTUAL 0x3E97..", "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa", "WETH"],
  ["USDC 0x58dB..", "0x58dBa34e6ee6eb76Ef71A6ca0f18871CAE817D3b", "USDC"],
  ["USDC 0x1B2f..", "0x1B2f3f5C1B6037101FDD3EC14649E0d3F98fA642", "USDC"],
];
const SWAP = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
        if (/rate limit|exceeded|429/i.test(j.error.message)) { await sleep(1500 * (i + 1)); continue; }
        return { err: j.error.message };
      }
      return { ok: j.result };
    } catch (e) { await sleep(1500 * (i + 1)); }
  }
  return { err: "retries-exhausted" };
}

const headRes = await rpc("eth_blockNumber", []);
const head = parseInt(headRes.ok, 16);
console.log("head", head, "| window", head - 2100, "-", head, "(~70min)");

for (const [label, pool] of POOLS) {
  const rows = [];
  for (let start = head - 2100; start <= head; start += 700) {
    const end = Math.min(start + 699, head);
    const r = await rpc("eth_getLogs", [{
      address: pool,
      fromBlock: "0x" + start.toString(16),
      toBlock: "0x" + end.toString(16),
      topics: [SWAP],
    }]);
    if (r.ok) rows.push(...r.ok);
    else console.log(" err", label, start, r.err);
    await sleep(700);
  }
  rows.sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16));
  console.log(`\n=== ${label}  swaps=${rows.length}`);
  for (const l of rows) {
    const d = l.data.replace(/^0x/, "");
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push(d.slice(i * 64, i * 64 + 64));
    const [a0i, a1i, a0o, a1o] = parts.slice(2, 6).map((x) => BigInt("0x" + x));
    console.log(`  blk=${parseInt(l.blockNumber, 16)} sender=${"0x" + l.topics[1].slice(26)} to=${"0x" + l.topics[2].slice(26)}`);
    console.log(`     amt0In=${a0i.toString()} amt1In=${a1i.toString()} amt0Out=${a0o.toString()} amt1Out=${a1o.toString()}`);
  }
}
