---
name: aeon
description: Set up and run an Aeon agent instance — get started from scratch, pick which skills to turn on or install more from packs, reschedule or change what runs, edit what an existing skill does, fix a skill that isn't firing, set the STRATEGY.md north star and soul/ voice, turn a coding-agent chat into a scheduled Aeon skill, and mine past coding-agent conversations for recurring work worth automating as a skill. Use when the user mentions Aeon, aeon.yml, an Aeon skill / instance / routine / pack, asks to schedule, enable, edit, or debug an agent that runs on a cron, or asks what of their repeated/manual work Aeon could take over.
---

# Aeon

Aeon is an agent that runs on the user's own GitHub repo via Actions. A skill is a Markdown file (`skills/<name>/SKILL.md`); `aeon.yml` says which ones run and when.

Pick the mode they're asking for:

| | |
|---|---|
| **1 · Start** | No instance yet, or set one up from scratch |
| **2 · Reschedule** | Change times, cadence, or what a skill focuses on |
| **3 · Unblock** | "It didn't run" / "nothing happened" |
| **4 · Chat → skill** | Turn what we just did into a scheduled skill |
| **5 · Edit a skill** | Change what an existing skill does |
| **6 · What to turn on** | Pick skills, browse packs, install more |
| **7 · Strategy & voice** | `STRATEGY.md` and `soul/` — the north star and the tone |
| **8 · Mine history → skill** | "What of my repeated work could Aeon do for me?" — surface it from past coding-agent chats |

## Preflight (every mode)

1. Find the repo: current dir → `gh repo set-default` → ask. Clone it if it isn't local.
2. **Confirm `gh` points at THEIR instance, before any command that writes.**

   ```bash
   gh repo view --json nameWithOwner -q .nameWithOwner
   ```

   If that prints `aeonfun/aeon` and they aren't working on upstream itself, stop and run `gh repo set-default <owner>/<repo>`. `gh` prefers an `upstream` remote over `origin` when no default is pinned, and every Aeon write (`auth`, `secrets set`, `skills run`, config pushes) is a `gh -R <resolved>` call — so it will cheerfully put their API keys on the upstream repo and dispatch runs there. It looks like success: no error, a real run id, and the skill just never fires on their instance.
3. `gh auth status` — everything routes through `gh`. If it fails, tell them to run `gh auth login` and stop.
4. Use the `./aeon` CLI for all config writes. It preserves comments in `aeon.yml` and validates. Never hand-edit the YAML — with one exception: the CLI cannot *create* an entry for a brand-new skill (see Mode 4 step 4).

**Don't trust "disabled" for a skill you just created.** The read path lists skills from disk and defaults a missing `aeon.yml` entry to `enabled: false`, so "not configured" and "disabled" look identical. One command tells them apart:

```bash
comm -23 <(ls skills/*/SKILL.md | cut -d/ -f2 | sort) \
         <(grep -oE '^  [a-z0-9-]+:' aeon.yml | tr -d ' :' | sort)
```

Anything it prints is on disk but unconfigured. **Orientation — what's installed, what's on, and where everything lives: `references/layout.md`.**

**Setting any key or token:** read `references/secrets.md` — it has every secret and repo variable with the exact page to get it from. Always set secrets with `./aeon secrets set NAME --stdin`, never as a command argument.

---

## Mode 1 — Start on Aeon

Goal: one real notification in their phone, fast. Do not configure a schedule first.

1. **Run `./aeon init`.** Ask public or private first (public: Actions minutes are free; private: `--private`, minutes bill against the account quota, 2,000/mo on Free). Then, from a clone of the template:

   ```bash
   git clone https://github.com/aeonfun/aeon && cd aeon
   ./aeon init                 # add --private, --name <repo>, --harness <h> as needed
   ```

   It is idempotent and prints a check or a fix per step: signs in to GitHub with the `workflow` scope, creates `<owner>/<name>` from the **template** (not a fork: forks start with Actions disabled), points this folder at it (`aeonfun/aeon` stays as the `upstream` remote), runs `gh repo set-default`, enables Actions and lets them open PRs (the default token permission is left as is), offers to store the gh token as `GH_GLOBAL` (only if it has `repo` + `workflow`), connects a model from the credential manifest, and links Telegram with a `/start` deep link. Re-run it any time; `bin/onboard` is the read-only check. `--dry-run` shows every step without changing anything.

   **If they set things up by hand, pin the default repo before any other command.** With an `upstream` remote and no default pinned, **`gh` prefers `upstream` over `origin`**, so secrets and runs silently land on `aeonfun/aeon`. Fix and verify:

   ```bash
   gh repo set-default <owner>/<repo>
   gh repo view --json nameWithOwner -q .nameWithOwner   # must print THEIR repo
   ```

2. **Auth a model** (if `init` skipped it). At least one is required. The choices per harness, in the order the workflow uses them, are in `harness-adapter/harnesses.json` (`credentials`) and the table in `docs/harnesses.md`. Fastest is `./aeon auth --harness claude-code` (Claude Pro/Max, opens a browser), or `./aeon auth --key <key>`, which detects the provider **from the key prefix**: `sk-ant-oat` (OAuth), `sk-or-` (OpenRouter), `bk_` (Bankr), `inf_` (Surplus), `xai-` (Grok); anything else lands in `ANTHROPIC_API_KEY`.

   **UsePod, Venice, GLM and HivemindOS keys have no prefix** and are undetectable, so a bare `--key` files them as a plain Anthropic key and the run fails later with a confusing auth error. They must be named:

   ```bash
   ./aeon auth --key <token> --provider usepod    # same for venice, glm, hivemindos
   ```

   `--dry-run` prints the resolved `method=... -> secret ...` without calling `gh` or `claude`; run it whenever the provider is in doubt.

   **Don't assume they have a Claude subscription:** ten providers work, including OpenRouter, Grok, GLM, and crypto-settled gateways. See "Providers and harnesses".
3. **Wire one channel** (if `init` skipped it). Telegram is the fastest: `./aeon init` asks for the @BotFather token and links the chat for them; by hand it is `./aeon secrets set TELEGRAM_BOT_TOKEN --stdin` and `TELEGRAM_CHAT_ID`. Skip Discord/Slack/email for now; one channel is enough to prove it works.
4. **Run one skill now.** Pick it with Mode 6 — ask what they want handled, propose one — then `./aeon skills run <name>`. Wait for it, then `./aeon runs logs <id>`. They should get a Telegram message.
5. **Only then, schedule it.** `./aeon skills enable <name>` and set a time (see Mode 2).

Good first skills: `digest` (topic briefing), `github-monitor` (their repos), `heartbeat` (already on by default, reports only when something needs attention).

---

## Mode 2 — Reschedule / change the routine

Show them their day as a **timeline in their own timezone**, not a config file:

```
07:00  digest           "solana"
09:00  pr-review        your repos
18:00  heartbeat        health check
```

Build it from `./aeon skills ls --enabled --json`. (`--enabled` matters: plain `ls` prints a `SCHEDULE` column for *disabled* skills too — that's their `aeon.yml` entry, not proof anything fires.) No CLI, or want the raw file? `references/layout.md` has grep-only equivalents. Then take plain-language edits and apply them:

| They say | You do |
|---|---|
| "move the digest to 7am" | `./aeon skills schedule digest "0 6 * * *"` |
| "weekdays only" | `... "0 6 * * 1-5"` |
| "too noisy, twice a week" | `... "0 6 * * 1,4"` |
| "stop the crypto one" | `./aeon skills disable token-movers` |
| "make it about rust instead" | `./aeon skills set digest --var rust` |

Rules:
- **All cron in `aeon.yml` is UTC.** Convert from their timezone, and say so: "7am Paris = `0 6 * * *` UTC (5am in summer — want it pinned to local time?" There is no local-time option, so if DST matters, tell them which half of the year is off by an hour.
- Confirm back the **next 3 fire times in their timezone** after any change.
- `--dry-run` first on anything ambiguous, show the diff, then apply.
- Changes need a push to take effect. The CLI does it; confirm it landed.
- **Then check the entry came out right** - one grep, every time:

  ```bash
  grep '^  <skill>:' aeon.yml
  ```

  The CLI writes `schedule`, `var`, `model` and `harness` double-quoted, and the scheduler reads `aeon.yml` with yq, so a quoted or a bare `schedule:` both fire. Quotes still matter on a hand-written per-skill `model:`/`harness:` override (see Harness below). Details in Mode 3, check 5.

Skills with `schedule: workflow_dispatch` are on-demand only — they never fire on cron. `reactive` ones fire on conditions, not time.

---

## Mode 3 — Unblock

"It didn't run." Check in this order and stop at the first hit:

1. **Is it on?** `./aeon skills ls --enabled` — is it listed?
2. **Duplicate key?** `node scripts/validate-config.js`. A repeated skill name in `aeon.yml` silently shadows the first one. Common after hand-edits.
3. **Is it even cron?** `workflow_dispatch` and `reactive` never fire on a schedule.
4. **Are Actions disabled?** `gh api repos/{owner}/{repo}/actions/permissions`. GitHub auto-disables scheduled workflows after 60 days of repo inactivity — this silently kills forks and nothing in Aeon surfaces it. Re-enable in repo Settings.
5. **Is the schedule valid cron?** `grep '^  <skill>:' aeon.yml`. The scheduler reads `aeon.yml` with yq (`scripts/parse-aeon-config.sh`), so quotes are optional:

   ```
   schedule: "0 12 * * *"   ✅ fires
   schedule: 0 12 * * *     ✅ fires
   schedule: "0 12 * *"     ❌ never fires (wrong field count)
   ```

   `scripts/cron-due.sh` treats a wrong field count, `*/0` or an out-of-range value as "not due" and only warns on stderr, so the skill is skipped every tick. `node scripts/validate-config.js` checks the schedule format, so run it after any hand edit. Invalid YAML anywhere in `aeon.yml` fails the whole scheduler tick with an `::error::`, so nothing runs at all.

   **Older instances:** a `scheduler.yml` from before the yq parser (no `scripts/parse-aeon-config.sh` in the repo) matches schedules with the bash regex `schedule: *"([^"]+)"`, so there an unquoted value is skipped silently, every tick, forever, and nothing else detects it. Pull upstream, or add the quotes by hand.
6. **Did it run and fail?** `./aeon runs ls` then `./aeon runs logs <id>`. A failed skill retries after a 30-minute cooldown.

Three more, if the above are clean:

- **It ran against the wrong repo.** The giveaway is a command that reported success with a run id, but `./aeon runs ls` on their instance shows nothing. `gh` prefers `upstream` over `origin` when no default is pinned, so an unpinned checkout sends every write to `aeonfun/aeon`.

  ```bash
  gh repo view --json nameWithOwner -q .nameWithOwner   # if this isn't their repo:
  gh repo set-default <owner>/<repo>
  ```

  Then **clean up what landed upstream** — re-running against the right repo does not undo it. Any key set while mispointed is now a secret on someone else's repo:

  ```bash
  gh secret list -R aeonfun/aeon      # timestamps matching the misfire = theirs
  ```

  **Rotate it at the provider first, always** — it sat on a repo whose collaborators can land a workflow that reads it. Then re-set it on their instance with `./aeon secrets set NAME --stdin`.

  **Don't blind-delete it.** `gh secret list` shows only *last-updated*, so it cannot tell you whether the upstream repo already had that secret and the misfire **overwrote** it. Ask before removing:
  - Upstream never had it → `gh secret delete <NAME> -R <upstream>`.
  - Upstream had its own → deleting breaks *their* scheduled runs. The owner must re-set upstream's own value; the overwrite is not reversible from here.

  If the delete 403s, they never had write access — nothing was ever written, and the earlier command failed while only *looking* fine.
- **Missing secret.** Skills declare keys in `requires:`. Check them against `./aeon secrets ls --set`. A missing optional key (`KEY?`) means it degrades quietly, not that it breaks.
- **"No MCP tools available."** On the Claude harness a single unresolved `${VAR}` in `.mcp.json` disables **every** MCP server for that run, not just the broken one (`::warning::.mcp.json references secret(s) not set:` … `Skipping MCP this run.`). Grok degrades per-server instead. If an OAuth server broke a run *after* working, suspect a rotated refresh token that couldn't be saved — `references/mcp.md`.
- **It ran but sent nothing.** That's usually correct. Aeon's convention is silence on no signal — a clean run sends nothing rather than an empty report.

Note: GitHub only delivers ~10% of `*/5` cron ticks, so the scheduler catches up missed slots for up to 12 hours. A skill firing 40 minutes late is normal.

---

## Mode 4 — Turn this chat into a skill

They just did something in this chat and want it to happen on a schedule.

1. **Write the skill file.** `skills/<name>/SKILL.md` — frontmatter, then the prompt. Derive it from what actually happened in the session:
   - the prompt body = what they asked for, plus the steps that worked
   - `mode:` = `read-only` unless it needs to commit or open PRs
   - `requires:` = any API key the work hit (`KEY?` if it can degrade without it)
   - `category:` = one of `core evolution basics dev crypto productivity`
   - if they liked the output, paste a trimmed sample into the body as the format spec

2. **Fix the three things that break unattended runs:**
   - **Nobody's there.** Any point where you asked them a question has to become a default or a rule.
   - **Stay silent on nothing.** Add an explicit "if there's nothing worth reporting, log and exit without notifying." Otherwise it gets muted in a week.
   - **Don't repeat yesterday.** Add "check the last 3 days of `memory/logs/` and skip anything already reported."

3. **Check it can actually run there.** No local filesystem, no logged-in tools. If the session read their home directory or used a local MCP server, say so plainly — that part won't work unattended unless it's wired as a repo secret / `.mcp.json`. Wiring an MCP server for unattended use (dashboard Connect, OAuth refresh, the rotating-token PAT): `references/mcp.md`.

4. **Give it an `aeon.yml` entry.** A new skill on disk has no entry. `./aeon skills enable|schedule <name>` **upserts**: if the entry is missing they create it (inline, quoted `schedule:` defaulting to `"0 12 * * *"`, inserted before the fallback `heartbeat:` line) and then apply the change. To land it present but **disabled**, add it by hand instead, before the `heartbeat:` line:

   ```yaml
     my-skill: { enabled: false, schedule: "0 12 * * *" }
   ```

   **Include the quoted `schedule:` even though it's disabled.** It matches every other entry, and an older instance whose scheduler still uses the bash regex only reads quoted values (Mode 3, check 5). The CLI writes the values it adds double-quoted, so later edits stay consistent.

   Match the inline `{ … }` form every other entry uses, on one line. Per-skill `model:`/`harness:` overrides are read through `scripts/skill_entry.sh`, which also follows an entry split across lines, but the value must be double-quoted (see Harness below).

   This is the one sanctioned exception to "never hand-edit the YAML". Validate after: `node scripts/validate-config.js`. It checks structure and schedule format, but not whether a `model:`/`harness:` override is quoted.

5. **Regenerate BOTH catalogs, add the eyebrow entry, then ship it as a PR.** A new skill trips four CI gates, and **a red gate blocks the merge**: `main` requires the `gate` check, which `ci-gate` fails whenever any other check on the PR is red. Run them locally first. Commit `SKILL.md` on its own before regenerating (the catalog's `sha`/`updated` are git-derived):

   ```bash
   bash scripts/check-skill-categories.sh   # category is one of the six
   bin/generate-skills-json                 # catalog/skills.json
   bin/generate-packs-json                  # catalog/packs.json - NOT optional
   eyebrow scan --path . --lockfile /tmp/fresh.json   # splice only this skill's entry into eyebrowlock.json
   ```

   `generate-packs-json` is the one everyone forgets: `catalog/skills.json` is itself a trigger path for `ci-packs-json`, so committing the skills catalog without the pack catalog goes red on a workflow you never touched. Commit both files. `ci-skill-integrity` also hard-fails any skill with no `eyebrowlock.json` entry; use the eyebrow version pinned in `.github/workflows/ci-skill-integrity.yml` and commit only the new skill's artifact, not a whole-file rescan.

   Full gate list, triggers, and the `ci-tests` / `ci-apps` commands: `references/ci.md`.

6. **Run it once** (`./aeon skills run <name>`), show them the output, then schedule it via Mode 2.

### Skill file shape

```yaml
---
name: my-skill
description: One line — what it does and what it sends.
metadata:
  title: My Skill
  mode: read-only
  category: basics
  var: ""
  tags:
    - content
  requires:
    - SOME_API_KEY?
---

Today is ${today}. <the prompt — plain instructions, including judgment calls>

## Steps
1. <the procedure - 52 of 85 skills carry this section>

## Network note
<curl / WebFetch / `./secretcurl` / `gh api` — how this skill fetches>

## Log
Report via `./notify` (use `./notify -f file.md` for anything multi-line).
Send nothing if there's nothing worth reporting.
Append what you did to `memory/logs/${today}.md` under a `### <skill-name>` heading.
```

Bodies run 133–757 lines (~306 median) — a skill is a prompt in prose, not a config file. `## Steps` / `## Network note` / `## Constraints` / `## Log` is the house shape.

Four things that bite when authoring — full detail in `references/skill-anatomy.md`:

- **`requires:` is a least-privilege allowlist — the run exports only the keys named here.** Inline (`requires: [KEY?]`) and block (`- KEY` lines) both parse, top-level or nested under `metadata:`. The catch is the value: only names matching `^[A-Z][A-Z0-9_]{2,}$` (trailing `?` = optional) are injected; a lowercase or malformed entry is silently dropped.
- **A typo'd `mode:` grants write.** Unknown values fall back to `write`, never to the safer tier. The exact string is `read-only`.
- **`${today}` / `${var}` are not templated.** Nothing rewrites `SKILL.md`; the workflow puts the date and var in the surrounding prompt and the model resolves them in context. Inventing `${my_thing}` yields a literal `${my_thing}`.
- **Never put a secret on a command line.** Use `./secretcurl` with a `{ENV_NAME}` placeholder in braces — Claude Code's permission analyzer blocks `$SECRET` expansions at run time.

Schedules do **not** go in `SKILL.md`; they live in `aeon.yml`. Upstream skills no longer carry a `schedule:` or `cron:` frontmatter line. If you find one (in a fork or a third-party skill), it is inert: **nothing reads it** (`scheduler.yml` parses `aeon.yml` only). Don't add one, and don't trust one you find - check `aeon.yml`.

---

## Mode 5 — Change what an existing skill does

"Make the digest shorter", "stop covering X", "add a source". More common than authoring a new skill.

**First, check whether it's a config change, not a file edit.** Most skills take a topic, filter, or mode through `var` — read the skill's `var:` line and the comment on its `aeon.yml` entry before touching the body. If `var` covers it, you're done:

```bash
./aeon skills set digest --var "rust"          # no file edit at all
```

Otherwise edit `skills/<name>/SKILL.md`:

1. **Read the whole body first.** These files run long (200–750 lines) and carry judgment rules, exit taxonomies, and scoring rubrics that a targeted edit can silently contradict.
2. **Don't strip the survival machinery.** Whatever else changes, the skill must keep: the `./notify` path, the silent-on-no-signal exit, the `memory/logs/${today}.md` append under `### <skill-name>`, and any already-reported dedup. Edits that "tighten" a skill often delete these. The `### <skill-name>` heading is parsed by the health loop and the dedup rule reads the last 3 days of logs — breaking either makes the skill re-report until it gets muted. Conventions in `references/skill-anatomy.md`.
3. **Update frontmatter if the behaviour moved.** A new data source that needs a key → add it to `requires:`. Now writes files or opens PRs → `mode: write`. Changed `description:`, `name:`, `category:` or `requires:` → regenerate **both** catalogs (`bin/generate-skills-json && bin/generate-packs-json`) and commit both; `skills.json` carries those fields and feeds `packs.json`. See `references/ci.md`.
4. **Warn if it's an upstream skill.** Anything shipped in `aeonfun/aeon` will conflict on the next `git merge upstream/main`. Fine, but say so — the two-repo convention is to keep local edits deliberate and few.
5. **Run it once** (`./aeon skills run <name>`) and read the output before leaving.

Automated alternative: the in-repo `autoresearch` skill evolves a target skill by generating four scored variations and shipping the winner as a PR. Reach for it when the ask is "make this better" rather than a specific change.

---

## Mode 6 — "What should I turn on?"

The real first question during onboarding. **Don't dump the catalog.** Ask two or three questions about what they actually want handled while they're away, then propose **three** skills with a one-line reason each.

Three at a time, not twelve. Every enabled skill is a recurring notification, and the fastest way to kill an instance is to make it noisy on day one. `heartbeat` is already on and stays silent unless something needs attention.

```bash
./aeon skills ls                 # all skills — SKILL / ON / SCHEDULE / PACK / DESC
./aeon skills ls --enabled       # only what actually runs
./aeon skills ls --pack crypto   # one pack
./aeon skills <name>             # one skill's detail
./aeon packs ls                  # the six first-party packs
```

`ls` footers with `86 skills · 1 enabled` — read it to them before proposing anything. First run installs the CLI runtime (tsx + yaml, ~12MB); the npm noise is one-time and expected. Grep-only equivalents: `references/layout.md`.

Packs are a visibility filter, not a runtime switch — revealing one runs nothing. Core (12), Evolution (9) and Basics (18) show by default; Dev (16), Crypto (19) and Productivity (11) are on demand.

Reasonable starting sets:

| They care about | Propose |
|---|---|
| Their repos | `github-monitor`, `pr-review`, `changelog` |
| A topic / research | `digest`, `article`, `mention-radar` |
| Markets | `token-movers`, `defi-overview`, `monitor-polymarket` |
| Shipping / traction | `heartbeat`, `shiplog`, `bd-radar` |

### Installing more

```bash
bin/install-skill-pack --list             # browse the community registry
bin/install-skill-pack <owner>/<repo>     # install a curated pack
bin/add-skill <owner>/<repo> --list       # any repo containing SKILL.md files
```

Everything lands **disabled**, security-scanned, with provenance in `skills.lock`.

**Read a community SKILL.md before enabling it.** Installing a pack means running a stranger's prompt with your secrets injected. The scanner is regex — it can't catch prompt injection. Check that `requires:` matches the stated job, that `capabilities:` is honest, and that nothing instructs the agent to send data somewhere unrelated.

**Confirm explicitly before enabling anything with real-world blast radius:** `distribute-tokens` (sends USDC), `schedule-ads` (spends money), `send-email` and `vuln-scanner` (contact real people), `deploy-prototype` and `feature` (push to other people's repos).

---

## Mode 7 — Strategy and voice

Two files that ride in the context of **every** run. Neither is required, both are cheap, and they move output quality more than any per-skill tuning.

### `STRATEGY.md` — the north star

Imported into `CLAUDE.md`, so it's in every skill's context: goal, priorities, audience, hard constraints. When a choice isn't otherwise determined, this breaks the tie. Keep it **tight** (it costs tokens on every single run) and **specific** (a vague strategy can't break a tie).

```bash
./aeon strategy show
./aeon strategy set --file STRATEGY.md
./aeon strategy build "<one-line goal>"    # dispatches the strategy-builder skill
```

`build` reads the brief plus the repo README and `memory/MEMORY.md`, then commits a draft. It runs as an Action, so pull once it finishes. No API key needed.

### `soul/` — how it sounds

By default Aeon has no personality. `soul/SOUL.md` (identity, worldview, opinions) and `soul/STYLE.md` (voice, vocabulary, anti-patterns) are read on every run, so notifications and content sound like the operator. `soul/examples/` holds 10–20 calibration samples.

```bash
./aeon soul show
./aeon soul build --handle <x-handle> --name "<Full Name>" --links <url,url>
```

`XAI_API_KEY` gives the richest read of a real X timeline; without it, `soul-builder` falls back to web search. There's also a gallery of complete example souls at github.com/aeonfun/soul.md to start from.

**The quality bar: specific enough to be wrong.** *"I think most AI safety discourse is galaxy-brained cope"* is useful. *"I have nuanced views on AI safety"* is not. Push for the first kind — a soul that can't offend anyone won't sound like anyone.

---

## Mode 8 — Mine history for skills to automate

"What am I doing by hand over and over that Aeon could just do?" Mode 4 turns *this* chat into a skill; Mode 8 mines *past* chats to find which chat is worth turning into one. It reads the operator's local coding-agent transcripts (`~/.claude/projects` or `~/.codex/sessions`), so it only works on their own machine — never inside an Aeon run.

1. **Scan.** Run the miner from the instance repo root:

   ```bash
   node "${PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}/skills/aeon/scripts/mine-history.mjs" --days 45 --top 15
   ```

   It parses every top-level session in the window (skips subagent sidechains), normalises shell commands to `binary subcommand`, groups session titles, and prints a digest ranked by **distinct sessions × distinct days** — recurrence and cadence, not raw volume. Flags: `--days N` (window, default 120), `--project SUBSTR` (only sessions whose cwd matches — scope to one repo/topic), `--top N`, `--min-sessions N`, `--json`. It has no dependencies and reverts to a clean error if there's no history. Deeper reading of the tables and the candidate rubric: `references/history-mining.md`.

2. **Read it as a human would.** The digest is raw signal, not a verdict — the judgment is yours:
   - **Recurring command workflows** — a `binary subcommand` across many sessions *and* many days is a habit. Universal plumbing (`git status`, `gh auth`, bare `node`/`python3`) is already filtered out, but `gh pr`/`gh api`/`npm run` are substrate too — high everywhere, weak as a skill idea. Look for the *distinctive* recurring call: a named script, a specific CLI (`x-cli`, `langfuse`, `raindrop`), a tight `gh api` pattern.
   - **Recurring task themes** — grouped session titles are the strongest signal. A title you've hit across many days at a rough cadence ("check X", "review Y", "digest Z") is almost always the real automation candidate.
   - **Tooling / projects** — which MCP servers and repos the work lives in; tells you what a skill would need wired and where to scope `--project`.

3. **Filter to genuine candidates.** A row is worth proposing only if it's all of:
   - **Recurring** — spans several sessions across several days, not one busy afternoon.
   - **Fetch/compute/report-shaped** — pulls or checks something and reports. Interactive, decision-heavy, or one-off migration work does *not* automate.
   - **Unattended-safe** — no dependence on local files, logged-in desktop apps, or a human answering mid-task (Mode 4 step 2/3 covers hardening).
   - **Not already a skill.** Dedup against the instance: `./aeon skills ls`. Much recurring `gh pr` work is already `pr-review`/`pr-check`; a research cadence is already `digest`/`mention-radar`. If an existing skill covers it, the move is Mode 2 (reschedule) or Mode 5 (edit its `var`), **not** a new skill.

4. **Propose three, with evidence.** Don't dump the digest. Name **three** candidates, each with its recurrence count as proof ("you did X across N sessions over D days"), a one-line skill sketch (what it fetches, what it sends), a suggested `mode:` (`read-only` if it only fetches and reports) and a suggested `schedule:` inferred from the observed cadence (seen ~daily → daily; ~weekly → weekly). Ask which to build.

5. **Hand off to Mode 4** to author the chosen one — the same skill-file shape, unattended-hardening, quoted-`schedule:` entry, and dual-catalog CI. Mode 8 finds the work; Mode 4 ships it.

**Privacy:** the transcripts are read locally and only the aggregate digest is surfaced. Don't paste raw prompt bodies or anything sensitive from a session into a channel or a committed file; the counts and titles are enough to decide.

---

## Providers and harnesses

Two independent axes. Don't confuse them: the **gateway** decides which model answers; the **harness** decides which CLI runs the skill.

### Gateway — what powers Claude Code

Set a secret and it's live. `aeon.yml` ships `gateway: { provider: auto }`, which resolves at run time from whichever keys exist, in this priority order:

```
claude → anthropic → openrouter → bankr → usepod → venice → surplus → grok → glm → hivemindos
```

`direct` is **not** a hop in that chain — it's the placeholder when *none* of the ten secrets is set. It requires nothing and configures nothing, so the run proceeds on whatever `ANTHROPIC_*` env happens to exist and otherwise fails at the first model call. "Resolved to `direct`" in a log means **no key was found**, not that a fallback worked.

| Provider | Secret | Notes |
|---|---|---|
| Claude subscription | `CLAUDE_CODE_OAUTH_TOKEN` | One-click OAuth, included in Pro/Max |
| Anthropic API | `ANTHROPIC_API_KEY` | Pay-as-you-go |
| OpenRouter | `OPENROUTER_API_KEY` | `sk-or-…` · Anthropic-native passthrough, lowest-risk |
| Bankr | `BANKR_LLM_KEY` | `bk_…` · discounted Opus |
| UsePod | `USEPOD_TOKEN` | No prefix — pass `--provider usepod`. Token sits in the base URL, keep it secret |
| Venice | `VENICE_API_KEY` | No prefix — pass `--provider venice`. Privacy-first, bridged via a sidecar |
| Surplus | `SURPLUS_API_KEY` | `inf_…` · settles USDC on Base — fund the wallet + `approve()` once first |
| Grok (xAI) | `XAI_API_KEY` | `xai-…` · passthrough to `api.x.ai` |
| GLM (Z.AI) | `GLM_API_KEY` | No prefix — pass `--provider glm`. Alias `ZAI_API_KEY`. Passthrough to `api.z.ai/api/anthropic` |
| HivemindOS Models | `HIVEMINDOS_CREDIT_TOKEN` | Billed to a credit balance, no provider account needed. Not in `./aeon auth` or the dashboard yet - `gh secret set HIVEMINDOS_CREDIT_TOKEN`. Sidecar; model via `HIVEMINDOS_MODEL` (default `inclusionai/ling-3.0-flash`) |

It runs as a **cascade**, not a single choice: the highest-priority key goes first, and on *any* failure (no credits, rate limit, outage, dud response) the run falls over to the next provider whose key is set. It only errors if every one fails. The log prints `Routing attempt via '<provider>'` per hop.

- **Reorder:** repo variable `GATEWAY_ORDER` (space-separated names).
- **Pin one** (disables failover): `./aeon config set gateway <name>`.
- **Any Anthropic-compatible endpoint:** `ANTHROPIC_API_KEY` plus the repo variable `ANTHROPIC_BASE_URL` — e.g. `https://api.deepseek.com/anthropic`.

### Harness — which CLI runs the skill

Nine harnesses: `claude` (default), `grok`, `codex`, `pi`, `vibe`, `kimi`, `fx`, `cursor`, `hermes`. All run through the same `harness-adapter/run-harness` contract; only `claude` goes through the gateway above, every other harness uses its own auth (`glm` is a gateway provider, not a harness). `codex`/`pi`/`vibe`/`kimi`/`hermes` can all run on one shared `OPENROUTER_API_KEY`; `fx` needs `AI_GATEWAY_API_KEY`, `cursor` needs `CURSOR_API_KEY`. Native logins: `./aeon auth --harness <name>` (see `./aeon auth --help`), and `docs/harnesses.md` for models and verification status. The rest of this section covers `grok`, the one with the most knobs. The Grok harness runs the `grok` CLI instead of Claude Code and **bypasses the gateway entirely**.

- **Set it:** `./aeon config set harness grok` globally, or `harness: "grok"` on a single skill's `aeon.yml` entry - **quoted**. Per-skill `model:` and `harness:` are read through `scripts/skill_entry.sh` with a match that requires double quotes, so an unquoted override is silently ignored and the skill keeps running the global default - no error, and the log's `model=` line looks normal. The CLI writes both quoted; after a hand edit, re-read the entry and add the quotes if they're missing.
- **Auth:** `XAI_API_KEY`, or an X account (SuperGrok / X Premium+) via the dashboard's **Connect X account**, which stores `GROK_CREDENTIALS`. There is no CLI flag for the X OAuth flow — send them to `./aeon` (the dashboard) for that one.
- **Models:** `grok-4.7` (default, reasoning), `grok-4.6` or `grok-4.5`, the ids the dashboard offers for the harness. Older api.x.ai ids such as `grok-composer-2.5-fast` are not harness models (the grok CLI rejects them on an X-account login); they work only on the `grok` gateway path (`XAI_API_KEY` plus the `GROK_MODEL` repo variable).
- **No free tier.**

Tell them up front:
- `vibe` and `kimi` runs report **0 tokens** (their CLIs expose no token counts), so cost tracking reads blank for them. Not a bug. Grok reports real usage and cost.
- The X OAuth session expires. If unattended runs start failing on auth, reconnect.
- `mode: read-only` still applies (the wrapper OS sandbox write-locks the workspace on every harness), and MCP works.

Per-skill grok knobs, in `SKILL.md` frontmatter (ignored on the Claude harness): `max_turns` (default 60) and `effort` (`low|medium|high|xhigh|max`, reasoning models only; non-reasoning models reject it).
