import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSchedule, scheduleError } from "./schedule";

describe("scheduleError", () => {
  it("accepts the schedules the scheduler runs", () => {
    for (const s of [
      "workflow_dispatch",
      "reactive",
      "0 9 * * *",
      "*/15 * * * *",
      "30 23 * * 0,5",
      "0 9-17/2 1,15 * 1-5",
      "0 9 * JAN-MAR MON-FRI",
      "0 9 * * sat-sun",
      "0 0 1 12 7",
    ]) {
      assert.equal(scheduleError(s), null, s);
    }
  });

  it("rejects what cron-due.sh treats as never due", () => {
    for (const s of [
      "",
      "cron expression",
      "0 9 * *",
      "0 9 * * * *",
      "60 9 * * *",
      "0 24 * * *",
      "0 9 0 * *",
      "0 9 * 13 *",
      "0 9 * * 8",
      "*/0 * * * *",
      "0 17-9 * * *",
      "0 9 * * 1\nfoo: bar",
    ]) {
      assert.notEqual(scheduleError(s), null, JSON.stringify(s));
    }
  });
});

describe("normalizeSchedule", () => {
  it("saves one canonical line, so no stray whitespace reaches aeon.yml", () => {
    assert.equal(normalizeSchedule("0  9 * * *"), "0 9 * * *");
    assert.equal(normalizeSchedule(" 0 9 * * 1\n"), "0 9 * * 1");
    assert.equal(normalizeSchedule("0\t9 * * *"), "0 9 * * *");
  });
});
