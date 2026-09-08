#!/usr/bin/env node
/**
 * One-time, LOCAL bootstrap: mint a Surplus Intelligence seller Bearer key via SIWE.
 *
 * This runs on YOUR machine, offline from Aeon/GitHub Actions. Your private key is
 * read from the environment, used once to sign the SIWE challenge, and never printed
 * or persisted. The only output is the `si_seller_...` key - paste that into the Aeon
 * dashboard as the repo secret SURPLUS_SELLER_KEY. The scheduled `compute-resell`
 * skill then runs Bearer-only and never sees a private key.
 *
 * Usage:
 *   npm i viem            # one dependency, only needed locally for this script
 *   SELLER_WALLET_PRIVATE_KEY=0x... node skills/compute-resell/bootstrap-siwe.mjs [label]
 *
 * Optional env:
 *   SURPLUS_HOST   default https://api.surplusintelligence.ai
 *   KEY_LABEL      default "compute-resell" (or pass as argv[2])
 *   KEY_EXPIRES_AT ISO 8601; omit for a long-lived key
 */

import { privateKeyToAccount } from 'viem/accounts';

const HOST = process.env.SURPLUS_HOST || 'https://api.surplusintelligence.ai';
const LABEL = process.argv[2] || process.env.KEY_LABEL || 'compute-resell';
const EXPIRES_AT = process.env.KEY_EXPIRES_AT || undefined;

const pk = process.env.SELLER_WALLET_PRIVATE_KEY;
if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
  console.error('ERROR: set SELLER_WALLET_PRIVATE_KEY=0x<64 hex chars> in your environment.');
  console.error('It is used once to sign the challenge and is never logged or stored.');
  process.exit(1);
}

const account = privateKeyToAccount(pk);
const address = account.address;
console.error(`Signing wallet: ${address}`);

async function main() {
  // 1) Fetch the SIWE challenge for this address.
  const chalRes = await fetch(`${HOST}/v1/seller/auth/challenge?address=${address}`, {
    headers: { accept: 'application/json' },
  });
  if (!chalRes.ok) {
    console.error(`challenge http=${chalRes.status}: ${await chalRes.text()}`);
    process.exit(2);
  }
  const { message, nonce, expires_at } = await chalRes.json();
  console.error(`Challenge received (nonce=${nonce}, expires_at=${expires_at}). Signing within 5 min...`);

  // 2) Sign the exact challenge string (EIP-191 personal_sign).
  const signature = await account.signMessage({ message });

  // 3) Exchange the signed challenge for a seller API key (shown ONCE).
  const body = { message, signature, label: LABEL };
  if (EXPIRES_AT) body.expires_at = EXPIRES_AT;

  const keyRes = await fetch(`${HOST}/v1/seller/auth/keys`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await keyRes.text();
  if (!keyRes.ok) {
    console.error(`issue-key http=${keyRes.status}: ${text}`);
    process.exit(3);
  }
  const rec = JSON.parse(text);
  // Live API returns { key: "si_seller_...", id, wallet, label, created_at }.
  const apiKey = rec.key ?? rec.api_key;
  if (!apiKey) {
    console.error(`No key in response. Fields: [${Object.keys(rec).join(', ')}]. Body: ${text}`);
    process.exit(4);
  }

  // The key is only returned once - surface it clearly on stdout.
  console.error('\n=== Seller key minted. Copy the key below into SURPLUS_SELLER_KEY. ===');
  console.error(`  id:     ${rec.id ?? '(n/a)'}`);
  console.error(`  wallet: ${rec.wallet ?? address}`);
  console.error(`  label:  ${rec.label ?? LABEL}`);
  console.error('==================================================================\n');
  process.stdout.write(`${apiKey}\n`);
}

main().catch((e) => {
  console.error('bootstrap failed:', e?.message || e);
  process.exit(10);
});
