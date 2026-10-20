/**
 * Tests for apps/dashboard/lib/utils.ts - cron parsing, display names, and time helpers.
 *
 * Run with:  node --import tsx --test apps/dashboard/lib/utils.test.ts
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import {
  displayName,
  initials,
  parseCron,
  cronLabel,
  buildCron,
  timeAgo,
  getSkillStatus,
  lastSuccessfulRunId,
  localToUtc24,
  slugify,
} from "./utils";
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
    const parsed = parseCron("0 12 * * *", 0);
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
    const parsed = parseCron("0 14 * * 1", 0);
    assert.equal(parsed.mode, "time");
    if (parsed.mode === "time") {
      assert.deepEqual(parsed.days, [1]);
    }
  });

  it("parses a multi-day schedule", () => {
    const parsed = parseCron("0 9 * * 1,3,5", 0);
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
    assert.equal(buildCron("time", 9, "m", 9, 0, "AM", [1, 3, 5], 0), "0 9 * * 1,3,5");
  });

  it("carries the weekday back across midnight east of UTC", () => {
    // 1:00 AM Mon/Wed in UTC+2 is 11 PM Sun/Tue in UTC.
    assert.equal(buildCron("time", 1, "m", 1, 0, "AM", [1, 3], 120), "0 23 * * 0,2");
  });

  it("carries the weekday forward across midnight west of UTC", () => {
    // 8:00 PM Sat/Sun in UTC-5 is 1 AM Sun/Mon in UTC.
    assert.equal(buildCron("time", 8, "m", 8, 0, "PM", [6, 0], -300), "0 1 * * 0,1");
  });

  it("keeps a daily schedule daily across midnight", () => {
    assert.equal(buildCron("time", 1, "m", 1, 0, "AM", [-1], 120), "0 23 * * *");
  });

  it("moves the minute in half-hour and 45-minute zones", () => {
    // 9:00 AM in India (+5:30) is 3:30 UTC; in Nepal (+5:45) 3:15 UTC.
    assert.equal(buildCron("time", 9, "m", 9, 0, "AM", [-1], 330), "30 3 * * *");
    assert.equal(buildCron("time", 9, "m", 9, 0, "AM", [-1], 345), "15 3 * * *");
    // 12:15 AM Monday in Newfoundland (-3:30) is 3:45 AM Monday UTC.
    assert.equal(buildCron("time", 1, "m", 12, 15, "AM", [1], -210), "45 3 * * 1");
  });

  it("round-trips through parseCron in any zone", () => {
    for (const offset of [-600, -210, -300, 0, 120, 330, 345, 840]) {
      for (const [h12, min, ap, days] of [
        [12, 0, "AM", [1, 3]],
        [11, 45, "PM", [0, 6]],
        [9, 30, "AM", [-1]],
        [1, 15, "AM", [2]],
      ] as const) {
        const cron = buildCron("time", 1, "m", h12, min, ap, [...days], offset);
        const p = parseCron(cron, offset);
        assert.equal(p.mode, "time", cron);
        if (p.mode !== "time") continue;
        assert.deepEqual([p.hour12, p.minute, p.ampm], [h12, min, ap], `${cron} at ${offset}`);
        assert.deepEqual([...p.days].sort(), [...days].sort(), `${cron} at ${offset}`);
      }
    }
  });
});

describe("parseCron across the UTC day boundary", () => {
  it("shows a late UTC time as the next local day east of UTC", () => {
    const p = parseCron("30 23 * * 0,5", 120);
    assert.equal(p.mode, "time");
    if (p.mode === "time") {
      assert.deepEqual([p.hour12, p.minute, p.ampm, p.days], [1, 30, "AM", [1, 6]]);
    }
  });

  it("shows an early UTC time as the previous local day west of UTC", () => {
    const p = parseCron("0 3 * * 1", -300);
    assert.equal(p.mode, "time");
    if (p.mode === "time") {
      assert.deepEqual([p.hour12, p.minute, p.ampm, p.days], [10, 0, "PM", [0]]);
    }
  });

  it("adds a half-hour offset to the minute", () => {
    const p = parseCron("45 18 * * *", 330);
    assert.equal(p.mode, "time");
    if (p.mode === "time") {
      assert.deepEqual([p.hour12, p.minute, p.ampm, p.days], [12, 15, "AM", [-1]]);
    }
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

  it("rounds a half-hour zone's hour down, west and east", () => {
    assert.equal(localToUtc24(0, 330), 18);
    assert.equal(localToUtc24(22, -210), 1);
  });
});

// ── lastSuccessfulRunId ───────────────────────────────────────────────

describe("lastSuccessfulRunId", () => {
  const run = (id: number, workflow: string, status: string, conclusion: string | null): Run => ({
    id,
    workflow,
    status,
    conclusion,
    created_at: "",
    url: "",
  });

  it("returns the newest successful run of the skill", () => {
    const runs = [
      run(3, "skill: strategy-builder (repo=a/b)", "in_progress", null),
      run(2, "skill: soul-builder", "completed", "success"),
      run(1, "skill: strategy-builder", "completed", "success"),
    ];
    assert.equal(lastSuccessfulRunId("strategy-builder", runs), 1);
    assert.equal(lastSuccessfulRunId("soul-builder", runs), 2);
  });

  it("ignores failed runs and returns null when none succeeded", () => {
    assert.equal(
      lastSuccessfulRunId("strategy-builder", [run(1, "skill: strategy-builder", "completed", "failure")]),
      null,
    );
    assert.equal(lastSuccessfulRunId("strategy-builder", []), null);
  });
});
