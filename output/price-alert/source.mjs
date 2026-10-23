const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const SRC = "0xcd920c78f0dc6d6d9d6b9d9116e93fdf7f7a343a";

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

const out = { address: SRC };
out.code_len = (await rpc("eth_getCode", [SRC, "latest"])).length;
out.code = (await rpc("eth_getCode", [SRC, "latest"])).slice(0, 30);
out.nonce = parseInt(await rpc("eth_getTransactionCount", [SRC, "latest"]), 16);
out.eth = Number(BigInt(await rpc("eth_getBalance", [SRC, "latest"]))) / 1e18;
out.deus = Number(BigInt(await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(SRC).slice(2) }, "latest"]))) / 1e18;

const tx = await rpc("eth_getTransactionByHash", ["0x8e90f286541f7623ab3cfb13b1eaf76908bb0a4a7aa61f78f71c47f20685448b"]);
out.tx = { from: tx.from, to: tx.to, nonce: parseInt(tx.nonce, 16) };
const rc = await rpc("eth_getTransactionReceipt", ["0x8e90f286541f7623ab3cfb13b1eaf76908bb0a4a7aa61f78f71c47f20685448b"]);
out.tx.emitters = [...new Set(rc.logs.map((l) => l.address))];
out.tx.logs = rc.logs.map((l) => ({ addr: l.address, topic0: l.topics[0], topic2: l.topics[2] || null, data_len: l.data.length }));

console.log(JSON.stringify(out, null, 2));
