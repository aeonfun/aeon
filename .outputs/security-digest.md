*Security Digest — 2026-04-28*
Verdict: 2 actively exploited, 0 to schedule, 0 to monitor. _Sources: KEV, GH Advisory, EPSS_

*PATCH TODAY*
- [CVE-2024-7399](https://nvd.nist.gov/vuln/detail/CVE-2024-7399) — Samsung MagicINFO 9 Server · KEV added 2026-04-24 · EPSS 0.82 · CVSS 9.8
  Path traversal lets unauth attacker write arbitrary files as system authority. Active exploitation per Arctic Wolf + CISA KEV.
  → upgrade Samsung MagicINFO 9 Server to ≥21.1050 today.
- [CVE-2026-39987](https://github.com/marimo-team/marimo/security/advisories/GHSA-2679-6mx9-h9xc) — marimo (pip) · KEV added 2026-04-23 · EPSS 0.55 · CVSS 9.3
  Pre-auth RCE via /terminal/ws WebSocket — endpoint skips validate_auth() when running in EDIT mode. Public PoC in advisory.
  → upgrade marimo to ≥0.23.0 today.

