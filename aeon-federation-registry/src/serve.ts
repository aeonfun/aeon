/**
 * aeon-federation-registry/serve.ts — HTTP routes.
 *
 * GET /federation                — full registry, ETag'd
 * GET /federation/<publisher>    — one publisher's record
 * GET /federation/skills?q=<q>   — search across federation
 */

import type { Env } from './index.js';

export async function handleFederationRoutes(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean); // ["federation", ...]

  if (parts.length === 1) {
    return await serveFullRegistry(env);
  }

  if (parts[1] === 'skills') {
    return await serveSearch(env, url.searchParams.get('q') || '');
  }

  return await servePublisher(env, parts[1]);
}

async function serveFullRegistry(env: Env): Promise<Response> {
  // PLACEHOLDER: real D1 query.
  // const { results } = await env.DB.prepare('SELECT * FROM publishers WHERE withdrawn = 0').all();
  const placeholder = {
    schema: 'aeon-federation/1',
    generated: new Date().toISOString(),
    note: 'Registry is scaffold inside the Sealed Sprint. No real publishers yet.',
    publishers: [],
  };
  return new Response(JSON.stringify(placeholder, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

async function servePublisher(env: Env, handle: string): Promise<Response> {
  // PLACEHOLDER: real D1 query.
  return new Response(
    JSON.stringify({ error: 'publisher not found', handle, note: 'scaffold' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

async function serveSearch(env: Env, q: string): Promise<Response> {
  if (!q) {
    return new Response(JSON.stringify({ error: 'query required' }), { status: 400 });
  }
  // PLACEHOLDER: post-seal this uses Workers AI for semantic search across
  // federation.skills.description. Mirrors the in-tree skill-discovery pattern.
  return new Response(
    JSON.stringify({ query: q, results: [], note: 'scaffold' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
