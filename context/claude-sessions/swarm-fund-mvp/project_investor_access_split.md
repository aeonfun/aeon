---
name: Investor access split — Stage 1 live, Stage 2 queued
description: Public /investors is now vision-only; gated /investors/101+201+onepager are Privy-gated. Stage 2 (Postgres queue + email/Telegram + dashboard panel) is scheduled to be built by a remote routine.
type: project
originSessionId: cf5e9454-9b47-41fd-8a54-73aa60bac3e9
---
**Stage 1 shipped 2026-04-27 (commit `b686093`).** Public `/investors` strips the ASK ($10M / $80M post, VC list, 1,000× multiples callout, scenario analysis, Bull/Base/Bear raise headers, "free option" kicker). Three gated routes — `/investors/101` (full 22-section deck), `/investors/201` (PDF embed), `/investors/onepager` (HTML embed) — sit behind `<InvestorGate>` (Privy email login + `swarm-lab-site/src/content/investor-allowlist.json`). Currently only `t@rswarm.ai` is whitelisted; any other login → "Access not available." Request flow uses a `mailto:t@rswarm.ai` shim from `<RequestAccessModal>`.

**Stage 2 queued.** Remote routine [`trig_01USVATWYoxg5JYry6UhJLcD`](https://claude.ai/code/routines/trig_01USVATWYoxg5JYry6UhJLcD) fires once at 2026-04-28T06:08:00Z (11:08 PM PT 2026-04-27) to open a PR adding: Postgres `investor_access_requests` table + Alembic migration, FastAPI endpoints (`POST /api/v1/investors/request|approve|deny`, `GET status|queue`), `python/notifications/investor_alerts.py` (Resend + Telegram via existing bot), a dashboard approval-queue panel, and the modal/gate frontend swap from JSON → API. PR-only delivery (no direct push to main).

**Why:** founder doesn't want public seed-round framing on rswarm.ai, but does want a low-friction approval flow for active investor conversations. Two-stage rollout: cut the ASK material immediately (Stage 1), wire the queue + notifications when ready (Stage 2).

**How to apply:**
- Adding an investor TODAY: edit `swarm-lab-site/src/content/investor-allowlist.json`, push, Vercel auto-deploys. (Stage 2 will replace this with a dashboard panel.)
- New investor-related work: read the design memo at `~/.claude/plans/for-the-public-facing-jiggly-dream.md` first — full Stage 1 + Stage 2 spec with file paths, table schema, endpoint shapes.
- Stage-2 unblock items (Resend signup, env vars, migration, smoke test) live in `outputs/manual_tasks_thomas.md` under "Investor-access Stage 2 — env vars + Resend setup."
- DO NOT add ASK content (multiples, raise sizes, VC target lists, scenario tables) to the public `/investors` page or its components. Those live exclusively on the gated 101/201/onepager surfaces.
