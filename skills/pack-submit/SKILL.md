---
name: pack-submit
description: Package one of this agent's own skills as a standalone community pack and submit it to the aeon registry as a PR
metadata:
  title: Pack Submit
  category: evolution
  var: ""
  tags:
    - dev
    - meta
    - packs
  mode: write
  requires:
    - GH_GLOBAL?
  capabilities:
    - external_api
    - writes_external_host
    - sends_notifications
---

> **${var}** — The local skill to publish as a community pack: a skill **slug** (a directory name under `skills/`), optionally followed by flags. **Required.**
> Examples:
> - `token-movers` — package `skills/token-movers/` into a fresh public repo and submit it to the aeon registry
> - `token-movers --repo myorg/aeon-token-movers` — override the pack repo name (default `aeon-skill-pack-<slug>`)
> - `token-movers --no-register` — create and push the pack repo, but skip the registry PR against `aeonfun/aeon`
> - `token-movers --dry-run` — build and validate the pack locally, write nothing to GitHub

If `${var}` is empty, exit `PACK_SUBMIT_NO_VAR`:
```bash
./notify "pack-submit aborted: var empty — pass a skill slug e.g. \"token-movers\""
```
Then stop.

Today is ${today}. Your task is to take the **existing** skill named in `${var}`, wrap it in a standalone community-pack repo (its own GitHub repo with a `skills-pack.json` manifest), and **submit it to the aeon community registry** - a PR against `aeonfun/aeon` that adds both surfaces the registry demands in one diff: a row in the **Listed packs** table in `docs/community-skill-packs.md` AND a matching entry in `catalog/skill-packs.json`. This is the inverse of `install-skill`: instead of pulling a community pack in, it pushes one of your own skills out for every other Aeon agent to install with `bin/install-skill-pack`.

## What a community pack is (so you build the right thing)

A community pack is a **public GitHub repo** that holds one or more skills plus a `skills-pack.json` manifest that names and versions them. `bin/install-skill-pack owner/repo` reads that manifest and installs the skills. To be **discoverable** (listed by `bin/install-skill-pack --list` and the dashboard's Community Packs panel), the pack must also be registered in `aeonfun/aeon`'s `catalog/skill-packs.json` + the Listed packs table in `docs/community-skill-packs.md`. So publishing is two moves: **(a)** stand up the pack repo, **(b)** open the registry PR. This skill does both. Full protocol: `docs/community-skill-packs.md`.

## Steps

**Shell shape.** Each Bash call is one allowed command (pipes are fine). The run refuses a call that sets a variable (`SLUG=$(...)`, `PACK_DIR=$(mktemp -d)`, `PR_URL=$(gh pr create ...)`), uses `if` / `while` or `[ ... ] &&` tests, or joins commands with `;`, `&&` or `||`, and each refusal costs a model turn; `awk`, `cut`, `sed`, `cp`, `mv`, `mktemp` and `tee` are not allowed commands, and a `cd` does not carry over to the next call. So parse `${var}` and the frontmatter yourself, run each command below as its own call with every value (slug, owner, repo names, title) written in literally in place of the `<SLUG>`, `<OWNER>`, `<FULL_REPO>` style placeholders, work in the fixed dir `/tmp/pack-submit-work` with absolute paths (`git -C <dir>`, not `cd <dir> && git`), copy files with `node -e` (`fs.cpSync`, `fs.copyFileSync`), and write files (the manifest, README, LICENSE, PR body) with the Write tool. A `>` redirect into a file is refused too (/tmp included), and so is a jq `$name` variable: the registry edit pipes `jq` into a `node` writer with every value written into the filter as a string.

1. **Parse and validate `${var}`** yourself, not with a shell script. The first whitespace-separated token is the skill slug SLUG; the rest are flags (`--repo owner/name`, `--no-register`, `--dry-run`). The slug must match `^[a-z0-9][a-z0-9-]*$` and resolve to a real directory:
   - SLUG does not match `^[a-z0-9][a-z0-9-]*$`: run `./notify "pack-submit aborted: \"<SLUG>\" is not a valid skill slug (lowercase kebab-case)"` and stop.
   - Check `skills/<SLUG>/SKILL.md` with Glob. If it is missing, run ``./notify "pack-submit aborted: skills/<SLUG>/SKILL.md not found - run with a slug from \`ls skills/\`"`` and stop.

   If validation fails, exit `PACK_SUBMIT_BAD_VAR` with the notify above and stop. Note the boolean flags and the optional `--repo` value (REPO_OVERRIDE) from the rest of `${var}`.

2. **Read the source skill's metadata.** Everything the manifest and registry entry need is already declared in `skills/<SLUG>/SKILL.md`'s frontmatter - read it, don't invent it:
   - **Display name** — `metadata.title`; fall back to the top-level `name:`.
   - **Description** — the top-level `description:` (one line).
   - **Category** — `metadata.category`. Registry categories are an open vocabulary, but first-party-only values (`core`, `evolution`, `basics`) don't describe a third-party pack — if you see one of those, pick the closest community category (`dev`, `crypto`, `productivity`, `research`, `social`) from what the skill actually does. Otherwise pass the category through.
   - **Secrets** — `metadata.requires`. An entry ending in `?` is **optional** → `secrets_optional`; an entry without `?` is **required** → `secrets_required`. Strip the `?`. Registry `secrets_required` must be UPPER_SNAKE env names.
   - **Capabilities** — `metadata.capabilities`, copied verbatim (already the locked taxonomy; see `docs/CAPABILITIES.md`). Omit if absent.

   Read `skills/<SLUG>/SKILL.md` with the Read tool and take the values from its frontmatter (between the first two `---` lines): TITLE = `metadata.title` (else the top-level `name:`), DESC = the top-level `description:`, CATEGORY = `metadata.category`. Collect the `requires:`/`capabilities:` list items (lines under those keys beginning with `    - `); split `requires` into required (no `?`) and optional (trailing `?`, stripped).

3. **Build the pack repo locally.** Stage a clean working tree - the manifest at root, the full skill directory copied verbatim (including any helper scripts/config, not just `SKILL.md`), a README, and an MIT `LICENSE`. PACK_DIR is the fixed path `/tmp/pack-submit-work/pack`. Create it, then copy the skill, each as its own call:
   ```bash
   mkdir -p /tmp/pack-submit-work/pack/skills/<SLUG>
   ```
   ```bash
   node -e "require('fs').cpSync('skills/<SLUG>','/tmp/pack-submit-work/pack/skills/<SLUG>',{recursive:true})"
   ```
   Write `/tmp/pack-submit-work/pack/skills-pack.json` with the Write tool (valid JSON with every value properly escaped, never hand-joined strings, so quoting is safe). Include only fields you actually have:
   ```json
   {
     "name": "<TITLE>",
     "version": "0.1.0",
     "description": "<DESC>",
     "author": "<operator github handle>",
     "license": "MIT",
     "homepage": "https://github.com/<owner>/<pack-repo>",
     "skills": [
       {
         "slug": "<SLUG>",
         "path": "skills/<SLUG>",
         "description": "<DESC>",
         "category": "<CATEGORY>",
         "schedule": "0 12 * * *",
         "default_enabled": false,
         "secrets_required": [ ... ],
         "secrets_optional": [ ... ],
         "capabilities": [ ... ]
       }
     ]
   }
   ```
   Write a `README.md` that names the skill, states its schedule assumption, lists required/optional secrets, and shows the one-line install (`bin/install-skill-pack <owner>/<pack-repo>`). Write a standard MIT `LICENSE` (year `${today}`'s year, copyright the operator handle). Resolve the operator handle once, as its own call:
   ```bash
   gh api user --jq .login
   ```
   It prints OWNER.

4. **Pre-flight the pack.** Run the repo's own validator against the staged directory - it enforces exactly what `bin/install-skill-pack` requires (valid JSON manifest, clean slug, no `..` in paths, the `SKILL.md` present, locked-taxonomy capabilities):
   ```bash
   ./scripts/validate-pack.sh /tmp/pack-submit-work/pack
   ```
   Exit non-zero (an `ERROR:` line) → exit `PACK_SUBMIT_INVALID_PACK`, notify with the failing line, and stop. **Do not** push an invalid pack. Warnings are fine to proceed on; surface them in the notify.

   If `--dry-run` was passed, stop here: notify the operator that the pack built and validated cleanly at `/tmp/pack-submit-work/pack`, list the manifest fields, and exit `PACK_SUBMIT_DRY_RUN` without touching GitHub.

5. **Create and push the pack repo.** PACK_REPO is the `--repo` override if given, else `aeon-skill-pack-<SLUG>` (owner defaults to OWNER). The pack must be **public** - the installer fetches its tarball, and a private pack can't be installed by anyone else. First check the name is free:
   ```bash
   gh repo view <PACK_REPO> --json nameWithOwner --jq .nameWithOwner
   ```
   If that call succeeds (prints a name), the repo already exists: run `./notify "pack-submit aborted: repo <PACK_REPO> already exists - pass --repo to pick another name"` and stop. If it fails with "Could not resolve", the name is free. Then each as its own call:
   ```bash
   git -C /tmp/pack-submit-work/pack init -q
   ```
   ```bash
   git -C /tmp/pack-submit-work/pack add -A
   ```
   ```bash
   git -C /tmp/pack-submit-work/pack commit -q -m "Aeon community pack: <SLUG>"
   ```
   ```bash
   gh repo create <PACK_REPO> --public --source=/tmp/pack-submit-work/pack --push
   ```
   Capture the resulting `owner/repo`:
   ```bash
   gh repo view <PACK_REPO> --json nameWithOwner --jq .nameWithOwner
   ```
   It prints FULL_REPO. If repo creation fails (permission/name), exit `PACK_SUBMIT_REPO_FAILED`, notify with the `gh` error's shortest decisive line, and stop.

6. **Submit the registry PR against `aeonfun/aeon`** (skip this whole step if `--no-register` was passed - then jump to step 7 reporting only the pack repo). The registry lives in the canonical repo, so work against a fork, not this instance's checkout - this instance's `catalog/skill-packs.json` and `docs/community-skill-packs.md` can be stale. Each as its own call; if the fork call fails because the fork already exists, carry on:
   ```bash
   gh repo fork aeonfun/aeon --clone=false --default-branch-only
   ```
   ```bash
   git clone -q https://github.com/<OWNER>/aeon.git /tmp/pack-submit-work/aeon
   ```
   If that clone fails, clone the canonical repo instead:
   ```bash
   git clone -q https://github.com/aeonfun/aeon.git /tmp/pack-submit-work/aeon
   ```
   ```bash
   git -C /tmp/pack-submit-work/aeon checkout -b pack-submit/<SLUG>
   ```
   Make the two edits the validator (`scripts/validate-skill-packs.mjs`) checks for parity:

   **(a) `catalog/skill-packs.json`** - append one object to `.packs`. Build it with `jq` from the values you resolved, written in literally (mirror the pack's own manifest: `skills` is `["<SLUG>"]`, `trust_level` is `"community"`, aggregate `secrets_required`/`capabilities` from the skill). One call: `jq` builds the new file and pipes it into a one-line `node` writer that saves it over the clone's file (node writes only after jq has read the whole input, so the same path is safe). Each value goes into the jq filter as a JSON string (a `"` inside it becomes `\"`, and reword any `'`): a jq `$name` variable from `--arg` and a `>` redirect into a file are both refused in this run:
   ```bash
   jq '.packs += [ { repo:"<FULL_REPO>", name:"<TITLE>", description:"<DESC>", author:"<OWNER>",
        license:"MIT", homepage:"https://github.com/<FULL_REPO>", category:"<CATEGORY>", trust_level:"community",
        skills:["<SLUG>"] } ]' /tmp/pack-submit-work/aeon/catalog/skill-packs.json \
     | node -e 'require("fs").writeFileSync("/tmp/pack-submit-work/aeon/catalog/skill-packs.json", require("fs").readFileSync(0))'
   ```
   Add `secrets_required` / `capabilities` keys to that object only when the skill declares them (keep it in sync with the pack manifest). Do **not** use `trust_level: trusted` — that requires the repo to be in `skills/security/trusted-sources.txt`, and the validator rejects an unearned `trusted`.

   **(b) `docs/community-skill-packs.md`** - add a table row under the `| Pack | Skills | Description |` header in the **Listed packs** section (the last section of the file). The table moved there from `.github/README.md` in #845; do not edit the README. The row format, matching the existing rows exactly:
   ```
   | [<pack-repo-name>](https://github.com/<FULL_REPO>) | 1 | <one-line description, ≤110 chars>. |
   ```
   Use `python3` for a surgical insert. **The row must land inside the table's contiguous block** - insert it immediately *after the last existing `| [` row*, never after a blank line or other text. The parity validator parses rows only until the first non-`|` line, so a row placed past the table is invisible to it and the PR fails CI with "in the registry but has no row in the Community Packs table". Verify with a re-read that the row sits among the other rows. Run it as one `python3 - <<'PY'` call (the heredoc is the script on stdin), with PACK_NAME (the pack repo's name), FULL_REPO and DESC written in literally as Python strings:
   ```python
   import re
   PACK_NAME, FULL_REPO, DESC = "<PACK_REPO_NAME>", "<FULL_REPO>", "<DESC>"
   F = "/tmp/pack-submit-work/aeon/docs/community-skill-packs.md"
   lines = open(F).read().split("\n")
   sec = next(i for i,l in enumerate(lines) if re.match(r'^#+\s+Listed packs\s*$', l))
   hdr = next(i for i in range(sec,len(lines)) if re.match(r'^\|\s*Pack\s*\|\s*Skills\s*\|\s*Description\s*\|', lines[i]))
   i = hdr + 2; last = i
   while i < len(lines) and lines[i].startswith("|"): last = i; i += 1   # last data row
   lines.insert(last + 1, f"| [{PACK_NAME}](https://github.com/{FULL_REPO}) | 1 | {DESC} |")
   open(F,"w").write("\n".join(lines))
   ```

   **Validate parity before committing** - this is the exact CI gate the PR will hit (the script resolves its files from its own location, so the absolute path checks the clone):
   ```bash
   node /tmp/pack-submit-work/aeon/scripts/validate-skill-packs.mjs
   ```
   A non-zero exit → fix the reported mismatch (skill count, a missing row, or a `--path` flag) and re-run until it prints `validate-skill-packs: OK`. Never open the PR on a red validator.

   Then commit both files together, push the branch to your fork, and open the PR against the canonical repo, each as its own call:
   ```bash
   git -C /tmp/pack-submit-work/aeon add catalog/skill-packs.json docs/community-skill-packs.md
   ```
   ```bash
   git -C /tmp/pack-submit-work/aeon commit -m "feat: list <TITLE> community pack (<FULL_REPO>)"
   ```
   ```bash
   git -C /tmp/pack-submit-work/aeon push -u origin pack-submit/<SLUG>
   ```
   Write the PR body with the Write tool to `/tmp/pack-submit-work/pr-body.md`, values filled in:
   ````markdown
   ## New community pack

   **Pack:** [<FULL_REPO>](https://github.com/<FULL_REPO>)
   **Skill:** `<SLUG>` - <DESC>
   **Author:** @<OWNER> · **License:** MIT · **Category:** <CATEGORY>

   Adds a row to the Listed packs table in `docs/community-skill-packs.md` and a matching `catalog/skill-packs.json` entry (both in this diff, per the publishing checklist). `node scripts/validate-skill-packs.mjs` passes locally.

   Install once merged:
   ```
   bin/install-skill-pack <FULL_REPO>
   ```
   ````
   Then open the PR. `--head` names the pushed branch, since the call does not run inside the clone (use `aeonfun:pack-submit/<SLUG>` if the clone fell back to the canonical repo):
   ```bash
   gh pr create --repo aeonfun/aeon --head <OWNER>:pack-submit/<SLUG> --title "feat: list <TITLE> community pack" --body-file /tmp/pack-submit-work/pr-body.md
   ```
   It prints PR_URL. If `gh pr create` fails because a PR already exists for the branch, capture the existing URL instead of erroring. This PR is **not** self-merging - it lands in someone else's repo and is reviewed by the aeon maintainers.

7. **Log.** Append to `memory/logs/${today}.md`:
   ```
   ### pack-submit
   - Skill: {SLUG} ({TITLE})
   - Pack repo: https://github.com/{FULL_REPO}
   - Registry PR: {PR_URL or "skipped (--no-register)"}
   - Secrets: {required list or "none"} · Capabilities: {list or "none"}
   - Exit: PACK_SUBMIT_OK (or the code that applied)
   ```

8. **Notify.** Send one concise line via `./notify` (≤4000 chars, clickable URLs):
   ```
   *pack-submit - {TITLE}*
   Pack repo: https://github.com/{FULL_REPO}
   Registry PR: {PR_URL}
   Install: `bin/install-skill-pack {FULL_REPO}`
   {"Requires: X, Y" if any required secrets, else omit}
   ```
   On `--no-register`, say the pack repo is live and give the exact PR checklist link (`docs/community-skill-packs.md#pack-maintainers-publishing-checklist`) so the operator can list it manually.

## Exit taxonomy

| Code | When | Action |
|------|------|--------|
| `PACK_SUBMIT_OK` | Pack repo pushed and registry PR opened (or `--no-register` completed) | Notify with pack repo + PR link |
| `PACK_SUBMIT_NO_VAR` | `${var}` empty | Notify abort reason; stop |
| `PACK_SUBMIT_BAD_VAR` | Slug malformed or `skills/<slug>/SKILL.md` missing | Notify with the slug; stop |
| `PACK_SUBMIT_INVALID_PACK` | `validate-pack.sh` reported an ERROR | Notify with the failing line; stop (nothing pushed) |
| `PACK_SUBMIT_DRY_RUN` | `--dry-run` — built + validated, wrote nothing to GitHub | Notify with the staged path + manifest summary |
| `PACK_SUBMIT_REPO_FAILED` | `gh repo create` failed (name taken, permission) | Notify with the gh error; stop |
| `PACK_SUBMIT_REGISTRY_FAILED` | Fork/clone/validate/PR step failed after the pack repo was pushed | Notify: pack repo is live, registry PR did not open, with the failing step |

## Network note

There is no network sandbox — `git` and `gh` reach GitHub directly. `gh` is authenticated in Actions (via `GH_GLOBAL` when set; the ambient `GITHUB_TOKEN` otherwise, which **cannot** create repos or cross-repo PRs — surface that as `PACK_SUBMIT_REPO_FAILED` rather than looping). Every irreversible outward write — creating the public pack repo (step 5) and opening the registry PR (step 6) — happens **in-run** and is fail-closed: a failed pre-flight (`validate-pack.sh`) or a failed parity check (`validate-skill-packs.mjs`) stops before any push. Confirm reachability with `gh api repos/aeonfun/aeon --jq .full_name` before deciding a fork/clone failure is real vs transient.

## Constraints

- **Publish only skills that already exist in `skills/`.** This skill packages and distributes; it does not author. To create a new skill, use `create-skill`.
- **The pack repo must be public** — the installer fetches its tarball; a private pack is uninstallable by others.
- **Never** register with `trust_level: trusted` — that is earned via `skills/security/trusted-sources.txt`, and the validator rejects a self-declared `trusted`. Community packs use `trust_level: community`.
- **Never** open the registry PR on a red `validate-skill-packs.mjs` — a broken registry entry takes down `bin/install-skill-pack --list` and the dashboard panel for everyone.
- **Keep the two registry surfaces in lockstep** - the Listed packs row in `docs/community-skill-packs.md` and the `skill-packs.json` entry ship in one diff, with matching skill counts. That is what the CI gate enforces.
- **Don't leak secret values.** The manifest lists secret **names** only (from the skill's `requires:`), never values.
