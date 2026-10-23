---
name: lazybrief
description: Overnight do-it-later inbox. A local Gemma (via Ollama) sorts the links, notes and todos dumped during the day into a five-line morning brief, sent through ./notify.
metadata:
  title: Lazybrief
  category: productivity
  var: ""
  tags:
    - productivity
    - local-model
  mode: write
  capabilities:
    - sends_notifications
---
> **${var}** — Optional path to the Lazybrief checkout. Default: `apps/lazybrief`.

Sort the Lazybrief inbox with a local open-weight model and send the five-line
brief through `./notify`. Lazybrief does the model work; this skill only runs it
and delivers the result.

**Run each command below as its own Bash call.** No `&&`, `;` or pipes: the
sandbox denies chained commands.

## Steps

1. Set `APP` to `${var}` if it is non-empty, otherwise `apps/lazybrief`. If
   `APP/lazybrief.py` does not exist, notify
   `lazybrief: no checkout at APP (see the Lazybrief README)` and stop.

2. Check the model is reachable:
   ```bash
   python3 APP/lazybrief.py doctor
   ```
   If the last line is not `ready`, the local model is down. Notify
   `lazybrief: local model not ready, skipped tonight's brief (start Ollama)`
   with `--severity warn` and stop. Never send an empty or invented brief, and
   never fall back to `--offline` unless the operator asked for it in `${var}`.

3. Generate the brief. Run this exactly **once**, because it archives the inbox:
   ```bash
   python3 APP/lazybrief.py brief --brief-file APP/data/notify.md
   ```
   It writes the full brief to `APP/data/briefs/YYYY-MM-DD.md` and the compact
   five-line version to `APP/data/notify.md` (git-ignored, like the rest of
   `APP/data/`). On an empty inbox the file holds
   a one-line "quiet night" notice instead.

4. Send it:
   ```bash
   ./notify --title "Lazybrief" -f APP/data/notify.md
   ```

5. Append one line to `memory/logs/${today}.md`: how many items were sorted (from
   the `(archived N items ...)` line of step 3's output), or that the inbox was
   empty.

## Where it runs

The model lives on `localhost:11434`. A hosted GitHub Actions runner cannot reach
it, and the inbox lives in `APP/data/` on your own disk. Run this skill wherever
Ollama and the inbox are: your own machine, or a self-hosted runner on it.

## Install

From the root of your Aeon repo:
```bash
git clone https://github.com/NurstarK/lazybrief apps/lazybrief
mkdir -p skills/lazybrief
cp apps/lazybrief/skill/SKILL.md skills/lazybrief/SKILL.md
```

Then add one line under `skills:` in `aeon.yml` (schedules are UTC):
```yaml
  lazybrief: { enabled: true, schedule: "0 5 * * *", var: "" } # overnight do-it-later inbox -> 5-line brief (local Ollama)
```

## Environment

No secrets. Optional: `LAZYBRIEF_MODEL` (default `gemma3`), `OLLAMA_HOST`
(default `http://localhost:11434`), `LAZYBRIEF_HOME` (default `APP/data`).
