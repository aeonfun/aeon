const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const WHO = "0x5a46519659e3557112b90a8becb891873fe17406";

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

const out = { address: WHO };
out.code = (await rpc("eth_getCode", [WHO, "latest"])).slice(0, 20);
out.nonce = parseInt(await rpc("eth_getTransactionCount", [WHO, "latest"]), 16);
out.eth = Number(BigInt(await rpc("eth_getBalance", [WHO, "latest"]))) / 1e18;
out.deus = Number(BigInt(await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(WHO).slice(2) }, "latest"]))) / 1e18;

// the staking tx
const tx = await rpc("eth_getTransactionByHash", ["0xf126500c20ecbcc02626c6a4de701ee0cac41cbae29f419c2c6bfcb1cc9dab24"]);
out.tx = { from: tx.from, to: tx.to, value: Number(BigInt(tx.value)) / 1e18, nonce: parseInt(tx.nonce, 16) };
const rc = await rpc("eth_getTransactionReceipt", ["0xf126500c20ecbcc02626c6a4de701ee0cac41cbae29f419c2c6bfcb1cc9dab24"]);
out.tx.status = rc.status;
out.tx.log_count = rc.logs.length;
out.tx.emitters = [...new Set(rc.logs.map((l) => l.address))];

console.log(JSON.stringify(out, null, 2));
