---
name: Schedule Ads
description: Schedule paid ads across Meta/TikTok/Snapchat/Pinterest/LinkedIn via the AdManage.ai API, driven by a declarative config file. Launches PAUSED by default — never auto-activates live spend.
schedule: "0 8 * * *"
commits: true
permissions:
  - contents:write
tags: [growth, ads]
---

Reads `skills/schedule-ads/config.yaml`, picks schedule entries matching today, and queues ad launches via AdManage.ai. The actual API calls happen in `scripts/postprocess-admanage.sh` (outside the sandbox, with full env access) — this skill just builds the launch payloads and drops them in `.pending-admanage/`.

Read `memory/MEMORY.md` for context. Read the last 3 days of `memory/logs/` for recent launch activity.

## Safety defaults

This skill **spends real money on ad platforms**. Guardrails, in priority order:

1. **PAUSED by default.** Every launch request sets the entity to PAUSED. The operator has to resume manually in the AdManage dashboard before spend starts. `launchPaused: false` in config is the explicit opt-out.
2. **Daily spend cap.** Before queueing any launches, postprocess checks `GET /v1/spend/daily` for today. If spend ≥ `dailySpendCap` in the config, all queued launches are skipped and a warning is notified. This is a circuit breaker, not a budget enforcer — platform budgets still apply.
3. **Dry-run mode.** If `DRY_RUN=true` in env or `dryRun: true` in config, the skill builds the payloads, writes them to `.pending-admanage/dryrun/`, notifies what *would* launch, and exits without calling the API.
4. **Config-only.** The skill does not invent campaigns, creative, or targeting. If there's no schedule for today, it exits cleanly with no API calls.
5. **Single source of truth.** All ads/campaigns/targeting live in `config.yaml`. The skill never generates new creative on the fly.

## Sandbox note

AdManage requires `Authorization: Bearer $ADMANAGE_API_KEY` on every endpoint. The sandbox blocks env var expansion in curl headers, so this skill **cannot make the API calls directly**. Instead:

- This skill writes launch intents to `.pending-admanage/launches/*.json` (one file per batch).
- After Claude finishes, the workflow runs `scripts/postprocess-admanage.sh`, which has full env access. That script calls `POST /v1/launch`, polls `GET /v1/batch-status/{id}`, and notifies the result via `./notify`.
- The skill never sees or touches the API key.

If `scripts/postprocess-admanage.sh` is missing, the skill still queues correctly — the payloads just sit in `.pending-admanage/launches/` until the script exists. Log a warning and carry on.

## Steps

1. **Load config.** Read `skills/schedule-ads/config.yaml`. If the file doesn't exist, log `SCHEDULE_ADS_NOT_CONFIGURED` and exit cleanly (no notify, no error). The example template lives next to this file as `config.example.yaml`.

2. **Validate config shape.** Required top-level keys: `defaults` (with `adAccountId`, `workspaceId`, `page`), and `schedules` (array). If either is missing, file an issue in `memory/issues/` per the CLAUDE.md issue tracker convention, notify once, and exit.

3. **Pick today's schedule entries.** For each entry in `schedules`, match against today's date:
   - `when.everyDay: true` → always matches.
   - `when.dayOfWeek: monday` (or any weekday name, lowercase) → matches if today is that weekday (UTC).
   - `when.date: "2026-04-25"` → matches only on that exact date.
   - `when.dates: ["2026-04-25", "2026-05-02"]` → matches if today is in the list.
   - `when.cron: "0 8 * * 1"` → (advanced) matches if today satisfies the cron. Optional — skip if it's too much parsing effort.

   If no entries match today, log `SCHEDULE_ADS_NOTHING_TODAY` and exit cleanly (no notify).

4. **Build launch payloads.** For each matching schedule entry, construct the AdManage `POST /v1/launch` body:
   ```json
   {
     "ads": [
       {
         "adName": "<templated from ad.adName, {date} replaced>",
         "adAccountId": "<from defaults or entry override>",
         "workspaceId": "<from defaults or entry override>",
         "title": "<from ad>",
         "description": "<from ad>",
         "cta": "<from ad or defaults.cta>",
         "link": "<from ad>",
         "page": "<from defaults>",
         "insta": "<from defaults, Meta only>",
         "adSets": [ { "value": "<id>", "label": "<name>" } ],
         "media": [ { "url": "<media url>" } ],
         "status": "PAUSED"
       }
     ]
   }
   ```
   Enforce `status: PAUSED` on every ad unless `defaults.launchPaused` is explicitly `false`. Never strip it silently.

   Template substitutions inside string fields:
   - `{date}` → today's ISO date (YYYY-MM-DD)
   - `{dateHuman}` → "April 21, 2026" style

5. **Pre-flight validation.** For each payload:
   - `media[*].url` must be an absolute `https://` URL. Reject entries with local paths or obviously broken URLs.
   - `adSets[*].value` must be a non-empty string. If missing, skip the entry with a warning in the log.
   - For Meta entries (`adAccountId` starts with `act_`): `page` and `insta` must be set. TikTok/Snapchat/etc. have their own requirements — don't block on Meta-specific fields for other platforms.
   - `title` and `description` must be non-empty.

   Drop invalid entries, keep going. Log which ones were skipped and why.

6. **Handle dry-run.** If `DRY_RUN=true` or `config.dryRun: true`:
   - Write payloads to `.pending-admanage/dryrun/{schedule-name}-{timestamp}.json`.
   - Notify a preview (see step 9) but with `[DRY RUN]` prefix.
   - Skip step 7.
   - This mode exists for the operator to sanity-check before arming real launches.

7. **Queue for postprocess.** Write each launch payload to `.pending-admanage/launches/{schedule-name}-{timestamp}.json`:
   ```json
   {
     "schedule": "<entry name>",
     "queuedAt": "<iso timestamp>",
     "dailySpendCap": <number | null>,
     "payload": { "ads": [ ... ] }
   }
   ```
   `postprocess-admanage.sh` will pick these up after Claude exits, run the API calls with real env, poll batch status, and fire its own notifications.

8. **Write artifact to `.outputs/schedule-ads.md`** so downstream chain consumers can read what was queued. Format:
   ```markdown
   # Schedule Ads — ${today}

   Queued: N launches across M schedules.
   Dry-run: yes|no.

   ## Entries
   - <schedule name>: <ad count> ads, platform=<meta|tiktok|…>, paused=<bool>
     - <adName> — <title>
   ```

9. **Notify** via `./notify`. Keep it tight:
   ```
   *Ads queued — ${today}${dryRunSuffix}*

   <N> launches queued from <M> schedules.

   - <schedule name> → <ad count> ads <platform> <paused|LIVE>
     "<first adName>"
   - ...

   <if dry-run>
   no API calls made — remove DRY_RUN to arm.
   <else>
   postprocess-admanage will call AdManage and report batch results.
   ```
   If nothing was queued (no schedules matched), don't notify at all.

10. **Log to `memory/logs/${today}.md`:**
    ```
    ## Schedule Ads
    - Schedules matching today: <names>
    - Payloads queued: <count> (dry-run: <bool>)
    - Files written: .pending-admanage/launches/*.json
    ```

## Config schema

See `skills/schedule-ads/config.example.yaml` for a filled-in template. Minimum viable config:

```yaml
defaults:
  adAccountId: act_XXXXXXXXXX
  workspaceId: XXXXXXXXXXXX
  page: XXXXXXXXXXXX         # Meta Page ID
  insta: XXXXXXXXXXXX        # Instagram user ID
  cta: LEARN_MORE
  launchPaused: true         # NEVER change this without thought
  dailySpendCap: 50          # USD. Circuit breaker.
  dryRun: false

schedules:
  - name: weekly-promo
    platform: meta
    when: { dayOfWeek: monday }
    adSets:
      - { value: "120xxxxxxxxxxxxx", label: "US Broad 25-55" }
    ads:
      - adName: "Weekly promo — {date}"
        title: "Headline copy here"
        description: "Supporting copy in a sentence or two."
        cta: LEARN_MORE
        link: https://example.com
        media:
          - url: https://media.admanage.ai/your-account/hero.mp4
```

## What it does NOT do

- **Does not create campaigns or ad sets.** Those must pre-exist in AdManage (use the dashboard or `POST /v1/manage/create-campaign` separately). This skill only launches *ads into existing ad sets*.
- **Does not upload creative.** Media URLs must be hosted somewhere accessible (AdManage CDN, your own CDN, Supabase, wherever). If you need upload, add a separate `upload-ad-media` skill that calls `POST /v1/media/upload/url`.
- **Does not generate copy.** Titles/descriptions come from config. If the operator wants AI-written variants, a separate skill can write them into `config.yaml` and commit — keeps the launch path boring and auditable.
- **Does not manage budgets, bids, or targeting.** Everything downstream of launch (scaling, pausing losers, budget shifts) lives in follow-up skills or the dashboard.
- **Does not launch to Google Ads, Axon, or Taboola** in v1. Config schema is deliberately Meta/TikTok/Snapchat/Pinterest/LinkedIn-shaped. Adding Google/Axon later is straightforward but their launch shapes differ enough to need their own validation.

## Environment Variables

- `ADMANAGE_API_KEY` — required for `scripts/postprocess-admanage.sh`. Never read by this skill.
- `DRY_RUN` — optional. If `true`, forces dry-run mode regardless of config.
- Notification channels configured via repo secrets (see CLAUDE.md).

## Output

End with a `## Summary` block: schedules matched today, payload count, dry-run yes/no, files written.
