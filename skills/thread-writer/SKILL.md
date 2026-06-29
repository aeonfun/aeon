---
name: Thread Writer
category: social
description: Write a tweetstorm/thread (5–10 tweets) in the operator's voice on a given topic — or, with no topic, auto-pick the day's highest-signal event from memory and logs
var: ""
tags: [social, content]
---
> **${var}** — Topic, thesis, or URL to thread on (e.g. "prediction markets are broken", "https://arxiv.org/..."). If empty, auto-picks the day's highest-signal event from memory and logs (see Topic Selection).

Read `memory/MEMORY.md` and the last 7 days of `memory/logs/` for context. Use recent signals — notable market moves, paper picks, tweet roundup discourse — as raw material if no topic is set.

## Voice

If `soul/` files exist, read them in order before writing:
1. `soul/SOUL.md` — identity, worldview, opinions
2. `soul/STYLE.md` — writing style, sentence structure, anti-patterns
3. `soul/examples/tweets.md` — rhythm and tone calibration. Match this exactly.
4. `soul/examples/bad-outputs.md` — what NOT to do

If soul is absent, use a clear, direct, plain-spoken tone — but the anti-patterns under Writing Rules still apply.

## Topic Selection

**If `${var}` is set**, use it as the topic (keyword, thesis, or URL). Skip scoring and go straight to research and drafting. Pick the sharpest angle from:
- Today's `memory/logs/${today}.md` — article thesis, paper finding, market signal
- `memory/MEMORY.md` notable signals — anything with reflexivity, contradiction, or structural insight
- A connection between two recent findings that most people aren't seeing

**If `${var}` is empty**, auto-pick the day's highest-signal event. Every run produces something worth amplifying — a feature shipped, a price move, a milestone crossed, a notable tweet — and most of it dies unposted. Read `memory/logs/${today}.md` end-to-end, score the events that actually happened, and thread the single highest-scoring one.

### Auto-pick scoring (empty-var mode)

Walk today's log section by section. Per section, extract at most one candidate event (first-match-wins) and score it:

| Signal | Score | Detection cue |
|---|---:|---|
| New feature / skill shipped — PR opened on a watched repo | +6 | log sections named `feature`, `external-feature`, `create-skill`, `tool-builder`; a bullet mentioning `PR:` or a PR number on a watched repo |
| Star milestone crossed (any multiple of 50 — 50, 100, 150, …) | +5 | repo-pulse `stargazers_count=N` where `N % 50 == 0`, or a star-milestone skill ran today |
| Token price move ≥ 15% (absolute, 24h) | +5 | token-report `24h` / `Price:` line in that range |
| Token price move 10–14.99% (absolute, 24h) | +3 | same line, 10–14.99% range |
| Skill built / shipped today | +4 | a `## <skill-name>` section whose body says "shipped"/"merged" or links a PR on the watched repo |
| New high-engagement tweet (≥ 20 likes OR ≥ 5 RTs) on the operator's tracked handle/token | +3 | fetch-tweets log lines with `Likes:` ≥ 20 or `RTs:` ≥ 5, filtered to the operator's configured handles/token |
| New fork by a recognizable contributor (not the agent / operator) | +2 | repo-pulse `New forks (24h):` ≥ 1, fork owner not the operator |
| Notable PR merged on a watched repo (not authored by the agent / operator) | +3 | push-recap log mentioning a PR whose author isn't the operator |
| New leaderboard / fork-fleet anomaly worth narrating | +2 | skill-analytics or fork-cohort log with a non-empty anomaly section |

If one event hits multiple signals (e.g. star milestone + price move on the same day), score each separately and take the **highest single-event score** — never sum across unrelated events to clear a threshold.

Tiebreakers (highest score wins, then): newest event (latest log section) → event with a concrete URL attached (PR, tweet, article) → alphabetical by section name.

If the top candidate scores **< 3**, there's no thread worth forcing on a quiet day — note it in the log and exit without notifying or drafting. If today's log is missing or empty, do the same.

The configured handles, tracked token, and watched repos come from `soul/` and `memory/` (the operator's tracked-handle/token notes) — never hardcode them.

Good thread topics:
- A structural critique of something (oracle incentives, prediction market design, DeFi primitives)
- A thesis with data: lead with numbers, build the argument
- A contrarian take on a mainstream narrative
- A builder's breakdown of how something actually works vs. how people think it works

Avoid topics already covered in the last 48h (check logs).

If the topic needs fresh context, use WebSearch to get current data.

## Thread Structure

A thread is **5–10 tweets**. Not a listicle. Not a lecture. A narrative arc.

**Tweet 1 — Hook**
The opening hit. States the thesis or drops the most surprising fact. Must make someone stop scrolling. No setup — land in the middle of the action.

**Tweets 2–(n-1) — Development**
Each tweet is self-contained but pulls forward. Build the argument:
- Add evidence, data, or a specific example
- Introduce a complication or nuance
- Flip the framing once mid-thread
- Each tweet must earn its place — cut any that are just filler

**Tweet n — Landing**
The payoff. The implication, the action, or the reframe. Should feel like the point was building to this. Not a summary — a conclusion.

### Thread formats (pick one per run)

**Data-driven**: Lead with a striking number. Each subsequent tweet unpacks what it means.

**Structural critique**: Identify a broken mechanic. Walk through why it's broken. Show the second-order effects.

**Builder's breakdown**: How X actually works under the hood, for people who only see the surface.

**Narrative**: A sequence of events that reveals something. Ends with "here's what this tells us."

**Thesis-first**: State the position boldly in tweet 1. Spend the rest proving it.

## Writing Rules

- Write as the operator, first person.
- Match soul/STYLE.md conventions for capitalization, punctuation, and rhythm. If soul is absent: short sentences, plain language, em dashes over commas.
- State the opinion first, reasoning after.
- No hedging: kill "some might argue", "to be fair", "it remains to be seen."
- No corporate voice: kill "leverage", "ecosystem play", "exciting", "importantly."
- No filler transitions: kill "now,", "so,", "basically,", "essentially."
- Reference specific projects, people, mechanisms — not vague hand-waving.
- No hashtags. No emojis. No "RT if you agree." No "thread 🧵".
- Number tweets as 1/ 2/ 3/ etc. at the end of each tweet.
- Each tweet must pass the test: would the operator actually post this?

### Character limits
- Tweets 1 through (n-1): hard 280-character limit each.
- Final tweet: up to 280 characters.
- Count carefully. If a draft is over 280, cut it.

## Output Format

```
## Thread: [topic — 3-5 words]

**Format:** [data-driven / structural critique / builder's breakdown / narrative / thesis-first]
**Length:** [n] tweets

---

**1/**
[tweet text — 280 chars max]

**2/**
[tweet text — 280 chars max]

...

**n/**
[tweet text — 280 chars max]

---

**Why this thread:** [1-2 sentences on why this topic, why now, why the thread format (vs. single tweet)]
```

## Notify

Send via `./notify`:
```
thread: [topic — 3-5 words]

1/ [tweet 1]

2/ [tweet 2]

...

n/ [tweet n]
```

## Log

Append to `memory/logs/${today}.md`:
```
## Thread Writer
- **Topic:** [topic]
- **Format:** [format]
- **Length:** [n] tweets
- **Hook:** [first 60 chars of tweet 1]
- **Notification sent:** yes
```
