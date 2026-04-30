const { execFileSync } = require('child_process');
const msg = `*Daily Pick — 2026-04-30*

*Token: LUNC (Terra Luna Classic)*  HIGH  signal 9/10
Price: $0.0000727 (+3.4% 24h / +63.4% 7d) | mcap $0.40B | vol $92M (vol/mcap 0.23)
Score breakdown: [24h+1, 7d+1, cgtrend+2, v/mc>=0.20+3, RS vs BTC/ETH+2] = 9/10
Catalyst: 176M LUNC burned April 27 alone (LUNCMetrics) on top of cumulative 6.43% supply already destroyed; net exchange outflows + Cosmos SDK v0.53 upgrade nearby.
Risk: 60-88% in a month is late-cycle chase territory — LUNC has a long history of dead-cat bounces fading inside a week once burn-momentum coverage tapers.
Vs recent picks: not deduped (DOGE 04-29, RAY 04-28, PENGU/XCN 04-27, APE 04-25); same memecoin-revival rotation but LUNC has supply-side mechanics DOGE lacks.

*Market: "US x Iran permanent peace deal by May 31, 2026?"*  HIGH  edge ~13pp
Current: YES 18.5¢ / NO 81.5¢ | 24h vol $416k | resolves 2026-05-31
Fair YES: ~5% (inputs: Islamabad talks stalled, Iran's Apr-28 proposal "unlikely to be accepted" by Trump admin, US still blockading Iranian ports — Al Jazeera, NPR, CFR)
Thesis: ceasefire-extended-indefinitely is not a "permanent peace deal" — Trump's bar is ending nuclear/missile/proxy programs simultaneously, gap is too wide for 31 days. Buy NO at 81.5¢.
Risk: Trump pulls a surprise mediator-driven headline (Pakistan/Qatar/Oman); a partial deal labelled "permanent" by either side resolves YES on a technicality.

sources: cg=ok, dex=ok, poly=ok
not financial advice — pattern-matching only`;
console.log('msg length:', msg.length);
try {
  execFileSync('./notify', [msg], { cwd: '/home/runner/work/aeon/aeon', stdio: 'inherit' });
  console.log('notify OK');
} catch (e) {
  console.error('notify FAIL:', e.message);
  process.exit(1);
}
