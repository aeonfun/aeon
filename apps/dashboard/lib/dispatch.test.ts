/**
 * Tests for apps/dashboard/lib/dispatch.ts - sanitizeModel must keep every real
 * model id intact (a mangled id 422s against aeon.yml's `model` choice input)
 * while still dropping anything that is not an id.
 *
 * Run with:  node --import tsx --test apps/dashboard/lib/dispatch.test.ts
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { sanitizeModel } from "./dispatch";
import { buildSkillRunArgs } from "./run-skill";
import { buildSoul, buildStrategy } from "./builders";
import { HARNESSES, modelsForHarness } from "./constants";

describe("sanitizeModel", () => {
  it("keeps every model id the dashboard offers, byte for byte", () => {
    for (const { id: harness } of HARNESSES) {
      for (const { id } of modelsForHarness(harness)) {
        assert.equal(sanitizeModel(id), id, `${harness}: ${id} was mangled`);
      }
    }
  });

  it("keeps slashed OpenRouter ids (regression: openai/x became openaix)", () => {
    assert.equal(sanitizeModel("openai/gpt-5.1-codex-mini"), "openai/gpt-5.1-codex-mini");
    assert.equal(sanitizeModel("moonshotai/kimi-k2.7-code"), "moonshotai/kimi-k2.7-code");
    assert.equal(sanitizeModel("deepseek/deepseek-v4-flash"), "deepseek/deepseek-v4-flash");
  });

  it("keeps dotted versions and colon variant suffixes", () => {
    assert.equal(sanitizeModel("grok-4.5"), "grok-4.5");
    assert.equal(sanitizeModel("vendor/model:free"), "vendor/model:free");
    assert.equal(sanitizeModel("claude-haiku-4-5-20251001"), "claude-haiku-4-5-20251001");
  });

  it("strips characters outside the id charset", () => {
    assert.equal(sanitizeModel("claude-sonnet-5; rm -rf /"), "");
    assert.equal(sanitizeModel(" grok-4.5 "), "grok-4.5");
    assert.equal(sanitizeModel("claude-sonnet-5$(id)"), "claude-sonnet-5id");
    assert.equal(sanitizeModel("claude-opus@2025"), "claude-opus2025");
  });

  it("rejects values that do not look like an id", () => {
    for (const bad of ["", "/", "/etc/passwd", "../x", "a/../b", "a//b", "openai/", "model:", "-x", ".x", ":x", "(config default)"]) {
      assert.equal(sanitizeModel(bad), "", `${JSON.stringify(bad)} should be rejected`);
    }
  });

  it("yields empty for non-string input", () => {
    assert.equal(sanitizeModel(undefined), "");
    assert.equal(sanitizeModel(null), "");
    assert.equal(sanitizeModel(42), "");
    assert.equal(sanitizeModel({ id: "grok-4.5" }), "");
  });
});

describe("dispatch argv keeps slashed model ids", () => {
  it("buildSkillRunArgs (dashboard run + aeon skills run)", () => {
    const args = buildSkillRunArgs("digest", { model: "openai/gpt-5.1-codex-mini" });
    assert.deepEqual(args.slice(-2), ["-f", "model=openai/gpt-5.1-codex-mini"]);
  });

  it("buildSkillRunArgs omits an unusable model", () => {
    const args = buildSkillRunArgs("digest", { model: "../.." });
    assert.equal(args.some(a => a.startsWith("model=")), false);
  });

  it("buildStrategy and buildSoul (dashboard + aeon strategy/soul)", () => {
    const strategy = buildStrategy({ goal: "grow", model: "moonshotai/kimi-k3" });
    assert.deepEqual(strategy.args.slice(-2), ["-f", "model=moonshotai/kimi-k3"]);
    const soul = buildSoul({ handle: "aeonframework", model: "deepseek/deepseek-v4-pro" });
    assert.deepEqual(soul.args.slice(-2), ["-f", "model=deepseek/deepseek-v4-pro"]);
  });
});
