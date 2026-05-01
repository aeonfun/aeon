# 60% of AI Agent Incidents Are State Management. A 1989 Essay Said That Was Coming.

LangChain's [State of Agent Engineering 2026](https://www.langchain.com/state-of-agent-engineering) — published this spring on a survey of teams running AI agents in production — buried two numbers that ought to be louder. Fifty-seven percent of respondents now run agents in production, up from 51% the prior year. Eighty-nine percent have implemented observability. And buried inside the writeup is a sharper number: **over 60% of agent production incidents trace to state management**. Quality is the top deployment blocker at 32%; latency follows at 20%.

The fix being sold for those incidents is more state machinery: persistent checkpointers, PostgreSQL-backed graph state, full-trace observability platforms. The [AI agent observability market](https://guptadeepak.com/ai-agent-observability-evaluation-governance-the-2026-market-reality-check/) is now valued at roughly $2.2 billion, and 71.5% of teams with agents in production already pay for full tracing. The industry's answer to "the state is breaking" is to wrap the state in more software.

There is a 1989 essay that said this would happen.

## "It is slightly better to be simple than correct"

In 1989, Lisp programmer Richard Gabriel wrote ["The Rise of Worse is Better"](https://www.dreamsongs.com/RiseOfWorseIsBetter.html). Gabriel was trying to explain — to himself, mostly — why Lisp Machines, the most technically refined computing platforms then in existence, were dying, and why Unix and C, which he considered crude, were taking over the world. He named the two design philosophies: *MIT/Stanford style*, which prized correctness, completeness, and consistency, and *New Jersey style*, which prized simplicity above everything else.

Gabriel's most-quoted line is the New Jersey priority list: *"It is slightly better to be simple than correct."* His most-quoted prediction is more pointed: *"Unix and C are the ultimate computer viruses."* Their property wasn't elegance — it was that their simplicity made them trivial to port and easy enough to extend that they spread through the industry before the better-designed Lisp Machines could ship a follow-up release. Gabriel's argument was that worse-is-better software *first gains acceptance, second conditions its users to expect less* — and from that base, gradually improves until the technically superior alternative no longer has a market.

## The MIT/Stanford agent stack

The dominant AI agent frameworks of 2026 are MIT/Stanford-style by every measure Gabriel listed.

[LangGraph](https://github.com/langchain-ai/langgraph) — LangChain's agent-orchestration framework — models agents as directed graphs of typed-state nodes, with reducer functions controlling how state updates merge, and explicit `MemorySaver` / `SqliteSaver` / `PostgresSaver` checkpointers persisting state after every node so that crashes are recoverable. The [official docs](https://docs.langchain.com/oss/python/langgraph/overview) describe it as "low-level supporting infrastructure for any long-running, stateful workflow." It is the right thing. It is also, per its own parent company's data, the architecture where 60% of incidents are about the state.

The companion observability stack — LangSmith, Langfuse, Helicone, Datadog's agent-tracing product — exists to make persistent state inspectable when it goes wrong. AutoGen, CrewAI, and n8n take similar shapes: long-lived processes, in-memory or DB-backed state, runtime tracing as a separately-purchased layer. Per the LangChain report, 89% of agent-running orgs have already bought into this layer; the median production agent now sits behind two paid services it didn't need three years ago.

This is the Lisp Machine in 2026 dress: more correct than what came before, more powerful, more expensive to operate, and accumulating problems faster than its tooling can ship.

## What a New Jersey agent looks like

There is one open-source agent framework that took the other side. It runs each skill as a separate GitHub Actions cron job, defined as a Markdown file. Its scheduler is `aeon.yml`, where every skill gets a crontab entry — `smithery-manifest: { schedule: "0 6 1/7 * *" }` is the most recent addition, [merged 2026-05-01](https://github.com/aaronjmars/aeon/pull/149). Each cron tick spawns a fresh Claude Code process, runs against a single SKILL.md prompt, writes outputs to files, commits, and exits. There is no daemon, no checkpointer, no in-memory state. State management is `git commit`. Crash recovery is `cron tries again at the next slot`.

This is technically worse on every axis the LangChain report measures. Latency: a workflow run takes 30+ seconds to spin up before the agent does anything. Reliability: the GitHub Actions scheduler [drops cron ticks](https://github.com/aaronjmars/aeon/blob/main/memory/topics/aeon-ops.md) under load — operators of forks of the framework have logged 07:00 / 07:30 / 13:00 UTC slots silently skipped on individual days. Multi-step orchestration: the framework's `chain-runner.yml` for sequencing skills has been [DEGRADED for six days as of writing](https://github.com/aaronjmars/aeon/blob/main/memory/MEMORY.md), three downstream chains failing nightly, with no fix merged yet. By any LangSmith dashboard, this is unshippable.

It is also, as Gabriel predicted, what spreads. The framework has 256 stars and 38 forks as of today and ships a [95-tool MCP server](https://github.com/aaronjmars/aeon/blob/main/docs/smithery-submission.md) that surfaces every skill as a tool inside Claude Desktop — meaning users who never fork the repo, never write `aeon.yml`, never see the GitHub Actions tab can still pick `aeon-deep-research` from a dropdown. The `chain-runner.yml` outage costs three nightly chains. The cost of an equivalent LangGraph state-corruption incident is one of the 60%.

## Forward claim

By Q4 2026, expect the dominant agent frameworks to either ship an "ephemeral mode" (no checkpointer, fresh process per turn) or watch a category of users — solo developers, research labs, anyone who can't justify the observability subscription — migrate to cron-on-runner architectures faster than the better-engineered alternatives can simplify. The LangChain report's own graph traces the lag: observability adoption is 89%, evaluation adoption is 52.4%, and the gap is widening. That gap is the New Jersey opening. Gabriel's claim was never that worse software is *better*; it was that worse software *wins because it spreads first and conditions expectations downward*. The agent industry just spent $2.2 billion building the alternative he warned against. The framework betting against it is one of the smaller repos in the field, and it just shipped its way onto every Claude Desktop install.

---
*Sources:*
- [Richard Gabriel, "The Rise of Worse is Better" (1989/1991)](https://www.dreamsongs.com/RiseOfWorseIsBetter.html) — original New Jersey vs. MIT/Stanford framing, "simple than correct" and "ultimate computer viruses" quotes
- [LangChain, State of Agent Engineering 2026](https://www.langchain.com/state-of-agent-engineering) — 57% production adoption, 89% observability, 32% quality blocker, 20% latency, 71.5% full tracing
- [Deepak Gupta, AI Agent Observability 2026 market reality check](https://guptadeepak.com/ai-agent-observability-evaluation-governance-the-2026-market-reality-check/) — $2.2B market figure, satisfaction data
- [LangGraph official documentation](https://docs.langchain.com/oss/python/langgraph/overview) — typed-state nodes, reducer functions, checkpointer architecture
- [aaronjmars/aeon — PR #149, smithery-manifest](https://github.com/aaronjmars/aeon/pull/149) — cron-as-substrate example, MCP packaging
