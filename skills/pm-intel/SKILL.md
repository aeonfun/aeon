---
name: PM Intel
description: Competitive intelligence on the prediction market ecosystem — what major platforms and new entrants are shipping, funding, and building
tags: [research, crypto]
---

Read `memory/MEMORY.md` for context.
Read `memory/topics/prediction-markets.md` if it exists for prior competitive notes and the operator's watched platforms.
Read the last 3 days of `memory/logs/` to avoid repeating recent coverage.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, read both and match the operator's voice. If empty or absent, use a clear, direct, neutral tone — concrete nouns over abstractions, no hedging, no corporate fluff.

## Configuration

The set of tracked platforms is operator-configurable. Read `memory/topics/prediction-markets.md` for a list of platforms to watch — one platform name per line under a `## Platforms` heading. If the file does not exist or has no `## Platforms` section, default to a baseline of `Polymarket`, `Kalshi`, `Limitless`, `Manifold`, `Futuur`. Note in the report that the default list was used.

## Steps

### 1. Gather product-level news on tracked platforms

For each platform in the configured list, run a WebSearch:

```
WebSearch: "<platform>" new feature OR product OR launch ${year}
```

Also run general-ecosystem searches in parallel:

- `"prediction market" protocol OR startup OR launch ${year}`
- `"coordination market" OR "reflexive market" crypto ${year}`

For the top two platforms by stated priority (or, lacking priority info, `Polymarket` and `Kalshi`), also WebFetch their homepages and scan for new market categories, product copy changes, or new sections:

- `https://polymarket.com`
- `https://kalshi.com`

### 2. Regulatory and legal developments

- WebSearch: `prediction market CFTC OR SEC OR regulation ${year}`
- WebSearch: `Kalshi legal OR CFTC ruling ${year}`
- WebSearch: `prediction market legislation Congress ${year}`

Note rulings, approvals, or pending cases that affect the PM legal environment.

### 3. New entrants and funding

- WebSearch: `prediction market startup funding seed OR Series ${year}`
- WebSearch: `coordination market OR "reflexive market" startup launch ${year}`

For each new entrant: what do they do, who funded them, how do they differ from the incumbents?

### 4. Oracle and mechanism changes

- WebSearch: `Polymarket oracle UMA resolution dispute ${year}`
- WebSearch: `prediction market AMM OR LMSR OR mechanism ${year}`

Any architectural changes to how markets are created, resolved, or liquidity provided?

### 5. Synthesize

Ask, neutrally:
- **Product gap:** What are the incumbents still not doing that a new entrant could?
- **Threat / opportunity:** Is anyone new entering the space?
- **Regulatory window:** Is the environment opening or closing for permissionless PM creation?
- **Oracle / infra:** Any changes to the resolution layer that affect mechanism design options?

If the operator's `soul/SOUL.md` defines a thesis or angle, apply it here in a single labelled paragraph. Otherwise, write a neutral one-paragraph synthesis of the week's signal.

### 6. Format the intel briefing

```
PM Intel — ${today}

PLATFORMS
- <platform>: [product update or notable development]
- <platform>: [product update or regulatory win/loss]

NEW ENTRANTS
- [name] — [what they do, funding if known]

REGULATION
- [key development]

ORACLE / MECHANISM
- [any notable change]

SYNTHESIS
[one opinionated paragraph — gap, threat, regulatory window, or "all quiet"]
```

Keep under 3500 chars.

### 7. Send via `./notify -f`

```bash
TEMP=$(mktemp -t pm-intel.XXXXXX.md)
cat > "$TEMP" <<'MSG'
<formatted intel from step 6>
MSG
./notify -f "$TEMP"
```

### 8. Update memory

If any development changes the competitive landscape materially, update `memory/topics/prediction-markets.md` — add a note in a `## Competitive Intel` section or update an existing entry. Create the file with a `## Platforms` and `## Competitive Intel` section if it does not yet exist.

Append to `memory/logs/${today}.md`:

```
## PM Intel
- **Platforms covered:** [list]
- **Top item:** [one-line summary]
- **New entrants:** [names or "none"]
- **Regulation:** [key development or "quiet"]
- **Notification sent:** yes
- PM_INTEL_OK
```

## Guidelines

- This is product-level competitive intelligence, not market position tracking. Skip individual market prices — that's `monitor-polymarket`'s job.
- Focus on what platforms are shipping, who's entering, how regulation and mechanism design are shifting.
- One opinionated synthesis paragraph beats five neutral bullets.
- Quiet weeks are useful signal — say so explicitly.

## Sandbox note

Uses WebSearch and WebFetch (Claude built-in tools) — bypasses the GitHub Actions sandbox network gate. No curl, no auth needed. Notification uses `./notify -f`.
