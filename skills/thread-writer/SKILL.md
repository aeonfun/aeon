---
name: Thread Writer
description: Write a tweetstorm/thread (5–10 tweets) in the operator's voice on a given topic, grounded in memory and research
var: ""
tags: [social, content]
---
> **${var}** — Topic, thesis, or URL to thread on (e.g. "prediction markets are broken", "https://arxiv.org/..."). If empty, picks the sharpest idea from recent memory and logs.

Read `memory/MEMORY.md` and the last 7 days of `memory/logs/` for context. Use recent signals — notable market moves, paper picks, tweet roundup discourse — as raw material if no topic is set.

## Voice

If `soul/` files exist, read them in order before writing:
1. `soul/SOUL.md` — identity, worldview, opinions
2. `soul/STYLE.md` — writing style, sentence structure, anti-patterns
3. `soul/examples/tweets.md` — rhythm and tone calibration. Match this exactly.
4. `soul/examples/bad-outputs.md` — what NOT to do

If soul is absent, use a clear, direct, plain-spoken tone — but the anti-patterns under Writing Rules still apply.

## Topic Selection

If `${var}` is set, use it. Otherwise pick the sharpest, most threadable idea from:
- Today's `memory/logs/${today}.md` — article thesis, paper finding, market signal
- `memory/MEMORY.md` notable signals — anything with reflexivity, contradiction, or structural insight
- A connection between two recent findings that most people aren't seeing

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
