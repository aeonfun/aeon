*Security Digest — 2026-05-08*
Verdict: 1 actively exploited (Ivanti EPMM), 5 to schedule. _Sources: KEV, GH Advisory, EPSS_

*PATCH TODAY*
- [CVE-2026-6973](https://github.com/advisories/GHSA-36fg-ffjj-h5p6) — Ivanti EPMM (mobile MDM) · KEV added 2026-05-07 · CVSS 7.2 · EPSS 0.05 (89.8 pct)
  Improper input validation in admin path → authed RCE. CISA-confirmed exploited.
  → upgrade Ivanti EPMM to ≥12.6.1.1 / 12.7.0.1 / 12.8.0.1 today.

*PATCH THIS WEEK*
- [vm2 cluster](https://github.com/advisories/GHSA-47x8-96vw-5wg6) — vm2 (npm) · CVSS 10/10/9.9/9.1 · no EPSS yet
  Four sandbox escapes published 2026-05-07: CVE-2026-43997 (host Object), 44005 (mutable proxies), 43999 (Module._load), 44007 (NodeVM nesting). Working PoCs in advisory bodies.
  → upgrade vm2 to ≥3.11.1; if pinned, retire vm2 (project deprecated).
- [GHSA-54pg-9963-v8vg](https://github.com/advisories/GHSA-54pg-9963-v8vg) — intercom-client (npm) · CVSS 9.3 · supply-chain compromise
  Malicious 7.0.4 published 04-30 from compromised dev account; preinstall hook harvests AWS/GCP/Azure creds + .env. intercom-php composer 5.0.2 hit same day.
  → pin intercom-client ≤7.0.3 (skip 7.0.4); audit installs since 04-30, rotate cloud creds.
- [CVE-2026-42596](https://github.com/advisories/GHSA-4vmc-gm8v-m35h) — gotenberg/v8 (Go) · CVSS 9.4 · no EPSS yet
  Unauthenticated SSRF via deny-list bypass in downloadFrom + webhook.
  → upgrade gotenberg/v8 to ≥8.32.0.
- [CVE-2026-44523](https://github.com/advisories/GHSA-q6mh-rqwh-g786) — note-mark/backend (Go) · CVSS 10 · no EPSS yet
  JWT secret weakness → token forgery → full account takeover.
  → upgrade note-mark/backend to pseudo-version ≥0.0.0-20260501152247.
- [CVE-2026-43948](https://github.com/advisories/GHSA-mhc8-p3jx-84mm) — wger (pip) · CVSS 9.9 · no EPSS yet
  Cross-tenant password reset + plaintext disclosure via gym=None bypass.
  → upgrade wger to ≥2.6.
