---
name: Repo Scanner
description: Catalog GitHub repos into a prioritized fleet report with concrete, coded opportunities that downstream skills consume directly
var: ""
tags: [dev, meta]
---
<!-- autoresearch: variation B — sharper output: opportunity taxonomy + fleet Top-5 + priority column + GraphQL bulk fetch -->
> **${var}** — GitHub username or org to scan. Required — set in aeon.yml var field. Accepts `name`, `@name`, or `https://github.com/name` (normalized to bare login).

Today is ${today}. Catalog all GitHub repos under `${var}` into a structured reference file that downstream skills (`external-feature`, `pr-review`, `code-health`, `repo-pulse`, `vercel-projects`) consume — each repo labelled with a **priority** and a list of **concrete, coded opportunities**, with a fleet-level **Top 5 opportunities** block at the top.

## Why this shape

`external-feature` is the main reader and needs specific, codeable targets, not free-form TODOs. This skill grounds every opportunity in a fixed taxonomy (`MISSING_CI`, `STALE_PRS:N`, `OPEN_ISSUE_BACKLOG:N`, …) so `external-feature` can pick one and ship a PR the same day. The pre-ranked Top 5 fleet opportunities block removes the ranking burden from every downstream skill.

## Steps

1. **Normalize and resolve OWNER.** Strip leading `@`, strip `https://github.com/` / `http://github.com/`, strip trailing slashes from `${var}`. If empty after normalization, check `memory/MEMORY.md` for a GitHub username under "About This Repo" or a `github: username` line. If still empty, send `./notify "repo-scanner: REPO_SCANNER_NO_USERNAME — set var or add to MEMORY.md"`, log, and exit. Store as `OWNER`.

2. **Load prior scan state.** If `memory/topics/repos.md` exists, read it and parse the trailing machine-readable block:
   ```
   <!-- repo-scanner-state
   name|pushedAt|category
   name|pushedAt|category
   -->
   ```
   Into `PRIOR` map. Missing file → empty map, full rescan. Used for change detection, archive/new-repo delta, and active→stale flips.

3. **Bulk-fetch repo metadata via GraphQL.** Run one paginated query (100 nodes per page, loop until `hasNextPage=false`) via `gh api graphql`:
   ```bash
   gh api graphql --paginate \
     -F owner="$OWNER" \
     -f query='
       query($owner: String!, $endCursor: String) {
         repositoryOwner(login: $owner) {
           repositories(first: 100, after: $endCursor,
                        orderBy: {field: PUSHED_AT, direction: DESC},
                        ownerAffiliations: OWNER) {
             pageInfo { hasNextPage endCursor }
             nodes {
               name url description pushedAt updatedAt createdAt
               isArchived isFork isTemplate isPrivate isEmpty
               stargazerCount forkCount diskUsage
               primaryLanguage { name }
               languages(first: 5, orderBy: {field: SIZE, direction: DESC}) { nodes { name } }
               repositoryTopics(first: 10) { nodes { topic { name } } }
               licenseInfo { spdxId }
               defaultBranchRef { name }
               issues(states: OPEN)        { totalCount }
               pullRequests(states: OPEN)  { totalCount }
               readme:        object(expression: "HEAD:README.md")         { ... on Blob { byteSize text } }
               claudemd:      object(expression: "HEAD:CLAUDE.md")         { ... on Blob { byteSize } }
               license_file:  object(expression: "HEAD:LICENSE")           { ... on Blob { byteSize } }
               dependabot:    object(expression: "HEAD:.github/dependabot.yml") { ... on Blob { byteSize } }
               contributing:  object(expression: "HEAD:CONTRIBUTING.md")   { ... on Blob { byteSize } }
               workflows:     object(expression: "HEAD:.github/workflows") { ... on Tree { entries { name } } }
               packagejson:   object(expression: "HEAD:package.json")      { ... on Blob { text } }
               cargotoml:     object(expression: "HEAD:Cargo.toml")        { ... on Blob { byteSize } }
               gomod:         object(expression: "HEAD:go.mod")            { ... on Blob { byteSize } }
               pyproject:     object(expression: "HEAD:pyproject.toml")    { ... on Blob { byteSize } }
               requirements:  object(expression: "HEAD:requirements.txt")  { ... on Blob { byteSize } }
               foundry:       object(expression: "HEAD:foundry.toml")      { ... on Blob { byteSize } }
               hardhat:       object(expression: "HEAD:hardhat.config.js") { ... on Blob { byteSize } }
             }
           }
         }
       }' > /tmp/repos-raw.json
   ```
   `--paginate` walks all pages. Merge all `nodes` into one list.

   Fetch `good first issue` counts per repo with a single follow-up call where `issues.totalCount > 0`:
   ```bash
   gh api "repos/$OWNER/$NAME/issues?labels=good%20first%20issue&state=open&per_page=1" -i \
     | awk '/^[Ll]ink:/{ match($0, /page=([0-9]+)>; rel="last"/, m); print m[1]+0; exit } END{ print 0 }'
   ```
   Skip this call for repos with 0 open issues.

   **Filter out:** `isArchived`, `isTemplate`, `isEmpty` (or `diskUsage==0`).

   **Error modes:**
   - Owner not found / API error → `./notify "repo-scanner: REPO_SCANNER_API_FAIL owner=$OWNER"`, exit 1.
   - Owner exists but all repos filtered out → proceed to step 5 with empty lists and set status to `REPO_SCANNER_EMPTY`.

4. **Derive per-repo fields.** For each surviving repo:

   - **Category** (by `pushedAt`):
     - `active` ≤ 30 days, `maintained` ≤ 90 days, `stale` > 90 days.
     - Forks are categorized by pushedAt like any other repo (**not** a separate category); the fork status is a tag (`fork`) shown in the Details block. This fixes a bug in the previous version where an actively maintained fork was demoted into the Forks bucket.

   - **Stack detection** — inspect blobs in this order; first match wins:
     - `packagejson.text` present → parse JSON, check for `next`, `react`, `vue`, `svelte`, `hono`, `express`, `vite`, `astro`, `remix`, `bun`, `fastify` in `dependencies`/`devDependencies`. Fallback `Node/TS` if `typescript` present else `Node/JS`.
     - `cargotoml` → `Rust`
     - `gomod` → `Go`
     - `pyproject` or `requirements` → `Python` (check `pyproject.text` if small for `fastapi`/`django`/`flask`)
     - `foundry` → `Solidity (Foundry)`; `hardhat` → `Solidity (Hardhat)`
     - Else → `primaryLanguage.name` (or `—` if null)

   - **"What"** — 1–2 sentence summary drawn from the first ~600 chars of `readme.text`. Strip Markdown badges (`![.*?](...)`), HTML tags, and emoji shields. Must be ≤ 240 chars. If README missing or `<200` bytes → flag `README_STUB` opportunity and fall back to GraphQL `description`; if that's also empty flag `EMPTY_DESCRIPTION`.

   - **Opportunities — emit zero or more codes from this fixed taxonomy:**
     | Code | Trigger |
     |------|---------|
     | `MISSING_CI` | `workflows` null OR `workflows.entries` empty |
     | `MISSING_LICENSE` | `licenseInfo` null AND `license_file` null |
     | `MISSING_DEPENDABOT` | `dependabot` null AND any of (packagejson, cargotoml, gomod, pyproject) present |
     | `MISSING_CLAUDE_MD` | `claudemd` null |
     | `MISSING_CONTRIBUTING` | `contributing` null AND `stars ≥ 10` |
     | `README_STUB` | `readme` null OR `readme.byteSize < 200` |
     | `EMPTY_DESCRIPTION` | `description` null or blank |
     | `OPEN_ISSUE_BACKLOG:N` | `issues.totalCount ≥ 10` (N = count) |
     | `STALE_PRS:N` | count of open PRs with `updatedAt` older than 14 days (fetch when `pullRequests.totalCount > 0`) |
     | `GOOD_FIRST_ISSUES:N` | count from the follow-up query when `N ≥ 1` |
     | `ABANDON_RISK` | category=stale AND `stars ≥ 10` AND pushedAt within last 180d (once-active repo going cold) |

     **Never emit free-form opportunities.** Taxonomy codes are the contract with `external-feature`.

   - **Priority** (derived):
     - `HIGH` — `active` AND `≥2` opportunities, OR `maintained` AND `stars ≥ 20` AND `≥1` opportunity
     - `MED` — `active` AND `1` opportunity, OR `maintained` AND `≥2` opportunities
     - `LOW` — everything else

   - **Agent-repo tag** — if `name` ends with `-aeon` or contains `aeon-agent`, add topic `agent-repo`. These stay in the catalog but are excluded from the fleet Top 5 (they evolve via `autoresearch`, not `external-feature`).

   - **Change-detection reuse** — if `PRIOR[name].pushedAt == current pushedAt`, reuse the prior `#### name` Details block (copy verbatim from the old `memory/topics/repos.md` under heading match). Keeps diffs meaningful and cuts rewrite churn.

5. **Rank the fleet Top 5.** Flatten (repo × opportunity) pairs across non-`agent-repo` repos. Rank by:
   1. Priority (HIGH > MED > LOW)
   2. Opportunity impact order: `MISSING_CI` > `MISSING_LICENSE` > `STALE_PRS` > `OPEN_ISSUE_BACKLOG` > `MISSING_DEPENDABOT` > `README_STUB` > `MISSING_CLAUDE_MD` > `MISSING_CONTRIBUTING` > `ABANDON_RISK` > `EMPTY_DESCRIPTION` > `GOOD_FIRST_ISSUES`
   3. `stargazerCount` desc
   4. `pushedAt` desc (tie-break)

   Take the top 5. Each row must include a concrete **one-line fix** written against the specific repo/stack (e.g., `Add .github/workflows/ci.yml running 'npm test' + 'npm run build' on push/PR`, not `Add CI`).

6. **Write the catalog** to `memory/topics/repos.md`:
   ```markdown
   # GitHub Repos — ${today}
   Last scan: ${today}
   Owner: ${OWNER}
   Totals: N repos · A active · M maintained · S stale · F forks
   Status: REPO_SCANNER_OK

   ## Top 5 fleet opportunities
   Pre-ranked; each row is a concrete target `external-feature` can pick up directly.
   | # | Repo | Priority | Opportunity | One-line fix |
   |---|------|----------|-------------|--------------|
   | 1 | [owner/name](url) | HIGH | MISSING_CI | Add `.github/workflows/ci.yml` running `npm test` on push/PR |
   | … |

   ## Delta since last scan
   - New: owner/foo
   - Archived (disappeared): owner/bar
   - Flipped active→stale: owner/baz
   - Resolved opportunities: owner/qux (MISSING_LICENSE)

   (Omit sub-bullets that are empty. Omit the entire section on first run.)

   ## Active (≤30d)
   | Repo | Priority | What | Stack | Opportunities | ★ | Issues/PRs | Last push |
   |------|----------|------|-------|---------------|---|------------|-----------|
   | [name](url) | HIGH | 1-sentence summary | Next.js | MISSING_CI, STALE_PRS:2 | 42 | 3/1 | YYYY-MM-DD |

   ## Maintained (≤90d)
   | … |

   ## Stale (>90d)
   | … |

   ---

   ### Repo Details

   #### name
   **What:** 1–2 sentence summary.
   **Stack:** language/framework + key deps.
   **Status:** active · fork: no
   **Topics:** topic1, topic2
   **License:** MIT
   **Numbers:** 42 ★ · 7 forks · 3 open issues · 1 open PR · last push YYYY-MM-DD
   **Opportunities:**
   - `MISSING_CI` — concrete fix for this repo
   - `OPEN_ISSUE_BACKLOG:12` — triage stale issues, close or label

   <!-- repo-scanner-state
   name|pushedAt|category
   name|pushedAt|category
   -->
   ```

   Keep **What** ≤ 120 chars in the table; long detail belongs in the `#### name` block. Every opportunity in Details must be a taxonomy code followed by a repo-specific concrete fix.

7. **Update the memory index.** If `memory/MEMORY.md` doesn't already link to `topics/repos.md`, append a pointer under "About This Repo" (or create that section):
   ```markdown
   - [Repo catalog](topics/repos.md) — GitHub fleet with prioritized opportunities
   ```

8. **Update `memory/watched-repos.md`** with every `active` + `maintained` + `HIGH`-priority `stale` repo. Rules:
   - Preserve lines referencing owners **other than** `${OWNER}` (hand-maintained cross-org entries).
   - One `${OWNER}/name` per line, sorted alphabetically.
   - Keep an initial `# Watched Repos` header.

9. **Notify** with one of these statuses:
   - `REPO_SCANNER_OK` → `repo-scanner: cataloged N repos (A/M/S · F forks) · top: {owner/name} {CODE} → {fix}`
   - `REPO_SCANNER_EMPTY` → `repo-scanner: owner=${OWNER} has no active non-archived repos`
   - `REPO_SCANNER_NO_USERNAME` → (already sent in step 1)
   - `REPO_SCANNER_API_FAIL` → `repo-scanner: GitHub API failed for owner=${OWNER}`

   Use `./notify "..."` with a single-line message.

10. **Log** to `memory/logs/${today}.md` under `### repo-scanner`:
    - Status code
    - Totals: `N total · A active · M maintained · S stale · F forks`
    - Top 5 lines (copy from the catalog Top 5 block)
    - Delta: `new:`, `archived:`, `flipped_active_to_stale:`, `resolved_opportunities:`

## Guidelines

- **Skip** archived, template, and empty (`diskUsage=0` or `isEmpty=true`) repos entirely — they waste downstream attention.
- **Opportunities must be taxonomy codes.** Adding a new code is fine; renaming existing codes breaks `external-feature` consumers.
- **Don't overwrite cross-owner entries in `watched-repos.md`.** Those are hand-curated and may reference orgs outside `${OWNER}`.
- **Agent repos stay in the catalog** but are excluded from Top 5 fleet opportunities — they evolve via `autoresearch`, not `external-feature`.
- **Change detection** — reuse prior Details blocks for unchanged `pushedAt` to keep diffs meaningful. The Top 5 and tables always regenerate from current data.

## Sandbox note

- **Primary path:** `gh api graphql --paginate` uses the workflow's `GITHUB_TOKEN` and does not rely on curl env-var expansion, so the sandbox curl blockage does not apply.
- **No cloning:** GraphQL `object(expression: "HEAD:…")` reads cover README, CLAUDE.md, LICENSE, dependabot, workflows, and all common manifest files — no `gh repo clone` needed, which also eliminates the `/tmp/repo-scan` cleanup path and disk pressure on large orgs.
- **Fallback:** if `gh api graphql` fails persistently, fall back to `gh repo list "$OWNER" --limit 500 --json name,description,pushedAt,primaryLanguage,isArchived,isFork,stargazerCount,url,defaultBranchRef,repositoryTopics,licenseInfo` plus per-repo `gh api "repos/$OWNER/$NAME/contents/PATH" --silent 2>/dev/null` probes for file existence. Slower (~1 req/file/repo) but same auth path.
- **WebFetch** is not useful here — GitHub's HTML doesn't expose the same structured metadata and the sandbox fallback is already served by `gh`.

## Output schema (stable)

Downstream consumers (`external-feature`, `pr-review`, `code-health`, `repo-pulse`, `vercel-projects`) grep against `memory/topics/repos.md` for these exact fields. **Do not rename or remove these without a coordinated update** across every consumer skill:

- Section headings: `## Top 5 fleet opportunities`, `## Active (≤30d)`, `## Maintained (≤90d)`, `## Stale (>90d)`, `## Delta since last scan`, `### Repo Details`
- Per-repo heading: `#### {name}`
- Per-repo labelled fields: `**What:**`, `**Stack:**`, `**Status:**`, `**Topics:**`, `**License:**`, `**Numbers:**`, `**Opportunities:**`
- Machine block delimiters: `<!-- repo-scanner-state` … `-->` and the `name|pushedAt|category` pipe-schema inside
- Opportunity taxonomy codes (see step 4 table): `MISSING_CI`, `MISSING_LICENSE`, `MISSING_DEPENDABOT`, `MISSING_CLAUDE_MD`, `MISSING_CONTRIBUTING`, `README_STUB`, `EMPTY_DESCRIPTION`, `OPEN_ISSUE_BACKLOG:N`, `STALE_PRS:N`, `GOOD_FIRST_ISSUES:N`, `ABANDON_RISK`. Adding new codes is fine; renaming existing ones breaks consumers.
- Status codes: `REPO_SCANNER_OK`, `REPO_SCANNER_EMPTY`, `REPO_SCANNER_NO_USERNAME`, `REPO_SCANNER_API_FAIL`.

## Constraints

- Do **not** rename the following schema elements — downstream skills grep for them: `## Active`, `## Maintained`, `## Stale`, `#### {name}`, `**Opportunities:**`, `## Top 5 fleet opportunities`, `<!-- repo-scanner-state`.
- Taxonomy codes are stable. Add new codes, never rename. Downstream code keys off the code prefix before the colon.
- Do **not** introduce new env vars — `GITHUB_TOKEN` is already provided to `gh` by the workflow.
- Do **not** change `${var}` semantics (still "GitHub username or org"); normalization is purely additive.
- On weekly Sunday schedule a single run may issue 100–300 GraphQL calls for large orgs — well within the 5000 req/h unauthenticated ceiling and the higher authenticated one. Avoid making the GraphQL object list larger than needed.
