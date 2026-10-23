const RPC = "https://base.gateway.tenderly.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const TOKENS = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": ["USDC", 6],
  "0x940a319b75861014a220d9c6c144d108552b089b": ["DEUS", 18],
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": ["VIRTUAL", 18],
  "0x4200000000000000000000000000000000000006": ["WETH", 18],
};
const TARGET = "0x1184de98c71b565a7bc8313d89d74322c3df7f3b";

for (const [label, hash] of [
  ["18:11Z 0x1184", "0x2260508925dbd183e8e579cc20e78f219aaf7c878bd4afc61d5b9c3de300104b"],
  ["18:38Z 0x3fd5", "0xe89c0d6d07721e787659adad057b03fa0b9d0a1952cc7d437d5086143f9d0e95"],
]) {
  const rec = await rpc("eth_getTransactionReceipt", [hash]);
  console.log("\n=== " + label + " ===");
  let inUsd = 0, outDeus = 0;
  for (const l of rec.ok.logs) {
    const tok = TOKENS[l.address.toLowerCase()];
    if (!tok || l.topics.length !== 3 || !l.topics[0].startsWith("0xddf252ad")) continue;
    const [sym, dec] = tok;
    const amt = Number(BigInt(l.data)) / 10 ** dec;
    if (amt < 0.01 && sym !== "DEUS") continue;
    console.log(`  ${amt.toFixed(4)} ${sym} from=${"0x"+l.topics[1].slice(26)} to=${"0x"+l.topics[2].slice(26)}`);
  }
  await sleep(600);
}
