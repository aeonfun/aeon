const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa";
const VIRTUAL = "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b";
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
const bal = async (tok, blk) => {
  try { return Number(BigInt(await rpc("eth_call", [{ to: tok, data: "0x70a08231" + pad(POOL).slice(2) }, blk]))) / 1e18; }
  catch { return null; }
};

const blkNum = 52963113;
const before = "0x" + (blkNum - 1).toString(16);
const after = "0x" + blkNum.toString(16);

const [dB, vB] = await Promise.all([bal(DEUS, before), bal(VIRTUAL, before)]);
const [dA, vA] = await Promise.all([bal(DEUS, after), bal(VIRTUAL, after)]);

// deepest pool is DEUS/VIRTUAL: price DEUS in VIRTUAL = vReserve / dReserve
const priceBefore = vB / dB;
const priceAfter = vA / dA;

// also compute sqrtPriceX96 implied price from the swap log
const sqrtP = 2411471431407235723544n;
const priceFromSqrt = (Number(sqrtP) / 2 ** 96) ** 2;

console.log(JSON.stringify({
  block: blkNum,
  pool_reserves: {
    before: { deus: dB, virtual: vB },
    after: { deus: dA, virtual: vA },
  },
  price_virtual_per_deus: { before: priceBefore, after: priceAfter, drop_pct: +((priceAfter - priceBefore) / priceBefore * 100).toFixed(3) },
  sqrtprice_implied: priceFromSqrt,
}, null, 2));
