const RPC = "https://base.gateway.tenderly.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) {
  for (let a = 1; a <= 6; a++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await r.json();
    if (!j.error) return j.result;
    if (j.error.code === -32005 || /rate limit/i.test(j.error.message || "")) { await sleep(1000 * 2 ** (a - 1)); continue; }
    throw new Error(JSON.stringify(j.error));
  }
  throw new Error("rate limited");
}
function decStr(hex) {
  if (!hex || hex === "0x") return null;
  const body = hex.slice(2);
  if (body.length < 128) return null;
  const len = parseInt(body.slice(64, 128), 16);
  const data = body.slice(128, 128 + len * 2);
  let s = "";
  for (let i = 0; i < data.length; i += 2) s += String.fromCharCode(parseInt(data.substr(i, 2), 16));
  return s;
}
function decUint(hex) { return hex && hex !== "0x" ? BigInt(hex).toString() : null; }

const WHO = {
  A_0ae9: "0x0ae95bd71d64e1d24d67f3cc293fb75f826c4a7b",
  B_5cbf: "0x5cbf5dfaa5336ce0456e24217e7911365100879a",
  C_d4c4: "0xd4c450ace519d33beaddf24e4c7e197f5d9c9409",
};
const out = {};
for (const [k, a] of Object.entries(WHO)) {
  const e = { address: a };
  for (const [pk, sel] of Object.entries({ name: "0x06fdde03", symbol: "0x95d89b41" })) {
    try { e[pk] = decStr(await rpc("eth_call", [{ to: a, data: sel }, "latest"])); } catch (err) { e[pk] = null; }
    await sleep(80);
  }
  for (const [pk, sel] of Object.entries({ decimals: "0x313ce567", totalSupply: "0x18160ddd", periodFinish: "0xebe2b12b", rewardRate: "0x7b0a47ee" })) {
    try { e[pk] = decUint(await rpc("eth_call", [{ to: a, data: sel }, "latest"])); } catch (err) { e[pk] = null; }
    await sleep(80);
  }
  out[k] = e;
  await sleep(150);
}
console.log(JSON.stringify(out, null, 2));
