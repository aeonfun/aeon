#!/usr/bin/env node
// Finalize the data JSON: fill in transition notes + watch entries from authored prose.
import fs from "node:fs";

const root = "/home/runner/work/aeon/aeon";
const data = JSON.parse(fs.readFileSync(`${root}/.outputs/_perps_scan_pre.json`, "utf8"));

const notes = {
  "LAB":  "First appearance, +47.07% on funding -0.0360%/8h and vol 4.79x. Taker buy 51.98% sits one basis point under the 52% breakout gate. See WATCH.",
  "INJ":  "First appearance, +17.97% on OI +29.25% with funding -0.0346%/8h. Taker buy 48.71% and vol 1.95x both block CATALYST-BREAKOUT. See WATCH.",
  "HEI":  "First appearance, a +103.21% parabolic on OI +652% with vol 71x. pct_4h prints -15.42% inside the daily candle — the move already cracked. See WATCH.",
  "ID":   "First appearance at +37.50% with funding -0.7448%/8h and basis +3.6468, the deepest structural extreme on the board. Taker buy 49.66% blocks the breakout gate. See WATCH.",
  "TAO":  "First appearance, -5.03% on OI -2.57% with funding nearly flat. Misses CAPITULATION on the tier-2 -10% drawdown gate by half.",
  "HBAR": "First appearance, +2.01% inside a 16.96% range with OI flat. No directional thesis prints.",
};
for (const ch of data.regime_changes) {
  if (notes[ch.asset]) ch.note = notes[ch.asset];
}

data.watch = [
  {
    asset: "XLM",
    metrics_line: "+17.62% 24h, +66.99% 7d, OI +13.54% 24h on OI +234.62% 7d, funding -0.0007%/8h (7d avg +0.0013%, delta -0.0019%), taker buy 50.81%, vol 3.99x, liq $6.4M vs 7d p75 $2.0M, short liqs $4.5M vs p75 $1.3M, top L/S 0.73 (Δ -0.39 7d), basis +0.2004, pct_4h +10.00%, range 77.80%",
    transition_read: "XLM extends day-1 +28% into day-2 +17.62% with pct_4h still climbing +10.00%. The move keeps happening through the close. Top traders sit net short at 0.73 with delta -0.39 over 7d, so each extension squeezes them harder. CASH-AND-CARRY fires on basis +0.2004 and funding flat — institutional arb flow stacks on top of the squeeze fuel. CATALYST-BREAKOUT confirms on a single taker-buy print above 52%. The setup invalidates if pct_4h flips negative as OI rolls."
  },
  {
    asset: "ALLO",
    metrics_line: "+53.28% 24h, +177.07% 7d, OI +100.07% 24h on OI +972.57% 7d, funding +0.0035%/8h (7d avg -0.0004%, delta +0.0039%), taker buy 51.16%, vol 34.98x, liq $5.6M vs 7d p75 $345K, short liqs $3.8M vs p75 $265K, top L/S 0.99 (Δ -0.29 7d), basis +0.1008, pct_4h -3.47%, range 327.56%",
    transition_read: "ALLO extends day-1 +66% into day-2 +53.28% but pct_4h flipped negative at -3.47%, the first crack in the leverage build. Taker buy stalls at 51.16%. Buying never crossed the spread on day-1 either. CATALYST-BREAKOUT confirms only if taker clears 52% on a fresh leg up. The OI +972% 7d build invalidates through a flush if the day-2 momentum loss extends overnight."
  },
  {
    asset: "LAB",
    metrics_line: "+47.07% 24h, +38.63% 7d, OI +52.08% 24h on OI +31.88% 7d, funding -0.0360%/8h (7d avg +0.0082%, delta -0.0442%), taker buy 51.98%, vol 4.79x, liq $2.0M vs 7d p75 $458K, short liqs $1.5M vs p75 $252K, top L/S 1.15 (Δ -0.04 7d), basis —, pct_4h +7.59%, range 87.30%",
    transition_read: "LAB prints the closest CATALYST-BREAKOUT miss in the universe. Taker buy 51.98% sits one basis point under the 52% gate. The +47% move runs on funding -0.0360%/8h, shorts paying longs, with short liquidations 5.9x weekly p75. pct_4h +7.59% confirms the move keeps building into the close. CATALYST-BREAKOUT confirms on a single taker print above 52%. The setup invalidates through an OI flush if shorts cover and longs unwind together."
  },
  {
    asset: "HEI",
    metrics_line: "+103.21% 24h, +72.84% 7d, OI +652.49% 24h on OI +643.97% 7d, funding -0.0018%/8h (7d avg -0.0150%, delta +0.0132%), taker buy 50.72%, vol 71.33x, liq $1.1M vs 7d p75 $25K, short liqs $891K vs p75 $4K, top L/S 0.99 (Δ -3.07 7d), basis +0.0691, pct_4h -15.42%, range 168.27%",
    transition_read: "HEI ripped +103% on OI +652% with vol 71x — the fresh-listing parabolic shape. pct_4h prints -15.42% inside that same daily candle, so the leverage cascade already started. Top L/S collapsed -3.07 in 7d to 0.99, the print of smart money flushed flat through the move. Short liquidations $891K against $4K weekly p75 (218x) confirm forced cover drove most of the rip, not absorbed accumulation. Treat the +103% print as fresh-listing discharge, not a directional thesis."
  },
  {
    asset: "ID",
    metrics_line: "+37.50% 24h, +20.32% 7d, OI +510.21% 24h on OI +331.45% 7d, funding -0.7448%/8h (7d avg -0.1507%, delta -0.5941%), taker buy 49.66%, vol 62.59x, liq $940K vs 7d p75 $41K, short liqs $596K vs p75 $331, top L/S 1.03 (Δ -0.70 7d), basis +3.6468, pct_4h +2.64%, range 57.36%",
    transition_read: "ID enters at +37% with funding -0.7448%/8h, the deepest negative print in the universe by an order of magnitude. Basis +3.6468 pairs with OI +510% to mark a structural extreme. Shorts pay 0.74% every eight hours to stay short, and the regime cannot hold longer than days. Resolution arrives through either short capitulation that drives a vertical leg or long unwind that gives back the +37%. Taker buy 49.66% offers no directional tell yet."
  },
  {
    asset: "INJ",
    metrics_line: "+17.97% 24h, +24.58% 7d, OI +29.25% 24h on OI +31.41% 7d, funding -0.0346%/8h (7d avg -0.0134%, delta -0.0211%), taker buy 48.71%, vol 1.95x, liq $1.3M vs 7d p75 $597K, short liqs $840K vs p75 $173K, top L/S 0.90 (Δ -0.31 7d), basis +0.0621, pct_4h +0.99%, range 41.92%",
    transition_read: "INJ pushed +18% on OI +29.25% with funding -0.0346%/8h — longs piling in while shorts pay them. The shape reads fresh longside accumulation, not a breakout. Taker buy 48.71% blocks CATALYST-BREAKOUT by three points, and vol 1.95x sits one tick under the 2.0x trigger. The directional bid extends if taker crosses 52% with vol expansion. The setup invalidates if funding climbs back toward zero as the move stalls."
  }
];

fs.writeFileSync(`${root}/.outputs/perps-scan.data.json`, JSON.stringify(data, null, 2));
console.log("Wrote .outputs/perps-scan.data.json");
