const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";

const WALLETS = {
  escrow: "0xA85A38796B951CE87B378538b32B3E6Ee3C4C373",
  newmoney_7702: "0x3fd516041851011f38a0e9367b9e67e2eefd9a96",
  newmoney_837: "0x1184de98c71b565a7bc8313d89d74322c3df7f3b",
  mint_recipient: "0xd8f8e00e9d9ab9600a910f133f8959737e143e84",
};

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const bal = async (addr) => {
  const res = await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(addr) }, "latest"]);
  return Number(BigInt(res)) / 1e18;
};

const out = { head: parseInt(await rpc("eth_blockNumber", []), 16), wallets: {} };
for (const [name, addr] of Object.entries(WALLETS)) {
  try {
    const [b, nonce] = await Promise.all([
      bal(addr),
      rpc("eth_getTransactionCount", [addr, "latest"]),
    ]);
    out.wallets[name] = {
      address: addr,
      deus: b,
      nonce: parseInt(nonce, 16),
    };
  } catch (e) {
    out.wallets[name] = { address: addr, error: String(e.message).slice(0, 200) };
  }
}
const ts = await rpc("eth_call", [{ to: DEUS, data: "0x18160ddd" }, "latest"]);
out.total_supply = Number(BigInt(ts)) / 1e18;

console.log(JSON.stringify(out, null, 2));
