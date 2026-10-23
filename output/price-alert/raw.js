const RPC = "https://base.gateway.tenderly.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => "0x" + n.toString(16);

async function rpc(method, params, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) { if (/rate limit|exceeded|429/i.test(j.error.message)) { await sleep(2000*(i+1)); continue; } return { err: j.error.message }; }
      return { ok: j.result };
    } catch (e) { await sleep(2000 * (i + 1)); }
  }
  return { err: "retries-exhausted" };
}

const POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa";
const blk = 52994860;
const r = await rpc("eth_getLogs", [{ address: POOL, fromBlock: hex(blk), toBlock: hex(blk) }]);
for (const l of r.ok) {
  if (!l.topics[0].startsWith("0xb3e27736")) continue;
  console.log("RAW data:", l.data);
  const words = l.data.slice(2).match(/.{1,64}/g);
  console.log("words:", words.length);
  words.forEach((w, i) => console.log(`  w${i}=${w}  dec=${BigInt("0x"+w)}`));
  console.log("topics:", l.topics);
}

// Also the tx receipt to see full swap routing
const tx = "0x2260508925dbd183e8e579cc20e78f219aaf7c878bd4afc61d5b9c3de300104b";
const rec = await rpc("eth_getTransactionReceipt", [tx]);
if (rec.ok) {
  console.log("\n--- receipt logs (", rec.ok.logs.length, ") ---");
  for (const l of rec.ok.logs) {
    console.log(l.address, (l.topics[0]||"").slice(0,10),
      "| ERC20 amt:", l.topics.length===3 && (l.data||"").length>2 ? (Number(BigInt(l.data))/1e18).toFixed(4) : "-");
  }
} else console.log("rec err", rec.err);
