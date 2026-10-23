const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RPCS = [
  ["tenderly", "https://base.gateway.tenderly.co"],
  ["mainnet.base.org", "https://mainnet.base.org"],
];
const hex = (n) => "0x" + n.toString(16);

async function rpc(url, method, params, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
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

const KNOWN = 52995672; // 18:38Z three-pool buy tx
const POOLS = {
  "0x3E97 VIRTUAL": "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa",
  "0x58dB USDC": "0x58dBa34e6ee6eb76Ef71A6ca0f18871CAE817D3b",
  "0x1B2f USDC": "0x1B2f3f5C1B6037101FDD3EC14649E0d3F98fA642",
};
const V3SWAP = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

for (const [name, url] of RPCS) {
  console.log("--- " + name);
  for (const [label, pool] of Object.entries(POOLS)) {
    const r = await rpc(url, "eth_getLogs", [{ address: pool, fromBlock: hex(KNOWN - 5), toBlock: hex(KNOWN + 5) }]);
    console.log(`  ${label} all-topics [${KNOWN - 5},${KNOWN + 5}]:`, r.ok ? r.ok.length + " logs" : "ERR " + r.err);
    if (r.ok && r.ok.length) {
      const t = {};
      for (const l of r.ok) { const k = l.topics[0].slice(0, 10); t[k] = (t[k] || 0) + 1; }
      console.log("     topic0 counts:", JSON.stringify(t));
    }
    await sleep(600);
  }
  await sleep(600);
}
