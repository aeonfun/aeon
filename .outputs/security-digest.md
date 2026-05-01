*Security Digest — 2026-05-01*
Verdict: 1 actively exploited, 3 to schedule, 3 to monitor. _Sources: KEV, GH Advisory, EPSS_

*PATCH TODAY*
- [CVE-2026-41940](https://nvd.nist.gov/vuln/detail/CVE-2026-41940) — cPanel/WHM/WP2 · KEV added 2026-04-30 · EPSS 0.28 · CVSS 9.8
  Auth bypass in login flow → unauth RCE. Public PoC (watchTowr) on GitHub.
  → upgrade cPanel/WHM to LTS-line patch (86.0.41 / 110.0.97 / 118.0.63 / 126.0.54 / 130.0.19 / 132.0.29 / 134.0.20 / 136.0.5); WP2 to ≥136.1.7. Operator-side only — no cPanel in Aeon stack.

*PATCH THIS WEEK*
- [CVE-2026-39383](https://github.com/advisories/GHSA-5vh4-rgv7-p9g4) — gotenberg/v8 (Go) · CVSS 8.6 · EPSS 0 · PoC in advisory
  Unauth SSRF via `Gotenberg-Webhook-Url` header. → upgrade gotenberg to ≥8.31.0.
- [CVE-2026-42449](https://github.com/advisories/GHSA-56c3-vfp2-5qqj) — n8n-mcp (npm) · CVSS 8.5 · EPSS 0 · no public PoC
  IPv4-mapped IPv6 bypass of validateUrlSync → SSRF, cloud-metadata theft. → upgrade n8n-mcp to ≥2.47.14.
- [GHSA-rh99-wc69-c255](https://github.com/advisories/GHSA-rh99-wc69-c255) — edgelesssys/contrast (Go) · CVSS 8.1 · EPSS 0 · no public PoC
  Symlink in CopyFile → arbitrary host→guest write. → upgrade contrast to ≥1.19.1.

*MONITOR*
- [CVE-2026-40281](https://github.com/advisories/GHSA-q7r4-hc83-hf2q) — gotenberg/v8 (Go) · CVSS 10 · EPSS 0 · no fix yet
  ExifTool stdin arg injection (bypasses 8.30.x sanitization). → block untrusted PDF metadata input; watch >8.30.1.
- [CVE-2026-40280](https://github.com/advisories/GHSA-5q7p-7jgv-ww56) — gotenberg/v8 (Go) · CVSS 9.3 · EPSS 0 · no fix yet
  Case-insensitive URL scheme bypasses webhook/downloadFrom deny-list. → enforce egress firewall on Gotenberg.
- [CVE-2026-42354](https://github.com/advisories/GHSA-rcmw-7mc7-3rj7) — sentry (pip) · CVSS 9.1 · EPSS 0 · no fix yet
  SAML SSO improper auth → user identity linking. → disable SAML or pin IdP until ≤26.4.0 fix lands.

_Aeon stack: zero direct exposure verified via package.json/go.mod/Cargo.toml grep._
