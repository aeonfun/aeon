![hero](../images/explainer-2026-05-02.jpg)

<!-- hero image queued via .pending-replicate/explainer-2026-05-02.json; postprocess generates the file after Claude exits -->
<!-- image prompt: Technical schematic illustration of a multi-agent search loop, dark navy background, thin cyan and amber lines. Four labeled circular nodes reading "AGENT 1", "AGENT 2", "AGENT 3", "AGENT 4" arranged around a central rectangular block divided into three labeled compartments reading "ATTEMPTS", "NOTES", "SKILLS". Thin cyan arrows from each agent to the central block (read/write). A separate amber rectangle on the right labeled "EVALUATOR" connected to the agents only by directional arrows labeled "score" and "feedback", with a vertical wall between evaluator and agents. Pulse marks on the arrows labeled "heartbeat" at regular intervals. Monospace labels, blueprint aesthetic, technical paper figure style, 16:9, no human figures. -->

# CORAL: four agents, one notebook, 24% off the kernel

**Key idea in one sentence:** Run four LLM agents in parallel sandboxes, give them a shared notebook with three columns — Attempts, Notes, Skills — and a periodic interrupt that forces them to write down what they learned, and a population beats a single long-running agent on hard search problems by 19–24%.

## The Setup

Long-running LLM agents drift. They fixate, repeat themselves, blow context, lose the thread. Single-agent setups stretch the leash and watch them wander. Multi-agent setups bolt them to a rigid scheduler and strip the autonomy that made the LLMs interesting in the first place. CORAL ([arXiv:2604.01658](https://arxiv.org/abs/2604.01658), Qu/Zheng/Zhou et al., MIT / CMU / NUS, April 2026) splits the difference: keep agents long-running and autonomous, give them shared memory and a clock.

## The Intuition Pump

Four researchers in adjacent offices, each with a private whiteboard. None can see the others' boards. Every twenty minutes a bell rings, and at the bell each one walks to a shared notebook in the hallway. They jot what they tried, what failed, what trick they invented worth reusing — and they read what the others wrote. Then back to their offices. Where the analogy breaks: those researchers can stop, eat, decide to swap rooms. CORAL's heartbeat is the actual control mechanism. Without the bell, the agents fixate so hard they never check the notebook at all. The interrupt is the work.

## How It Actually Works

1. **Spawn N agents in isolated workspaces.** Each gets its own scratch directory and its own LLM session. No shared filesystem. They cannot see each other directly.
2. **Each agent runs the same loop:** research → plan → implement → evaluate → reflect → repeat. The evaluator is a separate process. Agents send code, get back a score and feedback, and cannot see or touch the grader. The Manager Infra blocks any attempt to read evaluation logic.
3. **Shared memory has three slots.** *Attempts* — prior runs with their scores and the evaluator's feedback. *Notes* — observations and advice ("strategy X dead-ends at step 3"). *Skills* — reusable code packaged as named tools any agent can call later.
4. **The heartbeat fires on a timer.** When it ticks, the agent's loop is interrupted: reflect on the last K steps, prune context, write notes to the shared store, optionally publish a skill. Without this, the authors observed agents getting "stuck in their own line of work" and never externalizing anything useful — the population behaves like four independent solos.
5. **Read before write.** Before each new attempt, an agent queries the notebook — pulls relevant attempts, notes, skills — and seeds its plan. Copycat behavior emerged spontaneously: one agent finds an angle, the others read it, three branches converge on a consensus, then diverge again.
6. **The evaluator stays dumb on purpose.** Score plus feedback. No leaderboard. No "you're losing." This isolates the fitness signal from agent reasoning, so agents can't game the grader by reasoning about it.

## Numbers That Anchor It

- Anthropic's kernel-engineer take-home — single agent: **1,363 → 1,350 cycles in 4.6 hours**. Four agents: **1,363 → 1,103 cycles in 4.5 hours**. ~19% off the prior best at the same wall clock ([alphaXiv overview](https://www.alphaxiv.org/overview/2604.01658)).
- **3–10×** higher improvement rate than fixed evolutionary-search baselines, with far fewer evaluations, across **10 tasks** ([arXiv abstract](https://arxiv.org/abs/2604.01658)).
- Erdős Minimum Overlap problem: C₅ score **0.38089**, new SOTA ([project page](https://human-agent-society.github.io/CORAL/)).
- Stanford OpenVaccine (mRNA degradation MCRMSE): **20.5%** improvement over the human baseline ([project page](https://human-agent-society.github.io/CORAL/)).
- 17 authors. Reference implementation at [github.com/Human-Agent-Society/CORAL](https://github.com/Human-Agent-Society/CORAL).

## What Would Break This

Run the same kernel task with one long-running agent that has full read/write access to the same shared notebook and gets the same heartbeat ticks. If that solo matches the four-agent score, the population is theater — heartbeat-plus-memory is doing the work, not the count of agents. The paper does not run this ablation cleanly, which is the most important missing experiment.

A second falsifier: if the four agents converge to the same plateau despite isolated workspaces, the diversity claim collapses. The authors flag this — agents are initialized identically and given identical info. Behavioral diversity is incidental, not engineered.

## Why It Matters

If the heartbeat-plus-notebook pattern survives the missing ablation, it becomes the cheapest known way to extract more search out of a fixed compute budget. You parallelize agents instead of stretching one. For anyone running a swarm of long-lived agents — research, trading, kernel tuning — the design is plug-compatible: shared memory with three slots, isolated sandboxes, periodic forced reflection, evaluator behind a wall. Not a new idea in pieces. New as a tested combination, with code, that beats single-agent SOTA at the same wall clock.

## Sources

- [CORAL: Towards Autonomous Multi-Agent Evolution for Open-Ended Discovery](https://arxiv.org/abs/2604.01658) — primary, arXiv:2604.01658, April 2 2026
- [Project page (Human-Agent-Society)](https://human-agent-society.github.io/CORAL/) — primary, official benchmark numbers and mechanism description
- [GitHub: Human-Agent-Society/CORAL](https://github.com/Human-Agent-Society/CORAL) — primary, reference implementation
- [alphaXiv overview of 2604.01658](https://www.alphaxiv.org/overview/2604.01658) — secondary, narrative summary
