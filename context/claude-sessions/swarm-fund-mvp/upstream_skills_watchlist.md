---
name: Upstream SKILL.md watchlist
description: Quarterly check — repos that would be worth vendoring via scripts/vendor-skill.sh if they ship an agent-skills package
type: reference
originSessionId: 02ccf02f-be83-469f-bc11-b76ba0afa726
---
# Upstream SKILL.md watchlist

`scripts/vendor-skill.sh <owner/repo> [subpath]` vendors any repo that publishes a Claude-compatible `SKILL.md`. Check these orgs quarterly; when any ships an agent-skills repo, one script invocation + one `CLAUDE.md` routing line adopts it.

**Automated:** the scheduled task `upstream-skills-watchlist-check` runs this scan on the 1st of Jan/Apr/Jul/Oct at 9am local and reports any hits. Manage via Claude Code Scheduled sidebar. Next run: **2026-07-01**. First run should be triggered manually via "Run now" to pre-approve `gh` Bash permissions for future runs.

## Checked 2026-04-20

| Org | Has `agent-skills`? | Notes |
|---|---|---|
| `Polymarket` | ✅ yes — vendored as `web3-polymarket` (ADR-049) | Last upstream push 2026-02-19 |
| `hyperliquid-dex` | ❌ no | Only SDKs (python, rust), node, order_book_server. Check again Q3-2026 |
| `anthropics` | ✅ partial — `anthropic-skills` plugin already loaded via Claude Code registry | No manual vendor needed |

## To check next

- `crypto-com` / `Cronos-Labs` — for Crypto.com MCP skill docs
- `lunarcrush` — social sentiment SKILL
- `temporalio` — Temporal agent skills
- `apache` / `questdb` — QuestDB time-series SKILL
- `anthropic-experimental` — new skill drops

## How to check

```bash
gh repo list <org> --limit 50 --json name,description,pushedAt | \
  jq '.[] | select(.name | test("skill|agent|mcp"; "i"))'
```

If a candidate exists, verify it has `SKILL.md` at root (or known subpath), then:

```bash
scripts/vendor-skill.sh <org>/<repo>
```

Add to `CLAUDE.md` under `## Skill routing` once vendored.
