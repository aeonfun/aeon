#!/usr/bin/env bash
# Smoke test for the v4.1 perps-brief postprocess pipeline.
#
# Exercises three scenarios in sequence and prints the rendered output
# + ledger summary for each:
#
#   1. HEAVY DAY  — 2 current (1 RIDE, 1 CLOSE), 2 new positions
#                   (one of them auto-flips a current SHORT to LONG),
#                   3 watchlist (1 kept, 1 dropped, 1 promoted, 2 new-added)
#   2. SKIP DAY   — 1 current (RIDE), 0 new, 1 watchlist
#   3. COLD START — 0 current, 1 new, 0 watchlist
#
# Restores empty ledger after each scenario.
#
# Usage: bash scripts/test-perps-brief-v4-pipeline.sh

set -euo pipefail

cd "$(dirname "$0")/.."

LEDGER="memory/topics/state/active-setups.json"
DATA=".outputs/perps-brief.data.json"
MD=".outputs/perps-brief.md"
BACKUP_DIR="memory/topics/state/snapshots"

EMPTY_LEDGER='{
  "schema_version": "v4.1",
  "last_updated": null,
  "open": [],
  "watchlist": [],
  "closed": []
}'

reset_ledger() {
  mkdir -p "$(dirname "$LEDGER")"
  echo "$EMPTY_LEDGER" > "$LEDGER"
  rm -f "$DATA" "$MD"
  rm -rf "$BACKUP_DIR"
}

run_scenario() {
  local name="$1"
  local ledger_seed="$2"
  local data_payload="$3"

  echo
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  SCENARIO: $name"
  echo "═══════════════════════════════════════════════════════════════════"

  mkdir -p "$(dirname "$LEDGER")"
  echo "$ledger_seed" > "$LEDGER"
  mkdir -p .outputs
  echo "$data_payload" > "$DATA"

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
  echo "─── rendered brief ($MD) ───"
  cat "$MD"

  echo
  echo "─── final ledger summary ───"
  python3 - <<'PY'
import json
from pathlib import Path
d = json.loads(Path("memory/topics/state/active-setups.json").read_text())
print(f"open={len(d['open'])} watchlist={len(d['watchlist'])} closed={len(d['closed'])}")
print("OPEN:     ", [(e['id'], e.get('mae_pct'), e.get('mfe_pct')) for e in d['open']])
print("WATCHLIST:", [e['id'] for e in d['watchlist']])
print("CLOSED:   ", [(e['id'], e.get('outcome'), e.get('return_pct'), e.get('auto_flipped')) for e in d['closed']])
PY
}

# ═══════════════════════════════════════════════════════════════════
# SCENARIO 1 — HEAVY DAY
# ═══════════════════════════════════════════════════════════════════
#
# Seed ledger:
#   open[]:
#     - HYPE  LONG  fired 2026-05-18 → today's eval = RIDE
#     - FARTCOIN SHORT fired 2026-05-19 → auto-flip to LONG today
#                 (today's perps regime says SHORT is wrong, LONG fires)
#                 close as auto_flipped
#     - TAO   LONG  fired 2026-05-19 → today's eval = CLOSE (horizon hit)
#   watchlist[]:
#     - SOL    LONG  pending → trigger fired today → PROMOTE
#     - ARB    LONG  pending → still good → KEEP
#     - DOGE   SHORT pending → thesis broken → DROP

HEAVY_LEDGER='{
  "schema_version": "v4.1",
  "last_updated": "2026-05-21T04:25:00Z",
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
      "mae_pct": -1.5,
      "mfe_pct": 8.2,
      "mae_date": "2026-05-19",
      "mfe_date": "2026-05-21",
      "invalidation_breached": false,
      "watchlist_provenance": null,
      "evaluations": [
        {"date": "2026-05-19", "call": "RIDE", "price_at_eval": 28.10, "note": "minor dip, thesis intact"},
        {"date": "2026-05-20", "call": "RIDE", "price_at_eval": 29.50, "note": "structure building"},
        {"date": "2026-05-21", "call": "RIDE", "price_at_eval": 30.70, "note": "MFE updated"}
      ]
    },
    {
      "id": "FARTCOIN-2026-05-19-001",
      "asset": "FARTCOIN",
      "direction": "SHORT",
      "fired_date": "2026-05-19",
      "fired_price": 0.6800,
      "fired_btc_price": 94500.0,
      "fired_eth_price": 3475.0,
      "entry_zone": "market",
      "invalidation": "close above 0.72",
      "horizon": "3d",
      "thesis": "DISTRIBUTION + crowded long",
      "confluence_fired": ["quant_regime_aligned", "pattern_tag_supports"],
      "confluence_missing": ["both_tag", "narrative_phase_aligned"],
      "named_risks": ["meme squeeze risk"],
      "mae_pct": -3.1,
      "mfe_pct": 2.4,
      "mae_date": "2026-05-21",
      "mfe_date": "2026-05-19",
      "invalidation_breached": false,
      "watchlist_provenance": null,
      "evaluations": [
        {"date": "2026-05-20", "call": "RIDE", "price_at_eval": 0.7000, "note": "fading slow"},
        {"date": "2026-05-21", "call": "RIDE", "price_at_eval": 0.7010, "note": "underwater but holding"}
      ]
    },
    {
      "id": "TAO-2026-05-19-001",
      "asset": "TAO",
      "direction": "LONG",
      "fired_date": "2026-05-19",
      "fired_price": 480.0,
      "fired_btc_price": 94500.0,
      "fired_eth_price": 3475.0,
      "entry_zone": "market",
      "invalidation": "close below 460",
      "horizon": "3d",
      "thesis": "CATALYST-BREAKOUT FRESH",
      "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned"],
      "confluence_missing": ["both_tag"],
      "named_risks": ["AI sector could fade"],
      "mae_pct": -0.5,
      "mfe_pct": 9.4,
      "mae_date": "2026-05-19",
      "mfe_date": "2026-05-21",
      "invalidation_breached": false,
      "watchlist_provenance": null,
      "evaluations": [
        {"date": "2026-05-20", "call": "RIDE", "price_at_eval": 510.0, "note": "trending well"},
        {"date": "2026-05-21", "call": "RIDE", "price_at_eval": 525.0, "note": "momentum strong"}
      ]
    }
  ],
  "watchlist": [
    {
      "id": "SOL-watchlist-2026-05-20-001",
      "asset": "SOL",
      "direction": "LONG",
      "first_seen_date": "2026-05-20",
      "trigger": "close above 158 with vol >1.5x 7d avg",
      "invalidation": "close below 148",
      "horizon": "7d",
      "thesis": "COMPRESSION pending breakout",
      "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag"],
      "named_risks": ["BTC.D rolling"]
    },
    {
      "id": "ARB-watchlist-2026-05-20-001",
      "asset": "ARB",
      "direction": "LONG",
      "first_seen_date": "2026-05-20",
      "trigger": "close above 1.20",
      "invalidation": "close below 1.05",
      "horizon": "3d",
      "thesis": "early discovery",
      "confluence_fired": ["narrative_phase_aligned"],
      "named_risks": ["weak quant signal"]
    },
    {
      "id": "DOGE-watchlist-2026-05-20-001",
      "asset": "DOGE",
      "direction": "SHORT",
      "first_seen_date": "2026-05-20",
      "trigger": "funding extreme >+0.12%/8h",
      "invalidation": "close above 0.20",
      "horizon": "3d",
      "thesis": "DISTRIBUTION setup",
      "confluence_fired": ["quant_regime_aligned"],
      "named_risks": ["meme squeeze risk"]
    }
  ],
  "closed": []
}'

HEAVY_DATA='{
  "schema_version": "v4.1",
  "date": "2026-05-22",
  "qualifier": null,
  "market_sentiment": {
    "paragraphs": [
      "BTC funding warm at +0.07%/8h avg. OI +6% 24h, basis +0.3%. Majors absorbing leverage on the bid.",
      "Alt funding neutral. Memes hot, three of top five funding extremes. Retail crowded there, not majors."
    ],
    "bias_line": "Bias · long majors with structure, fade extreme funding on memes."
  },
  "current_positions": [
    {
      "id": "HYPE-2026-05-18-001",
      "ticker": "HYPE",
      "direction": "LONG",
      "fired_date": "2026-05-18",
      "fired_price": 28.40,
      "horizon": "7d",
      "day_of": "4/7",
      "call": "RIDE",
      "thesis_note": "ACCUMULATION continues, OI +21% 7d, narrative still RISING",
      "invalidation": "close below 26.00",
      "watch": "funding warming +0.04%/8h, up from +0.02%",
      "mae_pct": -1.5,
      "mae_day_of": "1",
      "mfe_pct": 12.3,
      "mfe_day_of": "4",
      "now_pct": 10.6
    },
    {
      "id": "FARTCOIN-2026-05-19-001",
      "ticker": "FARTCOIN",
      "direction": "SHORT",
      "fired_date": "2026-05-19",
      "fired_price": 0.6800,
      "horizon": "3d",
      "day_of": "3/3",
      "call": "CLOSE",
      "thesis_note": "regime flipped to ACCUMULATION today, opposite-direction entry firing",
      "invalidation": "close above 0.72",
      "return_pct": -3.5,
      "return_vs_btc_pct": -4.8,
      "return_vs_eth_pct": -3.9,
      "outcome": "LOSS",
      "mae_pct": -3.5,
      "mfe_pct": 2.4,
      "auto_flipped": true
    },
    {
      "id": "TAO-2026-05-19-001",
      "ticker": "TAO",
      "direction": "LONG",
      "fired_date": "2026-05-19",
      "fired_price": 480.0,
      "horizon": "3d",
      "day_of": "3/3",
      "call": "CLOSE",
      "thesis_note": "horizon reached, momentum slowing, funding warming",
      "invalidation": "close below 460",
      "return_pct": 9.4,
      "return_vs_btc_pct": 7.1,
      "return_vs_eth_pct": 8.2,
      "outcome": "WIN",
      "mae_pct": -0.5,
      "mfe_pct": 11.2,
      "auto_flipped": false
    }
  ],
  "new_positions": [
    {
      "ticker": "FARTCOIN",
      "direction": "LONG",
      "horizon": "3d",
      "entry_zone": "market or 0.71",
      "invalidation": "close below 0.65",
      "thesis": "Regime flipped ACCUMULATION today, smart money positioning, funding flushed",
      "confluence_fired": ["quant_regime_aligned", "regime_transition", "pattern_tag_supports"],
      "risks": ["could be a fakeout if BTC.D rolls hard"]
    },
    {
      "ticker": "SOL",
      "direction": "LONG",
      "horizon": "7d",
      "entry_zone": "market",
      "invalidation": "close below 148",
      "thesis": "Trigger fired — close above 158 confirmed yesterday with vol 1.8x avg. CATALYST-BREAKOUT now active. AI sector tailwind via aixbt-pulse bridge.",
      "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag", "regime_transition", "cross_domain_bridge"],
      "risks": ["BTC.D rolling could front-run too aggressively"]
    }
  ],
  "watchlist": [
    {
      "ticker": "ARB",
      "direction": "LONG",
      "day_of_watchlist": 3,
      "trigger": "close above 1.20",
      "invalidation": "close below 1.05",
      "thesis": "Building base, narrative attention rising but quant not confirming",
      "confluence_fired": ["narrative_phase_aligned"]
    },
    {
      "ticker": "PEPE",
      "direction": "SHORT",
      "day_of_watchlist": 1,
      "trigger": "funding extreme >+0.15%/8h with top L/S >2.0",
      "invalidation": "close above last 7d high",
      "thesis": "DISTRIBUTION building but not yet at LONG-TRAP severity",
      "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned"]
    },
    {
      "ticker": "GRASS",
      "direction": "LONG",
      "day_of_watchlist": 1,
      "trigger": "hold above 4.20 with 24h vol >$300M",
      "invalidation": "close below 3.80",
      "thesis": "DePIN narrative co-leader. Breakout confirmation pending.",
      "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag"]
    }
  ],
  "ledger_ops": {
    "evaluations": [
      {"open_id": "HYPE-2026-05-18-001", "date": "2026-05-22", "call": "RIDE", "price_at_eval": 31.40, "todays_high": 31.80, "todays_low": 30.50, "invalidation_breached_today": false, "note": "thesis intact"},
      {"open_id": "FARTCOIN-2026-05-19-001", "date": "2026-05-22", "call": "CLOSE", "price_at_eval": 0.7040, "todays_high": 0.7100, "todays_low": 0.6900, "invalidation_breached_today": false, "note": "auto-flip exit"},
      {"open_id": "TAO-2026-05-19-001", "date": "2026-05-22", "call": "CLOSE", "price_at_eval": 525.0, "todays_high": 530.0, "todays_low": 520.0, "invalidation_breached_today": false, "note": "horizon reached"}
    ],
    "close": [
      {"open_id": "FARTCOIN-2026-05-19-001", "closed_price": 0.7040, "close_reason": "auto-flip to LONG entry", "return_pct": -3.5, "return_vs_btc_pct": -4.8, "return_vs_eth_pct": -3.9, "horizon_realized": "3d", "auto_flipped": true},
      {"open_id": "TAO-2026-05-19-001", "closed_price": 525.0, "close_reason": "horizon reached, momentum slowing", "return_pct": 9.4, "return_vs_btc_pct": 7.1, "return_vs_eth_pct": 8.2, "horizon_realized": "3d", "auto_flipped": false}
    ],
    "open_now": [
      {"ticker": "FARTCOIN", "direction": "LONG", "fired_price": 0.7040, "fired_btc_price": 95210.0, "fired_eth_price": 3510.0, "entry_zone": "market or 0.71", "invalidation": "close below 0.65", "horizon": "3d", "thesis": "Regime flipped ACCUMULATION today", "confluence_fired": ["quant_regime_aligned", "regime_transition", "pattern_tag_supports"], "confluence_missing": [], "named_risks": ["could be a fakeout if BTC.D rolls"], "watchlist_id_promoted": null},
      {"ticker": "SOL", "direction": "LONG", "fired_price": 159.50, "fired_btc_price": 95210.0, "fired_eth_price": 3510.0, "entry_zone": "market", "invalidation": "close below 148", "horizon": "7d", "thesis": "CATALYST-BREAKOUT confirmed", "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag", "regime_transition", "cross_domain_bridge"], "confluence_missing": [], "named_risks": ["BTC.D rolling"], "watchlist_id_promoted": "SOL-watchlist-2026-05-20-001"}
    ],
    "add_watchlist": [
      {"ticker": "PEPE", "direction": "SHORT", "trigger": "funding extreme >+0.15%/8h with top L/S >2.0", "invalidation": "close above last 7d high", "horizon": "3d", "thesis": "DISTRIBUTION building", "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned"], "named_risks": ["could squeeze before trigger"]},
      {"ticker": "GRASS", "direction": "LONG", "trigger": "hold above 4.20 with 24h vol >$300M", "invalidation": "close below 3.80", "horizon": "3d", "thesis": "DePIN co-leader", "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag"], "named_risks": ["narrative could rotate to AI"]}
    ],
    "keep_watchlist": ["ARB-watchlist-2026-05-20-001"]
  }
}'

run_scenario "HEAVY DAY" "$HEAVY_LEDGER" "$HEAVY_DATA"
reset_ledger

# ═══════════════════════════════════════════════════════════════════
# SCENARIO 2 — SKIP DAY (no new entries)
# ═══════════════════════════════════════════════════════════════════

SKIP_LEDGER='{
  "schema_version": "v4.1",
  "last_updated": "2026-05-21T04:25:00Z",
  "open": [
    {
      "id": "HYPE-2026-05-18-001",
      "asset": "HYPE",
      "direction": "LONG",
      "fired_date": "2026-05-18",
      "fired_price": 28.40,
      "fired_btc_price": 95000.0,
      "fired_eth_price": 3500.0,
      "entry_zone": null,
      "invalidation": "close below 26.00",
      "horizon": "7d",
      "thesis": "ACCUMULATION",
      "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned"],
      "confluence_missing": [],
      "named_risks": ["BTC.D rising"],
      "mae_pct": -1.5,
      "mfe_pct": 8.2,
      "mae_date": "2026-05-19",
      "mfe_date": "2026-05-21",
      "invalidation_breached": false,
      "watchlist_provenance": null,
      "evaluations": []
    }
  ],
  "watchlist": [
    {
      "id": "ARB-watchlist-2026-05-20-001",
      "asset": "ARB",
      "direction": "LONG",
      "first_seen_date": "2026-05-20",
      "trigger": "close above 1.20",
      "invalidation": "close below 1.05",
      "horizon": "3d",
      "thesis": "early discovery",
      "confluence_fired": ["narrative_phase_aligned"],
      "named_risks": ["weak quant signal"]
    }
  ],
  "closed": []
}'

SKIP_DATA='{
  "schema_version": "v4.1",
  "date": "2026-05-22",
  "qualifier": null,
  "market_sentiment": {
    "paragraphs": [
      "Quiet tape. BTC chopping in 2% range. Funding flat across the board.",
      "Alts mixed, no clear leader. F&G holds 28 Fear."
    ],
    "bias_line": "Bias · cash-patient, no confluence today."
  },
  "current_positions": [
    {
      "id": "HYPE-2026-05-18-001",
      "ticker": "HYPE",
      "direction": "LONG",
      "fired_date": "2026-05-18",
      "fired_price": 28.40,
      "horizon": "7d",
      "day_of": "4/7",
      "call": "RIDE",
      "thesis_note": "structure holding, no invalidation",
      "invalidation": "close below 26.00",
      "watch": "watch for breadth deterioration",
      "mae_pct": -1.5,
      "mae_day_of": "1",
      "mfe_pct": 8.2,
      "mfe_day_of": "3",
      "now_pct": 6.0
    }
  ],
  "new_positions": [],
  "watchlist": [
    {
      "ticker": "ARB",
      "direction": "LONG",
      "day_of_watchlist": 3,
      "trigger": "close above 1.20",
      "invalidation": "close below 1.05",
      "thesis": "still building base, no fresh catalyst",
      "confluence_fired": ["narrative_phase_aligned"]
    }
  ],
  "ledger_ops": {
    "evaluations": [
      {"open_id": "HYPE-2026-05-18-001", "date": "2026-05-22", "call": "RIDE", "price_at_eval": 30.10, "todays_high": 30.50, "todays_low": 29.80, "invalidation_breached_today": false, "note": "quiet day, thesis intact"}
    ],
    "close": [],
    "open_now": [],
    "add_watchlist": [],
    "keep_watchlist": ["ARB-watchlist-2026-05-20-001"]
  }
}'

run_scenario "SKIP DAY" "$SKIP_LEDGER" "$SKIP_DATA"
reset_ledger

# ═══════════════════════════════════════════════════════════════════
# SCENARIO 3 — COLD START (empty ledger, one new entry)
# ═══════════════════════════════════════════════════════════════════

COLD_LEDGER="$EMPTY_LEDGER"

COLD_DATA='{
  "schema_version": "v4.1",
  "date": "2026-05-22",
  "qualifier": null,
  "market_sentiment": {
    "paragraphs": [
      "Fresh week. BTC consolidating after last week breakout. Funding warm but not extreme.",
      "Sector rotation looking like AI leadership."
    ],
    "bias_line": "Bias · selective long entries in AI sector."
  },
  "current_positions": [],
  "new_positions": [
    {
      "ticker": "TAO",
      "direction": "LONG",
      "horizon": "7d",
      "entry_zone": "market",
      "invalidation": "close below 460",
      "thesis": "AI narrative leader, CATALYST-BREAKOUT FRESH, [BOTH] tag",
      "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned", "both_tag", "cross_domain_bridge"],
      "risks": ["AI sector could rotate to memes"]
    }
  ],
  "watchlist": [],
  "ledger_ops": {
    "evaluations": [],
    "close": [],
    "open_now": [
      {"ticker": "TAO", "direction": "LONG", "fired_price": 485.0, "fired_btc_price": 95210.0, "fired_eth_price": 3510.0, "entry_zone": "market", "invalidation": "close below 460", "horizon": "7d", "thesis": "AI narrative leader, CATALYST-BREAKOUT FRESH", "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned", "both_tag", "cross_domain_bridge"], "confluence_missing": [], "named_risks": ["AI sector could rotate to memes"], "watchlist_id_promoted": null}
    ],
    "add_watchlist": [],
    "keep_watchlist": []
  }
}'

run_scenario "COLD START" "$COLD_LEDGER" "$COLD_DATA"
reset_ledger

echo
echo "═══════════════════════════════════════════════════════════════════"
echo "  ALL SCENARIOS PASS"
echo "═══════════════════════════════════════════════════════════════════"
