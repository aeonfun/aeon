const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";

const NONZERO = "0x0000000000000000000000000000000000000000";
const WHO = {
  router_cd92: "0xcd920c78f0dc6d6d9d6b9d9116e93fdf7f7a343a",
  src_a_0ae9: "0x0ae95bd71d64e1d24d67f3cc293fb75f826c4a7b",
  src_b_5cbf: "0x5cbf5dfaa5336ce0456e24217e7911365100879a",
  src_c_d4c4: "0xd4c450ace519d33beaddf24e4c7e197f5d9c9409",
  staker_5a46: "0x5a46519659e3557112b90a8becb891873fe17406",
};

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}
const pad = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

const out = { wallets: {} };
for (const [k, a] of Object.entries(WHO)) {
  const code = await rpc("eth_getCode", [a, "latest"]);
  const [nonce, ethHex, deusHex] = await Promise.all([
    rpc("eth_getTransactionCount", [a, "latest"]),
    rpc("eth_getBalance", [a, "latest"]),
    rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(a).slice(2) }, "latest"]),
  ]);
  out.wallets[k] = {
    address: a,
    eoa: code === "0x",
    code_prefix: code === "0x" ? null : code.slice(0, 12),
    nonce: parseInt(nonce, 16),
    eth: +(Number(BigInt(ethHex)) / 1e18).toFixed(6),
    deus: Number(BigInt(deusHex)) / 1e18,
  };
}

// staker's xDEUS NFT balance on 0x9c574b0f (emitter in the stake tx)
const XDEUS = "0x9c574b0f8526315b9defdf7539dd3d25b7ec7618";
try {
  const b = await rpc("eth_call", [{ to: XDEUS, data: "0x70a08231" + pad(WHO.staker_5a46).slice(2) }, "latest"]);
  out.staker_xdeus_nft = Number(BigInt(b));
} catch (e) { out.staker_xdeus_nft_err = String(e.message).slice(0, 120); }

console.log(JSON.stringify(out, null, 2));
