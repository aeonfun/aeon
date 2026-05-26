/**
 * verify-client.ts — browser-side ed25519 verification.
 *
 * Runs in the user's browser via WebCrypto. The server's claim of "verified"
 * is not trusted; the user re-runs the verification themselves.
 *
 * This is one of the seven enforceable glass-box properties.
 */

export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys
    .filter(k => k !== 'signature')
    .map(k => JSON.stringify(k) + ':' + canonicalize((obj as Record<string, unknown>)[k]))
    .join(',') + '}';
}

function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export async function verifyClientSide(post: {
  publisher_key: string;
  signature: string;
  [k: string]: unknown;
}): Promise<{ verified: boolean; canonicalMessage: string }> {
  const sigMatch = post.signature.match(/^ed25519:(.+)$/);
  const keyMatch = post.publisher_key.match(/^ed25519:(.+)$/);
  if (!sigMatch || !keyMatch) return { verified: false, canonicalMessage: '' };

  const canonicalMessage = canonicalize(post);

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      base64Decode(keyMatch[1]),
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    const verified = await crypto.subtle.verify(
      'Ed25519',
      key,
      base64Decode(sigMatch[1]),
      new TextEncoder().encode(canonicalMessage)
    );
    return { verified, canonicalMessage };
  } catch (err) {
    return { verified: false, canonicalMessage };
  }
}
