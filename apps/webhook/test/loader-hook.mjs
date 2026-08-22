// Loader hook for replay-guard.test.mjs — redirects the one otel import
// worker.js can't otherwise resolve outside the Workers runtime. See
// otel-stub.mjs for why.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@microlabs/otel-cf-workers") {
    return {
      url: new URL("./otel-stub.mjs", import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
