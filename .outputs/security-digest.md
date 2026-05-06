*Security Digest — 2026-05-06*
Verdict: nothing urgent today. 5 to schedule, 3 to monitor. _Sources: KEV, GH Advisory, EPSS_

*PATCH THIS WEEK*
- [CVE-2026-29090](https://github.com/advisories/GHSA-6j7p-qjhg-9947) — rucio (pip) · CVSS 9.9 · EPSS n/a · no public PoC
  SQL injection in FilterEngine PG/Oracle via DID Search API. Sister CVE-2026-29080 same package.
  → upgrade rucio to ≥35.8.5 / ≥38.5.5 / ≥39.4.2 / ≥40.1.1 by branch.
- [CVE-2026-42864](https://github.com/advisories/GHSA-fqvv-jvhr-g5jc) — firefighter-incident (pip) · CVSS 9.9 · EPSS n/a · no public PoC
  Unauth SSRF in Raid jira_bot endpoint → IAM credential theft.
  → upgrade firefighter-incident to ≥0.0.54.
- [CVE-2026-42238](https://github.com/advisories/GHSA-4pvg-prr3-9cxr) — nginx-ui (Go) · CVSS 9.8 · EPSS 0.002 · no public PoC
  Unauth RCE via Backup Restore.
  → upgrade nginx-ui to ≥2.3.8.
- [vm2 cluster](https://github.com/advisories/GHSA-ffh4-j6h5-pg66) — vm2 (npm) · CVSS 9.8 · 5 CVEs (26956/26332/24781/24120/24118)
  Coordinated sandbox-escape disclosure; package re-patched after deprecation.
  → upgrade vm2 to ≥3.11.0, or migrate to isolated-vm.
- [CVE-2026-42048](https://github.com/advisories/GHSA-9whx-c884-c68q) — langflow (pip) · CVSS 9.6 · EPSS n/a · no public PoC
  Path traversal in Knowledge Bases API.
  → upgrade langflow to ≥1.9.0.

*MONITOR*
- [GHSA-g38r-8gmr-ghrf](https://github.com/advisories/GHSA-g38r-8gmr-ghrf) — mysten-metrics + sui-execution-cut (crates.io) · malicious code · already yanked
  Sui-ecosystem typosquats. → audit Cargo.lock; remove if present.
- [CVE-2026-42601](https://github.com/advisories/GHSA-3h23-7824-pj8r) — archivebox (pip) · critical RCE · no fix
  Unvalidated per-crawl config overrides in AddView. → track advisory; restrict /add exposure.
- [CVE-2026-25660](https://github.com/advisories/GHSA-4v9x-cqc5-j645) — codechecker (pip) · critical auth bypass · no fix
  → track advisory; require network ACL in front of CodeChecker server.
