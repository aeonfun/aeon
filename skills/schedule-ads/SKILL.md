---
type: Skill
name: Schedule Ads
category: social
description: Manage paid ads on AdManage.ai from declarative config. Default branch schedules ad launches across Meta/TikTok/Snapchat/Pinterest/LinkedIn (PAUSED by default, never auto-activates live spend); `create` branch provisions Meta campaigns + ad sets (created PAUSED, IDs written back to state so the schedule branch can launch into them).
var: |
  Selects which flow runs (parse from ${var}):
  - empty / unset (default) → SCHEDULE branch: read config.yaml, pick schedule
    entries matching today, queue ad launches to .pending-admanage/launches/*.json.
    Launches PAUSED by default; dailySpendCap circuit-breaker; never auto-activates
    live spend. (Original schedule-ads behavior, unchanged.)
  - "create" → CREATE branch: read config.create.yaml, diff against
    .admanage-state/campaigns.json, queue Meta campaign + ad-set creates to
    .pending-admanage/creates/. On-demand; creates entities PAUSED; postprocess
    writes returned IDs back into state so the schedule branch can launch into them.
schedule: "0 8 * * *"
commits: true
permissions:
  - contents:write
tags: [growth, ads]
requires: [ADMANAGE_API_KEY]
---

> **${var}** selects the flow. Empty/unset = **schedule** (launch ads into existing ad sets). `create` = **create-campaign** (provision Meta campaigns + ad sets). Both are config-driven, PAUSED-by-default, and never call the AdManage API directly — they queue intents that credentialed postprocess scripts pick up after Claude exits.

Reads a declarative config, computes what to do, and drops JSON intent files under `.pending-admanage/`. The actual AdManage.ai API calls happen in `scripts/postprocess-admanage.sh` (schedule branch) and `scripts/postprocess-admanage-create.sh` (create branch) — outside the sandbox, with full env access. This skill never sees or touches `ADMANAGE_API_KEY`.

## Preamble (both branches)

1. Read `memory/MEMORY.md` for context. Read the last ~3 days of `memory/logs/` for recent launch / provisioning activity — don't re-report a signal already logged.
2. Parse `${var}`:
   - empty / unset → run the **Schedule branch** below.
   - `create` → run the **Create branch** below.
   - anything else → log `SCHEDULE_ADS_UNKNOWN_SELECTOR: <value>` and exit cleanly (no notify).
3. Both branches spend real money on ad platforms. The shared safety posture (see each branch) is: PAUSED by default, config-only (never invent campaigns/creative/targeting), dry-run available, and exit silently when there's nothing to do.

---

# Schedule branch (default — empty `${var}`)

Reads `skills/schedule-ads/config.yaml`, picks schedule entries matching today, and queues ad launches via AdManage.ai. Builds the launch payloads and drops them in `.pending-admanage/launches/`; `scripts/postprocess-admanage.sh` makes the calls.

## Safety defaults (schedule)

This branch **spends real money on ad platforms**. Guardrails, in priority order:

1. **PAUSED by default.** Every launch request sets the entity to PAUSED. The operator has to resume manually in the AdManage dashboard before spend starts. `launchPaused: false` in config is the explicit opt-out.
2. **Daily spend cap.** Before queueing any launches, postprocess checks `GET /v1/spend/daily` for today. If spend ≥ `dailySpendCap` in the config, all queued launches are skipped and a warning is notified. This is a circuit breaker, not a budget enforcer — platform budgets still apply.
3. **Dry-run mode.** If `DRY_RUN=true` in env or `dryRun: true` in config, the branch builds the payloads, writes them to `.pending-admanage/dryrun/`, notifies what *would* launch, and exits without calling the API.
4. **Config-only.** The branch does not invent campaigns, creative, or targeting. If there's no schedule for today, it exits cleanly with no API calls.
5. **Single source of truth.** All ads/campaigns/targeting live in `config.yaml`. The branch never generates new creative on the fly.

## Sandbox note (schedule)

AdManage requires `Authorization: Bearer $ADMANAGE_API_KEY` on every endpoint. The sandbox blocks env var expansion in curl headers, so this branch **cannot make the API calls directly**. Instead:

- This branch writes launch intents to `.pending-admanage/launches/*.json` (one file per batch).
- After Claude finishes, the workflow runs `scripts/postprocess-admanage.sh`, which has full env access. That script calls `POST /v1/launch`, polls `GET /v1/batch-status/{id}`, and notifies the result via `./notify`.
- The branch never sees or touches the API key.

If `scripts/postprocess-admanage.sh` is missing, the branch still queues correctly — the payloads just sit in `.pending-admanage/launches/` until the script exists. Log a warning and carry on.

## Steps (schedule)

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

8. **Write artifact to `output/.chains/schedule-ads.md`** so downstream chain consumers can read what was queued. Format:
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

10. **Log** — see the shared **Log** section below (discriminator: `schedule`).

## Config schema (schedule)

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

## What the schedule branch does NOT do

- **Does not create campaigns or ad sets.** Those must pre-exist in AdManage — use the **`create` branch** (`${var}=create`), the dashboard, or `POST /v1/manage/create-campaign` separately. This branch only launches *ads into existing ad sets*.
- **Does not upload creative.** Media URLs must be hosted somewhere accessible (AdManage CDN, your own CDN, Supabase, wherever). If you need upload, add a separate `upload-ad-media` skill that calls `POST /v1/media/upload/url`.
- **Does not generate copy.** Titles/descriptions come from config. If the operator wants AI-written variants, a separate skill can write them into `config.yaml` and commit — keeps the launch path boring and auditable.
- **Does not manage budgets, bids, or targeting.** Everything downstream of launch (scaling, pausing losers, budget shifts) lives in follow-up skills or the dashboard.
- **Does not launch to Google Ads, Axon, or Taboola** in v1. Config schema is deliberately Meta/TikTok/Snapchat/Pinterest/LinkedIn-shaped. Adding Google/Axon later is straightforward but their launch shapes differ enough to need their own validation.

---

# Create branch (`${var}=create`)

Reads `skills/schedule-ads/config.create.yaml`, figures out which campaigns/ad sets don't exist yet, and queues create requests to `.pending-admanage/creates/`. The credentialed API calls happen in `scripts/postprocess-admanage-create.sh` after Claude finishes.

This branch is **on-demand** — invoke it manually when you want to provision new campaigns, then reference the returned IDs in `skills/schedule-ads/config.yaml` (schedule branch) to launch creatives into them.

Read `.admanage-state/campaigns.json` (if it exists) to see what's already created.

## What this branch provisions

Two entity types only:
1. **Meta campaigns** — name, objective, budget, bid strategy, promoted object.
2. **Meta ad sets** — name, budget, optimization goal, targeting (geo/age/platforms), destination.

Everything else (TikTok/Snapchat/Pinterest/LinkedIn campaigns, advanced Meta fields like valueRuleSetId or Advantage+ catalog) is v2+. The shape below is intentionally minimal.

## Safety defaults (create)

Same posture as the schedule branch:

1. **PAUSED by default.** Every campaign + ad set is created with `status: PAUSED`. No surprise spend.
2. **Idempotent.** The branch tracks created entities in `.admanage-state/campaigns.json`. If a campaign name already exists in state, it's skipped. Run it twice → no duplicates.
3. **Dry-run mode.** `DRY_RUN=true` or `config.dryRun: true` → payloads written to `.pending-admanage/dryrun-create/`, notified, no API calls.
4. **Config-only.** No config file → exit silently. No invented campaigns, no autonomous provisioning.

## Sandbox note (create)

Every `/manage/*` endpoint requires `Authorization: Bearer $ADMANAGE_API_KEY`. Sandbox blocks env-var expansion in curl headers, so this branch queues intents only:

- Branch writes: `.pending-admanage/creates/campaigns/<slug>.json` and `.pending-admanage/creates/adsets/<campaign-slug>__<adset-slug>.json`
- After Claude exits, `scripts/postprocess-admanage-create.sh` runs with full env access, makes the API calls in the right order (campaigns first, then ad sets referencing returned campaign IDs), lands per-entity results in `.pending-admanage/creates-results/`, and writes IDs back to `.admanage-state/campaigns.json`.

If the postprocess script is missing, the branch still queues correctly — the payloads sit in `.pending-admanage/creates/` until the script exists.

## Steps (create)

1. **Load config.** Read `skills/schedule-ads/config.create.yaml`. If it doesn't exist, log `CREATE_CAMPAIGN_NOT_CONFIGURED` and exit cleanly (no notify). The example template lives next to this file as `config.create.example.yaml`.

2. **Load state.** Read `.admanage-state/campaigns.json`. If it doesn't exist, treat as empty. Shape:
   ```json
   {
     "campaigns": [
       {
         "configName": "Prospecting — Q2 2026",
         "campaignId": "120251616228380456",
         "adAccountId": "act_xxx",
         "createdAt": "2026-04-21T08:00:00Z",
         "adSets": [
           {
             "configName": "US Broad 25-54",
             "adSetId": "120251616242460456",
             "createdAt": "2026-04-21T08:00:04Z"
           }
         ]
       }
     ]
   }
   ```

3. **Validate config shape.** Required: `defaults.adAccountId`, `defaults.workspaceId`, `campaigns[]`. Each campaign needs `name` and `objective`. Each ad set needs `name`, and either `optimizationGoal` (explicit) or a compatible parent objective. If validation fails, file an issue in `memory/issues/` and exit.

4. **Compute diff.** For each campaign in config:
   - Match against state by exact `name`. If present, mark as `existing`.
   - If missing, mark as `new` and queue a campaign create.
   - For each ad set under the campaign, match against the parent's `adSets[]` in state by name. If missing, queue an ad-set create (with a `parentCampaignConfigName` reference that postprocess will resolve to a real campaign ID).

   If nothing is new, log `CREATE_CAMPAIGN_ALL_EXIST` and exit without notify.

5. **Build campaign create payloads.** Per the AdManage `POST /v1/manage/create-campaign` shape:
   ```json
   {
     "businessId": "<adAccountId>",
     "workspaceId": "<workspaceId>",
     "name": "<campaign.name>",
     "objective": "<campaign.objective>",
     "status": "PAUSED",
     "buyingType": "AUCTION",
     "specialAdCategories": [],
     "dailyBudget": <number>,
     "bidStrategy": "<LOWEST_COST_WITHOUT_CAP | LOWEST_COST_WITH_BID_CAP | COST_CAP | ...>",
     "promotedObject": { ... }
   }
   ```
   Skip keys that are `null`/absent in config — don't send empty strings. Always force `status: PAUSED` unless `defaults.launchPaused: false` is set explicitly.

6. **Build ad-set create payloads.** Per `POST /v1/manage/create-adset`:
   ```json
   {
     "businessId": "<adAccountId>",
     "workspaceId": "<workspaceId>",
     "campaignId": "__RESOLVE_FROM_PARENT__",
     "parentCampaignConfigName": "<campaign.name>",
     "name": "<adSet.name>",
     "status": "PAUSED",
     "dailyBudget": <number>,
     "billingEvent": "IMPRESSIONS",
     "optimizationGoal": "<LANDING_PAGE_VIEWS | OFFSITE_CONVERSIONS | ...>",
     "destinationType": "<WEBSITE | PHONE_CALL | MESSAGING_... | ...>",
     "targeting": { ... },
     "promotedObject": { ... }
   }
   ```

   The `__RESOLVE_FROM_PARENT__` sentinel + `parentCampaignConfigName` tells postprocess to look up the campaign ID after the campaign create succeeds. If the parent campaign was *existing* (already in state), write the real campaign ID directly and drop the sentinel.

7. **Pre-flight validation.**
   - `adAccountId` must start with `act_` (this branch is Meta-only in v1).
   - `dailyBudget` must be a positive number in dollars (not cents).
   - `objective` must be one of the documented Meta objectives: `OUTCOME_TRAFFIC`, `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`, `OUTCOME_AWARENESS`, `OUTCOME_SALES`, `OUTCOME_APP_PROMOTION`.
   - Targeting `geo_locations.countries` must be a non-empty array.
   Drop invalid entries, keep going, log what was skipped and why.

8. **Handle dry-run.** If `DRY_RUN=true` or `config.dryRun: true`: write payloads to `.pending-admanage/dryrun-create/` instead, notify with a `[DRY RUN]` prefix, skip step 9.

9. **Queue for postprocess.** Write files into `.pending-admanage/creates/`:
   - `campaigns/<slugify(name)>.json` — campaign create payload.
   - `adsets/<slugify(campaign-name)>__<slugify(adset-name)>.json` — ad-set create payload.

   The file-name convention matters: postprocess lexical-sorts `campaigns/` first, then `adsets/`, so campaigns always create before their children.

10. **Write artifact to `output/.chains/create-campaign.md`** so chain consumers can see what was queued:
    ```markdown
    # Create Campaign — ${today}

    New campaigns: N.
    New ad sets: M.
    Dry-run: yes|no.

    ## Campaigns
    - <name> — <objective>, $<dailyBudget>/day
      - ad set: <name> — <optimizationGoal>, $<dailyBudget>/day, <countries>

    ## Skipped (already exist)
    - <name>
    ```

11. **Notify via `./notify`.** Tight format:
    ```
    *Campaigns queued — ${today}${dryRunSuffix}*

    <N> campaigns, <M> ad sets queued for creation.

    - <campaign name>
      - adset: <adset name> — <country>, $<budget>/day

    <if dry-run>
    no API calls made — remove DRY_RUN to arm.
    <else>
    postprocess-admanage-create will provision and write IDs to .admanage-state/campaigns.json.
    ```
    If nothing is new, don't notify at all.

12. **Log** — see the shared **Log** section below (discriminator: `create`).

## Config schema (create)

See `skills/schedule-ads/config.create.example.yaml` for a filled-in template. Minimum viable config:

```yaml
defaults:
  adAccountId: act_XXXXXXXXXX
  workspaceId: XXXXXXXXXXXX
  launchPaused: true               # never flip without a reason
  dryRun: false                    # true = build, don't call

campaigns:
  - name: "Prospecting — Q2 2026"
    objective: OUTCOME_TRAFFIC
    dailyBudget: 50
    bidStrategy: LOWEST_COST_WITHOUT_CAP
    promotedObject:
      pixel_id: "123456789012345"
    adSets:
      - name: "US Broad 25-54"
        dailyBudget: 15
        optimizationGoal: LANDING_PAGE_VIEWS
        destinationType: WEBSITE
        targeting:
          geo_locations: { countries: ["US"] }
          age_min: 25
          age_max: 54
          publisher_platforms: [facebook, instagram]
```

## Interaction with the schedule branch

After `postprocess-admanage-create.sh` writes to `.admanage-state/campaigns.json`, the IDs are yours to reference in `skills/schedule-ads/config.yaml` (schedule branch) under `adSets[].value`. The two flows are intentionally decoupled:

- **create branch** provisions structure (container).
- **schedule branch** launches creative into that structure (contents).

Running both in the same Claude cycle *won't* chain — the state file won't have IDs until postprocess runs. Pattern is: run `${var}=create` → wait for postprocess to log the new IDs → copy IDs into `config.yaml` → next default (schedule) run uses them.

## What the create branch does NOT do

- **Doesn't touch existing campaigns.** Once a campaign is in state, this branch leaves it alone. Budget changes, bid changes, status flips, renames — all handled elsewhere (dashboard or a separate skill).
- **Doesn't delete or archive.** No destructive paths.
- **Doesn't provision media, pages, or pixels.** Pixel IDs must already exist in AdManage. Use `GET /v1/conversions/pixels` to discover them.
- **Doesn't create TikTok / Snapchat / Pinterest / LinkedIn** structures. Those have different payload shapes and live in v2.
- **Doesn't resume paused campaigns.** PAUSED is the end state; the operator unpauses manually when ready.

---

## Log (both branches)

Append to `memory/logs/${today}.md` under ONE `### schedule-ads` heading. First bullet is a discriminator naming which branch ran.

**Schedule branch:**
```
### schedule-ads
- Branch: schedule
- Schedules matching today: <names>
- Payloads queued: <count> (dry-run: <bool>)
- Files written: .pending-admanage/launches/*.json
```

**Create branch:**
```
### schedule-ads
- Branch: create
- New campaigns queued: <count>
- New ad sets queued: <count>
- Files: .pending-admanage/creates/**/*.json
```

## Environment Variables

- `ADMANAGE_API_KEY` — required for `scripts/postprocess-admanage.sh` (schedule) and `scripts/postprocess-admanage-create.sh` (create). Never read by this skill.
- `DRY_RUN` — optional. If `true`, forces dry-run mode regardless of config, in whichever branch runs.
- Notification channels configured via repo secrets (see CLAUDE.md).

## Output

End with a `## Summary` block naming the branch that ran:
- **schedule:** schedules matched today, payload count, dry-run yes/no, files written.
- **create:** new campaigns queued, new ad sets queued, skipped (already-exist) count, dry-run yes/no, files written.
