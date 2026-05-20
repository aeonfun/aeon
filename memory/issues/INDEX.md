# Issues

## Open

| ID | Title | Severity | Category | Detected | Affected Skills |
|----|-------|----------|----------|----------|-----------------|
| ISS-006 | monitor-runners .outputs/ artifact overwritten with stray CLI snippet after skill ran clean | high | output-format | 2026-05-20 | monitor-runners |

## Resolved

| ID | Title | Severity | Fix PR | Resolved |
|----|-------|----------|--------|----------|
| ISS-001 | perps-scan cannot fetch Coinglass v4 — authenticated curl blocked by sandbox | critical | TBD | 2026-05-18 |
| ISS-002 | Coinglass coins-markets universe call fails on every variant — perps-scan has no data | critical | TBD | 2026-05-18 |
| ISS-003 | Skills write the `## Summary` blob into `.outputs/` instead of the locked artifact format | medium | TBD | 2026-05-19 |
| ISS-004 | perps-scan still writes the `## Summary` blob into `.outputs/` after the ISS-003 guardrail patch | medium | TBD | 2026-05-19 |
| ISS-005 | Summary-blob artifact corruption persists across chain skills after the perps-scan-only structural fix | medium | TBD | 2026-05-20 |
