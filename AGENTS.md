<!-- AUTO-GENERATED from STRATEGY.md by scripts/gen-agents-md.js. Do not edit by hand.
     Grok (the grok harness) loads BOTH this file and CLAUDE.md as standing
     instructions and reads CLAUDE.md natively, so the full operating manual lives
     in CLAUDE.md — NOT duplicated here. This file carries only STRATEGY.md, which
     CLAUDE.md delivers to Claude Code via the `@STRATEGY.md` import that grok does
     not expand. Edit STRATEGY.md and re-run the generator to update it. -->

# Strategy (Grok harness)

Grok already loads Aeon's full operating manual from `CLAUDE.md` (how Aeon works,
memory, tools, capability mode, security, output). This file adds only the
operator's strategy below — the north-star `CLAUDE.md` references as `@STRATEGY.md`,
which grok does not expand. Read it at the start of every task and let it break
ties; absorb it, don't quote it.

# Strategy

Aeon's north-star. Every skill reads this — it's imported into `CLAUDE.md`, so it
sits in context on **every** run. Skills should align their output to it: what to
work on, what to prioritise, what to flag, what to skip.

Keep it short (it costs tokens each run): one north-star, 3–5 priorities, the
constraints. Replace the defaults below with your own.

> **Status:** unconfigured defaults. Until you tailor this file, skills operate
> with general best judgment and no specific bias. Remove this line once it's yours.

## North-star metric

The single outcome everything should move toward.
*e.g. "weekly active users of my app", "MRR", "reach of my research".*

**Default:** sustainable, compounding progress on the operator's active projects.

## Priorities

The few things that matter most right now, most important first.

1. Correct, verifiable work over work that merely looks finished.
2. Depth on the operator's core projects over broad, shallow coverage.
3. Surface signal early — don't sit on something that needs a decision.

*Replace with your own; cap at ~5.*

## Audience

Who the output is for, and their level.
*e.g. "technical founders on X", "my internal team", "just me".*

**Default:** the operator — assume technical and time-constrained.

## Hard constraints

Lines never to cross.

- Never publish secrets, private data, or unverified claims as fact.
- Stay within any configured spend and rate limits.

*Add your own — budget caps, tone, topics to avoid, compliance limits.*

## Optimize for / avoid

- **Optimize for:** signal, correctness, and the priorities above.
- **Avoid:** filler, hype, busywork, anything off-strategy.
