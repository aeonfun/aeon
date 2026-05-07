*Security Digest — 2026-05-07*
Verdict: 1 actively exploited (no patch yet), 5 to schedule, 3 to monitor. _Sources: KEV, GH Advisory, EPSS_

*PATCH TODAY*
- [CVE-2026-0300](https://nvd.nist.gov/vuln/detail/CVE-2026-0300) — Palo Alto PAN-OS · KEV added 2026-05-06 · EPSS 0.149 (94.6 pct) · CVSS 9.8 · CISA due 2026-05-09
  Out-of-bounds write in User-ID Captive Portal allows unauth RCE as root on PA-Series/VM-Series. No vendor patch yet.
  → restrict User-ID Authentication Portal to trusted zones or disable today (no fix released; CISA mitigation deadline 05-09).

*PATCH THIS WEEK*
- [CVE-2026-44006 + cluster](https://github.com/advisories/GHSA-qcp4-v2jj-fjx8) — vm2 (npm) · CVSS 10.0 · 5 sandbox-escape CVEs (44006/43997/44005/43999/44007) + 3 high (43998/44004/44001)
  Coordinated disclosure: prototype proxy, host Buffer.alloc, builtin allowlist bypass. Vulnerable ≤3.10.5; vm2 is deprecated but emergency patch shipped at 3.11.0.
  → upgrade vm2 to ≥3.11.0, or migrate to isolated-vm.
- [CVE-2026-44351](https://github.com/advisories/GHSA-gmvf-9v4p-v8jc) — fast-jwt (npm) · CVSS 9.1 · vulnerable ≤6.2.3
  JWT auth bypass: async key resolver accepts empty HMAC secret → forge-any-token.
  → upgrade fast-jwt past 6.2.3 (check release feed for fixed version).
- [CVE-2026-44484](https://github.com/advisories/GHSA-w37p-236h-pfx3) — pytorch-lightning (pip) · supply-chain compromise · 2.6.2 + 2.6.3 only
  PyPI package versions compromised; ML-stack relevance for swarm-fund-mvp paper_triage.
  → unpin/downgrade off 2.6.2/2.6.3 today; reinstall from clean 2.6.1 or wait for clean re-release.
- [CVE-2026-42589](https://github.com/advisories/GHSA-rqgh-gxv4-6657) — gotenberg/v8 (go) · CVSS 9.8 · vulnerable 8.29.1
  Unauthenticated RCE via ExifTool metadata key injection. Same vendor: SSRF (CVE-2026-42596 9.4) + DoS (42594 7.5) + ExifTool bypass (42590 8.2).
  → upgrade gotenberg/v8 past 8.29.1.
- [CVE-2026-41050](https://github.com/advisories/GHSA-765j-qfrp-hm3j) — rancher/fleet (go) · CVSS 9.9 · multiple vulnerable ranges
  Helm impersonation bypass of RESTClientGetter retains cluster-admin during template rendering.
  → upgrade Fleet to 0.15.1 / 0.14.5 / 0.13.10 / 0.12.14 / 0.11.13 (per branch).

*MONITOR*
- [CVE-2026-44513](https://github.com/advisories/GHSA-98h9-4798-4q5v) — diffusers (pip) · CVSS 8.8 · trust_remote_code bypass via custom_pipeline. → audit any custom_pipeline usage in HF diffusers stack.
- [CVE-2026-42880](https://github.com/advisories/GHSA-3v3m-wc6v-x4x3) — argo-cd v3 (go) · CVSS 9.6 · ServerSideDiff Kubernetes Secret extraction. → if running ArgoCD 3.2.x/3.3.x, upgrade to 3.2.11 / 3.3.9.
- [CVE-2026-44334](https://github.com/advisories/GHSA-xcmw-grxf-wjhj) — praisonai (pip) · CVSS 8.4 · unauth RCE via tool_override.py (CVE-2026-40287 patch bypass). → avoid public-network exposure of PraisonAI agents.

