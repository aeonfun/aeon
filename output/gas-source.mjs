const u = "https://rpc.mainnet.chain.robinhood.com";
const call = (m, p) => fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) }).then(r => r.json()).then(j => j.result);
const targets = ["0x3ace8e0a2937297be9488a8c235a616d1a929519", "0xe4bf6f7efc32aad76e80916543d1277dbe8ecf9a"];
const lo0 = 95250000, hi0 = 95407836;
const balAt = async (a, b) => BigInt(await call("eth_getBalance", [a, "0x" + b.toString(16)]) || "0x0");
(async () => {
  for (const a of targets) {
    let lo = lo0, hi = hi0;
    if (await balAt(a, lo) !== 0n) { console.log(a, "already funded before", lo); continue; }
    if (await balAt(a, hi) === 0n) { console.log(a, "never funded"); continue; }
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (await balAt(a, mid) === 0n) lo = mid; else hi = mid;
    }
    const blk = await call("eth_getBlockByNumber", ["0x" + hi.toString(16), true]);
    const ts = new Date(parseInt(blk.timestamp, 16) * 1000).toISOString();
    const hits = blk.transactions.filter(t => (t.to || "").toLowerCase() === a || (t.from || "").toLowerCase() === a);
    console.log(a, "first funded at block", hi, ts);
    for (const t of hits) console.log("   tx", t.hash.slice(0, 14), "from", t.from, "value", (Number(BigInt(t.value)) / 1e18).toFixed(6), "to", t.to, "sel", (t.input || "").slice(0, 10));
  }
})();
