#!/usr/bin/env bash
# Smoke test for the v4 perps-brief postprocess pipeline.
#
# Builds a synthetic .outputs/perps-brief.data.json that exercises:
#   - open ledger entry + RIDE evaluation
#   - open ledger entry + SELL (now) close
#   - new setup mode=now → opens new ledger entry
#   - new setup mode=wait → adds to pending
#   - pending entry promoted to open via pending_id_promoted
#   - pending entry kept via keep_pending
#   - pending entry dropped (omitted from keep_pending)
#
# Runs render → snapshot → apply → validate and prints the resulting brief.
#
# Usage: bash scripts/test-perps-brief-v4-pipeline.sh
# The script restores the empty ledger after the run so the repo stays clean.

set -euo pipefail

cd "$(dirname "$0")/.."

LEDGER="memory/topics/state/active-setups.json"
DATA=".outputs/perps-brief.data.json"
MD=".outputs/perps-brief.md"
BACKUP_DIR="memory/topics/state/snapshots"

# --- Seed a ledger with a few rows so apply has something to mutate.
echo "[smoke] seeding ledger with open + pending fixtures"
mkdir -p "$(dirname "$LEDGER")"
cat > "$LEDGER" <<'EOF'
{
  "schema_version": "v4",
  "last_updated": "2026-05-19T04:25:00Z",
  "open": [
    {
      "id": "HYPE-2026-05-18-001",
      "asset": "HYPE",
      "direction": "LONG",
      "fired_date": "2026-05-18",
      "fired_price": 28.40,
      "fired_btc_price": 95000.0,
      "fired_eth_price": 3500.0,
      "entry_zone": "27.50-28.50",
      "invalidation": "close below 26.00",
      "horizon": "7d",
      "thesis": "ACCUMULATION continues, narrative RISING",
      "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned", "both_tag"],
      "confluence_missing": [],
      "named_risks": ["BTC.D rising could pressure alts"],
      "evaluations": []
    },
    {
      "id": "TAO-2026-05-17-001",
      "asset": "TAO",
      "direction": "LONG",
      "fired_date": "2026-05-17",
      "fired_price": 480.0,
      "fired_btc_price": 94000.0,
      "fired_eth_price": 3450.0,
      "entry_zone": "market",
      "invalidation": "close below 460",
      "horizon": "3d",
      "thesis": "CATALYST-BREAKOUT FRESH",
      "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned"],
      "confluence_missing": ["both_tag"],
      "named_risks": ["AI sector could fade"],
      "evaluations": []
    }
  ],
  "pending": [
    {
      "id": "SOL-pending-2026-05-19-001",
      "asset": "SOL",
      "direction": "LONG",
      "first_seen_date": "2026-05-19",
      "trigger": "close above 158 with vol >1.5x 7d avg",
      "invalidation": "close below 148",
      "horizon": "7d",
      "thesis": "COMPRESSION → CATALYST-BREAKOUT pending",
      "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag"],
      "named_risks": ["BTC.D rolling"]
    },
    {
      "id": "ARB-pending-2026-05-19-001",
      "asset": "ARB",
      "direction": "LONG",
      "first_seen_date": "2026-05-19",
      "trigger": "close above 1.20",
      "invalidation": "close below 1.05",
      "horizon": "3d",
      "thesis": "early discovery",
      "confluence_fired": ["narrative_phase_aligned"],
      "named_risks": ["weak quant signal"]
    },
    {
      "id": "DOGE-pending-2026-05-19-001",
      "asset": "DOGE",
      "direction": "SHORT",
      "first_seen_date": "2026-05-19",
      "trigger": "funding extreme >+0.12%/8h",
      "invalidation": "close above 0.20",
      "horizon": "3d",
      "thesis": "DISTRIBUTION setup",
      "confluence_fired": ["quant_regime_aligned"],
      "named_risks": ["meme squeeze risk"]
    }
  ],
  "closed": []
}
EOF

# --- Build a synthetic data.json
echo "[smoke] writing synthetic data.json"
mkdir -p .outputs
cat > "$DATA" <<'EOF'
{
  "schema_version": "v4",
  "date": "2026-05-20",
  "qualifier": null,
  "market_sentiment": {
    "paragraphs": [
      "BTC funding warm at +0.07%/8h avg. OI +6% 24h, basis +0.3%. Majors absorbing leverage on the bid.",
      "Alt funding neutral. Memes hot, three of top five funding extremes. Retail crowded there, not majors."
    ],
    "bias_line": "Bias · long majors with structure, fade extreme funding on meme tickers."
  },
  "open_positions": [
    {
      "id": "HYPE-2026-05-18-001",
      "ticker": "HYPE",
      "direction": "LONG",
      "fired_date": "2026-05-18",
      "fired_price": 28.40,
      "horizon": "7d",
      "day_of": "2/7",
      "call": "RIDE",
      "thesis_status": "intact",
      "thesis_note": "ACCUMULATION continues, OI +21% 7d, narrative still RISING",
      "invalidation": "close below 26.00",
      "watch": "funding warming +0.04%/8h, up from +0.02%",
      "evaluation_note": "thesis intact, no invalidation hit"
    },
    {
      "id": "TAO-2026-05-17-001",
      "ticker": "TAO",
      "direction": "LONG",
      "fired_date": "2026-05-17",
      "fired_price": 480.0,
      "horizon": "3d",
      "day_of": "3/3",
      "call": "SELL (now)",
      "thesis_status": "intact",
      "thesis_note": "horizon reached, +9.4% return, funding warming",
      "invalidation": "close below 460",
      "watch": null,
      "evaluation_note": "closing at horizon, take profits"
    }
  ],
  "new_setups": [
    {
      "ticker": "FARTCOIN",
      "direction": "SHORT",
      "mode": "now",
      "horizon": "3d",
      "entry_zone": "market or first bounce to $0.65",
      "trigger": null,
      "thesis": "DISTRIBUTION + LONG-TRAP. Funding +0.14%/8h, top L/S 2.4.",
      "invalidation": "close above $0.72",
      "confluence_fired": ["quant_regime_aligned", "pattern_tag_supports", "narrative_phase_aligned"],
      "confluence_missing": ["both_tag"],
      "risks": ["memes can squeeze irrespective of fundamentals"]
    },
    {
      "ticker": "SOL",
      "direction": "LONG",
      "mode": "now",
      "horizon": "7d",
      "entry_zone": "market",
      "trigger": null,
      "thesis": "Trigger fired — close above $158 confirmed yesterday. CATALYST-BREAKOUT now active.",
      "invalidation": "close below $148",
      "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag", "regime_transition"],
      "confluence_missing": [],
      "risks": ["BTC.D rolling could front-run"]
    },
    {
      "ticker": "PEPE",
      "direction": "SHORT",
      "mode": "wait",
      "horizon": "3d",
      "entry_zone": null,
      "trigger": "funding extreme >+0.15%/8h with top L/S >2.0",
      "thesis": "DISTRIBUTION building but not yet at LONG-TRAP severity",
      "invalidation": "close above last 7d high",
      "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned"],
      "confluence_missing": ["pattern_tag_supports"],
      "risks": ["could squeeze before trigger"]
    }
  ],
  "fade_note": null,
  "skip_day_best_near_miss": null,
  "ledger_ops": {
    "evaluations": [
      {"open_id": "HYPE-2026-05-18-001", "date": "2026-05-20", "call": "RIDE", "price_at_eval": 31.40, "note": "thesis intact, no invalidation hit"},
      {"open_id": "TAO-2026-05-17-001", "date": "2026-05-20", "call": "SELL (now)", "price_at_eval": 525.0, "note": "horizon reached"}
    ],
    "close": [
      {
        "open_id": "TAO-2026-05-17-001",
        "closed_price": 525.0,
        "close_reason": "SELL (now) — horizon reached, momentum slowing",
        "return_pct": 9.4,
        "return_vs_btc_pct": 7.1,
        "return_vs_eth_pct": 8.2,
        "outcome": "WIN",
        "horizon_realized": "3d"
      }
    ],
    "open_now": [
      {
        "ticker": "FARTCOIN",
        "direction": "SHORT",
        "fired_price": 0.6710,
        "fired_btc_price": 95210.0,
        "fired_eth_price": 3510.0,
        "entry_zone": "market or first bounce to $0.65",
        "invalidation": "close above $0.72",
        "horizon": "3d",
        "thesis": "DISTRIBUTION + LONG-TRAP",
        "confluence_fired": ["quant_regime_aligned", "pattern_tag_supports", "narrative_phase_aligned"],
        "confluence_missing": ["both_tag"],
        "named_risks": ["memes can squeeze"],
        "pending_id_promoted": null
      },
      {
        "ticker": "SOL",
        "direction": "LONG",
        "fired_price": 159.50,
        "fired_btc_price": 95210.0,
        "fired_eth_price": 3510.0,
        "entry_zone": "market",
        "invalidation": "close below $148",
        "horizon": "7d",
        "thesis": "CATALYST-BREAKOUT confirmed",
        "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag", "regime_transition"],
        "confluence_missing": [],
        "named_risks": ["BTC.D rolling"],
        "pending_id_promoted": "SOL-pending-2026-05-19-001"
      }
    ],
    "add_pending": [
      {
        "ticker": "PEPE",
        "direction": "SHORT",
        "trigger": "funding extreme >+0.15%/8h with top L/S >2.0",
        "invalidation": "close above last 7d high",
        "horizon": "3d",
        "thesis": "DISTRIBUTION building",
        "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned"],
        "named_risks": ["could squeeze before trigger"]
      }
    ],
    "keep_pending": ["ARB-pending-2026-05-19-001"]
  }
}
EOF

# DOGE-pending is intentionally omitted from keep_pending → should be dropped.
# SOL-pending is promoted → should be removed.
# ARB-pending is kept → should remain.
# PEPE-pending is just added → should appear new.

echo
echo "[smoke] step 1/4 — render"
python3 scripts/render-perps-brief.py

echo
echo "[smoke] step 2/4 — snapshot"
python3 - <<'PY'
import sys
sys.path.insert(0, "scripts")
from lib import ledger as L
print("snapshot:", L.snapshot())
PY

echo
echo "[smoke] step 3/4 — apply ledger ops"
python3 scripts/apply-ledger-ops.py

echo
echo "[smoke] step 4/4 — validate post-apply ledger"
( cd scripts && python3 -m lib.ledger "../$LEDGER" )

echo
echo "[smoke] ===== rendered brief ($MD) ====="
cat "$MD"
echo
echo "[smoke] ===== final ledger summary ====="
python3 - <<'PY'
import json
from pathlib import Path
d = json.loads(Path("memory/topics/state/active-setups.json").read_text())
print(f"open={len(d['open'])} | pending={len(d['pending'])} | closed={len(d['closed'])}")
print("OPEN IDs:    ", [e['id'] for e in d['open']])
print("PENDING IDs: ", [e['id'] for e in d['pending']])
print("CLOSED IDs:  ", [e['id'] for e in d['closed']])
print()
print(f"HYPE evaluations: {len(d['open'][0]['evaluations'])} | last call: {d['open'][0]['evaluations'][-1]['call']}")
PY

echo
echo "[smoke] cleaning up fixtures (resetting ledger to empty + removing snapshot + data.json + md)"
cat > "$LEDGER" <<'EOF'
{
  "schema_version": "v4",
  "last_updated": null,
  "open": [],
  "pending": [],
  "closed": []
}
EOF
rm -f "$DATA" "$MD"
rm -rf "$BACKUP_DIR"
echo "[smoke] PASS — pipeline end-to-end works"
