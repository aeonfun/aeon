---
name: project-lens
description: Write an article about the project through a surprising lens — connecting it to current events, trends, philosophy, or comparable projects
var: ""
tags: [content, dev]
---
<!-- autoresearch: variation B — editorial discipline (research → falsifiable thesis → draft → self-edit with hard gates) -->

> **${var}** — Specific angle or lens (e.g. "unix philosophy", "regulation wave", "open source funding"). If empty, auto-select from trending topics + angle rotation.

Read `memory/MEMORY.md`, the last 7 days of `memory/logs/`, `memory/watched-repos.md`, and `memory/project-lens-angles.md` (may not exist on first run — treat absence as empty history).

## What this skill does

Writes articles that explain the project through a **different lens each time** — framed so a reader who's never heard of the project understands why it matters, via something they already care about. NOT a repo progress update (that's `repo-article` / `push-recap`).

**Why models fail at this by default:** they slide into feature-listing wrapped in philosophical language, forced parallels with no mechanism, and marketing tone. This skill prevents that with a research → thesis → draft → self-edit pipeline where each phase has hard gates. If the gates can't pass, abort — don't publish a weak article.

## Phase 1 — Context

Read before deciding anything:
- Last 14 days of `articles/project-lens-*.md` and `memory/project-lens-angles.md` — know which angle categories and theses are exhausted.
- 2-3 most recent `articles/repo-article-*.md` and `articles/push-recap-*.md` — know what shipped lately.
- Repo state: `gh api repos/{owner}/{repo} --jq '{name, description, stargazers_count, forks_count, open_issues_count, updated_at}'`. If unreachable, continue with memory only and log the gap.

If `memory/watched-repos.md` is empty or missing, abort and notify: "project-lens: no watched repo configured."

## Phase 2 — Pick the lens

**If `${var}` is set**, use it verbatim. Classify into one of the 8 categories below for logging.

**If `${var}` is empty**:
1. Run 2-3 WebSearch queries on what's being debated right now in tech, crypto, AI, regulation, open source, or philosophy (e.g., `"AI agents" autonomy debate last 7 days`, `crypto regulation April 2026`, `open source funding model 2026`).
2. From results, identify 3 candidate angles with non-obvious connections to the project.
3. Pick the one that (a) hasn't appeared in the last 14 days **and** (b) has the strongest concrete connection. Record the choice and the rejected candidates with one-line reasons.

### Angle categories (no repeat within 14 days)

1. **Current events** — Something happening this week/month.
2. **Philosophy / big ideas** — Unix philosophy, cathedral vs bazaar, composability, anti-fragility, skin in the game, swarm intelligence, etc.
3. **Industry comparison** — How a well-known company/project solved a similar problem differently.
4. **User story** — POV of a specific persona (solo dev, DAO, research lab, crypto community) with and without this tool.
5. **Contrarian take** — Challenge a common assumption; use project as evidence.
6. **Technical deep-dive for non-technical readers** — One architectural decision, plain language, bigger implications.
7. **Historical parallel** — Computing / internet / non-tech history with a concrete mechanism (not surface resemblance).
8. **Ecosystem map** — Where the project sits: adjacent, complementary, competing.

## Phase 3 — Research (gate: collect evidence before drafting)

**External side — required minimums:**
- 3+ WebSearch queries on the lens topic (different framings, not rewordings)
- WebFetch on the 2+ most relevant sources
- ≥3 **distinct domains** across cited sources
- ≥3 concrete facts extracted: names, numbers, dollar amounts, dated quotes, specific events
- Recency: ≤30 days old for "current events"; ≤180 days for industry comparison / contrarian / ecosystem; ≤5 years for philosophy / historical
- Log every URL consulted

**Project side — required minimums:**
- 2+ recent articles in `articles/` read end-to-end
- `gh api repos/{owner}/{repo}/commits --jq '.[0:10] | .[] | {sha: .sha[0:7], msg: (.commit.message|split("\n")[0])}'` — last 10 commits
- ≥3 specific project references you plan to use: named features, file paths, commit hashes, architectural choices. **Not** vague claims like "the project uses AI" or "it has good UX."

**If you cannot hit these minimums, abandon the angle and re-run Phase 2 with a different category.** Log the abandoned angle and why.

## Phase 4 — Thesis lock (hard gate)

Before drafting, write **ONE falsifiable claim in ≤30 words** that links the lens to the project. Example:

> "Running agents as scheduled GitHub Actions — rather than as persistent servers — trades a few seconds of latency for a property the AI industry barely has: versioned, audit-trailed, publicly forkable autonomy."

Rules:
- **Falsifiable**: a reasonable critic could argue the opposite.
- **Specific**: names concrete things (cron jobs, not "infrastructure"; audit-trailed, not "better").
- Not a tautology. Not marketing. Not "this is cool because X."

**If you can't state the thesis in one sentence, the angle isn't working — return to Phase 2.** Do not proceed with a fuzzy thesis.

## Phase 5 — Draft (700-1000 words)

Save to `articles/project-lens-${today}.md` with this structure:

```markdown
# [Title: leads with the lens, works for a reader who doesn't know the project]

[¶1-2: external hook. Start with the trend/idea/event/question the reader already cares about. Do NOT name the project yet.]

## [Section: establishes the external frame]
[Build the lens with one or more of your concrete facts — a quote, a number, a specific event.]

## [Section: introduces the project through the frame]
[Project enters here — but through the lens, not as a feature list. Describe how it embodies, challenges, or extends the idea with specific code/design references.]

## [Section: one non-obvious technical or strategic detail]
[Where the article earns its existence. Point to something in the code, architecture, or approach a reader wouldn't get from the README.]

## [Section: zoom back out]
[A concrete forward claim — specific enough to be wrong. Not "this is exciting." Something like "this suggests X won't happen for 2-3 years because Y" or "this is the same mistake [named case] made, and it took [duration] to recover."]

---
*Sources:*
- [source title](url) — what it was used for
- ...
```

**Draft requirements:**
- Title must work for a reader who doesn't know the project name.
- ≥3 external citations rendered as inline links.
- ≥3 specific project references (named features, file paths, commit hashes, named decisions).
- 700-1000 words (count before submitting).

## Phase 6 — Self-edit (hard gates — all must pass)

Go through this checklist after the first draft. If any gate fails, rewrite the affected section **once**. If the second pass still fails, **abort and log** — do not publish a weak article.

- [ ] Title does NOT name the project
- [ ] First 2 paragraphs do NOT name the project
- [ ] ≥3 external citations with URLs (inline)
- [ ] ≥3 specific project references (named, not vague)
- [ ] Falsifiable thesis visible in the article text
- [ ] 700-1000 words
- [ ] No banned phrases: *revolutionary*, *groundbreaking*, *game-changing*, *paradigm shift*, *disrupting*, *unlocks*, *empowers*, *the future of X*, *leverage / leveraging*, *at scale*, *democratize* (unless quoting a source that used the word)
- [ ] Every parallel/comparison states a concrete mechanism — not surface resemblance
- [ ] Closing section makes a specific forward claim (not generic optimism or "time will tell")
- [ ] No feature-list paragraphs ("the project does X, Y, Z") — if found, cut and keep ONE element

## Phase 7 — Output

1. **Save** `articles/project-lens-${today}.md`.
2. **Append** to `memory/project-lens-angles.md` (create if missing):
   ```markdown
   ## ${today}
   - Angle: [category]
   - Thesis: [one-line falsifiable claim]
   - Title: [article title]
   - Sources: [3-5 URLs]
   ```
3. **Notify** via `./notify`:
   ```
   *New Article: [title]*

   [3-4 sentence summary: the external thing the article connects to, the thesis claim, one specific project detail.]

   Read: [URL to articles/project-lens-${today}.md — use `git remote get-url origin` for this repo]
   ```
4. **Log** to `memory/logs/${today}.md`:
   ```
   ## Project Lens
   - Angle: [category]
   - Thesis: [one-line]
   - External sources: [count] across [N] distinct domains
   - Project references: [count]
   - Self-edit gates: all passed | failed at [gate name] → rewrite → [passed | aborted]
   - Status: published | aborted
   - Notification: sent | skipped
   ```

## Anti-patterns (prevention beats self-edit catch)

- **Forced parallels** — every comparison needs a concrete mechanism, not surface resemblance. "X is like Y because both are new" fails; "X is like Y because both decoupled [specific function] from [specific bottleneck]" passes.
- **Feature-dump via the lens** — pick ONE architectural decision and interrogate it, don't list what the project does.
- **Marketing tone** — aim for trade-publication prose, not a company blog.
- **False novelty** — if you can't point to what's actually new, name what's old that still works and why.
- **Vague closings** — the final section must make a claim specific enough that a reader could come back in six months and say "you were wrong" or "you were right."

## Sandbox note

Use **WebFetch** if curl fails for any URL. The `gh` CLI handles GitHub API auth internally — prefer it over raw curl for repo metadata.

## Constraints

- Never publish if Phase 6 self-edit fails twice — abort cleanly.
- Never reuse an angle category within 14 days (check `memory/project-lens-angles.md`).
- Never invent facts to fill the citation minimum — if research is thin, abandon the angle.
