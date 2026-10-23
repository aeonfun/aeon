const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(RPC, {
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
    } catch (e) {
      await sleep(1200 * (i + 1));
    }
  }
  return { err: "retries-exhausted" };
}

const targets = [
  ["0x3fd516041851011f38a0e9367b9e67e2eefd9a96", "new 18:38Z buyer"],
  ["0x999f938d97639e825dc963d375c69c78e5e03f38", "16:52Z $198 buyer"],
  ["0x09b383a627c3d35daf38cd77af0064c1848833c6", "incumbent whale"],
  ["0x6e831ebc833edb0160ba874ae934ca0981ac8ebb", "router 18:11Z"],
  ["0x49a782c2660e77dded753bb88ac57619298ad50e", "MM seller"],
];

for (const [a, label] of targets) {
  const bal = await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(a) }, "latest"]);
  await sleep(400);
  const nonce = await rpc("eth_getTransactionCount", [a, "latest"]);
  await sleep(400);
  const code = await rpc("eth_getCode", [a, "latest"]);
  await sleep(400);
  const eth = await rpc("eth_getBalance", [a, "latest"]);
  console.log(
    [label, a,
     "bal=" + (bal.ok ? (Number(BigInt(bal.ok)) / 1e18).toFixed(6) : "ERR:" + bal.err),
     "nonce=" + (nonce.ok ? parseInt(nonce.ok, 16) : "ERR"),
     "eth=" + (eth.ok ? (Number(BigInt(eth.ok)) / 1e18).toFixed(6) : "ERR"),
     "code=" + (code.ok ? code.ok.slice(0, 12) : "ERR")].join(" | ")
  );
}
