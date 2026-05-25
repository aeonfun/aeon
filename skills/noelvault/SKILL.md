---
name: Noelvault
description: Save and recall agent knowledge using noelvault — a persistent, searchable, versioned external memory store that works across all Aeon instances
var: ""
tags: [memory, storage, research, persistence]
---
> **${var}** — Topic, key, or artifact to save/recall. If empty, list recent vault entries and sync today's key findings from memory/logs to vault.

Noelvault is an external memory backend. Unlike MEMORY.md (git-based, per-fork), noelvault persists to a shared Supabase backend — searchable and versioned across all Aeon instances.

Requires `NOELVAULT_URL` set in environment. Default hosted API: `https://illmpwsqcnwelnwfiikn.supabase.co/functions/v1/vault`

---

## Steps

### 1. Check environment

If `NOELVAULT_URL` is not set, use `https://illmpwsqcnwelnwfiikn.supabase.co/functions/v1/vault` as the base URL.

### 2. Determine mode from `${var}`

**If `${var}` is empty → List + Sync mode:**
- Fetch recent entries: `GET $NOELVAULT_URL/vault/list?limit=20`
- Read today's log at `memory/logs/${today}.md` for any outputs worth persisting
- For each significant finding in today's log (research, execution result, workflow, important memory), save it to vault (step 4)
- Report the list of vault entries and what was synced

**If `${var}` looks like a search query (no `/` in it) → Recall mode:**
- Search: `GET $NOELVAULT_URL/vault/search?q=${var}`
- If results found, read the top result: `GET $NOELVAULT_URL/vault/entry?key=<top result key>`
- Summarize findings and add to context for the current session
- Log to `memory/logs/${today}.md`: `### noelvault recall\n- Query: ${var}\n- Found: <N> results`

**If `${var}` contains `/` (looks like a key, e.g. `research/btc-analysis`) → Read mode:**
- Fetch: `GET $NOELVAULT_URL/vault/entry?key=${var}`
- If not found, search instead: `GET $NOELVAULT_URL/vault/search?q=${var}`
- Return full content and version history if found

### 3. Before starting any research or analysis task

Always search vault first to avoid duplicate work:
```
GET $NOELVAULT_URL/vault/search?q=<topic>
```
If prior research exists (< 7 days old), use it as context before proceeding.

### 4. Save an artifact

Use this after completing any research, execution, or analysis:

```
POST $NOELVAULT_URL/vault/save

{
  "type": "<research|execution|workflow|prompt|file|memory>",
  "title": "<descriptive title>",
  "content": "<full content>",
  "key": "<type>/<slug>",
  "tags": ["<relevant>", "<tags>"],
  "commitMsg": "initial",
  "agentId": "aeon"
}
```

Response: `{ "key": "...", "version": 1, "changed": true }`

Same key on repeat saves → auto-increments version, previous version snapshotted automatically.

**Entry types:**
- `research` — market analysis, token deep dives, on-chain findings
- `execution` — trade logs, automation runs, task results
- `workflow` — reusable agent playbooks, step sequences
- `prompt` — versioned system prompts and instructions
- `file` — generated code, reports, exports
- `memory` — long-term context, preferences, session summaries

### 5. Version history and diff

To review how a research or prompt evolved:
```
GET $NOELVAULT_URL/vault/history?key=<key>
GET $NOELVAULT_URL/vault/diff?key=<key>&from=1&to=<latest>
```

### 6. Log and notify

After every vault operation, log to `memory/logs/${today}.md`:
```
### noelvault
- Action: <save|recall|list>
- Key: <key>
- Version: <v>
- Summary: <one line>
```

Send via `./notify` if a significant artifact was saved:
```
*Noelvault* — saved <title> (v<version>) to vault
Key: <key>
```

---

## Wallet auth (optional)

To isolate entries to your wallet namespace, add headers to every request:
```
X-Wallet-Address: 0x...
X-Wallet-Signature: 0x...  (sign "noelclaw:<toolName>:<timestamp>")
X-Wallet-Timestamp: <unix ms>
```

Without auth headers → entries go to the `anon` shared namespace, still useful for most Aeon workflows.

---

Source: https://github.com/noelclaw/noelvault
