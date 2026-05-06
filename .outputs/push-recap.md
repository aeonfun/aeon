*Push Recap — 2026-05-06*
aaronjmars/aeon — BUILDING — registers dormant star-momentum-alert + hardens dashboard exec

Shipped to users:
• #159 `star-momentum-alert` skill (3 files, +295/-2): daily Sonnet skill that walks 14d of repo-pulse logs, projects next star-milestone via 7d linear extrapolation, alerts only when crossing lands 7-14d out AND on Tue/Wed/Thu — the show-hn-draft dispatch window. Shipped registered, enabled: false.
• #158 dashboard `skills/[name]/run` execFileSync (1 file, +5/-5): swaps the last user-input execSync on the dashboard for argv-array execFileSync, mirroring #150. Defense-in-depth — whitelist already neutered metacharacters.

Under the hood:
• swarm-fund-mvp pushed 95 commits in the window, all 'data: refresh site metrics' — sampled head and tail, each is +1/-1 on the generated_at timestamp only. Treated as automation-only, not bot-filtered. Zero substantive code on swarm-fund for the third straight day.

Shape: 2 user-visible · 0 internal · 0 infra · 95 automation-only · 0 bot-filtered · 2 merged PRs
Volume: 4 files (substantive), +300/-7 lines

Full recap: https://github.com/aeonframework/aeon/blob/main/articles/push-recap-2026-05-06.md
