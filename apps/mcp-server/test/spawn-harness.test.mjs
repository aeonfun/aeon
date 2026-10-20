// spawnHarness runs the harness in its own process group and kills the group on
// timeout. Killing only bash left a child it started holding the stdout pipe, so
// `close` waited for that child and the timeout never returned. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HARNESS_TIMEOUT_MS, RUN_TIMEOUT_SECONDS, spawnHarness } from "../dist/skill-executor.js";

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// A SIGKILLed child stays visible to kill(pid, 0) until it is reaped, and once
// bash is gone that is up to init, so give it a moment instead of checking once.
async function gone(pid, ms = 2_000) {
  const end = Date.now() + ms;
  while (alive(pid)) {
    if (Date.now() > end) return false;
    await new Promise(r => setTimeout(r, 50));
  }
  return true;
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
    assert.equal(await gone(pid), true, "the harness's own child should be killed with it");
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

// run-harness's timeout(1) puts the CLI in a process group spawnHarness cannot
// kill, so the Node timer must leave `timeout` its TERM and its -k
// grace first; it is only the backstop where timeout(1) is missing.
test("the node timer fires after run-harness's own timeout and kill grace", () => {
  const rh = readFileSync(new URL("../../../harness-adapter/run-harness", import.meta.url), "utf-8");
  const killAfter = Number(/RH_KILL_AFTER:-(\d+)/.exec(rh)[1]);
  assert.ok(
    HARNESS_TIMEOUT_MS > (RUN_TIMEOUT_SECONDS + killAfter) * 1000,
    `${HARNESS_TIMEOUT_MS}ms must exceed ${RUN_TIMEOUT_SECONDS}s + ${killAfter}s`,
  );
});
