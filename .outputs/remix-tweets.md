REMIX_TWEETS_ERROR — Remix Tweets 2026-05-04
Cause: no handle configured. `$X_HANDLE` env unset, `soul/SOUL.md` Identity has no @handle, `aeon.yml` remix-tweets has no var: override (var: reserved for time-window per SKILL.md L9). `$XAI_API_KEY` also unset and `.xai-cache/` directory absent — would have failed at fetch even if handle resolved.
8th consecutive ERROR fire (04-27 → 05-04). Same root cause every day. Operator action: add `X_HANDLE` + `XAI_API_KEY` to workflow env in `.github/workflows/skill-runner.yml` (or per-skill config), or wire `scripts/prefetch-xai.sh` to populate `.xai-cache/remix-tweets.json`.
source: cache=miss, xai=fail, fetched=0, kept=0, drops=0
