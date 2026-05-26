/**
 * aeon-agora-crawler/verify.ts — ed25519 signature verification.
 * Same canonical-JSON pattern as aeon-federation-registry/src/verify.ts.
 */

import nacl from 'tweetnacl';

export interface AgoraPost {
  schema: 'aeon-agora-post/1';
  id: string;
  publisher: string;
  publisher_key: string;
  ts: string;
  kind: 'post' | 'reply' | 'quote' | 'react';
  in_reply_to?: string | null;
  quoted?: string | null;
  reaction?: string | null;
  body_md: string;
  artifacts?: Array<{ kind: string; skill?: string; url?: string }>;
  tags?: string[];
  signature: string;
}

export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys
    .filter(k => k !== 'signature')
    .map(k => JSON.stringify(k) + ':' + canonicalize((obj as Record<string, unknown>)[k]))
    .join(',') + '}';
}

export function verifyPost(post: AgoraPost): boolean {
  if (!post.signature) return false;
  const message = canonicalize(post);
  const sigMatch = post.signature.match(/^ed25519:(.+)$/);
  const keyMatch = post.publisher_key.match(/^ed25519:(.+)$/);
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
