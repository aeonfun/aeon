# Open Questions

Decisions that surfaced during the dossier walk that require an explicit conversation with the author (or with both maintainers acting together). None of these block the dossier itself; all of them shape what **Chapter Three** looks like.

---

## Governance & process

### 1. Formal co-maintainer status — RESOLVED 2026-05-26

**Decision:** Full co-maintainer status. Both Andrew and aaronjmars are repo owners of `aaronjmars/aeon` with full merge rights. CODEOWNERS file recommended at next opportunity. See [`04-GOVERNANCE.md`](04-GOVERNANCE.md) § Our seat as co-author for the merge-authority scope.

### 2. Release process

No SemVer, no changelog file, no release branches today. A breaking change to skill format propagates to every fork on next `sync-upstream`. Possible structure:

- Tag releases on `main` (`v0.x.y`).
- Maintain a `CHANGELOG.md` (the `changelog` *skill* generates content, not version-log).
- Mark breaking changes loudly in commit messages and release notes.
- Optional: a `release/N` branch for stability if the fork ecosystem grows past a threshold.

Recommendation: introduce SemVer-style tags + CHANGELOG.md for the runtime + dashboard + MCP/A2A + supply-chain scripts. Skills stay un-versioned (each is independent).

### 3. Skill-pack vetting tier

`skill-security-scan` runs on every pack at install time. The README lists 6 packs as featured. Should "featured in the README table" mean anything beyond "exists and follows the guidelines"? Two options:

- **Status quo** — directory listing, no vetting. Operators take the install scan as their only signal.
- **Featured tier** — packs in the README table get a manual review pass by a maintainer (read every SKILL.md, check the publisher's footprint). Other packs install via the same flow but aren't listed.

Recommendation: status quo for now. Revisit if a pack causes an incident.

### 4. Ecosystem listing standards

`ECOSYSTEM.md` is a directory (any public mention earns a row). The brand carries weight in the agent-framework conversation; a malicious project getting listed and abusing the "built on Aeon" claim is a real risk. Options:

- Status quo (directory, no vetting).
- Light vetting (verify the project actually uses Aeon, check for ToS violations).
- Two tiers ("verified" with checkmark vs unverified directory).

Recommendation: status quo + add a one-line ToS in `ECOSYSTEM.md` ("listing is a directory, not an endorsement; we may remove rows that misrepresent the project's use of Aeon"). Lowest-friction protection.

### 5. Discussion forum

Currently GitHub issues + each operator's own Telegram/Discord/Slack. As the fleet grows past ~30 active forks, an upstream forum may help peer learning (Discord server, GitHub Discussions tab, or Telegram supergroup).

Recommendation: enable GitHub Discussions on the public repo as a low-cost first step. Drop a link in the README. Reassess in 60 days based on signal.

---

## Architecture & code

### 6. Fleet Watcher canonical repo — DOWNGRADED

Operator decision 2026-05-26 confirms the in-repo subproject pattern (mcp-server/, a2a-server/, dashboard/, workers-runtime/, aeon-federation-registry/, aeon-agora/). By the same logic, Fleet Watcher could land at `aaronjmars/aeon/aeon-fleet-watcher/`. Deferred — not in the Sealed Sprint scope, but the pattern is established.

### 7. MCP npm package publication

`smithery-manifest.json` references an npm package but the package is not currently published. Smithery submission flags this. Two options:

- Publish `@aeonframework/mcp-server` to npm so `npx @aeonframework/mcp-server` works out of the box.
- Document the from-source build (`./add-mcp`) as the canonical install and remove the npm reference.

Recommendation: publish. The whole MCP ecosystem assumes npm distribution, and Smithery wants it.

### 8. A2A authentication

The A2A gateway has no auth by default. Local-trust model. If operators want to expose it externally (a common ask), they need to put a reverse proxy with auth in front. Options:

- Status quo + clearer docs.
- Bundle a token-based auth mode (`A2A_TOKEN=...` → require `Authorization: Bearer <token>`).
- Bundle full OAuth (heavy).

Recommendation: ship token-based auth as opt-in. ~30 lines of code in `a2a-server/src/index.ts`. Big UX win for the "expose to my external agent" use case.

### 9. Memory transactional semantics

The commit step auto-resolves rebase conflicts only for `memory/*` files (and the resolution is "take the new write"). Two skills writing to the same memory file in the same tick can lose one of the writes. Options:

- Status quo + better docs ("don't write to shared memory from parallel skills").
- Per-file locks via filenames (`memory/topics/<topic>.lock`).
- Real DB (incompatible with the file-based memory ethos).

Recommendation: status quo + lint check that warns when two skills declare write to the same memory path.

### 10. Schedule timezone

All schedules in `aeon.yml` are UTC. For operators in EU/Asia time zones, this is awkward (morning brief at 7am UTC is 3pm in Singapore). Options:

- Status quo.
- Support per-skill `tz: "America/New_York"` field.
- Document timezone conversion in the README more prominently.

Recommendation: add `tz:` field with safe default UTC. Pure additive change, ~40 lines in `messages.yml`.

### 11. Skill frontmatter — license / author / version fields

Today's frontmatter is `name, description, var, tags, depends_on`. For community packs, traceability would benefit from:

- `author: "@github_handle"` — who wrote the skill (especially in packs).
- `license: "MIT"` — explicit per-skill license.
- `version: "1.2.0"` — skill-level version for `skill-update-check` semantics.

Recommendation: add `author` and `license` as optional. `version` requires a versioning convention we don't have yet — defer.

---

## Memory & data

### 12. Memory log rotation

Logs accumulate forever in `memory/logs/YYYY-MM-DD.md`. After a year of operation, this is 365 files. They're small but the dir gets unwieldy. Options:

- Status quo.
- Monthly archival (move `memory/logs/2025-*.md` to `memory/logs/archive/2025/`).
- Yearly archival.

Recommendation: yearly archival, triggered by the `janitor` skill on Jan 1.

### 13. Cross-instance memory federation

Managed instances (`memory/instances.json`) are siloed — each instance has its own memory. For an operator running 5 instances, there's no way to query "what did any of my instances report about $TOKEN today?"

Recommendation: defer. This is genuinely an expansion topic (see [`09-EXPANSION-OPTIONS.md`](09-EXPANSION-OPTIONS.md) #2).

---

## Security

### 14. Trusted-sources signing

`skills/security/trusted-sources.txt` grants blanket trust to a GitHub user/repo. If the user gets compromised, every fork with that user in their trusted-sources accepts malicious skills without scanning. Options:

- Status quo.
- Optional commit-SHA pinning: `trusted: aaronjmars/aeon@<sha>` — trust only up to a specific commit.
- GPG/sigstore signing of skill files (heavy).

Recommendation: add commit-SHA pinning as an option. Small change, big bound on blast radius.

### 15. `add-skill --force` audit log

`--force` overrides the security scanner. There's no audit trail. Options:

- Status quo.
- `--force` writes an entry to `memory/logs/${today}.md` with `SKILL_INSTALL_FORCED <skill> <repo>`.
- `--force` requires `--reason "..."` flag, both logged.

Recommendation: require `--reason` and log. Cheap, useful for post-incident analysis.

### 16. Dashboard host-gate audit

Today the gate rejects with HTTP 403 and a JSON explanation. There's no log of rejections. An operator under attack (DNS-rebinding attempt) wouldn't know. Options:

- Status quo.
- Log rejections to `memory/logs/${today}.md`.
- Log rejections + rate-limit + alert via `./notify` after N rejections in a window.

Recommendation: log rejections to a dashboard-specific file (not memory logs — separate channel for security telemetry).

---

## External integration

### 17. Bankr gateway billing transparency

Operators don't see Bankr-side costs directly — `token-usage.csv` only logs Anthropic-side tokens. When routing through Bankr, the cost model changes. Options:

- Status quo (operators check Bankr dashboard separately).
- Mirror Bankr usage data into `memory/token-usage.csv` via Bankr API.
- Cost-report skill calls Bankr API to enrich.

Recommendation: enrich `cost-report`. Don't change the CSV format.

### 18. Smithery / MCP Registry lifecycle

Once published, who is responsible for keeping the manifest in sync with `skills.json`? Today the `smithery-manifest` skill regenerates the files, but submission is manual. Options:

- Manual submission only (status quo).
- Auto-submit on regeneration (requires API access to Smithery).
- Scheduled regeneration + notify when diff is non-trivial.

Recommendation: scheduled regeneration + notify on diff. Manual submission stays — Smithery has no public submission API.

---

## Brand and external comms

### 19. Co-authorship visibility

If we operate as co-maintainers, do we want public visibility (a co-author byline somewhere — README, footer, AUTHORS file)? This is purely a relational question between us and the author.

Recommendation: defer to the author. We don't lobby for our names.

### 20. Public roadmap

The framework has a clear product surface but no public roadmap. Listing 3-month / 12-month direction could attract contributors and downstream developers but also constrain pivots. Options:

- Status quo (no public roadmap).
- README "What's next" section.
- Public `ROADMAP.md` updated quarterly.

Recommendation: README "What's next" section with 3-month horizon only. Easy to update; doesn't lock us in.

---

## How to read this list

Each question is a **decision the author and we should make together** before the dossier ships upstream (if it ever does). None of them block use of the dossier in our private fork.

When raising one with the author, propose: (a) the question, (b) our recommendation, (c) two alternatives. Avoid yes/no framings — they erase the option space.

---

## Related docs

- [`04-GOVERNANCE.md`](04-GOVERNANCE.md) — governance questions in context.
- [`05-SECURITY.md`](05-SECURITY.md) — security questions in context.
- [`09-EXPANSION-OPTIONS.md`](09-EXPANSION-OPTIONS.md) — questions that hinge on expansion direction.
