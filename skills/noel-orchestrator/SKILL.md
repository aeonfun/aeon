---
name: Noel-Orchestrator
description: Dynamically coordinate Noelclaw agents based on context, memory history, execution scores, and realtime events — routing tasks to the right agent at the right time instead of managing workflows manually
var: ""
tags: [orchestration, agents, automation, coordination, noelclaw]
---
> **${var}** — Event, signal, or task to route. If empty, check active agent states and pending signals from memory/logs.

Noel-Orchestrator is a meta-agent coordination layer for the Noelclaw AI OS. Instead of manually triggering agents, it observes context and routes work dynamically — activating, pausing, or handing off between agents based on confidence scores, memory history, workload, and realtime events.

---

## Routing Model

```
SIGNAL / EVENT
     ↓
Orchestrator evaluates:
  - context type (market, risk, execution, comms)
  - confidence score (0–100) from memory/prior runs
  - agent workload (is it already busy?)
  - memory history (has this been tried before?)
     ↓
Route to the right agent
```

### Built-in routing rules

| Trigger | Agent activated | Condition |
|---------|----------------|-----------|
| Market shift detected | Research agent | Any signal with `type: market` |
| Confidence score ≥ 80 | Execution agent | Research output confirms entry |
| Rug/risk flag | Sentinel | Any `risk: high` or rug signal |
| Task complete | Noel-Crew | Workflow finishes, update live status |
| Memory gap detected | noelvault recall | Prior context missing for current task |
| Repeated failure (3×) | Pause + diagnose | Same agent hits stop-loss 3 times |

---

## Steps

### 1. On invocation with `${var}` empty — Status sweep

- Read `memory/logs/${today}.md` for active agent signals
- Check noelvault: `GET $NOELVAULT_URL/vault/search?q=orchestrator+state`
- List pending tasks and current agent states
- Report: which agents are active, idle, or waiting

### 2. On invocation with `${var}` = event/signal

Parse the input to extract:
- `type`: `market` | `risk` | `execution` | `comms` | `workflow`
- `confidence`: 0–100 (from prior research or explicit score)
- `urgency`: `high` | `normal` | `low`

Apply routing rules (table above). If no rule matches, default to Research agent for context gathering.

### 3. Dispatch

For each routed agent, write a dispatch log to `memory/logs/${today}.md`:
```
### noel-orchestrator dispatch
- Event: <signal>
- Agent: <target>
- Reason: <one line>
- Confidence: <score>
- Time: <timestamp>
```

Then hand off to the target agent with full context:
- What triggered it
- What confidence/memory data exists
- What the expected output is

### 4. Track execution score

After each routed task completes, update the agent's execution score in noelvault:
```
POST $NOELVAULT_URL/vault/save
{
  "type": "execution",
  "key": "execution/<agent-name>-score",
  "title": "<agent> execution history",
  "content": "<result, confidence delta, outcome>",
  "tags": ["orchestrator", "<agent-name>"]
}
```

Use this history to improve future routing confidence.

### 5. On workflow completion

When a full pipeline completes (research → execution → result):
- Save a workflow summary to noelvault (`type: workflow`)
- Notify via `./notify`: `*Orchestrator* — workflow complete: <summary>`
- Update `memory/logs/${today}.md` with outcome

---

## Agent Registry

| Agent | Trigger type | When to activate |
|-------|-------------|-----------------|
| Research | `market`, unknown signal | Need context before acting |
| Execution | `execution`, confidence ≥ 80 | Clear signal, ready to act |
| Sentinel | `risk: high`, rug flag | Risk management needed |
| Noel-Crew | `workflow: complete` | Status update, comms |
| noelvault | memory gap, session start | Recall prior context |

---

## Noelclaw Integration

Noel-Orchestrator works best alongside:
- **noelvault** — for memory recall and execution score persistence
- **Noel-Crew** — for live status updates on dispatch/completion
- **Sentinel** — for risk intercept on any high-confidence trade signals

Source: https://github.com/noelclaw/noelclaw
