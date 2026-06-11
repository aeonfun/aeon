// Starter content for the Strategy tab. STRATEGY.md is the operator's north-star
// — it's imported into CLAUDE.md, so it rides along in *every* skill run. That
// means two things: keep it tight (it costs tokens each run), and make it
// specific (a vague strategy can't break a tie). The scaffold below mirrors the
// real STRATEGY.md sections; the archetypes show a filled, specific strategy for
// a common operator shape so you start from something opinionated, not blank.

export const STRATEGY_SCAFFOLD = `# Strategy

## North-star metric

<!-- The single outcome everything should move toward. One sentence. -->

## Priorities

<!-- The few things that matter most right now, most important first. Cap at ~5. -->

1.
2.
3.

## Audience

<!-- Who the output is for, and their level. -->

## Hard constraints

<!-- Lines never to cross — budget, tone, topics to avoid, compliance. -->

-

## Optimize for / avoid

- **Optimize for:**
- **Avoid:**
`

export interface StrategyArchetype {
  key: string
  label: string
  blurb: string
  content: string
}

// Filled, specific strategies — bracketed bits are the only parts to personalise.
export const ARCHETYPES: StrategyArchetype[] = [
  {
    key: 'indie-saas',
    label: 'Indie SaaS / Product',
    blurb: 'Ship-fast product. North-star = activated users; retention over acquisition.',
    content: `# Strategy

## North-star metric

Weekly active users who complete the core action at least twice.

## Priorities

1. Ship the smallest thing that proves people will pay — talk to users every week.
2. One distribution channel done well before adding a second.
3. Retention over acquisition: fix why people leave before pouring more in the top.

## Audience

[Your target user] — busy, skeptical, already tolerating a workaround today.

## Hard constraints

- Never change pricing or the paywall without measuring churn for a week first.
- Stay within the monthly ad + infra budget.

## Optimize for / avoid

- **Optimize for:** time-to-value, a weekly shipping cadence, real user quotes.
- **Avoid:** feature bloat, vanity metrics, rewrites before product-market fit.
`,
  },
  {
    key: 'oss',
    label: 'Open-source maintainer',
    blurb: 'Adoption via contributors, not stars. Reliability + DX first.',
    content: `# Strategy

## North-star metric

Monthly active contributors (not just stars) on [project].

## Priorities

1. Make the first contribution effortless — docs, good-first-issues, fast review.
2. Reliability over features: a broken main branch costs trust you can't rebuy.
3. Tell the project's story where developers actually are (HN, the right subreddits).

## Audience

Developers evaluating [project] in five minutes, and contributors deciding whether to stick around.

## Hard constraints

- Never merge to main without green CI.
- Don't break public APIs without a deprecation path.

## Optimize for / avoid

- **Optimize for:** DX, clear docs, responsive reviews, semver discipline.
- **Avoid:** dependency sprawl, undocumented magic, ignored issues.
`,
  },
  {
    key: 'researcher',
    label: 'Researcher / Writer',
    blurb: 'Reach of work that holds up. Correctness and depth over volume.',
    content: `# Strategy

## North-star metric

Reach of work that holds up — citations, saves, and reuse by people you respect.

## Priorities

1. Correctness first: every claim sourced, every number traceable.
2. Depth on a few threads over shallow coverage of many.
3. Publish on a steady cadence so the body of work compounds.

## Audience

Technical peers and practitioners in [field] — assume they're smart and short on time.

## Hard constraints

- Never state speculation as settled fact; cite sources and link them.
- Don't chase trending topics you can't add real signal to.

## Optimize for / avoid

- **Optimize for:** rigor, original framing, clear writing, durable references.
- **Avoid:** hype, hot takes you can't defend, unsourced claims.
`,
  },
  {
    key: 'crypto-agent',
    label: 'Crypto / Agent project',
    blurb: 'Real onchain usage. Security + honest claims over hype.',
    content: `# Strategy

## North-star metric

Active [agents / integrations / users] doing real onchain actions weekly.

## Priorities

1. Ship usable onchain features over roadmap theater.
2. Security and honesty: one rug or overclaim erases months of trust.
3. Narrative that matches reality — distribution where crypto builders gather.

## Audience

Crypto-native builders and operators who can tell a demo from a product.

## Hard constraints

- Never publish unaudited claims about funds, yields, or safety as fact.
- Stay within configured spend and rate limits; no unreviewed mainnet actions.

## Optimize for / avoid

- **Optimize for:** shipped onchain primitives, verifiable claims, real usage.
- **Avoid:** vaporware, mercenary hype, anything that risks user funds.
`,
  },
  {
    key: 'creator',
    label: 'Creator / Audience',
    blurb: 'Engaged followers in a niche. Consistency + a recognizable voice.',
    content: `# Strategy

## North-star metric

Engaged followers in [niche] who reply, share, and show up — not raw follower count.

## Priorities

1. Consistency: post on a cadence you can sustain for a year.
2. One sharp idea per post over watered-down takes.
3. Reply and build in public — distribution is a conversation, not a broadcast.

## Audience

[Niche] on X — people who'd recognize a real take from filler.

## Hard constraints

- Never punch down or fake outrage for reach.
- Don't post claims you can't stand behind.

## Optimize for / avoid

- **Optimize for:** signal, a recognizable voice, genuine engagement.
- **Avoid:** engagement bait, thread spam, chasing every trend.
`,
  },
]
