const RPC = "https://base.gateway.tenderly.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => "0x" + n.toString(16);
const DEUS = "0x940a319b75861014a220d9c6c144d108552b089b";

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
  ["0x3E97 DEUS/VIRTUAL", "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa"],
  ["0x58dB DEUS/USDC", "0x58dBa34e6ee6eb76Ef71A6ca0f18871CAE817D3b"],
  ["0x1B2f DEUS/USDC", "0x1B2f3f5C1B6037101FDD3EC14649E0d3F98fA642"],
  ["0x75bc DEUS/USDC", "0x75bc14950Ab093cBd1f80BbbDf458596939180A3"],
];

for (const [label, pool] of POOLS) {
  const t0 = await rpc("eth_call", [{ to: pool, data: "0x0dfe1681" }, "latest"]);
  const t1 = await rpc("eth_call", [{ to: pool, data: "0xd21220a7" }, "latest"]);
  const a0 = t0.ok ? "0x" + t0.ok.slice(26) : "ERR";
  const a1 = t1.ok ? "0x" + t1.ok.slice(26) : "ERR";
  console.log(`${label}: token0=${a0} token1=${a1} | DEUS_is_token0=${a0.toLowerCase() === DEUS}`);
  await sleep(700);
}
