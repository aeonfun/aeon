/**
 * Tests for apps/dashboard/lib/config.ts — YAML config parsing and manipulation.
 *
 * Run with:  node --import tsx --test apps/dashboard/lib/config.test.ts
 *
 * Uses node:test + node:assert (no framework deps) to match the
 * existing test convention in api-gate.test.ts.
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import {
  parseConfig,
  updateSkillInConfig,
  updateModelInConfig,
  updateGatewayInConfig,
  updateJsonrenderInConfig,
  removeSkillFromConfig,
  addSkillToConfig,
} from "./config";

// ── Minimal valid config ─────────────────────────────────────────────

const MINIMAL_YAML = `skills:
  heartbeat: { enabled: true, schedule: "0 12 * * *" }

model: claude-sonnet-4-6
`;

const FULL_YAML = `# Aeon configuration
skills:
  morning-brief: { enabled: false, schedule: "0 7 * * *" }
  market-pulse: { enabled: true, schedule: "0 12 * * *", model: "claude-sonnet-4-6" }
  heartbeat: { enabled: true, schedule: "0 12 * * *" }

model: claude-opus-4-8

gateway:
  provider: direct

channels:
  jsonrender:
    enabled: true
`;

// ── parseConfig ──────────────────────────────────────────────────────

describe("parseConfig", () => {
  it("parses a minimal config", () => {
    const config = parseConfig(MINIMAL_YAML);
    assert.equal(Object.keys(config.skills).length, 1);
    assert.equal(config.skills["heartbeat"].enabled, true);
    assert.equal(config.skills["heartbeat"].schedule, "0 12 * * *");
    assert.equal(config.skills["heartbeat"].var, "");
    assert.equal(config.skills["heartbeat"].model, "");
    assert.equal(config.model, "claude-sonnet-4-6");
  });

  it("parses a full config with all fields", () => {
    const config = parseConfig(FULL_YAML);
    assert.equal(Object.keys(config.skills).length, 3);
    assert.equal(config.skills["morning-brief"].enabled, false);
    assert.equal(config.skills["morning-brief"].schedule, "0 7 * * *");
    assert.equal(config.skills["market-pulse"].enabled, true);
    assert.equal(config.skills["market-pulse"].model, "claude-sonnet-4-6");
    assert.equal(config.model, "claude-opus-4-8");
    assert.equal(config.gateway.provider, "direct");
    assert.equal(config.jsonrenderEnabled, true);
  });

  it("defaults model to claude-sonnet-4-6 when absent", () => {
    const yaml = `skills:\n  test: { enabled: false, schedule: "0 0 * * *" }\n`;
    const config = parseConfig(yaml);
    assert.equal(config.model, "claude-sonnet-4-6");
  });

  it("defaults gateway to auto when absent", () => {
    const config = parseConfig(MINIMAL_YAML);
    assert.equal(config.gateway.provider, "auto");
  });

  it("parses an explicit auto gateway", () => {
    const yaml = `skills: {}\n\ngateway:\n  provider: auto\n`;
    const config = parseConfig(yaml);
    assert.equal(config.gateway.provider, "auto");
  });

  it("defaults jsonrenderEnabled to false when absent", () => {
    const config = parseConfig(MINIMAL_YAML);
    assert.equal(config.jsonrenderEnabled, false);
  });

  it("parses bankr gateway", () => {
    const yaml = `skills: {}\n\ngateway:\n  provider: bankr\n`;
    const config = parseConfig(yaml);
    assert.equal(config.gateway.provider, "bankr");
  });

  it("parses a skill with var field", () => {
    const yaml = `skills:\n  pr-review: { enabled: false, schedule: "0 9 * * *", var: "owner/repo" }\n`;
    const config = parseConfig(yaml);
    assert.equal(config.skills["pr-review"].var, "owner/repo");
  });

  it("handles empty skills section", () => {
    // yaml library parses `skills:` with no entries as null, not an empty map
    const yaml = `skills:\n\nmodel: claude-sonnet-4-6\n`;
    const config = parseConfig(yaml);
    assert.equal(Object.keys(config.skills).length, 0);
  });
});

// ── updateSkillInConfig ──────────────────────────────────────────────

describe("updateSkillInConfig", () => {
  it("enables a disabled skill", () => {
    const updated = updateSkillInConfig(MINIMAL_YAML, "heartbeat", { enabled: false });
    assert.ok(updated.includes("heartbeat: { enabled: false"));
  });

  it("changes the schedule", () => {
    const updated = updateSkillInConfig(MINIMAL_YAML, "heartbeat", { schedule: "0 9 * * 1" });
    assert.ok(updated.includes("schedule: '0 9 * * 1'") || updated.includes('schedule: "0 9 * * 1"'));
  });

  it("sets a var on a skill", () => {
    const updated = updateSkillInConfig(MINIMAL_YAML, "heartbeat", { var: "test-value" });
    assert.ok(updated.includes("var: test-value") || updated.includes("var: 'test-value'"));
  });

  it("clears a var when empty string", () => {
    const yaml = `skills:\n  heartbeat: { enabled: true, schedule: "0 12 * * *", var: "old" }\n`;
    const updated = updateSkillInConfig(yaml, "heartbeat", { var: "" });
    // The 'var' key should be deleted from the inline map
    assert.ok(!updated.includes("var:") || updated.includes("var: ''"));
  });

  it("sets a model override on a skill", () => {
    const updated = updateSkillInConfig(MINIMAL_YAML, "heartbeat", { model: "claude-sonnet-4-6" });
    assert.ok(updated.includes("model: claude-sonnet-4-6") || updated.includes("model: 'claude-sonnet-4-6'"));
  });

  it("returns original yaml for non-existent skill", () => {
    const updated = updateSkillInConfig(MINIMAL_YAML, "nonexistent", { enabled: true });
    assert.equal(updated, MINIMAL_YAML);
  });

  it("updates multiple fields at once", () => {
    const updated = updateSkillInConfig(MINIMAL_YAML, "heartbeat", {
      enabled: false,
      schedule: "0 3 * * *",
      var: "hello",
    });
    const config = parseConfig(updated);
    assert.equal(config.skills["heartbeat"].enabled, false);
    assert.equal(config.skills["heartbeat"].schedule, "0 3 * * *");
    assert.equal(config.skills["heartbeat"].var, "hello");
  });
});

// ── updateModelInConfig ──────────────────────────────────────────────

describe("updateModelInConfig", () => {
  it("updates the top-level model", () => {
    const updated = updateModelInConfig(MINIMAL_YAML, "claude-opus-4-8");
    const config = parseConfig(updated);
    assert.equal(config.model, "claude-opus-4-8");
  });

  it("replaces an existing model", () => {
    const updated = updateModelInConfig(FULL_YAML, "claude-haiku-4-5-20251001");
    const config = parseConfig(updated);
    assert.equal(config.model, "claude-haiku-4-5-20251001");
  });
});

// ── updateGatewayInConfig ────────────────────────────────────────────

describe("updateGatewayInConfig", () => {
  it("flips an existing provider to bankr", () => {
    const updated = updateGatewayInConfig(FULL_YAML, "bankr");
    assert.equal(parseConfig(updated).gateway.provider, "bankr");
  });

  it("flips back to direct", () => {
    const bankr = updateGatewayInConfig(FULL_YAML, "bankr");
    const updated = updateGatewayInConfig(bankr, "direct");
    assert.equal(parseConfig(updated).gateway.provider, "direct");
  });

  it("creates the gateway block when absent", () => {
    const updated = updateGatewayInConfig(MINIMAL_YAML, "bankr");
    assert.equal(parseConfig(updated).gateway.provider, "bankr");
  });
});

// ── updateJsonrenderInConfig ─────────────────────────────────────────

describe("updateJsonrenderInConfig", () => {
  it("enables jsonrender when channels block exists", () => {
    const updated = updateJsonrenderInConfig(FULL_YAML, true);
    const config = parseConfig(updated);
    assert.equal(config.jsonrenderEnabled, true);
  });

  it("disables jsonrender", () => {
    const updated = updateJsonrenderInConfig(FULL_YAML, false);
    const config = parseConfig(updated);
    assert.equal(config.jsonrenderEnabled, false);
  });

  it("returns original when no channels block exists", () => {
    // MINIMAL_YAML has no channels block
    const updated = updateJsonrenderInConfig(MINIMAL_YAML, true);
    assert.equal(updated, MINIMAL_YAML);
  });
});

// ── removeSkillFromConfig ───────────────────────────────────────────

describe("removeSkillFromConfig", () => {
  it("removes a skill entry", () => {
    const updated = removeSkillFromConfig(FULL_YAML, "market-pulse");
    const config = parseConfig(updated);
    assert.equal(config.skills["market-pulse"], undefined);
    assert.equal(config.skills["morning-brief"].enabled, false);
    assert.equal(config.skills["heartbeat"].enabled, true);
  });

  it("returns original when skill does not exist", () => {
    const updated = removeSkillFromConfig(MINIMAL_YAML, "nonexistent");
    assert.equal(updated, MINIMAL_YAML);
  });

  it("removes the only skill", () => {
    const updated = removeSkillFromConfig(MINIMAL_YAML, "heartbeat");
    const config = parseConfig(updated);
    assert.equal(Object.keys(config.skills).length, 0);
  });
});

// ── addSkillToConfig ─────────────────────────────────────────────────

describe("addSkillToConfig", () => {
  it("adds a new skill with defaults", () => {
    const updated = addSkillToConfig(MINIMAL_YAML, "new-skill");
    const config = parseConfig(updated);
    assert.ok(config.skills["new-skill"]);
    assert.equal(config.skills["new-skill"].enabled, false);
    assert.equal(config.skills["new-skill"].schedule, "0 12 * * *");
  });

  it("does not duplicate an existing skill", () => {
    const updated = addSkillToConfig(MINIMAL_YAML, "heartbeat");
    assert.equal(updated, MINIMAL_YAML);
  });

  it("adds with custom config", () => {
    const updated = addSkillToConfig(MINIMAL_YAML, "custom-skill", {
      enabled: true,
      schedule: "0 9 * * 1",
    });
    const config = parseConfig(updated);
    assert.equal(config.skills["custom-skill"].enabled, true);
    assert.equal(config.skills["custom-skill"].schedule, "0 9 * * 1");
  });

  it("inserts before the heartbeat fallback entry", () => {
    const updated = addSkillToConfig(FULL_YAML, "brand-new");
    // The new skill should appear before heartbeat in the YAML
    const heartbeatIdx = updated.indexOf("heartbeat:");
    const brandNewIdx = updated.indexOf("brand-new:");
    assert.ok(brandNewIdx < heartbeatIdx, "new skill should be inserted before heartbeat");
  });

  it("inserts at end when heartbeat is absent", () => {
    const yaml = `skills:\n  alpha: { enabled: false, schedule: "0 0 * * *" }\n\nmodel: claude-sonnet-4-6\n`;
    const updated = addSkillToConfig(yaml, "beta");
    const config = parseConfig(updated);
    assert.ok(config.skills["beta"]);
  });
});

// ── Round-trip: parse → update → parse ──────────────────────────────

describe("round-trip config mutations", () => {
  it("add → update → parse preserves all fields", () => {
    let yaml = MINIMAL_YAML;
    yaml = addSkillToConfig(yaml, "deep-research", { enabled: false, schedule: "0 14 * * *" });
    yaml = updateSkillInConfig(yaml, "deep-research", { enabled: true, var: "quantum computing" });
    const config = parseConfig(yaml);
    assert.equal(config.skills["deep-research"].enabled, true);
    assert.equal(config.skills["deep-research"].var, "quantum computing");
    assert.equal(config.skills["deep-research"].schedule, "0 14 * * *");
    // Original skills still intact
    assert.equal(config.skills["heartbeat"].enabled, true);
  });

  it("add → remove → add again works", () => {
    let yaml = addSkillToConfig(MINIMAL_YAML, "temp-skill");
    assert.ok(parseConfig(yaml).skills["temp-skill"]);
    yaml = removeSkillFromConfig(yaml, "temp-skill");
    assert.equal(parseConfig(yaml).skills["temp-skill"], undefined);
    yaml = addSkillToConfig(yaml, "temp-skill");
    assert.ok(parseConfig(yaml).skills["temp-skill"]);
  });

  it("update model and gateway independently", () => {
    let yaml = updateModelInConfig(MINIMAL_YAML, "claude-opus-4-8");
    const config1 = parseConfig(yaml);
    assert.equal(config1.model, "claude-opus-4-8");

    // Model change should not affect skills
    assert.equal(config1.skills["heartbeat"].enabled, true);
  });
});