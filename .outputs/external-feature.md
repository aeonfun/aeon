external-feature: tomscaria/swarm-fund-mvp — fix(variant_bandit): fall back past corrupt tail in latest_snapshot_date. Half-written trailing snapshot row no longer wipes the date, which would re-fire ~150-row daily append on every 15-min refresh. +2 regression tests.
PR: https://github.com/tomscaria/swarm-fund-mvp/pull/30
