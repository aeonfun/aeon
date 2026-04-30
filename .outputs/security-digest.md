*Security Digest — 2026-04-30*
Verdict: nothing urgent today. 5 to schedule, 1 to monitor. _Sources: KEV ok, GH ok, EPSS ok_

*PATCH THIS WEEK*
- [CVE-2026-42232](https://github.com/advisories/GHSA-hqr4-h3xv-9m3r) — n8n (npm) · CVSS 10 · EPSS n/a · auth required, no public PoC
  XML Node prototype pollution chains to RCE. → upgrade n8n to ≥1.123.32 / ≥2.17.4 / ≥2.18.1.
- [CVE-2026-42231](https://github.com/advisories/GHSA-q5f4-99jv-pgg5) — n8n (npm) · CVSS 10 · EPSS n/a · auth required, no public PoC
  xml2js prototype pollution in webhook body → RCE via Git node. → upgrade n8n to ≥1.123.32 / ≥2.17.4 / ≥2.18.1.
- [CVE-2026-42352](https://github.com/advisories/GHSA-jgvc-94c8-3chc) — pygeoapi (pip) · CVSS 8.6 · EPSS n/a
  Unauthenticated SSRF via OGC API Processes Subscriber. → upgrade pygeoapi to ≥0.23.3.
- [CVE-2026-42226](https://github.com/advisories/GHSA-r4v6-9fqc-w5jr) — n8n (npm) · CVSS 8.5 · EPSS n/a
  Credential auth bypass in dynamic-node-parameters lets foreign API keys be re-used. → upgrade n8n to ≥1.123.32 / ≥2.17.5.
- [CVE-2026-42353](https://github.com/advisories/GHSA-jfgf-83c5-2c4m) — i18next-http-middleware (npm) · CVSS 8.2 · EPSS n/a
  Path traversal / SSRF via user-controlled language and namespace. → upgrade to ≥3.9.3.

*MONITOR*
- [GHSA-wr32-99hh-6f35](https://github.com/advisories/GHSA-wr32-99hh-6f35) — Nginx-UI (Go) · CVSS 8.5 · no fix yet · EPSS n/a
  SSRF via Cluster Proxy Middleware. → track for patched release; restrict cluster proxy access until then.

