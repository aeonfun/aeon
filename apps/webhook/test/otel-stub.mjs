// Stub for @microlabs/otel-cf-workers used by the webhook tests. worker.js
// imports `instrument` + `OTLPExporter` at module load time regardless of
// whether OTEL is enabled at runtime, and the real package transitively imports
// a `cloudflare:` virtual module Node can't resolve. replay-guard.test.mjs never
// enables OTEL, so `instrument()` is a pass-through there; otel-redact.test.mjs
// enables it and reads back the config function worker.js hands to
// `instrument()`, plus every span batch the stub exporter receives.
export const captured = { configFn: null, exported: [] };

export function instrument(handler, configFn) {
  captured.configFn = configFn;
  return handler;
}

export class OTLPExporter {
  constructor(config) {
    this.config = config;
  }
  export(spans, resultCallback) {
    captured.exported.push(spans);
    resultCallback({ code: 0 });
  }
  shutdown() {
    return Promise.resolve();
  }
}
