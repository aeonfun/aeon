const { execFileSync } = require('child_process');
const msg = `*Paper Pick — 2026-05-03 (PhD-prep slot)*

"TradeFM: A Generative Foundation Model for Trade-flow and Market Microstructure" — Kawawa-Beaudan / Sood / Papasotiriou / Borrajo / Veloso (JPMorgan AI Research) · ↑2 · Feb 2026
524M-param Transformer trained on billions of order-flow events across >9K equities; scale-invariant tokenization that eliminates asset-specific calibration is the architectural primitive CalibrationGap is missing for cross-market PM ingestion. Veloso byline = Stanford-tier citation; 2-3x lower distributional error than Compound Hawkes, zero-shot to APAC. Pairs with the operator's "ingest resolution text not titles" thesis as the microstructure-side complement.
[Read](https://arxiv.org/abs/2602.23784) | [PDF](https://arxiv.org/pdf/2602.23784)`;
execFileSync('./notify', [msg], { stdio: 'inherit' });
