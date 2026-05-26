/**
 * workers-runtime/src/index.ts — Cloudflare runtime port for Aeon (Session 01).
 *
 * STATUS: scaffold. The 21-step pipeline from `.github/workflows/aeon.yml` is
 * documented as comments + function stubs. The full implementation is the
 * subject of multi-week post-seal work — this file shows the shape and the
 * key boundaries so the implementation can drop in incrementally.
 *
 * PLACEHOLDER: no actual Anthropic SDK calls, no GitHub API calls, no skill
 * execution. Inside the Sealed Sprint this file is a structural skeleton
 * only; deployment is deferred.
 *
 * Architecture (see docs/contributor-dossier/03-subsystems/runtime-cloudflare.md):
 *   - HTTP entry (`fetch`) for dashboard "Run skill" → routes to SkillRunner DO
 *   - Cron entry (`scheduled`) for the 5-min tick → matches aeon.yml, dispatches
 *   - SkillRunner Durable Object — per-skill singleton, prevents parallel runs
 *   - Memory: KV (hot), D1 (index), R2 (articles), GitHub (cold/canonical)
 *   - Gateway: Anthropic direct OR Bankr (config-gated)
 *   - Fleet Watcher: optional preflight/postflight
 */

export interface Env {
  // Bindings (see wrangler.jsonc)
  CRON_STATE: KVNamespace;
  MEMORY_CACHE: KVNamespace;
  MEMORY_DB: D1Database;
  ARTICLE_BUCKET: R2Bucket;
  SKILL_RUNNER: DurableObjectNamespace;
  AI: unknown; // Workers AI

  // Secrets
  ANTHROPIC_API_KEY?: string;
  CLAUDE_CODE_OAUTH_TOKEN?: string;
  GITHUB_TOKEN?: string;
  FLEET_ENDPOINT?: string;
  FLEET_TOKEN?: string;
  BANKR_LLM_KEY?: string;

  // Vars
  AEON_REPO: string;
  DEFAULT_MODEL: string;
  GATEWAY_PROVIDER: 'direct' | 'bankr';
}

export default {
  /**
   * HTTP entry — dashboard's "Run skill" hits us here.
   * POST /run with JSON body { skill, var, model } → forwards to the SkillRunner DO.
   */
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/run' && req.method === 'POST') {
      const body = (await req.json()) as { skill?: string; var?: string; model?: string };
      const skill = body.skill ?? '';
      if (!/^[a-z][a-z0-9-]*$/.test(skill)) {
        return new Response('invalid skill name', { status: 400 });
      }
      // Per-skill DO singleton enforces concurrency (matches the Actions
      // concurrency: aeon-${skill} group).
      const id = env.SKILL_RUNNER.idFromName(skill);
      const runner = env.SKILL_RUNNER.get(id);
      return runner.fetch(req);
    }

    if (url.pathname === '/health') {
      return new Response('aeon-runtime ok (scaffold)\n', { status: 200 });
    }

    return new Response('not found', { status: 404 });
  },

  /**
   * Cron entry — runs every 5 min per wrangler.jsonc triggers.crons.
   * Replaces the messages.yml tick for skills with runtime: "workers".
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // PLACEHOLDER: skeleton of the tick logic.
    //
    // Real implementation:
    //   1. Read aeon.yml from GitHub via Octokit; cache in MEMORY_CACHE.
    //   2. For each skill with runtime: "workers" AND enabled: true, match cron
    //      expression against current time.
    //   3. Read CRON_STATE for dedup + retry + reactive triggers.
    //   4. For each matched skill, dispatch to its SkillRunner DO via ctx.waitUntil.

    console.log('[aeon-runtime] scheduled tick (scaffold — no-op)');
  },
};

/**
 * SkillRunner — Durable Object per-skill singleton.
 * Runs the 21-step pipeline that aeon.yml runs today.
 */
export class SkillRunner {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req: Request): Promise<Response> {
    // PLACEHOLDER: full 21-step pipeline.
    //
    // The pipeline mirrors .github/workflows/aeon.yml. Each step becomes a
    // private method on SkillRunner. Step order:
    //
    //   1. validate skill name
    //   2. validate secrets present
    //   3. run prefetch modules (workers-runtime/prefetch/*.ts)
    //   4. Fleet preflight (fail closed on non-200)
    //   5. resolve model + gateway
    //   6. build prompt (skill prose + var + today + chain context)
    //   7. call Anthropic SDK (or Bankr if gateway: bankr)
    //   8. capture token usage
    //   9. write output to staging (memory/skill-health/...)
    //  10. quality scoring (Workers AI bge or Haiku)
    //  11. json-render conversion (Workers AI Haiku)
    //  12. notify fan-out (Telegram/Discord/Slack/Email)
    //  13. retry pending notifications
    //  14. run postprocess modules (workers-runtime/postprocess/*.ts)
    //  15. Fleet postflight (always-run)
    //  16. log to token-usage.csv
    //  17. write to .outputs/<skill>.md (chain context for downstream)
    //  18. batch-commit memory writes to GitHub via Octokit (every N runs)
    //  19. update CRON_STATE entry for this skill
    //  20. emit observability event
    //  21. return result

    return new Response(
      JSON.stringify({
        status: 'scaffold',
        message:
          'SkillRunner is a Session 01 scaffold. The pipeline is not yet implemented. ' +
          'See docs/contributor-dossier/03-subsystems/runtime-cloudflare.md.',
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 501 }
    );
  }
}
