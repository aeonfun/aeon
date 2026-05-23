---
name: Protocol Monitor (x402 default)
description: Weekly tracker for a configured protocol's ecosystem velocity — new GitHub integrations, npm adoption, notable announcements. Defaults to x402; operators swap in their own protocol via memory/topics/tracked-protocol.md.
var: ""
tags: [dev, protocol, ecosystem]
---
> **${var}** — Optional protocol name override (must match a stanza in `memory/topics/tracked-protocol.md`). If empty, uses the default protocol declared in that file.

Today is ${today}. Read `memory/MEMORY.md` before starting.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, read both and match the operator's voice for the notification. If they are empty templates or absent, write in a clear, direct, neutral tone — short sentences, no hedging, no corporate launch-language.

## Why this skill exists

Some protocols are moving fast enough that "is the ecosystem still spreading or stalling?" needs a weekly answer. This skill turns that question into a recurring measurement: new repos integrating the protocol, npm adoption velocity, notable announcements, and a composite momentum score. The skill is parameterized — by default it tracks **x402** (HTTP-native micropayments for AI agents), but the operator can repoint it at any protocol by editing `memory/topics/tracked-protocol.md`.

## Config

This skill is driven entirely by `memory/topics/tracked-protocol.md`. If the file doesn't exist, create the seed below and continue with the x402 default:

```markdown
# Tracked Protocol

## Default
x402

## Protocols

### x402
- **Search queries (GitHub):**
  - `x402`
  - `"x402 protocol"`
- **npm packages to watch:**
  - `@coinbase/x402`
  - `x402`
  - `paykit`
- **WebSearch queries:**
  - `x402 payment agent`
  - `"x402 protocol" site:github.com OR site:npmjs.com OR site:blog`
- **One-line context:** HTTP-native micropayments rail for AI agents. Stablecoin payments per API call.

### <your-protocol>
- **Search queries (GitHub):** ...
- **npm packages to watch:** ...
- **WebSearch queries:** ...
- **One-line context:** ...
```

If `${var}` is set, select that stanza. Otherwise use the `Default` stanza.

If the resolved stanza is missing any of `Search queries`, `npm packages`, or `WebSearch queries`, log `PROTOCOL_MONITOR_NO_CONFIG: incomplete stanza for <protocol>` and exit (no notification).

## State

Per-protocol state lives at `memory/topics/protocol-state-<protocol>.md`. If it doesn't exist, create with this seed:

```markdown
# <protocol> Ecosystem Tracker

*Last run: never*

## Known Integrations
(populated on first run)

## Key Stats
- npm <pkg>: unknown weekly downloads
- GitHub repos matching <query>: unknown
- Notable announcements: (none recorded)

## Signal Log
(populated on first run)
```

Extract:
- `known_integrations` — list of repos/projects already integrating the protocol
- `npm_last_known` — last recorded weekly downloads per watched package (or "unknown")
- `gh_repo_count_last` — last recorded GitHub repo count

## Steps

### 1. Search GitHub for fresh integrations

For each `Search query` in the resolved stanza:

```bash
gh search repos "<query>" --sort=updated --limit=20 \
  --json=fullName,description,stargazersCount,updatedAt,language
```

Fallback if `gh search repos` fails:

```bash
gh api "search/repositories?q=<query>+in:readme+in:description&sort=updated&per_page=20" \
  --jq '.items[] | {full_name, description, stargazers_count, updated_at, language}'
```

From the union of results:
- Filter to repos updated in the last 7 days
- Cross-check against `known_integrations` — mark anything NEW (not in baseline)
- Note star count and brief description for each

### 2. Fetch npm download trend

For each `npm package` in the resolved stanza, use **WebFetch** (not curl — sandbox-resilient and these endpoints are unauthenticated):

```
https://api.npmjs.org/downloads/point/last-week/<pkg>
```

Returns JSON with a `downloads` field. Record this week's count per package. Compute delta vs `npm_last_known`.

If a package returns 404, skip it (the package may have been renamed) and note in the log.

### 3. WebSearch for protocol news

For each `WebSearch query` in the resolved stanza, run WebSearch (limit to past 7 days where the tool supports it).

From results, extract:
- New integrations or launches
- Developer blog posts or tutorials
- Protocol updates or spec changes
- Notable company/project announcements

Flag any result that's genuinely new vs baseline.

### 4. Synthesize the signal

Rate ecosystem momentum this week:

| Signal | Points |
|--------|--------|
| New GitHub repo integrating the protocol (updated last 7d, not in baseline) | +2 each |
| npm weekly downloads up vs last known (per package) | +3 |
| Notable announcement (company, product, protocol update) | +2 each |
| New developer tutorial / blog post | +1 each |
| Mentioned in trending context (adjacent narrative) | +1 |

**Momentum levels:**
- 0–2: quiet week
- 3–6: building
- 7–10: accelerating
- 11+: breakout

### 5. Update `memory/topics/protocol-state-<protocol>.md`

Rewrite with:
- Updated `*Last run: ${today}*`
- Updated `Known Integrations` (add newly discovered)
- Updated `npm_last_known` per package
- Updated `gh_repo_count_last`
- Appended entry to `Signal Log`

### 6. Notify

Write to `.pending-notify-temp/protocol-monitor-${protocol}-${today}.md` (create dir if needed), then:

```bash
./notify -f .pending-notify-temp/protocol-monitor-${protocol}-${today}.md
```

Format (voice per the Voice section above):

```
<protocol> pulse — ${today}

momentum: <level> (<score> pts)

new integrations (<count>):
- <full_name>: <description_one_line> (<stars>★)

npm <pkg>: <downloads>/wk (<delta> vs last week, or "first data point")
npm <pkg2>: ...

signals:
- <one-line summary of top news item>
- <one-line summary of next>

quiet week. ecosystem still compounding.   ← only if momentum == 0

state: memory/topics/protocol-state-<protocol>.md
```

Keep total under 900 chars. Do NOT use `./notify "$(cat ...)"` — write the file first, pass `-f path`.

If momentum score is 0, no new repos, no news: log `PROTOCOL_MONITOR_OK: quiet` and skip notification.

### 7. Log to `memory/logs/${today}.md`

```markdown
## Protocol Monitor — <protocol>
- **New repos (7d):** <count>
- **npm downloads:** <pkg>=<n>/wk (delta <±n>); <pkg2>=<n>/wk
- **Notable signals:** <count>
- **Momentum score:** <score> (<level>)
- **Notification:** sent / skipped (quiet)
- PROTOCOL_MONITOR_OK
```

## Required Env Vars

None. Uses `gh` CLI (GITHUB_TOKEN via workflow), WebFetch, WebSearch.

## Sandbox Note

- `gh search repos` and `gh api` use the gh CLI — handles auth internally, no env-var expansion in headers.
- npm API: use **WebFetch** (not curl — sandbox may block outbound). WebFetch bypasses the sandbox network gate.
- WebSearch: built-in tool, always available.

## What to watch for (recurring signal classes)

- New repos with the protocol name in README/description, updated in last 7 days — primary adoption signal
- npm download velocity — measures developer install rate, more reliable than tweet volume
- Corporate-backing materialization (cloud / payments / standards-body integrations)
- Cross-domain adoptions (the protocol escaping its original niche)
- Protocol updates — spec changes, new SDK versions, EIPs / RFCs
