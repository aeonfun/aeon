*Remix Tweets — 2026-05-01*
REMIX_TWEETS_ERROR — no handle configured (5th consecutive fire).

Resolution attempted:
- `$X_HANDLE` env var: unset
- `soul/SOUL.md` Identity: no @handle (only 'Thomas Scaria' / 'Lore' / 'Swarm Lab')
- `aeon.yml` remix-tweets: no `var:` field (and var is reserved for time-window override per SKILL.md L9)

Also noted: XAI_API_KEY unset and `.xai-cache/` absent — even with a handle the fetch leg would have failed.

Fix: add `X_HANDLE` env to the workflow + ensure XAI_API_KEY secret is present. Already tracked under 'Operator config sweep' in MEMORY.md.

source: cache=miss, xai=skipped, fetched=0, kept=0, drops=0
