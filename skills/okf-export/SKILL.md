---
type: Skill
name: OKF Export
category: meta
description: Backfill memory/topics into an OKF-conformant bundle by adding type frontmatter, then open a PR
var: ""
tags: [meta]
---
> **${var}** — Optional. A single topic filename (e.g. `crypto.md`) or subfolder to limit the backfill to. If empty, process every un-typed concept under `memory/topics/`.

Today is ${today}. Aeon's `memory/topics/` directory is a **native OKF (Open Knowledge Format) bundle** (see `docs/OKF.md` and the "Publishing knowledge (OKF)" section of `CLAUDE.md`). Historically, topic notes were written as plain markdown with no `type:` frontmatter. Your job is a **one-shot backfill**: bring existing concept files up to OKF v0.1 conformance and open a PR — **never commit to `main`**.

> **This is a lossy translation.** These notes were never written with `type:` in mind. Treat your output as a *draft* to be reviewed, not ground truth. When a file's `type:` is genuinely ambiguous, prefer `Reference` and flag it in the PR body rather than guessing a specific type.

## Steps

1. **Scope.** List `memory/topics/*.md` (and any subfolders). Exclude the reserved files `index.md` and `log.md`, and any non-`.md` files (e.g. `milestone-dispatch.json`). If `${var}` is set, restrict to that file/subfolder. For each file, check whether it already begins with a `--- ... ---` frontmatter block containing a non-empty `type:`. Skip files that already conform.

2. **Classify + enrich each un-typed concept.** For every file needing work, read it and prepend a frontmatter block using the pinned vocabulary in `CLAUDE.md` (`Token`, `Protocol`, `Narrative`, `Repo`, `Playbook`, `Metric`, `Reference`; pick the best fit, default `Reference` when unsure):
   ```yaml
   ---
   type: <Type>
   title: <Human title — derive from the top heading or filename>
   description: <One-sentence summary of what the note covers>
   tags: [<existing themes>]
   timestamp: ${today}T00:00:00Z
   ---
   ```
   - Do **not** rewrite the body. Only prepend frontmatter (and, where an obvious relationship exists, add a bundle-relative cross-link like `[Ethereum](/tokens/ethereum.md)` — but do not invent links to files that don't exist).
   - If a note clearly bundles many distinct entities (e.g. one file covering ten tokens), do **not** shatter it in this pass — give the file one honest `type:`/`title` and note in the PR body that it's a candidate for later splitting into per-entity concepts.

3. **Regenerate the index.** Run `node scripts/okf-index.mjs` to rebuild `memory/topics/index.md` from the new frontmatter.

4. **Validate.** Run `node scripts/okf-validate.mjs memory/topics`. It must exit 0 (`okf-validate: OK`). If it reports violations, fix them and re-run. Do **not** open a PR on a failing bundle.

5. **Open a PR** (never commit to `main`):
   ```bash
   git checkout -b okf-export/backfill-${today}
   git add memory/topics/
   git commit -m "okf-export: backfill type: frontmatter into memory/topics

   Lossy one-shot translation of existing notes into OKF v0.1 concepts.
   Review the type: choices — ambiguous files defaulted to Reference."
   git push -u origin okf-export/backfill-${today}
   gh pr create --title "okf-export: backfill memory/topics to OKF" --body "$(cat <<'EOF'
   ## What
   Backfilled `type:` frontmatter (+ title/description/timestamp) into existing `memory/topics/` concept files so the native OKF bundle conforms to v0.1 §9.

   ## Review notes
   - This is a **lossy translation** — verify the `type:` assigned to each file.
   - Files defaulted to `Reference` (ambiguous): {list, or "none"}
   - Candidates for later split into per-entity concepts: {list, or "none"}
   - `node scripts/okf-validate.mjs memory/topics` → OK
   EOF
   )"
   ```
   Capture the PR URL.

6. **Log** to `memory/logs/${today}.md` under a `### okf-export` heading:
   - Files typed: {count} (list slugs + assigned type)
   - Files defaulted to Reference: {list}
   - Validator: OK
   - PR: {url}
   - Exit: `OKF_EXPORT_OK` (or `OKF_EXPORT_NOOP` if everything already conformed)

7. **Notify** via `./notify` only if a PR was opened (a no-op run stays silent):
   ```
   *okf-export* — backfilled {N} concept(s) to OKF
   Review the type: choices. PR: {url}
   ```

## Sandbox note

All work is local file I/O against `memory/topics/` plus the two Node scripts (`scripts/okf-index.mjs`, `scripts/okf-validate.mjs`) — no network. The PR uses the `gh` CLI's built-in auth (no curl / secret expansion). No API keys required.

## Constraints

- **Never** commit to `main` — always open a PR.
- **Never** rewrite a note's body; only prepend frontmatter (+ safe cross-links).
- **Never** open a PR if `okf-validate` fails.
- Skip files that already carry a non-empty `type:` — idempotent by design.
- If nothing needs backfilling, exit `OKF_EXPORT_NOOP` and send no notification.
