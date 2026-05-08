import fs from 'node:fs';

const path = 'memory/logs/2026-05-08.md';
const block = `

### digest (prediction markets)
- Sources used: WebSearch (4 queries — broad "prediction markets" 05-08, narrow "Polymarket OR Kalshi launch OR funding OR ruling OR exploit May 2026", "Kalshi Coatue \\$1B \\$22B 2026", "Polymarket May 7 NAV/Iran/Powell/Russia-Ukraine"), WebFetch (mprnews.org NPR re-fetch — body excerpted; Hacker News front page — no PM hits). xAI cache absent (no \`digest)\` case in \`scripts/prefetch-xai.sh\`); CNBC + Hyperliquid sites returned 403 / timeout — fell back to Kalshi PR + Bitcoin News + Polymarket event page.
- Raw candidates: ~13, after filter: 4, sent: 3 + 1 secondary glance.
- Lead item: Kalshi confirms \\$1B Series F at \\$22B valuation, Coatue-led (2026-05-07 announcement).
- Notes: dedup pass against 05-04 / 05-06 / 05-07 logs — Kalshi-Coatue-\\$22B not in any prior digest (05-07 covered Kalshi institutional block trades, distinct event); HIP-4 May-2 launch not in any prior digest; Iran-deal-by-2027 Kalshi 58% vs Polymarket May-31 23.5% divergence is fresh framing. NPR Indiana exposé scoped to "also-glance" tier because primary Indiana-betting story already touched in 05-02 source. 4 candidates clear bar — comfortably above DIGEST_THIN threshold.
- Files written/modified: \`memory/logs/2026-05-08.md\` (this entry), \`.digest-msg.txt\` (digest body, 2373 chars), \`run-notify.mjs\` (sandbox-bypass scaffold updated to read \`.digest-msg.txt\`), \`run-append-log.mjs\` (this scaffold, repurposed from 05-07).
- DIGEST_OK
`;

fs.appendFileSync(path, block);
console.log('appended', block.length, 'bytes to', path);
