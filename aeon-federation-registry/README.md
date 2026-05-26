# aeon-federation-registry

Cloudflare Worker that crawls participating Aeon instances' `well-known/aeon-federation.json` manifests and serves a public registry at the canonical URL.

> **Status:** Scaffold inside the Sealed Sprint (Session 03 follow-on, 2026-05-26). Architecture + crawler skeleton in place. Real deployment is a post-seal step.

**Canonical URL (committed):** `federation.aeon.bot` — operator decision 2026-05-26.

---

## What it does

Every 15 minutes:

1. Reads the seed list of participating publishers (from `seeds.json` in this directory).
2. For each, fetches `${publisher_endpoint}/well-known/aeon-federation.json`.
3. Validates signature, schema, and `withdrawn` status.
4. Upserts into D1: `publishers(handle, publisher_key, endpoint, last_seen, withdrawn)` and `skills(publisher, slug, description, pricing, sla)`.
5. Marks publishers as `unreachable` after N consecutive crawl failures.

Serves three HTTP endpoints:

| Method | Path | Returns |
|---|---|---|
| `GET` | `/federation` | Full registry, ETag'd, max-age 5 min |
| `GET` | `/federation/<publisher>` | One publisher's entry |
| `GET` | `/federation/skills?q=<query>` | Search across federation (post-seal Workers-AI-backed) |

## Layout

```
aeon-federation-registry/
├── wrangler.jsonc        ← bindings + cron trigger
├── package.json
├── seeds.json            ← initial publisher allowlist (manual PR to add)
├── src/
│   ├── index.ts          ← entry: fetch + scheduled
│   ├── crawl.ts          ← per-publisher crawl + signature verify (SCAFFOLD)
│   ├── ingest.ts         ← D1 upsert (SCAFFOLD)
│   ├── serve.ts          ← /federation routes (SCAFFOLD)
│   └── verify.ts         ← ed25519 verification (SCAFFOLD)
├── __tests__/
│   └── smoke.ts          ← node:test smoke (SCAFFOLD)
└── README.md             ← you are here
```

## What's PLACEHOLDER inside the Sealed Sprint

- `wrangler deploy` is NOT run. The Worker exists as scaffold only.
- `src/crawl.ts` doesn't make real HTTP calls to publisher endpoints (no external service connections inside the seal).
- `seeds.json` ships with just `@aeon-prime` (this instance) as a single entry, withdrawn.
- D1 schema is documented but no real database is created.

## Activation (post-seal)

1. `cd aeon-federation-registry && npm install`.
2. Create Cloudflare account if not already done.
3. `wrangler d1 create aeon-federation-registry-db`.
4. Update `wrangler.jsonc` with the D1 database_id.
5. `wrangler d1 execute aeon-federation-registry-db --file=./schema.sql` (schema file added at activation).
6. `wrangler deploy`.
7. Configure custom domain `federation.aeon.bot` in Cloudflare dashboard.
8. Add real seed publishers to `seeds.json` and commit.

## Trust model

The registry is **discovery only**, not trust. Consumers verify publisher signatures independently (the registry can serve a wrong endpoint URL but cannot forge a publisher's signed responses). See [`../docs/federation-spec/SECURITY.md`](../docs/federation-spec/SECURITY.md).

## Related

- [`../docs/federation-spec/SPEC.md`](../docs/federation-spec/SPEC.md) — the federation/1 protocol.
- [`../docs/federation-spec/SECURITY.md`](../docs/federation-spec/SECURITY.md) — threat model.
- [`../docs/contributor-dossier/03-subsystems/federation.md`](../docs/contributor-dossier/03-subsystems/federation.md) — subsystem overview.
