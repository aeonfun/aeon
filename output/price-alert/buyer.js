const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
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

const tx = "0x2260508925dbd183e8e579cc20e78f219aaf7c878bd4afc61d5b9c3de300104b";
const rec = await rpc("eth_getTransactionReceipt", [tx]);
console.log("=== DEUS ERC20 transfers in tx ===");
for (const l of rec.ok.logs) {
  if (l.address.toLowerCase() !== DEUS.toLowerCase()) continue;
  if (l.topics.length !== 3 || !l.topics[0].startsWith("0xddf252ad")) continue;
  console.log(`  ${(Number(BigInt(l.data))/1e18).toFixed(4)} DEUS  from=${"0x"+l.topics[1].slice(26)}  to=${"0x"+l.topics[2].slice(26)}`);
}

const txRes = await rpc("eth_getTransactionByHash", [tx]);
console.log("\ntx from:", txRes.ok.from, "| to:", txRes.ok.to);

const candidates = new Set();
for (const l of rec.ok.logs) {
  if (l.address.toLowerCase() === DEUS.toLowerCase() && l.topics.length === 3) {
    candidates.add("0x" + l.topics[2].slice(26));
  }
}
console.log("\n=== balances of DEUS recipients (now / -1h / -24h) ===");
const headRes = await rpc("eth_blockNumber", []);
const head = parseInt(headRes.ok, 16);
for (const a of candidates) {
  const vals = [];
  for (const off of [0, 1800, 43200]) {
    const r = await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(a) }, hex(head - off)]);
    vals.push(r.ok ? (Number(BigInt(r.ok)) / 1e18).toFixed(4) : "ERR");
    await sleep(550);
  }
  const code = await rpc("eth_getCode", [a, "latest"]); await sleep(500);
  const nonce = await rpc("eth_getTransactionCount", [a, "latest"]); await sleep(500);
  console.log(`${a} now=${vals[0]} -1h=${vals[1]} -24h=${vals[2]} nonce=${nonce.ok?parseInt(nonce.ok,16):"-"} code=${(code.ok||"").slice(0,10)}`);
}
