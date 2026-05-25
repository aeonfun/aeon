---
name: Noel-Orchestrator
description: Dynamically coordinate multiple Aeon agents based on context, memory history, confidence scores, and realtime events — routes tasks to the right agent automatically instead of managing workflows manually
var: ""
tags: [orchestration, agents, automation, coordination, multi-agent]
---
> **${var}** — Event, signal, or task to route. If empty, sweep active agent states and pending signals from today's log.

Noel-Orchestrator is a meta-coordination skill for Aeon. It observes incoming signals and decides which agent or skill to activate, when, and with what context — based on confidence scoring, memory history, workload, and event type.

Works best alongside **noelvault** (for cross-session memory and execution score persistence).

---

## Steps

### 1. Check environment

If `NOELVAULT_URL` is not set, use `https://illmpwsqcnwelnwfiikn.supabase.co/functions/v1/vault` as the fallback. Execution score tracking requires vault access but is optional — orchestrator still routes without it.

### 2. Determine mode from `${var}`

**If `${var}` is empty → Status sweep:**
- Read `memory/logs/${today}.md` for active signals and pending tasks
- Search vault: `GET $NOELVAULT_URL/vault/search?q=orchestrator+state`
- Report: which agents are active, idle, blocked, or waiting
- Flag any tasks that have been waiting > 1 session without resolution

**If `${var}` contains a signal or event → Route mode:**
- Parse the input and classify it (see Routing Model below)
- Apply routing rules
- Dispatch to the right agent with full context
- Log the dispatch to `memory/logs/${today}.md`

### 3. Routing Model

Classify the incoming signal:

| Type | Keywords / indicators |
|------|-----------------------|
| `market` | price change, token, volume, dip, pump, signal |
| `risk` | rug, danger, warning, stop-loss, anomaly |
| `execution` | buy, sell, swap, trade, position |
| `research` | analyze, investigate, context, unknown |
| `workflow` | complete, done, finished, result |
| `comms` | update, notify, report, status |

Then apply routing rules:

| Signal type | Confidence | Action |
|------------|-----------|--------|
| `market` | any | Research first — gather context before acting |
| `research` output | ≥ 80 | Route to execution agent |
| `research` output | 50–79 | Hold — flag for re-evaluation next cycle |
| `risk` | any | Intercept immediately — pause execution, run risk review |
| `execution` | < 50 | Block — confidence too low, return to research |
| `workflow` complete | any | Summary → notify → log to vault |
| `comms` | any | Route to status/notification channel |
| Unknown | any | Default to research — gather context first |

**Confidence score** = 0–100. Build it from available signals:

| Factor | Score delta |
|--------|------------|
| Prior successful run on same task type | +25 |
| Memory history confirms pattern | +20 |
| Multiple independent signals agree | +20 |
| Single unconfirmed signal | +10 |
| Prior failure on same task type | -20 |
| Risk flag present | -30 |
| No memory history (first time) | start at 50 |

### 4. Dispatch

For each routed agent/skill, write a dispatch entry to `memory/logs/${today}.md`:

```
### noel-orchestrator dispatch
- Event: <signal summary>
- Routed to: <agent or skill name>
- Reason: <one line>
- Confidence: <score>/100
- Time: <ISO timestamp>
```

Hand off to the target with:
- What triggered the route
- Confidence score and what contributed to it
- Any relevant memory or vault context retrieved
- Expected output format

### 5. Track execution scores (requires noelvault)

After each routed task completes, update the agent's score:

```
POST $NOELVAULT_URL/vault/save
{
  "type": "execution",
  "key": "execution/<agent-slug>-score",
  "title": "<agent> execution history",
  "content": "<result summary, confidence delta, outcome: success|failure>",
  "tags": ["orchestrator", "<agent-slug>"],
  "commitMsg": "<one line outcome>",
  "agentId": "noel-orchestrator"
}
```

Use `GET $NOELVAULT_URL/vault/history?key=execution/<agent-slug>-score` to review performance before routing future tasks to that agent.

### 6. On workflow completion

When a full pipeline completes:
- Save a workflow summary to vault (`type: workflow`, `key: workflow/<slug>-<date>`)
- Log to `memory/logs/${today}.md`
- Send via `./notify` if significant:
  ```
  *Orchestrator* — workflow complete: <title>
  Route: <chain of agents>
  Outcome: <result>
  ```

### 7. On repeated failure

If the same agent fails 3× on the same task type:
- Block that route temporarily
- Save failure pattern to vault (`type: memory`, `key: memory/orchestrator-blocks`)
- Escalate to a higher-context agent or surface to the user for manual review

---

## Agent Registry

The orchestrator routes to any Aeon skill or agent. Default targets for Noelclaw OS:

| Role | Skill / Agent | Activate when |
|------|--------------|---------------|
| Research | `/deep-research`, `/market-analysis` | Unknown signal, need context |
| Execution | Execution agent | Confidence ≥ 80, clear signal |
| Risk | `/risk-management`, Sentinel | Any risk flag |
| Memory | `/noelvault` | Memory gap, session start, score lookup |
| Comms | Noel-Crew, `/notify` | Workflow complete, status update |

Customize this registry for your own agent setup — the routing logic works with any Aeon skill.

---

## Recommended Usage Pattern

```
# At session start — sweep state
/noel-orchestrator

# Route a specific event
/noel-orchestrator market shift: ETH down 4.2% in 1h, volume spike

# After research completes — route to next step
/noel-orchestrator research complete on AAVE — confidence 85, entry signal confirmed
```

---

## Source

Part of the Noelclaw AI OS — https://github.com/noelclaw/noelvault
