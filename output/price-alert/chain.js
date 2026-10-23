const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const ADDRS = [
  ["escrow", "0xA85A38796B951CE87B378538b32B3E6Ee3C4C373"],
  ["dir-1", "0x259f962e77262ee8d97cc6a112d0e0321323ea0d"],
  ["dir-2", "0xa2f42a10a8eb9089ac51108af68fa202bf2c3130"],
  ["new-0x3fd5", "0x3fd516041851011f38a0e9367b9e67e2eefd9a96"],
  ["new-0x999f", "0x999f938d97639e825dc963d375c69c78e5e03f38"],
  ["incumbent-0x09b3", "0x09b383a627c3d35daf38cd77af0064c1848833c6"],
  ["router-0x6e83", "0x6e831ebc833edb0160ba874ae934ca0981ac8ebb"],
  ["mm-0x49a7", "0x49a782c2660e77dded753bb88ac57619298ad50e"],
];

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) return { err: j.error.message };
  return { ok: j.result };
}

const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

const head = await rpc("eth_blockNumber", []);
console.log("head_block", parseInt(head.ok, 16), head.ok);

const supply = await rpc("eth_call", [{ to: DEUS, data: "0x18160ddd" }, "latest"]);
console.log("totalSupply", supply.ok ? (Number(BigInt(supply.ok)) / 1e18).toFixed(6) : supply.err);

for (const [label, a] of ADDRS) {
  const [bal, nonce, code, eth] = await Promise.all([
    rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(a) }, "latest"]),
    rpc("eth_getTransactionCount", [a, "latest"]),
    rpc("eth_getCode", [a, "latest"]),
    rpc("eth_getBalance", [a, "latest"]),
  ]);
  const b = bal.ok ? (Number(BigInt(bal.ok)) / 1e18).toFixed(6) : "ERR:" + bal.err;
  const e = eth.ok ? (Number(BigInt(eth.ok)) / 1e18).toFixed(6) : "ERR";
  console.log(
    [label, a, "bal=" + b, "nonce=" + (nonce.ok ? parseInt(nonce.ok, 16) : nonce.err),
     "eth=" + e, "code=" + (code.ok ? code.ok.slice(0, 10) : code.err)].join(" | ")
  );
}
