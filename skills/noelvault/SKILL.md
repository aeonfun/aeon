---
name: Noelvault
description: Persist agent knowledge to an external searchable vault — save research, execution logs, workflows, and memory across sessions and Aeon forks
var: ""
tags: [memory, storage, research, persistence]
---
> **${var}** — Key or topic to save/recall. If empty, list recent vault entries.

Noelvault is an external memory backend for Aeon. Unlike MEMORY.md (git-based, per-fork), noelvault persists to a shared Supabase backend — searchable, versioned, and available across all your Aeon instances.

Set `NOELVAULT_URL` in your environment:
```
export NOELVAULT_URL=https://api.noelclaw.com
```

---

## When to Use

- **After research or analysis** — save the output so future sessions can recall it
- **Before starting a task** — search vault for prior context on the same topic
- **When versioning a prompt or workflow** — same key = auto-increments version (git-style)
- **At session end** — save a memory summary so next session picks up where you left off

---

## Save to Vault

Save any artifact. `type` must be one of: `research` `execution` `workflow` `prompt` `file` `memory`

```
POST $NOELVAULT_URL/vault/save

{
  "type": "research",
  "title": "${var}",
  "content": "<your content here>",
  "key": "research/${var}",
  "tags": [],
  "commitMsg": "initial",
  "agentId": "aeon"
}
```

Response: `{ "key": "...", "version": 1, "changed": true }`

Same key on next save → auto-increments version, previous version snapshotted.

---

## Recall from Vault

**Search** (before doing work — check if this was researched before):
```
GET $NOELVAULT_URL/vault/search?q=${var}
```

**Read by key**:
```
GET $NOELVAULT_URL/vault/entry?key=research/${var}
```

**List recent entries**:
```
GET $NOELVAULT_URL/vault/list?limit=20
```

---

## Version History & Diff

```
GET $NOELVAULT_URL/vault/history?key=prompt/system-v1
GET $NOELVAULT_URL/vault/diff?key=prompt/system-v1&from=1&to=3
```

---

## Recommended Integration Pattern

```
# Session start
vault_recall: GET /vault/search?q=<today's topic>

# During execution
vault_save: POST /vault/save after each significant output

# Session end
vault_save: POST /vault/save with type: "memory", summary of session
```

---

## Wallet Auth (optional)

To isolate your vault entries from others, sign requests with your wallet:

```
X-Wallet-Address: 0x...
X-Wallet-Signature: 0x...  (sign "noelclaw:vault_save:<timestamp>")
X-Wallet-Timestamp: <unix ms>
```

Without auth headers → entries go to the shared `anon` namespace.

---

Skill source: https://github.com/noelclaw/noelvault
Hosted API: https://api.noelclaw.com
