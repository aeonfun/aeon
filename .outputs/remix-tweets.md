*Remix Tweets — 2026-05-02*
REMIX_TWEETS_ERROR — no handle configured.

6th consecutive fire (was 5th 05-01, 4th 04-30, 3rd 04-29, 2nd 04-28, 1st 04-27).

Resolution attempted:
- $X_HANDLE env: unset
- soul/SOUL.md Identity: no @handle (Thomas Scaria / Lore / Swarm Lab only)
- $XAI_API_KEY: unset (would have blocked even with handle)
- .xai-cache/remix-tweets.json: missing (no prefetch ran)

Operator action (unchanged from 04-27 to 05-01 fires):
1. Add X_HANDLE secret to workflow env for skills that need it
2. Wire XAI_API_KEY repo secret + scripts/prefetch-xai.sh remix-tweets) case so .xai-cache/remix-tweets.json populates before Claude runs
3. Or pause the 17:30 UTC cron until config sweep lands

source: cache=miss, xai=fail, fetched=0, kept=0, drops=0
