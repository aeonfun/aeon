// spawnHarness runs the harness in its own process group and kills the group on
// timeout. Killing only bash left a child it started holding the stdout pipe, so
// `close` waited for that child and the timeout never returned. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnHarness } from "../dist/skill-executor.js";

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test("a timeout kills the harness and every process it started", { timeout: 10_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "aeon-mcp-spawn-"));
  try {
    const pidFile = join(dir, "pid");
    const started = Date.now();
    const result = await spawnHarness(["-c", `sleep 30 & echo $! > "${pidFile}"; wait`], {
      input: "",
      cwd: dir,
      env: process.env,
      timeout: 500,
      maxBuffer: 1024,
    });
    assert.equal(result.error?.code, "ETIMEDOUT");
    assert.ok(Date.now() - started < 5_000, "spawnHarness should return soon after the timeout");
    const pid = Number(readFileSync(pidFile, "utf-8").trim());
    assert.ok(pid > 0);
    assert.equal(alive(pid), false, "the harness's own child should be killed with it");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a run inside the timeout returns its output", async () => {
  const result = await spawnHarness(["-c", "cat; echo done >&2"], {
    input: "hello",
    cwd: tmpdir(),
    env: process.env,
    timeout: 5_000,
    maxBuffer: 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "hello");
  assert.equal(result.stderr, "done\n");
});
