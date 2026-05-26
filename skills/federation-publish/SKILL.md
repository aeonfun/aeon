---
name: Federation Publish
description: Update well-known/aeon-federation.json with currently-published skills + identity
var: ""
tags: [meta]
---

> **${var}** — Empty: refresh the manifest from current `aeon.yml` entries marked `federation_publish: true`. `init`: bootstrap identity (generate publisher_key, prompt for endpoint and operator handle). `withdraw`: set `withdrawn: true` and stop publishing.

Today is ${today}. Maintain `well-known/aeon-federation.json` so other Aeon instances can discover this instance's published skills.

## Steps

1. **Check bootstrap state.** If `well-known/aeon-federation.json` still has `PLACEHOLDER_GENERATE_WITH_skills/federation-publish` in `publisher_key`:
   - If `${var}` is `init`: generate an ed25519 keypair (`openssl genpkey -algorithm ed25519`). Write the private key to `.secrets/federation-signing-key.pem` (gitignored). Derive the public key and place it in `publisher_key` field as `ed25519:<base64>`.
   - If `${var}` is empty: log `SKILL_FEDERATION_PUBLISH_BOOTSTRAP_NEEDED` and notify the operator that `./federation-publish init` is required first. Stop.

2. **Read aeon.yml.** Find every skill with `federation_publish: true` in its config block. Extract: slug, description (from SKILL.md frontmatter), tags, input_schema (from SKILL.md or default empty), pricing (from config: `federation_pricing: { model: free|x402|subscription, amount_usdc: ..., endpoint: ... }`).

3. **Update manifest.** Set:
   - `version` to `${today}`.
   - `skills[]` to the array built in step 2.
   - `withdrawn` to `false` (or `true` if `${var}` is `withdraw`).

4. **Sign manifest checksum.** Compute sha256 over the canonical JSON of the manifest (sorted keys, no whitespace). Sign with the operator's private key from `.secrets/federation-signing-key.pem`. Store the signature in `well-known/aeon-federation.json.sig` (separate file, also committed).

5. **Log.** Append to `memory/logs/${today}.md`:
- SKILL_FEDERATION_PUBLISH_OK skills=<N> version=${today}
- Or SKILL_FEDERATION_PUBLISH_BOOTSTRAP_NEEDED if step 1 stopped.

6. **Notify (silent on no-op).** If the manifest changed vs the previous commit, send via `./notify` (max 600 chars):
Federation manifest updated. <N> skills published. View: <endpoint>/well-known/aeon-federation.json

## Sandbox note

PLACEHOLDER inside the Sealed Sprint: this skill is scaffolded but key generation (`openssl genpkey`) must run on the operator's local machine the first time. The operator runs `./federation-publish init` interactively before any federation activity. No external network calls — all key material stays in `.secrets/`. The manifest at `well-known/aeon-federation.json` is committed to the repo (public) but the private key is not.
