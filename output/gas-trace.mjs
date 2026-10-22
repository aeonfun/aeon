const u = "https://rpc.mainnet.chain.robinhood.com";
const call = (m, p) => fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) }).then(r => r.json()).then(j => j.result);
const targets = ["0x3ace8e0a2937297be9488a8c235a616d1a929519", "0xe4bf6f7efc32aad76e80916543d1277dbe8ecf9a"];
(async () => {
  // test whether historical eth_getBalance works at all
  const t = targets[0];
  for (const b of [95407836, 95330000, 95320000, 95300000, 95200000]) {
    const r = await call("eth_getBalance", [t, "0x" + b.toString(16)]);
    console.log("balAt", b, r, r ? (Number(BigInt(r)) / 1e18).toFixed(6) : "null");
  }
  // scan blocks near each NOTE receipt for native value TO the staging wallets
  for (const [addr, nearBlk] of [[targets[0], 95308399], [targets[1], 95332921]]) {
    console.log("\n===", addr, "near", nearBlk);
    for (let b = nearBlk - 40; b <= nearBlk + 5; b++) {
      const blk = await call("eth_getBlockByNumber", ["0x" + b.toString(16), true]);
      if (!blk || !blk.transactions) continue;
      for (const tx of blk.transactions) {
        if ((tx.to || "").toLowerCase() === addr) {
          console.log(" blk", b, new Date(parseInt(blk.timestamp, 16) * 1000).toISOString(), "from", tx.from, "value", (Number(BigInt(tx.value)) / 1e18).toFixed(6), "sel", (tx.input || "0x").slice(0, 10), "tx", tx.hash.slice(0, 14));
        }
      }
    }
  }
})();
