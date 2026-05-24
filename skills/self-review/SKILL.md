---
name: Self Review
description: Weekly audit of what the agent did, what failed, and what to improve
var: ""
tags: [meta]
---
> **${var}** — Area to focus on. If empty, reviews everything.

If `${var}` is set, focus the review on that specific area.


Read memory/MEMORY.md for context and goals.
Read ALL memory/logs/ entries from the last 7 days.

Steps:
1. Audit quality of outputs:
   - Read recent articles in articles/ — are they substantive or formulaic?
   - Check recent notifications in logs — were they useful or noisy?
   - Review any PR comments posted — were they actionable?
2. Audit reliability:
   - How many skills ran vs expected?
   - Any repeated errors or patterns of failure?
   - Are monitors catching real issues or always returning OK?
3. Audit memory hygiene:
   - Is MEMORY.md current and under 50 lines?
   - Are logs structured consistently?
   - Any stale data that should be cleaned?
4. Generate improvement recommendations:
   - Skills to add, modify, or disable
   - Schedule adjustments
   - Config changes (feeds, repos, addresses to add/remove)
   - Quality improvements (better prompts, new data sources)
5. Save the full review to articles/self-review-${today}.md.
6. Apply any safe, obvious improvements directly:
   - Prune stale MEMORY.md entries
   - Update feeds.yml if feeds are dead
7. Send a summary via `./notify`:
   ```
   *Self Review — ${today}*
   Quality: assessment
   Reliability: X/Y skills ran
   Actions taken: what was fixed
   Recommendations: top 2-3 suggestions
   ```
8. Log to memory/logs/${today}.md.
