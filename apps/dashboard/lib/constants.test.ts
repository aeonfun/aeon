/**
 * Tests for apps/dashboard/lib/constants.ts - the data-driven pack grouping that
 * keeps installed community skills visible in the roster (regression: a skill in
 * a community pack like `antfleet-pr-review` used to vanish because the roster
 * iterated a hardcoded pack list).
 *
 * Run with:  node --import tsx --test apps/dashboard/lib/constants.test.ts
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { packGroups, FIRST_PARTY_KEYS, keyProvidedByHarness, MODELS, CODEX_MODELS, HARNESSES, pickerOptions } from "./constants";

const sk = (name: string, pack: string, packName = "") => ({ pack, packName });

describe("packGroups", () => {
  it("orders Core first, then community, then the rest of first-party", () => {
    const groups = packGroups([
      sk("heartbeat", "core"),
      sk("pr-review", "dev"),
      sk("pr-review-antfleet", "antfleet-pr-review", "AntFleet PR Review"),
    ]);
    assert.deepEqual(groups.map(g => g.key), ["core", "antfleet-pr-review", "dev"]);
  });

  it("labels a community pack by its joined packName, marked community", () => {
    const [g] = packGroups([sk("x", "antfleet-pr-review", "AntFleet PR Review")]);
    assert.equal(g.key, "antfleet-pr-review");
    assert.equal(g.label, "AntFleet PR Review");
    assert.equal(g.community, true);
    assert.equal(FIRST_PARTY_KEYS.has("antfleet-pr-review"), false);
  });

  it("falls back to the pack key when no packName is joined", () => {
    const [g] = packGroups([sk("x", "some-pack")]);
    assert.equal(g.label, "some-pack");
    assert.equal(g.community, true);
  });

  it("treats every first-party pack as non-community", () => {
    const groups = packGroups([sk("a", "dev"), sk("b", "crypto"), sk("c", "productivity")]);
    assert.ok(groups.every(g => g.community === false));
  });

  it("only emits packs that actually contain skills", () => {
    const groups = packGroups([sk("a", "core")]);
    assert.deepEqual(groups.map(g => g.key), ["core"]);
  });

  it("defaults a missing pack to the lab catch-all", () => {
    const groups = packGroups([{ pack: "", packName: "" }]);
    assert.deepEqual(groups.map(g => g.key), ["lab"]);
  });
});

describe("keyProvidedByHarness", () => {
  it("the grok harness natively provides XAI_API_KEY (built-in search_x)", () => {
    assert.equal(keyProvidedByHarness("XAI_API_KEY", "grok"), true);
  });

  it("the claude harness provides no keys natively — XAI_API_KEY still required", () => {
    assert.equal(keyProvidedByHarness("XAI_API_KEY", "claude"), false);
  });

  it("does not cover unrelated keys even on the grok harness", () => {
    assert.equal(keyProvidedByHarness("COINGECKO_API_KEY", "grok"), false);
  });

  it("is safe for an unknown harness", () => {
    assert.equal(keyProvidedByHarness("XAI_API_KEY", "whatever"), false);
  });
});

describe("MODELS", () => {
  it("offers exactly the current three Claude models", () => {
    assert.deepEqual(MODELS.map(m => m.id), ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5-20251001"]);
  });
});

describe("pickerOptions", () => {
  it("keeps the list when the configured model is offered", () => {
    assert.deepEqual(pickerOptions(MODELS, "claude-opus-5-5"), MODELS);
    assert.deepEqual(pickerOptions(MODELS, ""), MODELS);
  });
  it("keeps an older configured model visible, marked as configured", () => {
    const opts = pickerOptions(MODELS, "claude-sonnet-5");
    assert.equal(opts.length, 4);
    assert.deepEqual(opts[3], { id: "claude-sonnet-5", label: "Sonnet 5 (configured)" });
  });
  it("labels an unknown id with the raw id", () => {
    assert.equal(pickerOptions(MODELS, "x/custom").at(-1)?.label, "x/custom (configured)");
  });
});

describe("CODEX_MODELS", () => {
  it("offers only GPT-6 Luna and GPT-6.1 Sol", () => {
    assert.deepEqual(CODEX_MODELS.map(m => m.id), ["openai/gpt-6-luna", "openai/gpt-6.1-sol"]);
  });
  it("names an older codex pin that left the list", () => {
    assert.equal(pickerOptions(CODEX_MODELS, "openai/gpt-5.1-codex-mini").at(-1)?.label, "GPT-5.1 Codex Mini (configured)");
  });
});

describe("HARNESSES", () => {
  it("lists Claude, Codex, Grok, Kimi first", () => {
    assert.deepEqual(HARNESSES.slice(0, 4).map(h => h.id), ["claude", "codex", "grok", "kimi"]);
  });
});
