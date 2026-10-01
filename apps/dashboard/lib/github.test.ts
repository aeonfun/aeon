/**
 * Tests for apps/dashboard/lib/github.ts's withFileLock - the in-process
 * per-path mutex serializing aeon.yml's read-modify-write-commit call sites
 * (skills PATCH/DELETE, upload, gateway.syncGatewayProvider/syncHarness).
 *
 * Run with:  node --import tsx --test apps/dashboard/lib/github.test.ts
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { withFileLock } from "./github";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("withFileLock", () => {
  it("serializes concurrent critical sections on the same path", async () => {
    const events: string[] = [];

    const a = withFileLock("aeon.yml", async () => {
      events.push("a-start");
      await sleep(20);
      events.push("a-end");
    });
    const b = withFileLock("aeon.yml", async () => {
      events.push("b-start");
      await sleep(5);
      events.push("b-end");
    });

    await Promise.all([a, b]);

    // Without the lock, b (shorter delay) would finish before a: [a-start,
    // b-start, b-end, a-end]. The lock must force b to wait for a entirely.
    assert.deepEqual(events, ["a-start", "a-end", "b-start", "b-end"]);
  });

  it("prevents a read-modify-write race from silently clobbering a field", async () => {
    // Simulates the real bug: two requests each read the same starting
    // "file", patch one field in memory, then overwrite the whole file.
    let file = { model: "claude-sonnet-5-5", harness: "pi" };

    async function patchModel(model: string) {
      return withFileLock("aeon.yml", async () => {
        const read = { ...file };
        await sleep(10); // model resolves fast
        file = { ...read, model }; // harness carried through from this call's own read
      });
    }
    async function patchHarness(harness: string) {
      return withFileLock("aeon.yml", async () => {
        const read = { ...file };
        await sleep(20); // harness resolves slower (e.g. OAuth device flow)
        file = { ...read, harness };
      });
    }

    // Fire harness first, model second - mirrors clicking the harness picker
    // then immediately the model picker.
    await Promise.all([patchHarness("fx"), patchModel("claude-opus-5-5")]);

    assert.equal(file.harness, "fx");
    assert.equal(file.model, "claude-opus-5-5");
  });

  it("does not serialize critical sections on different paths", async () => {
    const events: string[] = [];

    const a = withFileLock("aeon.yml", async () => {
      events.push("a-start");
      await sleep(20);
      events.push("a-end");
    });
    const b = withFileLock("soul/SOUL.md", async () => {
      events.push("b-start");
      await sleep(5);
      events.push("b-end");
    });

    await Promise.all([a, b]);

    assert.deepEqual(events, ["a-start", "b-start", "b-end", "a-end"]);
  });

  it("propagates a rejection to its own caller without poisoning later calls", async () => {
    await assert.rejects(
      withFileLock("aeon.yml", async () => {
        throw new Error("boom");
      }),
      /boom/,
    );

    const result = await withFileLock("aeon.yml", async () => "ok");
    assert.equal(result, "ok");
  });

  it("returns the callback's resolved value", async () => {
    const result = await withFileLock("aeon.yml", async () => ({ synced: true }));
    assert.deepEqual(result, { synced: true });
  });
});
