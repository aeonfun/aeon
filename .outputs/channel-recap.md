channel-recap requires var= set to a Telegram channel username

## Summary

**Skill aborted** per its own step-0 contract: `aeon.yml` has `channel-recap: { var: "" }`, so there is no public Telegram channel to fetch. No WebFetch calls, no article, no notify sent (the skill spec defines a no-fetch silent abort for empty var, distinct from the channel-missing-or-private branch that does notify).

**Files modified**
- `memory/logs/2026-05-03.md` — appended abort entry under "## Channel Recap — aborted".

**Follow-up for operator**
- To enable: set `var:` in `aeon.yml` line for `channel-recap` to a public Telegram channel username (without `@`), then the next 17:00 UTC Sunday cron will produce a weekly recap article. Worth pointing it at a Polymarket / prediction-market or AI-agent channel so the output feeds the swarm-fund-mvp content pipeline rather than going to waste.
