/**
 * aeon-federation-registry/verify.ts — ed25519 signature verification.
 *
 * Both crawler and clients use this. Browser clients re-verify in the
 * Pages frontend via WebCrypto — server's claim is not trusted.
 */

import nacl from 'tweetnacl';

export interface FederationManifest {
  schema: string;
  publisher: string;
  publisher_key: string;
  endpoint: string;
  operator: string;
  version: string;
  skills: unknown[];
  extensions?: unknown[];
  withdrawn: boolean;
  signature?: string;
}

/**
 * Canonical JSON serialization for signing:
 * - Keys sorted alphabetically at every level.
 * - No whitespace.
 * - Excludes the `signature` field itself.
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys
    .filter(k => k !== 'signature')
    .map(k => JSON.stringify(k) + ':' + canonicalize((obj as Record<string, unknown>)[k]))
    .join(',') + '}';
}

export async function verifyManifest(manifest: FederationManifest): Promise<boolean> {
  if (!manifest.signature) {
    // Manifests MAY be unsigned (some operators don't want the overhead).
    // Verification of an unsigned manifest = always-fails for paid skills,
    // accepted with a warning for free skills.
    return false;
  }

  // PLACEHOLDER inside the seal: signature verification scaffold.
  // Post-seal: this runs as-is once the manifest format is finalized.
  const message = canonicalize(manifest);
  const sigMatch = manifest.signature.match(/^ed25519:(.+)$/);
  const keyMatch = manifest.publisher_key.match(/^ed25519:(.+)$/);
  if (!sigMatch || !keyMatch) return false;

  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      base64Decode(sigMatch[1]),
      base64Decode(keyMatch[1])
    );
  } catch {
    return false;
  }
}

function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
