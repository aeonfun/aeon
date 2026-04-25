*Security Digest — 2026-04-25*
Verdict: 3 actively exploited (KEV), 5 to patch this week, 3 to monitor. _Sources: CISA KEV, GH Advisory, FIRST EPSS_

*PATCH TODAY*
- [CVE-2024-27199](https://nvd.nist.gov/vuln/detail/CVE-2024-27199) — JetBrains TeamCity · KEV 2026-04-20 · EPSS 0.91 · CVSS 7.3
  Path traversal allowing limited admin actions. Public PoC; in CISA KEV.
  → upgrade TeamCity to ≥2023.11.4 today.
- [CVE-2023-27351](https://nvd.nist.gov/vuln/detail/CVE-2023-27351) — PaperCut NG/MF · KEV 2026-04-20 · EPSS 0.86 · CVSS 7.5
  Auth bypass; documented ZDI exploit.
  → upgrade PaperCut to ≥20.1.7 / 21.2.11 / 22.0.9 today.
- [CVE-2024-7399](https://nvd.nist.gov/vuln/detail/CVE-2024-7399) — Samsung MagicINFO 9 · KEV 2026-04-24 · EPSS 0.82 · CVSS 9.8
  Path traversal → arbitrary file write as system authority.
  → upgrade MagicINFO Server to ≥21.1050 today.

*PATCH THIS WEEK*
- [CVE-2026-39987](https://nvd.nist.gov/vuln/detail/CVE-2026-39987) — marimo (pip) · KEV 2026-04-23 · EPSS 0.46 · CVSS 9.8
  Pre-auth RCE via unauthenticated /terminal/ws WebSocket. Exploited <10h post-disclosure.
  → upgrade marimo to ≥0.23.0.
- [GHSA-q5hj-mxqh-vv77](https://github.com/advisories/GHSA-q5hj-mxqh-vv77) — @anthropic-ai/claude-code (npm) · CVE-2026-40068 · CVSS n/a
  Trust dialog bypass via git worktree spoofing → arbitrary code exec. Aeon runs on Claude Code.
  → upgrade @anthropic-ai/claude-code to ≥2.1.84.
- [GHSA-wpqr-6v78-jr5g](https://github.com/advisories/GHSA-wpqr-6v78-jr5g) — @google/gemini-cli (npm) · CVSS 10.0 · EPSS 0
  RCE via workspace-trust + tool-allowlisting bypasses.
  → upgrade @google/gemini-cli to ≥0.39.1.
- [GHSA-vvf7-6rmr-m29q](https://github.com/advisories/GHSA-vvf7-6rmr-m29q) — dgraph v25 (go) · CVE-2026-41492 · CVSS 9.8 · EPSS 0
  Unauth admin token disclosure via /debug/vars → full auth bypass.
  → upgrade dgraph-io/dgraph/v25 to ≥25.3.3.
- [CVE-2025-48700](https://nvd.nist.gov/vuln/detail/CVE-2025-48700) — Zimbra Collaboration · KEV 2026-04-20 · EPSS 0.19
  Stored XSS in webmail interface.
  → schedule Zimbra patch this week.

*MONITOR*
- [GHSA-r75f-5x8p-qvmc](https://github.com/advisories/GHSA-r75f-5x8p-qvmc) — litellm (pip) · critical · EPSS n/a
  SQL injection in Proxy API key verification (1.81.16 ≤ vuln < 1.83.7).
  → track and schedule litellm ≥1.83.7 if proxy is exposed.
- [GHSA-mw35-8rx3-xf9r](https://github.com/advisories/GHSA-mw35-8rx3-xf9r) — ray (pip) · CVE-2026-41486 · high
  RCE via Parquet Arrow extension type deserialization (2.49.0 ≤ vuln < 2.55.0).
  → track and schedule ray ≥2.55.0 if loading untrusted Parquet.
- [GHSA-8x35-hph8-37hq](https://github.com/advisories/GHSA-8x35-hph8-37hq) — electerm (npm) · CVE-2026-41501 · CVSS 9.8
  Command injection via runLinux (vuln < 3.3.8).
  → track; upgrade electerm ≥3.3.8 if installed.
