---
name: stewart-lore identity scrub — keep lore-org admin
description: Scope guardrail when cleaning stewart-lore identity out of swarm-fund-mvp; do not touch his lore-org GitHub admin
type: project
originSessionId: 2cae8c9b-f28b-48b0-996a-9164174234e5
---
When scrubbing the `stewart-lore <stewart@lore.xyz>` identity from swarm-fund-mvp (git author rewrites, repo access, gh CLI, file-content sweeps), **do not** revoke or downgrade his admin role in the `lore` GitHub org or anything else lore-scoped.

**Why:** Stewart was CTO of lore. The swarm-fund-mvp scrub is about consolidating *this* project under the `tomscaria` identity (the actual repo owner) — it is not a broader access purge. Lore-org admin is unrelated and load-bearing for that org.

**How to apply:**
- Author rewrites in `swarm-fund-mvp` history: ✅ in scope
- `git config` user.name/user.email in this repo: ✅ in scope
- `gh auth` switch to tomscaria as default for this repo: ✅ in scope
- Removing stewart-lore as a collaborator on `tomscaria/swarm-fund-mvp`: ✅ in scope (project repo only)
- File-content references (paths, ADRs, MEMORY.md): ✅ in scope per case
- **`lore` GitHub org membership / admin role: ❌ out of scope** — leave alone
- **Anything else under the `lore` org or `lore.xyz` infrastructure: ❌ out of scope** unless explicitly re-asked
