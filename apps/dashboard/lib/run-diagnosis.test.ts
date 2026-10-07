import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { diagnoseRun, extractRunOutput, parseUsage } from "./run-diagnosis";

// --- the real shape ----------------------------------------------------------------
// fixtures/skill-run.log is the structural skeleton of a real
// `gh run view --log` (gh 2.102, a claude subscription run with 22,584 tokens):
// every line says "UNKNOWN STEP" in the step column, script blocks are
// ##[group]Run ... ##[endgroup], and the Run step's output ends with
//   <harness stderr tail> / echo "$RESULT_TEXT" / ##[notice]Token usage ...
// Content lines are replaced with neutral text.
const REAL = readFileSync(join(__dirname, "fixtures", "skill-run.log"), "utf8");
const realLines = REAL.split("\n");
const noticeAt = realLines.findIndex(l => l.includes("##[notice]Token usage"));
const tsOf = (l: string) => l.split("\t")[2].split(" ")[0];
const at = (i: number, text: string) => `run\tUNKNOWN STEP\t${tsOf(realLines[i])} ${text}`;
// The real log with one Run-output line (right before the notice) swapped.
function realRun(text: string): string {
  const lines = [...realLines];
  lines[noticeAt - 1] = at(noticeAt - 1, text);
  return lines.join("\n");
}
// A run that died before the Run step (checkout failed): no usage notice.
const runHeaderAt = realLines.findIndex(l => l.includes("##[group]Run set -euo pipefail"));
const failedEarly = [...realLines.slice(0, 40), at(39, "##[error]The process git failed with exit code 128")].join(
  "\n",
);

// The workflow's notice text uses a long dash after "Token usage".
const LONG_DASH = String.fromCharCode(0x2014);

describe("run diagnosis on the real gh log shape (UNKNOWN STEP)", () => {
  it("the fixture has the real structure", () => {
    assert.ok(realLines.every(l => !l || l.split("\t")[1] === "UNKNOWN STEP"));
    assert.ok(runHeaderAt > 0 && noticeAt > runHeaderAt);
    assert.ok(
      realLines.some(l => l.includes("$INPUT_TOKENS")),
      "script echo of the notice template is kept",
    );
  });

  it("slices the Run output and reads its token usage", () => {
    const out = extractRunOutput(REAL);
    assert.equal(out.reachedModel, true);
    // total is the notice's own figure (input + output), as printed in the log.
    assert.deepEqual(parseUsage(out.run), {
      input: 2936,
      output: 19648,
      cacheRead: 3251450,
      cacheCreation: 58568,
      total: 22584,
    });
    assert.doesNotMatch(out.run, /INPUT_TOKENS|##\[group\]/);
  });

  it("a successful run has nothing to explain", () => {
    assert.equal(diagnoseRun({ conclusion: "success", log: REAL }), null);
    assert.equal(diagnoseRun({ conclusion: null, log: "" }), null);
  });

  it("a failed run reads the provider error from the Run output", () => {
    const d = diagnoseRun({ conclusion: "failure", log: realRun('Error: 401 {"type":"authentication_error"}') });
    assert.equal(d?.reason, "The provider rejected the credential.");
    assert.equal(d?.credential, true);
    assert.equal(d?.usage?.total, 22584);
  });

  it("a run that failed before the model call reads the error annotation", () => {
    const out = extractRunOutput(failedEarly);
    assert.equal(out.reachedModel, false);
    // No usage notice: the slice ends at the first ##[error] instead.
    assert.match(out.run, /##\[error\]The process git failed with exit code 128$/);
    assert.doesNotMatch(out.run, /##\[group\]/);
    assert.match(out.problems, /exit code 128/);
    const d = diagnoseRun({ conclusion: "failure", log: failedEarly });
    assert.equal(d?.reason, "The run failed.");
    assert.equal(d?.credential, false);
  });

  it("works on a logs zip without job/step columns too", () => {
    const zipText = REAL.split("\n")
      .map(l => l.split("\t").slice(2).join("\t"))
      .join("\n");
    assert.equal(parseUsage(extractRunOutput(zipText).run)?.input, 2936);
  });
});

// --- a real revoked Codex login ------------------------------------------------------
// Trimmed from aaronjmars/aeon-oneshot-test run 37131474562 (gh run view --log):
// the ChatGPT login was revoked, codex died before the usage notice, and the
// ##[error] annotation itself only says "unauthorized (401)". Request ids and
// cf-ray dropped; the gh shape (run / UNKNOWN STEP / timestamp) kept.
const REVOKED = [
  "##[group]Run set -euo pipefail",
  'echo "Using harness: $HARNESS  |  model: $BANNER_MODEL"',
  'echo "::notice::Token usage - model: ${EFFECTIVE_MODEL:-$BANNER_MODEL}, input: $INPUT_TOKENS, output: $OUTPUT_TOKENS"',
  "##[endgroup]",
  "Using harness: codex  |  model: gpt-6-luna",
  "Capability mode: read-only",
  "##[notice]effective model for codex: gpt-6-luna",
  "read-only: workspace write-locked via bwrap",
  "2026-10-03T14:57:33.388315Z ERROR codex_models_manager::manager: failed to refresh available models: unexpected status 401 Unauthorized: Encountered invalidated oauth token for user, failing request, url: https://chatgpt.com/backend-api/codex/models?client_version=0.159.3, auth error: 401, auth error code: token_revoked",
  '2026-10-03T14:57:33.515361Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 401: {\\n  \\"error\\": {\\n    \\"message\\": \\"Encountered invalidated oauth token for user, failing request\\",\\n    \\"code\\": \\"token_revoked\\"\\n  },\\n  \\"status\\": 401\\n}")',
  'codex exited 1: {"type":"turn.started"} {"type":"error","message":"Reconnecting... 2/5 (workspace routing discovery unauthorized (401))"} {"type":"turn.failed","error":{"message":"workspace routing discovery unauthorized (401)"}}',
  '##[error]run-harness codex failed: {"type":"error","message":"workspace routing discovery unauthorized (401)"} {"type":"turn.failed","error":{"message":"workspace routing discovery unauthorized (401)"}}',
  "##[error]Process completed with exit code 1.",
  '##[group]Run case "$HIDDEN" in',
  'case "$HIDDEN" in',
  "##[endgroup]",
]
  .map((text, i) => `run\tUNKNOWN STEP\t2026-10-03T14:57:${String(30 + i).padStart(2, "0")}.0000000Z ${text}`)
  .join("\n");

describe("a real revoked Codex login", () => {
  it("reads as an expired login on the codex harness, not a rejected key", () => {
    const out = extractRunOutput(REVOKED);
    assert.equal(out.reachedModel, false);
    assert.equal(out.harness, "codex");
    assert.match(out.run, /token_revoked/);
    assert.doesNotMatch(out.run, /BANNER_MODEL|HIDDEN/);
    const d = diagnoseRun({ conclusion: "failure", log: REVOKED });
    assert.equal(d?.reason, "The saved login expired.");
    assert.equal(d?.credential, true);
    assert.equal(d?.harness, "codex");
  });

  it("the 401 annotation alone still reads as a rejected credential", () => {
    const annotationOnly = REVOKED.split("\n")
      .filter(l => !/token_revoked|invalidated oauth/.test(l))
      .join("\n");
    assert.equal(
      diagnoseRun({ conclusion: "failure", log: annotationOnly })?.reason,
      "The provider rejected the credential.",
    );
  });
});

// --- named steps (fast path) and edge cases -----------------------------------------
const T = "2026-10-02T10:00:00.0000000Z ";
const line = (step: string, text: string) => `run\t${step}\t${T}${text}`;
// The Run script mentions rate_limited / api_error (the health scorer prompt)
// and echoes the usage notice and harness banner templates; none of it is output.
const SCRIPT = [
  line("Run", "##[group]Run set -euo pipefail"),
  line("Run", "Flag any issues from: api_error, empty_output, low_quality, rate_limited, unverifiable_claim"),
  line("Run", 'echo "::notice::Token usage - model: X, input: $INPUT_TOKENS, output: $OUTPUT_TOKENS"'),
  line("Run", "Using harness: claude"),
  line("Run", "##[endgroup]"),
];
const usageLine = (i: number, o: number, cr = 0, cc = 0) =>
  line(
    "Run",
    `##[notice]Token usage - model: claude-sonnet-5-5, input: ${i}, output: ${o}, cache_read: ${cr}, cache_creation: ${cc}, total: ${i + o}`,
  );
const runLog = (...out: string[]) =>
  [
    line("Set up job", "Current runner version"),
    ...SCRIPT,
    ...out,
    line("Post Run", "##[group]Run cleanup"),
    line("Post Run", "rate_limited 429"),
    line("Post Run", "##[endgroup]"),
  ].join("\n");
const failed = (log: string) => diagnoseRun({ conclusion: "failure", log });

describe("run log slicing", () => {
  it("keeps only the Run step output plus error/warning annotations", () => {
    const out = extractRunOutput(
      runLog(
        line("Run", "model said hi"),
        usageLine(1, 1),
        line("Resolve harness", "##[error]grok harness needs auth"),
      ),
    );
    assert.match(out.run, /^model said hi\n##\[notice\]Token usage/);
    assert.equal(out.problems, "##[error]grok harness needs auth");
    assert.doesNotMatch(out.run, /rate_limited|INPUT_TOKENS/);
  });

  it("reads the token usage notice (last one wins), in either log form", () => {
    assert.deepEqual(parseUsage(extractRunOutput(runLog(usageLine(12, 3, 100, 5))).run), {
      input: 12,
      output: 3,
      cacheRead: 100,
      cacheCreation: 5,
      total: 15,
    });
    const raw = `::notice::Token usage ${LONG_DASH} model: x, input: 7, output: 1, cache_read: 0, cache_creation: 0, total: 8`;
    assert.equal(parseUsage(raw)?.total, 8);
    assert.equal(parseUsage(`${usageLine(1, 1)}\n${usageLine(0, 0)}`)?.total, 0);
    // No total field: fall back to input + output.
    assert.equal(parseUsage("##[notice]Token usage - input: 4, output: 6, cache_read: 900")?.total, 10);
    assert.equal(parseUsage("nothing here"), null);
  });

  it("reads the harness from the Run banner, never from a script block", () => {
    assert.equal(
      extractRunOutput(runLog(line("Run", "Using harness: codex  |  model: gpt-5"), usageLine(1, 1))).harness,
      "codex",
    );
    assert.equal(extractRunOutput(runLog(usageLine(1, 1))).harness, null);
    assert.equal(
      failed(runLog(line("Run", "Using harness: pi  |  model: x"), line("Run", "##[error]401 unauthorized")))?.harness,
      "pi",
    );
  });

  it("reads the real banner line from a gh log, and falls back to the effective model notice", () => {
    // As printed by aeon.yml's Run step (echo "Using harness: $HARNESS  |  model: $BANNER_MODEL").
    const banner = "run\tUNKNOWN STEP\t2026-10-03T08:14:02.5512345Z Using harness: kimi  |  model: kimi-k2.5";
    const effective = (h: string) =>
      `run\tUNKNOWN STEP\t2026-10-03T08:15:40.1234567Z ##[notice]effective model for ${h}: some-model`;
    const tail =
      "run\tUNKNOWN STEP\t2026-10-03T08:15:41.0000000Z ##[notice]Token usage - input: 0, output: 0, total: 0";
    assert.equal(extractRunOutput([banner, effective("cursor"), tail].join("\n")).harness, "kimi");
    // No banner: the notice names the harness.
    assert.equal(extractRunOutput([effective("codex"), tail].join("\n")).harness, "codex");
    // The notice's script echo ($HARNESS) never counts.
    const echoed = ["##[group]Run x", 'echo "::notice::effective model for $HARNESS: $M"', "##[endgroup]"].map(t =>
      line("Run", t),
    );
    assert.equal(extractRunOutput(runLog(...echoed, usageLine(1, 1))).harness, null);
  });
});

describe("failed-run diagnosis", () => {
  it("does not read the workflow script as a failure", () => {
    const d = failed(runLog(usageLine(0, 0)));
    assert.equal(d?.reason, "The run failed.");
    assert.doesNotMatch(`${d?.reason} ${d?.hint}`, /rate/i);
  });

  it("maps real failure output to a plain reason and a concrete next step", () => {
    const cases: [string, RegExp, boolean][] = [
      [line("Run", '##[error]run-harness claude failed: 401 {"type":"authentication_error"}'), /fresh key/, true],
      [
        line("Run", "##[error]codex: 401 refresh failed: invalid_grant"),
        /Log in again and connect the new login/,
        true,
      ],
      [line("Run", "##[error]OAuth token has expired"), /Log in again/, true],
      [line("Run", "##[error]insufficient_quota: You exceeded your current quota"), /Top up/, true],
      [line("Run", "##[error]HTTP 429 rate limit"), /Wait a minute/, false],
      [line("Run", "##[error]model_not_found: the model does not exist"), /another model/, false],
      [
        line("Resolve harness", "##[error]grok harness needs auth: set GROK_CREDENTIALS"),
        /saved under the right name/,
        true,
      ],
    ];
    for (const [l, hint, credential] of cases) {
      const d = failed(runLog(l));
      assert.match(d?.hint ?? "", hint, l);
      assert.equal(d?.credential, credential, l);
      assert.doesNotMatch(`${d?.reason} ${d?.hint}`, /test/i, l);
    }
    // Plain (non-annotation) output only counts inside the sliced Run output.
    assert.match(failed(runLog(line("Run", "Error: 401 unauthorized"), usageLine(0, 0)))?.hint ?? "", /fresh key/);
    assert.match(failed(runLog(line("Run", "boom")))?.hint ?? "", /run log/);
  });

  it("explains cancelled and timed-out runs", () => {
    assert.match(diagnoseRun({ conclusion: "cancelled", log: "" })?.reason ?? "", /cancelled/);
    assert.match(diagnoseRun({ conclusion: "timed_out", log: "" })?.reason ?? "", /time limit/);
    assert.equal(diagnoseRun({ conclusion: "skipped", log: "" }), null);
  });
});
