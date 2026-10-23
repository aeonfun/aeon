const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RPCS = [
  ["tenderly", "https://base.gateway.tenderly.co"],
  ["mainnet.base.org", "https://mainnet.base.org"],
];

async function rpc(url, method, params, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = await r.json();
      if (j.error) {
        if (/rate limit|exceeded|429/i.test(j.error.message)) { await sleep(1200 * (i + 1)); continue; }
        return { err: j.error.message };
      }
      return { ok: j.result };
    } catch (e) { await sleep(1200 * (i + 1)); }
  }
  return { err: "retries-exhausted" };
}

const POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa";
const USDC_POOL = "0x58dBa34e6ee6eb76Ef71A6ca0f18871CAE817D3b";

for (const [name, url] of RPCS) {
  // Sanity: no topics, tiny range with a known-active block (52995672 has a 3-pool buy)
  const r1 = await rpc(url, "eth_getLogs", [{ address: POOL, fromBlock: "0x3295b20", toBlock: "0x3295b40" }]);
  console.log(name, "no-topic 33 blocks around 529956XX:", r1.ok ? r1.ok.length + " logs" : "ERR " + r1.err);
  await sleep(500);
  const r2 = await rpc(url, "eth_getLogs", [{ address: USDC_POOL, fromBlock: "0x3295b20", toBlock: "0x3295b40" }]);
  console.log(name, "USDC pool same range:", r2.ok ? r2.ok.length + " logs" : "ERR " + r2.err);
  if (r2.ok && r2.ok.length) {
    const t = {};
    for (const l of r2.ok) t[l.topics[0]] = (t[l.topics[0]] || 0) + 1;
    console.log("  topics:", t);
  }
  await sleep(500);
  const r3 = await rpc(url, "eth_getLogs", [{ address: USDC_POOL, fromBlock: "0x3295b20", toBlock: "0x3295b40", topics: ["0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"] }]);
  console.log(name, "USDC pool v3-Swap topic:", r3.ok ? r3.ok.length + " logs" : "ERR " + r3.err);
  await sleep(700);
}
