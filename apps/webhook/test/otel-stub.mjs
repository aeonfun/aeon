// Stub for @microlabs/otel-cf-workers used only by replay-guard.test.mjs.
// worker.js imports `instrument` at module load time regardless of whether
// OTEL is enabled at runtime (env.OTEL_EXPORTER_OTLP_ENDPOINT unset in every
// test case here), and the real package transitively imports a `cloudflare:`
// virtual module Node can't resolve. Since `instrument()` is never actually
// CALLED in this test run, a no-op stand-in is behaviorally exact for what's
// under test (the replay-guard control flow), not a shortcut around it.
export function instrument(handler) {
  return handler;
}
