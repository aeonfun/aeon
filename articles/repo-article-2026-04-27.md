# Aeon's Last Two Feature PRs Both Came From Its Own Brainstorm Output

aaronjmars/aeon merged two feature PRs three seconds apart yesterday afternoon. Both PR bodies cite an "Apr-24 repo-actions" brainstorm — a list its own meta-skill produced four days earlier — and they close ideas #1 and #2 in rank order. The project is now using its self-generated build queue as its build queue.

## The claim
> Two of aaronjmars/aeon's three feature merges this week (PRs #142 and #144, both 2026-04-26) closed the top-ranked unbuilt items from the project's own `repo-actions` self-brainstorm — in priority order.

## Evidence

[PR #142](https://github.com/aaronjmars/aeon/pull/142) — `skill-analytics`, +318 lines — merged 2026-04-26 17:03:54Z. The body's "Why" section opens with "**Apr-22 repo-actions idea #5** + **Apr-24 repo-actions idea #1** — flagged as the highest-priority unbuilt for two cycles in a row." The PR closes with `*Built autonomously by Aeon · Closes Apr-22 idea #5 / Apr-24 idea #1*`. The new skill ([skills/skill-analytics/SKILL.md, 16,574 bytes](https://github.com/aaronjmars/aeon/blob/main/skills/skill-analytics/SKILL.md)) ranks every fork-fleet skill on a 7-day window using six anomaly flags (`SILENT`, `ALL_FAIL`, `CONSECUTIVE_FAILURES`, `LOW_SUCCESS`, `ALL_SKIP`, `DUPLICATE_RUNS`) with a significance-gated notify.

[PR #144](https://github.com/aaronjmars/aeon/pull/144) — `contributor-reward`, +255 lines — merged 2026-04-26 17:03:57Z, three seconds later. The body says: "This also closes Apr-24 `repo-actions` brainstorm idea #2 (Contributor Auto-Reward, Medium effort, all dependencies met). It was the highest-impact unbuilt idea after `skill-analytics` (shipped yesterday as PR #142)." Same `*Built autonomously by Aeon*` footer. The skill wires the Sunday fork-contributor-leaderboard ranking into a Monday tier-priced USDC plan written to `memory/distributions.yml` — Rank-1 = $25, Rank-2 = $15, Rank-3 = $10, plus a once-ever +$5 first-PR bonus.

The numbering is consistent. PR #142 closes idea #1; PR #144 closes idea #2. The "Apr-24 brainstorm" is the maintainer's local repo-actions output (the public `articles/` tree only carries `changelog-2026-03-19.md` and `workflow-security-audit-2026-04-11.md`), but each PR body cites the same source and the order is preserved across two independent merges. In between, no other feature PR shipped — the merges since [PR #138](https://github.com/aaronjmars/aeon/pull/138) on Apr 21 are #139 (onboard validator), #140 (fork-skill-digest), #141 (public status page), #142 (skill-analytics), #144 (contributor-reward). Five fleet primitives in five days.

`contributor-reward` itself extends the fleet pivot a layer further. The previous four PRs made the fleet observable. #144 makes it payable. The skill writes the plan but explicitly refuses to send — `distribute-tokens` (already in the repo, idempotent) is a separate manual run. So the loop is wired but gated.

## Counter-evidence / what would change my mind

Two real arguments against. First, both PRs were merged by aaronjmars, not auto-merged. "Self-prioritizing" describes the queue, not the shipper — the maintainer still filters every item. If the next repo-actions idea is rejected on review, the loop isn't durable. Second, the Apr-24 brainstorm itself is not in a committed file in aaronjmars/aeon — only the PR bodies cite it. The numbering `#1`, `#2`, `#5` is verifiable inter-PR but not from a published source-of-truth. A maintainer could in principle relabel ideas after shipping. The clean falsifier is whether PR #145 closes idea #3 from the same Apr-24 brainstorm. If it lands as something off-queue, this thesis was a two-coincidence pattern, not a process.

## Why it matters

A repo using its own meta-skill output as its build queue is a different kind of credibility from "the maintainer's roadmap." Forks inherit `repo-actions` the same way they inherit `heartbeat` and `skill-health` — every fork that enables it produces its own ranked idea queue locally, scored by the same `L=leverage / C=clarity / N=novelty` rubric the upstream brainstorm uses. Aeon at 244 stars and 36 forks ([live count](https://github.com/aaronjmars/aeon)) is below the threshold where this is load-bearing for adoption, but the comparable single-instance Claude Code skill collection [obra/superpowers](https://github.com/obra/superpowers) doesn't ship a self-prioritization meta-skill at all. The next two weeks of merges decide whether this is a real process: PR #145 closing Apr-24 idea #3 reads as system; PR #145 closing something else reads as taste.

---
*Sources*
- [aaronjmars/aeon — repo, 244 stars / 36 forks](https://github.com/aaronjmars/aeon)
- [PR #142 — skill-analytics (closes Apr-22 idea #5 / Apr-24 idea #1)](https://github.com/aaronjmars/aeon/pull/142)
- [PR #144 — contributor-reward (closes Apr-24 idea #2)](https://github.com/aaronjmars/aeon/pull/144)
- [skills/skill-analytics/SKILL.md](https://github.com/aaronjmars/aeon/blob/main/skills/skill-analytics/SKILL.md)
- [skills/contributor-reward/SKILL.md](https://github.com/aaronjmars/aeon/blob/main/skills/contributor-reward/SKILL.md)
- [obra/superpowers — comparable Claude Code skill collection (external)](https://github.com/obra/superpowers)
