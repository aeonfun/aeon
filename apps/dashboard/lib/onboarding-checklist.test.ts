import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checklistComplete, type ChecklistState } from "../components/OnboardingChecklist";

const done: ChecklistState = {
  repo: "bob/aeon",
  actionsEnabled: true,
  harness: "claude",
  hasModelKey: true,
  skillsPicked: true,
  notificationsSet: true,
  firstRunDone: true,
};

describe("HQ setup checklist", () => {
  test("the model row counts once a credential is saved (no test run)", () => {
    assert.equal(checklistComplete(done), true);
    assert.equal(checklistComplete({ ...done, hasModelKey: false }), false);
  });

  test("every other row still has to be done", () => {
    assert.equal(checklistComplete({ ...done, actionsEnabled: false }), false);
    assert.equal(checklistComplete({ ...done, actionsEnabled: null }), true);
    assert.equal(checklistComplete({ ...done, skillsPicked: false }), false);
    assert.equal(checklistComplete({ ...done, notificationsSet: false }), false);
    assert.equal(checklistComplete({ ...done, firstRunDone: false }), false);
  });
});
