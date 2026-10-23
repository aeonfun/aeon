const RPC = "https://base.gateway.tenderly.co";
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

const txs = [
  ["0xe89c0d6d07721e787659adad057b03fa0b9d0a1952cc7d437d5086143f9d0e95", "0x3fd5 received 5225 DEUS"],
  ["0x85d488f5d09c3569fc65c80564327f8bb0cfaa5921146ca72086df93912a3a74", "MM sent 2226 DEUS"],
];

for (const [hash, note] of txs) {
  const [tx, rec] = await Promise.all([rpc("eth_getTransactionByHash", [hash]), rpc("eth_getTransactionReceipt", [hash])]);
  console.log("=== " + note);
  if (tx.ok) {
    console.log("  from:", tx.ok.from, "| to:", tx.ok.to, "| value:", (Number(BigInt(tx.ok.value)) / 1e18).toFixed(6), "ETH");
    console.log("  input selector:", tx.ok.input.slice(0, 10), "| len:", tx.ok.input.length);
  } else console.log("  tx err", tx.err);
  if (rec.ok) {
    console.log("  status:", parseInt(rec.ok.status, 16), "| block:", parseInt(rec.ok.blockNumber, 16), "| logs:", rec.ok.logs.length);
    for (const l of rec.ok.logs) {
      if (l.topics.length === 3 && l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
        console.log("    ERC20", l.address, Number(BigInt(l.data)) / 1e18,
          l.topics[0] ? "from=" + "0x" + l.topics[1].slice(26) : "", "to=" + "0x" + l.topics[2].slice(26));
      } else {
        console.log("    log", l.address, "topic0=" + (l.topics[0] || "").slice(0, 10));
      }
    }
  } else console.log("  rec err", rec.err);
  await sleep(700);
}
