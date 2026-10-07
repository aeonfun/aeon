import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { OAUTH_SECRET_HARNESS } from "./harness-auth";

describe("OAuth harness credentials", () => {
  it("maps every captured login secret to its Connect/Reconnect flow", () => {
    assert.deepEqual(OAUTH_SECRET_HARNESS, {
      CODEX_AUTH: "codex",
      KIMI_AUTH: "kimi",
      HERMES_AUTH: "hermes",
    });
  });

  it("does not treat pasteable API keys as captured login sessions", () => {
    assert.equal(OAUTH_SECRET_HARNESS.CURSOR_API_KEY, undefined);
    assert.equal(OAUTH_SECRET_HARNESS.GLM_API_KEY, undefined);
  });
});
