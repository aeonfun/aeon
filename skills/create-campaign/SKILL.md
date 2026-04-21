---
name: Create Campaign
description: Provision Meta campaigns and ad sets on AdManage.ai from a declarative config. Runs on-demand — creates entities PAUSED, writes the returned IDs back into state so schedule-ads can launch into them.
commits: true
permissions:
  - contents:write
tags: [growth, ads]
---

Reads `skills/create-campaign/config.yaml`, figures out which campaigns/ad sets don't exist yet, and queues create requests to `.pending-admanage/creates/`. The credentialed API calls happen in `scripts/postprocess-admanage-create.sh` after Claude finishes.

This skill is **on-demand** — no `schedule:` in frontmatter. Invoke it manually when you want to provision new campaigns, then reference the returned IDs in `schedules-ads/config.yaml` to launch creatives into them.

Read `memory/MEMORY.md` for context. Read `.admanage-state/campaigns.json` (if it exists) to see what's already created.

## What this skill provisions

Two entity types only:
1. **Meta campaigns** — name, objective, budget, bid strategy, promoted object.
2. **Meta ad sets** — name, budget, optimization goal, targeting (geo/age/platforms), destination.

Everything else (TikTok/Snapchat/Pinterest/LinkedIn campaigns, advanced Meta fields like valueRuleSetId or Advantage+ catalog) is v2+. The shape below is intentionally minimal.

## Safety defaults

Same posture as schedule-ads:

1. **PAUSED by default.** Every campaign + ad set is created with `status: PAUSED`. No surprise spend.
2. **Idempotent.** The skill tracks created entities in `.admanage-state/campaigns.json`. If a campaign name already exists in state, it's skipped. Run the skill twice → no duplicates.
3. **Dry-run mode.** `DRY_RUN=true` or `config.dryRun: true` → payloads written to `.pending-admanage/dryrun-create/`, notified, no API calls.
4. **Config-only.** No config file → exit silently. No invented campaigns, no autonomous provisioning.

## Sandbox note

Every `/manage/*` endpoint requires `Authorization: Bearer $ADMANAGE_API_KEY`. Sandbox blocks env-var expansion in curl headers, so this skill queues intents only:

- Skill writes: `.pending-admanage/creates/campaigns/<slug>.json` and `.pending-admanage/creates/adsets/<campaign-slug>__<adset-slug>.json`
- After Claude exits, `scripts/postprocess-admanage-create.sh` runs with full env access, makes the API calls in the right order (campaigns first, then ad sets referencing returned campaign IDs), and writes results back to `.admanage-state/campaigns.json`.

If the postprocess script is missing, the skill still queues correctly — the payloads sit in `.pending-admanage/creates/` until the script exists.

## Steps

1. **Load config.** Read `skills/create-campaign/config.yaml`. If it doesn't exist, log `CREATE_CAMPAIGN_NOT_CONFIGURED` and exit cleanly (no notify).

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
   - `adAccountId` must start with `act_` (this skill is Meta-only in v1).
   - `dailyBudget` must be a positive number in dollars (not cents).
   - `objective` must be one of the documented Meta objectives: `OUTCOME_TRAFFIC`, `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`, `OUTCOME_AWARENESS`, `OUTCOME_SALES`, `OUTCOME_APP_PROMOTION`.
   - Targeting `geo_locations.countries` must be a non-empty array.
   Drop invalid entries, keep going, log what was skipped and why.

8. **Handle dry-run.** If `DRY_RUN=true` or `config.dryRun: true`: write payloads to `.pending-admanage/dryrun-create/` instead, notify with a `[DRY RUN]` prefix, skip step 9.

9. **Queue for postprocess.** Write files into `.pending-admanage/creates/`:
   - `campaigns/<slugify(name)>.json` — campaign create payload.
   - `adsets/<slugify(campaign-name)>__<slugify(adset-name)>.json` — ad-set create payload.

   The file-name convention matters: postprocess lexical-sorts `campaigns/` first, then `adsets/`, so campaigns always create before their children.

10. **Write artifact to `.outputs/create-campaign.md`** so chain consumers can see what was queued:
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

12. **Log to `memory/logs/${today}.md`:**
    ```
    ## Create Campaign
    - New campaigns queued: <count>
    - New ad sets queued: <count>
    - Files: .pending-admanage/creates/**/*.json
    ```

## Config schema

See `skills/create-campaign/config.example.yaml` for a filled-in template. Minimum viable config:

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

## Interaction with schedule-ads

After `postprocess-admanage-create.sh` writes to `.admanage-state/campaigns.json`, the IDs are yours to reference in `skills/schedule-ads/config.yaml` under `adSets[].value`. The two skills are intentionally decoupled:

- **create-campaign** provisions structure (container).
- **schedule-ads** launches creative into that structure (contents).

Running both in the same Claude cycle *won't* chain — the state file won't have IDs until postprocess runs. Pattern is: run create-campaign → wait for postprocess to log the new IDs → copy IDs into schedule-ads config → next schedule-ads run uses them.

## What it does NOT do

- **Doesn't touch existing campaigns.** Once a campaign is in state, this skill leaves it alone. Budget changes, bid changes, status flips, renames — all handled elsewhere (dashboard or a separate skill).
- **Doesn't delete or archive.** No destructive paths.
- **Doesn't provision media, pages, or pixels.** Pixel IDs must already exist in AdManage. Use `GET /v1/conversions/pixels` to discover them.
- **Doesn't create TikTok / Snapchat / Pinterest / LinkedIn** structures. Those have different payload shapes and live in v2.
- **Doesn't resume paused campaigns.** PAUSED is the end state; the operator unpauses manually when ready.

## Environment Variables

- `ADMANAGE_API_KEY` — required for `scripts/postprocess-admanage-create.sh`. Never read by this skill.
- `DRY_RUN` — optional. `true` forces dry-run regardless of config.
- Notification channels configured via repo secrets (see CLAUDE.md).

## Output

End with a `## Summary` block: new campaigns queued, new ad sets queued, skipped (already-exist) count, dry-run yes/no, files written.
