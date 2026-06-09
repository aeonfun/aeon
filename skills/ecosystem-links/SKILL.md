---
name: ecosystem-links
description: Link-health audit of ECOSYSTEM.md — checks every GitHub repo for archived/disabled state and every project URL for HTTP 4xx/5xx or redirect chains, surfacing dead/archived/moved entries before a casual reader stumbles into one. Closes the three-skill ecosystem loop with ecosystem-entrants (arrivals) and ecosystem-pulse (liveness).
var: ""
tags: [research, dev]
---

> **${var}** — Optional. `dry-run` skips notify (state still updates and article still writes). Empty = normal run.

Today is ${today}. `ECOSYSTEM.md` is the curated catalog of projects, agents, and products building on top of Aeon — 30+ entries today, growing in irregular bursts. `ecosystem-pulse` measures activity for projects that already resolve to a GitHub repo. `ecosystem-entrants` reports week-over-week arrivals and departures. Neither catches entries whose URLs have gone 404, whose GitHub repo got archived, or whose custom domain lapsed. The first time a casual visitor clicks an ecosystem row and hits a dead page, the catalog stops being trustworthy.

This skill closes that gap. It is a weekly Monday URL-health audit of every link in `ECOSYSTEM.md` — GitHub repos, X handles, custom project domains, anything in the links column. Read-only against `ECOSYSTEM.md`; curation stays a human PR decision per the file's own "Add your project" rules.

Read `memory/MEMORY.md` for context.
Read the last 8 days of `memory/logs/` for prior-run context.
Read `soul/SOUL.md` + `soul/STYLE.md` if populated to match voice in the notification and article.

## Why a separate skill from ecosystem-pulse and ecosystem-entrants

| Skill | Question answered | Cadence | Slot |
|-------|-------------------|---------|------|
| `ecosystem-pulse` | "Are listed projects shipping this week?" | Weekly (Mon 11:00 UTC) | Liveness of *known-good* GitHub repos |
| `ecosystem-entrants` | "What was added to ECOSYSTEM.md this week?" | Weekly (Mon 11:45 UTC) | First-touch of new entries |
| **`ecosystem-links`** | **"Do every row's URLs still resolve?"** | **Weekly (Mon 11:55 UTC)** | **URL validity across the full catalog** |

The three skills compose into a closed feedback loop on the ecosystem catalog: arrivals → liveness → link integrity. Together they catch the three failure modes a static list can hide: a project that landed and was never noticed, a project that listed and then went silent, and a project whose URLs went stale. Building any of them into the others would entangle three different questions (binary added/removed vs. gradated activity vs. binary URL state) — keeping each skill structurally simple is the point.

`ecosystem-pulse` already calls `gh api repos/{owner}/{repo}` for projects that resolve to a GitHub repo. It does **not** check `archived` or `disabled` flags (it cares about `pushed_at` recency), and it never touches the non-GitHub URLs in the row. `ecosystem-links` fills the URL-validity gap without re-doing pulse's recency work.

## Inputs

| Source | Purpose | Auth |
|--------|---------|------|
| `ECOSYSTEM.md` (repo root) | Project list — all URLs parsed from the markdown table | Local file |
| `memory/topics/ecosystem-links-state.json` | Prior-week per-URL snapshot for week-over-week transition detection | Local file |
| `gh api repos/{owner}/{repo}` | Read `archived`, `disabled`, `html_url` for GitHub URLs | `GH_TOKEN` |
| `curl -sI --max-time 10 --location {url}` (with `WebFetch` fallback) | HTTP status + redirect chain for non-GitHub URLs | None / public web |

No new secrets. GitHub access uses the `gh` CLI (`GH_TOKEN`), which handles auth internally — see Sandbox note. All non-GitHub URLs are read with the public web — no Aeon credentials are ever sent to a third-party domain.

Writes:
- `memory/topics/ecosystem-links-state.json` — per-URL snapshot keyed by the canonical URL
- `articles/ecosystem-links-${today}.md` — digest on every non-error run (including QUIET; the article is the durable record even when the notification is suppressed)
- `memory/logs/${today}.md` — one log block per run
- Notification via `./notify` — only when ≥1 DEAD or newly-ARCHIVED URL has surfaced since the last run (see step 7)

## URL extraction

Each `ECOSYSTEM.md` row exposes a third pipe-delimited cell containing one or more Markdown links: `[label](url) · [label2](url2)`. Logo URLs in the first cell (`<img src="...">`) are **out of scope** — they are CDN-hosted by Twitter/CoinGecko and their freshness is not a curation signal. We check the operator-curated outbound links only.

For each accepted row:

1. Extract the project **name** from the second pipe-delimited cell.
2. Extract every `[label](url)` match in the third cell, in order. Keep the raw URL string verbatim — no normalisation (case + trailing slash matter for cache keys).
3. **Classify** each URL by host:
   - `github.com/{owner}/{repo}[/...]` → kind=`github`, target=`{owner}/{repo}` (strip path tail beyond the repo).
   - `x.com/{handle}` or `twitter.com/{handle}` → kind=`x`. **Not checked**: X aggressively rate-limits unauthenticated HEAD requests and a 429/403 from X would generate noise indistinguishable from a real dead handle. Recorded for completeness; status frozen as `XONLY`.
   - Any other `http(s)://` host → kind=`web`, target=full URL.
4. Skip non-HTTP schemes (mailto, telegram, discord invites with their own auth flows). Recorded as `kind=other`, status frozen as `OTHER`.

Within a single row, deduplicate URLs after classification — a row that lists the same GitHub repo twice (once in handle column, once standalone) doesn't get checked twice. Across rows, the same URL appearing in two projects is checked once and the result fans out to both.

## Buckets

Every checked URL is bucketed by the result of its check this run:

| Bucket | Rule | Notify? |
|--------|------|---------|
| `OK` | HTTP 2xx on direct hit; or final URL after redirect chain shares the same registrable host as the source URL. For GitHub: repo lookup succeeded and `archived=false`, `disabled=false`. | No |
| `ARCHIVED` | GitHub repo lookup succeeded and `archived=true`. Includes `disabled=true` (treated as the more severe form of "this repo is no longer maintained"). | Yes (when newly transitioned) |
| `MOVED` | Redirect chain terminates on a *different* registrable host than the source URL (e.g. `oldproject.io` → `newowner.tech` or to a parked domain). Logged separately from DEAD because the source still resolves — but the destination is no longer what the operator listed. | Yes (when newly transitioned) |
| `DEAD` | Final HTTP status is 4xx or 5xx. Includes connection refused, DNS NXDOMAIN, and TLS handshake failures (all surfaced under the same operator-facing "DEAD" tier — the distinction matters less than "this link does not resolve to a working page"). | Yes |
| `INCONCLUSIVE` | Network-side failure that cannot distinguish "URL gone" from "our check failed" — e.g. fetch tool error, timeout, sandbox-blocked outbound. Never escalates to DEAD on a single run (would false-flag the operator's curation in a sandbox-blocked environment). Surfaces in the article; suppressed from notifications until **two consecutive runs** see the same INCONCLUSIVE for the same URL — at that point reclassified to `DEAD` and notified. | No (first hit) / Yes (second consecutive) |
| `XONLY` | URL is on `x.com`/`twitter.com`. Not checked, recorded for completeness. | No |
| `OTHER` | Non-HTTP scheme. Not checked, recorded for completeness. | No |

`MOVED` deliberately stays separate from `OK`: a redirect from `https://foo.com` to `https://www.foo.com` shares the registrable host (`foo.com`) and is treated as `OK`. A redirect to a completely different domain (parked landing page, registrar holding page, new owner's marketing site) means the original URL no longer reaches the project the operator listed — that's a curation issue worth a Monday morning surface.

## State schema

`memory/topics/ecosystem-links-state.json`:

```json
{
  "last_run": "2026-06-08",
  "last_status": "ECOSYSTEM_LINKS_OK",
  "urls": {
    "https://github.com/aaronjmars/MiroShark": {
      "kind": "github",
      "project": "MiroShark",
      "bucket": "OK",
      "http_status": null,
      "github_archived": false,
      "github_disabled": false,
      "final_url": null,
      "first_seen": "2026-05-12",
      "last_seen": "2026-06-08",
      "last_ok": "2026-06-08",
      "inconclusive_streak": 0
    },
    "https://oldproject.io": {
      "kind": "web",
      "project": "OldProject",
      "bucket": "MOVED",
      "http_status": 200,
      "final_url": "https://parking.registrar.com/oldproject.io",
      "first_seen": "2026-04-08",
      "last_seen": "2026-06-08",
      "last_ok": "2026-05-20",
      "inconclusive_streak": 0
    }
  }
}
```

Invariants:
- `urls` is keyed by the **raw URL string** as it appears in `ECOSYSTEM.md` — preserves the exact characters the operator chose so the diff against next week's parse is byte-stable.
- `project` is recorded per URL even though the same URL can appear under multiple rows — for those, `project` lists the first project that introduced the URL (display-only field; not a join key).
- `first_seen` is the date this URL first appeared in any run — never overwritten. `last_seen` is the most recent run where the URL was present in `ECOSYSTEM.md` — overwritten every run that sees it. `last_ok` is the most recent run where the URL was in bucket `OK` — overwritten on success only, retained on failure so the operator can see "this has been broken since X".
- `inconclusive_streak` counts consecutive runs that ended in `INCONCLUSIVE` for this URL — reset to 0 on any non-INCONCLUSIVE result. When this counter hits 2, the next INCONCLUSIVE run reclassifies the URL to `DEAD` (see Buckets table).
- A URL whose `last_seen` is more than 28 days old is **pruned** from state (matches `ecosystem-entrants` pruning policy — a URL that was removed and then re-added much later is treated as a fresh entry; the operator's question on re-add is "does this work?" not "did it come back?").
- A URL whose row is removed from `ECOSYSTEM.md` is **not** reported as DEAD — its row left the catalog, so its status is no longer a curation concern. Pruning is silent.

## Steps

### 0. Bootstrap

```bash
mkdir -p memory/topics articles
[ -f memory/topics/ecosystem-links-state.json ] || cat > memory/topics/ecosystem-links-state.json <<'EOF'
{"last_run":null,"last_status":null,"urls":{}}
EOF
```

If `jq empty memory/topics/ecosystem-links-state.json` fails (corrupt JSON from an aborted write), back it up to `.bak`, reset to the empty template, and tag the run `STATE_CORRUPT`. Continue — a fresh state file means re-checking every URL from scratch this run; transitions cannot fire (no prior to diff against), but the notification gate falls back to "any DEAD / ARCHIVED / MOVED in the current snapshot" so genuine issues still surface.

### 1. Parse var

- Lowercase, trim. If the resulting string equals `dry-run`, set `MODE=dry-run`. Empty → `MODE=execute`.
- Any other non-empty value → log `ECOSYSTEM_LINKS_BAD_VAR: ${var}` and exit (no writes, no notify).

### 2. Parse ECOSYSTEM.md

If `ECOSYSTEM.md` does not exist at the repo root → log `ECOSYSTEM_LINKS_NO_ECOSYSTEM_FILE`, write a one-line notification (`ecosystem-links: ECOSYSTEM.md not found at repo root`), exit. The file is the floor — if it's missing the skill has no signal to compute on.

Apply the same parser shape as `ecosystem-entrants` so the two skills can never disagree on what counts as a row:

- Read every line that begins with `| ` and contains at least 2 `|` separators after the leading one.
- Reject the header line and the divider line.
- Reject rows where the second cell is empty after trim (decorative separators).
- Scope to the **first** markdown table whose header line includes the word `Project` (case-insensitive). If no such header is found → log `ECOSYSTEM_LINKS_NO_PROJECT_TABLE`, exit with no notify.

For each accepted row: extract the project name (second cell) and every `[label](url)` link in the third cell. Classify each URL per the URL extraction section.

### 3. Check each URL

Process the URL set with light per-host rate-limiting — at most one outbound HEAD per host per 1.5s — to avoid hammering any single project's origin. Whole-skill timeout: 8 minutes (the catalog is ~30 entries today × ≤4 URLs per row × ~3s per check, comfortably under the cap with headroom for growth).

**GitHub URLs (`kind=github`)**:

```bash
gh api "repos/${target}" --jq '{archived, disabled, html_url, name}' > "/tmp/ecosystem-links-gh-${i}.json" 2>/tmp/ecosystem-links-gh-${i}.err
```

Outcomes:
- `archived: true` → `ARCHIVED` (also set if `disabled: true`).
- `archived: false`, `disabled: false` → `OK`.
- HTTP 404 (`gh api` exit code 1 with `Not Found` in stderr) → `DEAD`.
- Any other failure (rate-limit, network) → `INCONCLUSIVE`.

**Web URLs (`kind=web`)**:

```bash
curl -sI --max-time 10 --location --user-agent "aeon-ecosystem-links/1.0" "${url}" -o /tmp/ecosystem-links-${i}.headers -w '%{http_code} %{url_effective}\n' > /tmp/ecosystem-links-${i}.curlout 2>/tmp/ecosystem-links-${i}.err
```

Outcomes:
- Status 2xx + final URL's registrable host matches the source → `OK`.
- Status 2xx + final URL's registrable host differs → `MOVED`.
- Status 3xx that did **not** terminate (curl followed `--location` so this would only happen if redirect chain exceeded curl's default 50-hop cap) → `INCONCLUSIVE`.
- Status 4xx or 5xx → `DEAD`.
- curl error (DNS, TLS, connection refused, timeout) → first attempt is `INCONCLUSIVE`. **Retry once via WebFetch** as a sandbox-aware fallback — WebFetch is a built-in Claude tool that bypasses the sandbox per CLAUDE.md pattern 1. If WebFetch returns a 2xx page → `OK`. If WebFetch errors → `INCONCLUSIVE` (do NOT escalate to DEAD on a single run; see Buckets).

Registrable host comparison uses a conservative public-suffix-style match: compare the final two labels (`a.b.c.example.com` → `example.com`; `co.uk` style suffixes treat the final three labels as the registrable host — `example.co.uk` not `co.uk`). Edge cases at the boundary (`subdomain.github.io` → `github.io`) are listed as `MOVED` since a project that listed `myproject.github.io` and now redirects to a non-`myproject` host has meaningfully moved.

`kind=x`, `kind=other` are not checked in step 3 — they go straight into the snapshot with `bucket=XONLY` / `OTHER`.

### 4. Diff against prior state — compute transitions

For each URL in the current snapshot, look up the prior-run record in `state.urls[url]`:

- `prior_bucket = state.urls[url].bucket`
- `current_bucket = result of step 3`
- A **transition** is recorded when `prior_bucket != current_bucket` and **both** are non-null.

Transitions worth surfacing:

| From | To | Severity | Notify? |
|------|----|----|---------|
| `OK` | `DEAD` | High | Yes |
| `OK` | `ARCHIVED` | Medium | Yes |
| `OK` | `MOVED` | Medium | Yes |
| `DEAD` | `OK` | Recovery | Yes |
| `ARCHIVED` | `OK` | Recovery | Yes |
| `MOVED` | `OK` | Recovery | Yes |
| any | `INCONCLUSIVE` | Noise | No |
| `INCONCLUSIVE` | any | Resolution | Only if the resolved bucket is itself notifiable (DEAD/ARCHIVED/MOVED) |
| `XONLY` / `OTHER` | any | Out of scope | No |

`OK → INCONCLUSIVE` is never notified — would re-create the dependabot-noise pattern other skills work hard to suppress (transient sandbox failures should not page the operator). Recoveries ARE notified: an operator who saw "DEAD: foo.com" last week needs the closing "RECOVERED: foo.com" this week so they don't keep checking on it manually.

### 5. Build the digest counts

For the article:

- `N` = total URLs in this run's snapshot
- `OK_C` = count in OK
- `ARCH_C` = count in ARCHIVED
- `MOVED_C` = count in MOVED
- `DEAD_C` = count in DEAD
- `INC_C` = count in INCONCLUSIVE
- `XO_C` = count in XONLY
- `OT_C` = count in OTHER

Plus transitions since last run: `T_NEW_DEAD`, `T_NEW_ARCH`, `T_NEW_MOVED`, `T_RECOVERED`.

### 6. Write the article

Overwrite `articles/ecosystem-links-${today}.md`:

```markdown
# Ecosystem Links — ${today}

*ECOSYSTEM.md URLs this week: {N} checked. OK: {OK_C}. Archived: {ARCH_C}. Moved: {MOVED_C}. Dead: {DEAD_C}. Inconclusive: {INC_C}. X-only (unchecked): {XO_C}.*

*Since last run: {T_NEW_DEAD} newly dead · {T_NEW_ARCH} newly archived · {T_NEW_MOVED} newly moved · {T_RECOVERED} recovered.*

## Dead ({DEAD_C})

| Project | URL | Status | Last OK | Notes |
|---------|-----|--------|---------|-------|

## Archived ({ARCH_C})

| Project | URL | First archived seen | Notes |
|---------|-----|---------------------|-------|

## Moved ({MOVED_C})

| Project | URL | Resolves to | First moved seen |
|---------|-----|-------------|------------------|

## Recovered since last run ({T_RECOVERED})

| Project | URL | Previous bucket |
|---------|-----|-----------------|

## Inconclusive ({INC_C})

| Project | URL | Streak | Notes |
|---------|-----|--------|-------|

*INCONCLUSIVE entries are NOT failures — the check could not reach a verdict this run (sandbox / transient / fetch tool error). After two consecutive INCONCLUSIVE runs the entry is reclassified to DEAD and notified.*

## Full URL list ({N})

| Project | URL | Kind | Bucket | Last seen |
|---------|-----|------|--------|-----------|

---
*Generated by `ecosystem-links`. URL kinds: github (live `gh api` repo lookup), web (HTTP HEAD + redirect chain), x (unchecked: rate-limited surface), other (non-HTTP scheme). Run again with `var=dry-run` to refresh without sending a notification.*
```

Always write the article on a non-error run, even when DEAD/ARCHIVED/MOVED are all zero — the snapshot section is the durable record.

### 7. Decide whether to notify (gated)

Skip notify entirely on `BAD_VAR`, `NO_ECOSYSTEM_FILE`, `NO_PROJECT_TABLE`, `DRY_RUN`, `STATE_CORRUPT`.

Otherwise notify only if any of:

1. **First (baseline) run** — `state.urls` was empty before this run. One-liner watermark; do NOT fire N notifications for every URL just because we'd never seen them before.
2. **≥1 transition into DEAD, ARCHIVED, or MOVED** this run (per step 4's table).
3. **≥1 transition out of DEAD, ARCHIVED, or MOVED back to OK** (recovery surface — closes the prior alert's loop).
4. **`STATE_CORRUPT` recovery special case**: the diff against the prior snapshot is lost this run. If the current snapshot has any URL in DEAD/ARCHIVED/MOVED, fire a single notification listing them so the operator gets the post-corruption signal — flagged in the body as `(post-state-corruption baseline)` so they know transitions aren't being computed this run.

Pure-INCONCLUSIVE rounds never notify (would be a sandbox-failure paging loop).

### 8. Notification format

Baseline (first) run:

```
*Ecosystem Links — baseline — ${today}*

ecosystem-links is now monitoring {N} URLs across ECOSYSTEM.md.
Next Monday will report transitions. Snapshot in
articles/ecosystem-links-${today}.md.
```

Normal run with transitions:

```
*Ecosystem Links — ${today}*

ECOSYSTEM.md: {N} URLs checked · {T_NEW_DEAD} newly dead · {T_NEW_ARCH} newly archived · {T_NEW_MOVED} newly moved · {T_RECOVERED} recovered since last Monday

{If T_NEW_DEAD > 0:}
Dead:
- {Project}: {url} ({http status or error})
- ...

{If T_NEW_ARCH > 0:}
Archived:
- {Project}: {url}

{If T_NEW_MOVED > 0:}
Moved (resolves to a different host now):
- {Project}: {url} → {final_url}

{If T_RECOVERED > 0:}
Recovered:
- {Project}: {url} (was {prior_bucket})

Full digest: articles/ecosystem-links-${today}.md
```

Keep under 900 chars. If any section has more than 6 entries, list the first 6 and append "+M more (see article)" — preserves the dashboard render and the article carries the full list.

Send via `./notify "$MSG"` (single positional argument).

### 9. Persist state

Atomically overwrite `memory/topics/ecosystem-links-state.json` with the post-run snapshot:

- For every URL in the current snapshot: set `last_seen=${today}`; preserve `first_seen` if it exists, otherwise set it to `${today}`; update `kind`, `project`, `bucket`, `http_status`, `final_url`, `github_archived`, `github_disabled`.
- Update `last_ok` to `${today}` when `bucket=OK`; otherwise preserve the prior value.
- Bump `inconclusive_streak` by 1 when `bucket=INCONCLUSIVE`; reset to 0 otherwise.
- Drop URLs whose `last_seen` is older than 28 days from `${today}` (silent pruning per the state schema rule).
- Set `last_run=${today}` and `last_status` to the exit-taxonomy code from below.

Write to `memory/topics/ecosystem-links-state.json.tmp` first, then `mv` over the live path so a mid-write crash never leaves half-formed JSON.

### 10. Log

Append to `memory/logs/${today}.md`:

```markdown
## ecosystem-links
- **URLs checked**: {N} (github: G, web: W, x-only: XO_C, other: OT_C)
- **OK**: {OK_C} · **Archived**: {ARCH_C} · **Moved**: {MOVED_C} · **Dead**: {DEAD_C} · **Inconclusive**: {INC_C}
- **Transitions since last run**: {T_NEW_DEAD} new dead · {T_NEW_ARCH} new archived · {T_NEW_MOVED} new moved · {T_RECOVERED} recovered
- **Baseline run**: yes/no
- **Article**: articles/ecosystem-links-${today}.md
- **Notification**: sent / skipped (gated)
- **Status**: ECOSYSTEM_LINKS_OK
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `ECOSYSTEM_LINKS_OK` | Audit written; ≥1 notifiable transition, baseline run, or post-corruption snapshot with notifiable entries | Yes |
| `ECOSYSTEM_LINKS_QUIET` | Audit written; no notifiable transitions and no DEAD/ARCHIVED/MOVED entries | No (article + state still write) |
| `ECOSYSTEM_LINKS_NO_ECOSYSTEM_FILE` | `ECOSYSTEM.md` missing at the repo root | Yes (one-line failure notify) |
| `ECOSYSTEM_LINKS_NO_PROJECT_TABLE` | File present but no `Project`-header table found | Yes (one-line failure notify) |
| `ECOSYSTEM_LINKS_DRY_RUN` | `MODE=dry-run`; article + state wrote, notify skipped | No |
| `ECOSYSTEM_LINKS_STATE_CORRUPT` | State JSON unreadable, recreated; post-corruption baseline notify only if current snapshot has notifiable entries | Conditional |
| `ECOSYSTEM_LINKS_BAD_VAR` | `${var}` parse failed | No |

`OK` and `QUIET` are the two success states. The split lets the dashboard show "ran clean, everything resolves" without overloading the OK row.

## Design notes (do not edit without reading)

- **INCONCLUSIVE never single-shots to DEAD.** The most likely cause of an INCONCLUSIVE on aeon-agent is a sandbox-blocked outbound, not a genuinely dead URL. Treating a sandbox failure as a DEAD verdict would false-flag healthy projects on every run that the sandbox happens to misfire. The two-strike rule means a real dead URL fires within a week of going down (run T sees INCONCLUSIVE, run T+1 sees INCONCLUSIVE-streak=2 → reclassified DEAD), while a sandbox glitch self-clears on the next run.
- **X / Twitter URLs are recorded but not checked.** Unauthenticated HEAD requests to x.com are aggressively rate-limited; a 429 from X reads identically to a real 4xx for a dead handle. Surfacing a flood of `DEAD: @handle` rows that are actually "X blocked us" would slander the operator's curation. The article surfaces the X-only count for transparency, and the operator can manually audit those handles when they want to.
- **Logo URLs in the first cell are out of scope.** Logo CDN hosts (pbs.twimg.com, coin-images.coingecko.com, custom CDNs) are not curation surfaces — they are display assets owned by upstream services, and their availability is not a signal about the project's liveness. Checking them would generate noise the operator cannot act on.
- **MOVED is separate from DEAD on purpose.** A redirect from `foo.com` to `bar.com` resolves successfully — the original URL still works. But the destination is no longer what the operator listed (e.g. the domain expired and is now parked on a registrar landing page). That's a curation issue, but a *softer* one than DEAD — surfaced separately so the operator can prioritise.
- **Recoveries fire a notification.** If the operator saw "DEAD: foo.com" last week, they need closure when the same URL comes back. Otherwise they'll keep checking manually, or worse, doubt the next DEAD alert as "probably transient like last time."
- **The diff is the source of truth, not any single run's verdict.** A URL can go from DEAD → OK → DEAD across three runs (transient infrastructure issues, scheduled maintenance, etc.). Every transition is reported as it happens — the digest doesn't try to smooth over noisy weeks. If real-world noise gets bad enough that the notifications themselves become noise, the right response is to raise the INCONCLUSIVE streak threshold or add a per-URL allowlist, not to silently smooth the data.
- **Per-host rate-limit (1.5s gap) is conservative on purpose.** ECOSYSTEM.md will hit 100+ entries before the budget becomes a real bottleneck. At today's ~30 entries with 1–3 web URLs each and ~3 entries per host max, the worst-case rate budget is well under the 8-minute total cap. If/when the catalog grows past ~150 web URLs the cap can be re-evaluated.
- **`STATE_CORRUPT` is recoverable, not silent.** A fresh state file post-corruption means transitions cannot be computed this run, but the snapshot itself is still real data. If the snapshot contains URLs in DEAD/ARCHIVED/MOVED, the operator gets a single explicit `(post-state-corruption baseline)` notification listing them — same severity as a baseline-run notification, distinct flag in the body. Going silent post-corruption is the wrong default: a corrupted state file shouldn't suppress signals that exist in the current parse.
- **Read-only against `ECOSYSTEM.md`.** Curation is a human PR decision per the file's own "Add your project" rules. This skill never edits the ecosystem list itself.
- **Pairs with but does not gate `ecosystem-pulse` or `ecosystem-entrants`.** All three run on Monday morning in non-overlapping minute slots; a slow ecosystem-links never blocks the other two from running on schedule.

## Sandbox Note

Two outbound surfaces:

1. **GitHub API** via `gh api` — handles `GH_TOKEN` internally per CLAUDE.md, no env-var expansion in headers.
2. **Public web HEAD** via `curl -sI --max-time 10 --location` — public URLs with no auth, no secrets in headers. If curl fails (sandbox blocks outbound), retry once via `WebFetch` (built-in Claude tool that bypasses the sandbox). Only after WebFetch also fails does the URL get bucketed `INCONCLUSIVE` — and even then it takes two consecutive INCONCLUSIVE runs to reclassify to DEAD, so transient sandbox failures cannot generate a false alert.

No prefetch/postprocess wrapper required. The only other outbound call is `./notify`, which is already sandbox-safe.

## Required Env Vars

- `GH_TOKEN` (or `GITHUB_TOKEN` in CI) — provided by the runner; no new secret to provision.

No third-party API keys. No on-chain reads. No file writes outside `memory/`, `articles/`, and `/tmp/`.
