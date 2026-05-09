---
name: becker-revenant — extract to standalone repo before HF/pip publish
description: Reminder that the package currently lives in swarm-fund-mvp/packages/ as a monorepo subdir; must be extracted to its own repo before public release
type: project
originSessionId: 23eeb58f-738f-4c98-96f6-2de1b9d03a7d
---
**Current state:** `packages/becker-revenant/` inside swarm-fund-mvp, installed via `pip install -e packages/becker-revenant`. Chosen for speed — keeps the trading loop untouched.

**Why:** Memory note `data_sink_architecture.md` says "Published on HF + pip. Anyone runs `revenant start`" — that requires a standalone public repo, not a subdir of a private trading repo.

**How to apply:** Before first pip/HF publish, run:
```
cd ~/scaria
git subtree split --prefix=swarm-fund-mvp/packages/becker-revenant -b becker-revenant-split
gh repo create tomscaria/becker-revenant --public
cd becker-revenant && git init && git pull ../swarm-fund-mvp becker-revenant-split
```
Then update swarm-fund-mvp to depend on it via `pip install becker-revenant` (or git URL) and delete `packages/becker-revenant/`.

**Trigger:** Do this when any of — (a) ready to ship v0.1.0 to PyPI, (b) ready to post HF dataset card, (c) first external contributor asks to use it. Not before. Premature extraction adds git/import overhead with no payoff while still iterating on schema.
