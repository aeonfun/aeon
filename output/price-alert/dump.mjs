const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa";
const TX = "0xe2edb1b0e96e9a2d336b80b931f172fc21ee5c7281068dd9ddc3c1d7b716e9ad";
const SWAP = "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) {
  for (let a = 1; a <= 6; a++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await r.json();
    if (!j.error) return j.result;
    await sleep(1000 * 2 ** (a - 1));
  }
  throw new Error("rate limited");
}
const pad = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

const rc = await rpc("eth_getTransactionReceipt", [TX]);
const blkNum = parseInt(rc.blockNumber, 16);
const blk = await rpc("eth_getBlockByNumber", [rc.blockNumber, false]);
const ts = parseInt(blk.timestamp, 16);

// pool token balances before/after to derive price move
const before = "0x" + (blkNum - 1).toString(16);
const after = rc.blockNumber;
const q = async (blkRef) => ({
  deus: Number(BigInt(await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(POOL).slice(2) }, blkRef]))) / 1e18,
});

const swapLogs = rc.logs.filter((l) => l.topics[0] === SWAP);
console.log(JSON.stringify({
  tx: TX,
  block: blkNum,
  ts: new Date(ts * 1000).toISOString(),
  status: rc.status,
  from: rc.from,
  to: rc.to,
  gas_used: parseInt(rc.gasUsed, 16),
  emitters: [...new Set(rc.logs.map((l) => l.address))],
  swap_event: swapLogs.map((l) => ({
    pool: l.address,
    // Aerodrome Slipstream Swap: 3 topics, 4 data words
    sender: "0x" + l.topics[1].slice(26),
    recipient: "0x" + l.topics[2].slice(26),
    amount0: BigInt("0x" + l.data.slice(2, 66)).toString(),
    amount1: BigInt("0x" + l.data.slice(66, 130)).toString(),
    sqrtPriceX96: BigInt("0x" + l.data.slice(130, 194)).toString(),
    liquidity: BigInt("0x" + l.data.slice(194, 258)).toString(),
  })),
  transfers: rc.logs.filter((l) => l.address.toLowerCase() === DEUS.toLowerCase()).map((l) => ({
    from: "0x" + l.topics[1].slice(26),
    to: "0x" + l.topics[2].slice(26),
    deus: Number(BigInt(l.data)) / 1e18,
  })),
}, null, 2));
