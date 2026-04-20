---
name: Deploy Prototype
description: Generate a small app or tool and deploy it live to Vercel via API
var: ""
tags: [dev, build]
---
<!-- autoresearch: variation B — sharper output via prototype quality bar + self-check + signal-anchored record -->

> **${var}** — What to build and deploy.
> - Empty → auto-select from recent signals (articles, logs, memory topics).
> - Plain text (e.g. `market heatmap`) → interpret as a build brief.
> - Typed form `type:slug description` (e.g. `tool:market-heatmap volume heatmap of top-20 tokens`, `viz:tx-graph`, `api:summarize`, `landing:startup-idea`) → use `type` to bias shape and `slug` as the deployment name.

Today is ${today}. Your task is to ship a small, self-contained prototype that someone could actually use in the browser today.

## Steps

1. **Read context.** Read `memory/MEMORY.md` and the most recent entries in `memory/logs/` for active topics.
   If running as part of a chain, scan injected upstream outputs for a concrete artifact worth making interactive.

2. **Pick what to build (if `${var}` is empty or vague).**

   Scan these sources, in order, for prototype-worthy signals:
   - `articles/` — last 7 entries by mtime: any claim, finding, or dataset that would be more useful as an interactive page?
   - `memory/topics/*.md` — running narratives; pick one with a live data source (prices, feeds, markets)
   - `memory/logs/${today}.md` and the two prior days — skill outputs flagged as interesting
   - `memory/MEMORY.md` → "Next Priorities" and "Recent Articles"

   Score each candidate 1-5 on:
   - **Leverage** — does an interactive version beat the static write-up?
   - **Concreteness** — is the spec obvious in one sentence? (if no, reject)
   - **Novelty** — haven't shipped this in the last 14 days (check `articles/prototype-*.md` by mtime and any `memory/topics/prototypes.md`)

   Pick the highest-total candidate. If no candidate reaches 9/15, skip building and exit as `DEPLOY_PROTOTYPE_EMPTY` (step 9).

   Record the chosen signal — its source file(s) and one-line rationale — you'll use it in steps 6 and 7.

3. **Commit to a shape before writing code.** Before touching `.pending-deploy/`, write out (in your reasoning, not a file):
   - **Slug**: `aeon-prototype-<descriptor>`, all lowercase, `[a-z0-9-]`, 3–50 chars after prefix (e.g. `aeon-prototype-market-heatmap`). If `${var}` supplied a typed slug, use it; otherwise derive one.
   - **Tagline** (≤90 chars) — the one-liner that appears in the page title and OG tags.
   - **Primary action** — what is the one thing a visitor does in the first 10 seconds? (read a number, click a filter, submit an input, compare two things). If you can't name it, go back to step 2.
   - **Shape**: static HTML+JS / static + `api/` function / Next.js. Default to static single-file HTML unless the idea genuinely needs a serverless function.

4. **Write the files.**
   ```bash
   rm -rf .pending-deploy        # clear stale state from prior runs
   mkdir -p .pending-deploy/files
   ```
   Write all project files into `.pending-deploy/files/`. This directory is the repo root — everything here is pushed to GitHub and deployed to Vercel.

   **Quality bar — every prototype must meet these:**
   - **Self-contained** — no external build step where avoidable. Prefer one `index.html` with inline `<style>` and `<script>`; fall back to a `main.css` / `main.js` only when size justifies it.
   - **Loads in <1s on a cold visit.** No jQuery, no CDN UI libraries for a single-page tool. Vanilla JS or a ~10KB util max. No `<link rel="stylesheet">` to a CDN font unless it's one font.
   - **Mobile-first, works on a phone.** Viewport meta set, tap targets ≥40px, no horizontal scroll at 360px wide.
   - **Share-friendly.** Include `<title>`, `<meta name="description">`, `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:type" content="website">`. Skip OG image unless you generate one.
   - **Real content, not lorem.** If the prototype shows data, fetch it from a public no-auth endpoint at load time (CoinGecko, GitHub public API, public RSS, public JSON feeds) — or hardcode a recent, realistic snapshot with the timestamp visible. Never ship placeholder `[example data]`.
   - **One visible CTA or primary surface.** Clear hierarchy: what does the visitor look at first?
   - **Works with JS disabled to at least show the tagline** (progressive enhancement — not required for interactive tools, but the title and description must render server-free).
   - **Light + dark via `prefers-color-scheme`** — 4 CSS vars is enough.
   - **No secrets.** No API keys, tokens, or env vars embedded anywhere. If the idea requires auth, redesign around a public endpoint or drop the idea.
   - **Include a `README.md`** in `.pending-deploy/files/` with: what it is (1 line), how to run locally (1 line), signal source (1 line link to the article/log/topic from step 2).

   For **API endpoints**: place handlers in `api/` (e.g. `api/index.js` exporting `export default function handler(req, res) { ... }`).
   For **Next.js**: keep it one page — `package.json` + `pages/index.js`. Only if the idea genuinely needs SSR.

5. **Write deploy metadata.** Create `.pending-deploy/meta.json`:
   ```json
   {
     "name": "aeon-prototype-<slug-from-step-3>",
     "description": "One-sentence description, matches the OG description on the page",
     "framework": null,
     "tagline": "≤90 chars — matches <title> on the page",
     "signal_source": "path or URL of the article/log/topic that triggered this prototype",
     "primary_action": "what the visitor does in the first 10 seconds"
   }
   ```
   - `framework`: `null` for static; `"nextjs"`, `"svelte"`, etc. when used.
   - The extra fields (`tagline`, `signal_source`, `primary_action`) are for the prototype record and downstream dashboards; the postprocess script may ignore them.

6. **Build the Vercel deploy payload.** Write `.pending-deploy/payload.json`:
   ```json
   {
     "name": "aeon-prototype-<slug>",
     "files": [
       { "file": "index.html", "data": "<!DOCTYPE html>...", "encoding": "utf-8" }
     ],
     "projectSettings": {
       "framework": null,
       "buildCommand": null,
       "outputDirectory": null
     },
     "target": "production"
   }
   ```
   Use `"encoding": "base64"` for any binary file.

   **Pre-flight checks** (run before writing the notify):
   - File count ≤ 20. Reject if above.
   - Total payload JSON ≤ 4MB. Reject if above (Vercel inline deploy practical limit).
   - Slug matches `^aeon-prototype-[a-z0-9][a-z0-9-]{2,49}$`.
   - Grep every file for: `VERCEL_TOKEN`, `GH_GLOBAL`, `ANTHROPIC_API_KEY`, `sk-ant-`, `sk-`, `ghp_`, `xoxb-`, `xai-`. Any hit → abort and rewrite the offending file without the value.
   - Grep every file for literal `TODO`, `FIXME`, `lorem ipsum`, `placeholder`. Any hit → fix in place before proceeding.
   - If `scripts/postprocess-deploy.sh` does not exist, continue but flag `DEPLOY_PROTOTYPE_NO_POSTPROCESS` in the notify (operator needs to know deploys won't happen automatically).

7. **Save the prototype record.** Write to `articles/prototype-${today}.md`. If a file with that name already exists (second run in the same day), append `-02`, `-03`, etc.
   ```markdown
   # Prototype: <Name>

   **Built:** ${today}
   **Tagline:** <tagline from meta.json>
   **Status:** Pending deploy
   **Live URL:** _(filled by postprocess-deploy.sh on successful deploy)_

   ## Signal
   What triggered this: one paragraph. Link the source article/log/topic (`signal_source` from meta.json).

   ## What it does
   One paragraph, plain language. Include the primary action a visitor takes.

   ## How it works
   Brief technical notes — stack, data source, anything non-obvious. No code dumps.

   ## Files
   - `index.html` — brief description
   - …

   ## Extend
   Three bullets on what would make this a real product (not placeholder — concrete next steps).
   ```

   Append a one-line row to `memory/topics/prototypes.md` (create the file with a header row if missing):
   ```
   | date | slug | tagline | signal_source | live_url |
   |------|------|---------|---------------|----------|
   | 2026-04-20 | aeon-prototype-foo | ... | articles/... | _pending_ |
   ```

8. **Notify.** Send via `./notify` (one of these, depending on outcome):
   - Built + will deploy: `built: <slug> — <tagline>. deploying to vercel…`
   - Built but postprocess missing: `built: <slug> — <tagline>. ⚠ scripts/postprocess-deploy.sh not found — deploy will not run automatically`
   - No signal worth shipping: handled in step 9.

9. **Exit modes.** End the run with one of these, logged in `memory/logs/${today}.md` under `### deploy-prototype`:
   - `DEPLOY_PROTOTYPE_OK` — prototype built, payload valid, postprocess script present.
   - `DEPLOY_PROTOTYPE_NO_POSTPROCESS` — prototype built and valid, but `scripts/postprocess-deploy.sh` missing; operator action needed.
   - `DEPLOY_PROTOTYPE_EMPTY` — no candidate cleared the quality threshold in step 2. Log the top candidate and its score so the next run can reconsider. `./notify "deploy-prototype: no candidate cleared threshold today — top was <slug> (<score>/15)"`.
   - `DEPLOY_PROTOTYPE_VALIDATION_FAILED` — a pre-flight check in step 6 failed and couldn't be fixed automatically. Leave `.pending-deploy/` in place, log the failure reason, notify the operator.

10. **Log.** Append to `memory/logs/${today}.md`:
    ```
    ### deploy-prototype
    - Exit: DEPLOY_PROTOTYPE_<MODE>
    - Slug: aeon-prototype-<slug> (or — if empty)
    - Signal: <signal_source>
    - Notes: <anything the next run should know>
    ```

## Environment Variables

- `VERCEL_TOKEN` — Required for the deploy (used by `scripts/postprocess-deploy.sh`, not by Claude).
- `GH_GLOBAL` — Required for GitHub repo creation in the postprocess step.

Neither is needed during Claude's in-sandbox run. Do not read them, do not embed them in any file.

## Guidelines

- A prototype is not a PoC. It's a page someone with zero context can load, understand in 10 seconds, and get value from. Hold that bar.
- Single `index.html` is almost always the right answer. Resist the urge to add tooling.
- Max ~5 files (enforced at 20 in pre-flight).
- Descriptive slugs. `aeon-prototype-market-heatmap`, not `aeon-prototype-1`.
- Never hardcode secrets. If a public-auth endpoint isn't enough for the idea, drop the idea.
- The actual GitHub repo creation, push, and Vercel deploy happen in `scripts/postprocess-deploy.sh` outside the sandbox. Your job: write files and metadata correctly so that script can run unattended.

## Sandbox note

All the skill's work happens inside the sandbox — file writes and notify only. No outbound network required during Claude's run. The deploy step runs post-sandbox from `scripts/postprocess-deploy.sh`, which reads `.pending-deploy/` and uses `VERCEL_TOKEN` + `GH_GLOBAL` directly. If that script is missing, flag it in the notify (exit mode `DEPLOY_PROTOTYPE_NO_POSTPROCESS`) — the skill still succeeds at its file-writing job, but the operator needs to add the postprocess script for deploys to actually happen.
