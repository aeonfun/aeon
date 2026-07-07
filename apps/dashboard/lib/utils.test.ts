/**
 * Tests for apps/dashboard/lib/utils.ts - cron parsing, display names, and time helpers.
 *
 * Run with:  node --import tsx --test apps/dashboard/lib/utils.test.ts
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { displayName, initials, parseCron, cronLabel, buildCron, timeAgo, getSkillStatus, localToUtc24, slugify } from "./utils";
import type { Run } from "./types";

// ── displayName ──────────────────────────────────────────────────────

describe("displayName", () => {
  it("title-cases hyphenated slugs", () => {
    assert.equal(displayName("deep-research"), "Deep Research");
    assert.equal(displayName("market-pulse"), "Market Pulse");
  });

  it("handles special abbreviations", () => {
    assert.equal(displayName("pr-review"), "PR Review");
    // hn/lp/pvr are upper-cased abbreviations; bare words are title-cased
    assert.equal(displayName("hn-digest"), "HN Digest");
    assert.equal(displayName("lp-lock"), "LP Lock");
    assert.equal(displayName("pvr-triage"), "PVR Triage");
  });

  it("handles single-word slugs", () => {
    assert.equal(displayName("heartbeat"), "Heartbeat");
  });

  it("handles defi special case", () => {
    assert.equal(displayName("defi-monitor"), "DeFi Monitor");
  });

  it("handles x special case", () => {
    assert.equal(displayName("x-monitor"), "X Monitor");
  });

  it("handles rss special case", () => {
    assert.equal(displayName("rss-digest"), "RSS Digest");
  });
});

// ── initials ──────────────────────────────────────────────────────────

describe("initials", () => {
  it("takes first letter of each word", () => {
    assert.equal(initials("deep-research"), "DR");
    assert.equal(initials("market-pulse"), "MP");
  });

  it("handles single words by returning first two chars", () => {
    assert.equal(initials("heartbeat"), "HE");
  });

  it("is case insensitive for output", () => {
    // initials returns uppercase regardless of input
    assert.equal(initials("test-skill"), "TS");
  });
});

// ── slugify ───────────────────────────────────────────────────────────

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    assert.equal(slugify("Fleet Scorecard"), "fleet-scorecard");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    assert.equal(slugify("a  --  b__c"), "a-b-c");
  });

  it("trims leading and trailing hyphens", () => {
    assert.equal(slugify("  Hello! "), "hello");
    assert.equal(slugify("--x--"), "x");
  });

  it("returns empty string for input with no alphanumerics", () => {
    assert.equal(slugify("!!!"), "");
    assert.equal(slugify(""), "");
  });
});

// ── parseCron ─────────────────────────────────────────────────────────

describe("parseCron", () => {
  it("parses a daily cron schedule", () => {
    const parsed = parseCron("0 12 * * *");
    assert.equal(parsed.mode, "time");
    if (parsed.mode === "time") {
      assert.equal(parsed.minute, 0);
      // hour is in local time so we just verify mode
      assert.ok(parsed.hour12 >= 1 && parsed.hour12 <= 12);
    }
  });

  it("parses an interval schedule (every N minutes)", () => {
    const parsed = parseCron("*/5 * * * *");
    assert.equal(parsed.mode, "interval");
    if (parsed.mode === "interval") {
      assert.equal(parsed.value, 5);
      assert.equal(parsed.unit, "m");
    }
  });

  it("parses an interval schedule (every N hours)", () => {
    const parsed = parseCron("0 */3 * * *");
    assert.equal(parsed.mode, "interval");
    if (parsed.mode === "interval") {
      assert.equal(parsed.value, 3);
      assert.equal(parsed.unit, "h");
    }
  });

  it("parses a weekly schedule with days", () => {
    const parsed = parseCron("0 14 * * 1");
    assert.equal(parsed.mode, "time");
    if (parsed.mode === "time") {
      assert.deepEqual(parsed.days, [1]);
    }
  });

  it("parses a multi-day schedule", () => {
    const parsed = parseCron("0 9 * * 1,3,5");
    assert.equal(parsed.mode, "time");
    if (parsed.mode === "time") {
      assert.deepEqual(parsed.days, [1, 3, 5]);
    }
  });

  it("handles wildcard hour as interval", () => {
    const parsed = parseCron("* * * * *");
    assert.equal(parsed.mode, "interval");
    if (parsed.mode === "interval") {
      assert.equal(parsed.value, 1);
      assert.equal(parsed.unit, "h");
    }
  });

  it("does not crash on non-cron schedules like workflow_dispatch", () => {
    assert.doesNotThrow(() => parseCron("workflow_dispatch"));
    const parsed = parseCron("workflow_dispatch");
    assert.equal(parsed.mode, "time");
  });

  it("does not crash on an empty schedule", () => {
    assert.doesNotThrow(() => parseCron(""));
  });
});

// ── cronLabel ─────────────────────────────────────────────────────────

describe("cronLabel", () => {
  it("labels workflow_dispatch as on demand", () => {
    assert.equal(cronLabel("workflow_dispatch"), "On demand");
  });

  it("labels minute intervals", () => {
    assert.equal(cronLabel("*/30 * * * *"), "Every 30m");
  });

  it("labels hour intervals", () => {
    assert.equal(cronLabel("0 */6 * * *"), "Every 6h");
  });

  it("labels daily schedules with time", () => {
    // The exact time label depends on the system timezone.
    // Just verify it contains "daily" or a time.
    const label = cronLabel("0 12 * * *");
    assert.ok(label.includes("daily") || label.includes(":") || label.includes("12"));
  });
});

// ── buildCron ─────────────────────────────────────────────────────────

describe("buildCron", () => {
  it("builds a minute-interval cron", () => {
    assert.equal(buildCron("interval", 5, "m", 12, 0, "AM", [-1]), "*/5 * * * *");
  });

  it("builds an hour-interval cron", () => {
    assert.equal(buildCron("interval", 3, "h", 12, 0, "AM", [-1]), "0 */3 * * *");
  });

  it("builds a daily cron with specific days", () => {
    const cron = buildCron("time", 9, "m", 9, 0, "AM", [1, 3, 5]);
    // 9 AM local - we just verify the cron structure
    assert.ok(cron.includes("*"));
    assert.ok(cron.includes("1,3,5"));
  });
});

// ── timeAgo ───────────────────────────────────────────────────────────

describe("timeAgo", () => {
  it("shows seconds ago for recent dates", () => {
    const now = new Date().toISOString();
    assert.equal(timeAgo(now), "just now");
  });

  it("shows minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    assert.equal(timeAgo(fiveMinAgo), "5m ago");
  });

  it("shows hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    assert.equal(timeAgo(twoHoursAgo), "2h ago");
  });

  it("shows days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(timeAgo(threeDaysAgo), "3d ago");
  });

  it("returns empty string for unparseable timestamps (no 'NaNd ago')", () => {
    // The filename time format (hyphens, not colons) is not a valid Date input.
    assert.equal(timeAgo("2026-06-12T14-30-00Z"), "");
    assert.equal(timeAgo(""), "");
  });
});

// ── getSkillStatus ────────────────────────────────────────────────────

describe("getSkillStatus", () => {
  const makeRun = (conclusion: string | null, status: string, workflow: string): Run => ({
    id: 1,
    workflow,
    status,
    conclusion,
    created_at: new Date().toISOString(),
    url: "",
  });

  it("returns Working for in-progress run", () => {
    const result = getSkillStatus("test", true, [makeRun(null, "in_progress", "skill: test")]);
    assert.equal(result.label, "Working");
    assert.equal(result.color, "orange");
  });

  it("returns Error for failed run", () => {
    const result = getSkillStatus("test", true, [makeRun("failure", "completed", "skill: test")]);
    assert.equal(result.label, "Error");
    assert.equal(result.color, "red");
  });

  it("returns Enabled for enabled skill with no matching runs", () => {
    const result = getSkillStatus("test", true, []);
    assert.equal(result.label, "Enabled");
    assert.equal(result.color, "green");
  });

  it("returns Disabled for disabled skill with no matching runs", () => {
    const result = getSkillStatus("test", false, []);
    assert.equal(result.label, "Disabled");
    assert.equal(result.color, "gray");
  });
});

// ── localToUtc24 ─────────────────────────────────────────────────────

describe("localToUtc24", () => {
  it("converts local midnight to UTC correctly", () => {
    // The result depends on the system timezone, so we just verify it's a valid hour 0-23
    const result = localToUtc24(0);
    assert.ok(result >= 0 && result <= 23);
  });

  it("converts local noon to UTC correctly", () => {
    const result = localToUtc24(12);
    assert.ok(result >= 0 && result <= 23);
  });
});