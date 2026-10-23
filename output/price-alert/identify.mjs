const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const A = "0x0ae95bd71d64e1d24d67f3cc293fb75f826c4a7b";
const B = "0x5cbf5dfaa5336ce0456e24217e7911365100879a";
const C = "0xd4c450ace519d33beaddf24e4c7e197f5d9c9409";
const D = "0x639c4aeeb6976c43b69e0cf86bf3b10b777b8da8";
const ROUTER = "0xcd920c78f0dc6d6d9d6b9d9116e93fdf7f7a343a";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) {
  for (let a = 1; a <= 6; a++) {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const j = await r.json();
    if (!j.error) return j.result;
    if (j.error.code === -32005 || /rate limit/i.test(j.error.message || "")) { await sleep(1000 * 2 ** (a - 1)); continue; }
    throw new Error(JSON.stringify(j.error));
  }
  throw new Error("rate limited out");
}
const pad = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

const out = {};
for (const [k, a] of Object.entries({ A_0ae9: A, B_5cbf: B, C_d4c4: C, D_639c: D, ROUTER })) {
  const code = await rpc("eth_getCode", [a, "latest"]);
  const ent = { address: a, code_bytes: (code.length - 2) / 2 };
  if (code !== "0x") {
    // probe common ERC4626 / staking / token selectors
    const probes = {
      name: "0x06fdde03", symbol: "0x95d89b41", decimals: "0x313ce567",
      totalSupply: "0x18160ddd", asset: "0x38d52e0f", totalAssets: "0x01e1d114",
      periodFinish: "0xebe2b12b", rewardRate: "0x7b0a47ee", owner: "0x8da5cb5b",
    };
    for (const [pk, sel] of Object.entries(probes)) {
      try {
        const r = await rpc("eth_call", [{ to: a, data: sel }, "latest"]);
        if (r && r !== "0x") ent[pk] = r.length > 100 ? r.slice(0, 90) + "..." : r;
      } catch (e) { /* not implemented */ }
      await sleep(60);
    }
  }
  out[k] = ent;
  await sleep(120);
}
console.log(JSON.stringify(out, null, 2));
