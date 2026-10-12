# anatomy verification — 2026-10-12

Baseline: `b6762e5` on `feat/anatomy-integration`.

## geometry

Command:

```sh
CHROME_PATH=/private/tmp/chrome-wrapper node skills/anatomy/scripts/lines.mjs \
  skills/anatomy/examples/dial-indicator/dial-indicator-light.html \
  --out /private/tmp/anatomy-dial-lines2.png --width 390 --height 800 \
  --scale 1 --theme light --reduced
```

Result: `line ends: 0 of 367 ends on 23 lines float`; the first number is the
problem count, so there were zero floating endpoints. The 23 is the number of
line paths inspected. Console was clean. The earlier wording was ambiguous;
this is a passing geometry check, not 23 defects.

The local capture and drive runs also produced:

- `/private/tmp/anatomy-dial.png` — light capture, clean console, no sideways scroll.
- `/private/tmp/anatomy-dial-interactive.png` — pointer drag and ArrowRight/ArrowLeft interaction.
- `/private/tmp/anatomy-dial-no-webgl.png` — SVG fallback with `--no-webgl`, clean console.

## integrity findings

The vendored upstream tree has nine high findings and zero critical findings in
Eyebrow 0.5.6. They are expected patterns, preserved in `eyebrowlock.json`:

- `.gitignore:5` and `.gitignore:6`, `SENSITIVE-PATH-READ`: ignore rules for `.env` and `.env.*`; these do not read or exfiltrate secrets.
- `SKILL.md:80`, `PROMPT-INJECTION`: ordinary user-facing workflow language (“build it without asking”), not an instruction to bypass a safety boundary.
- `kit/turn.mjs:428`, `kit/turn-fixed.mjs:463`, and the four generated turning-dial HTML files: `atob` decodes packed numeric geometry into typed arrays; the decoded bytes are not executed as code.

The 34 medium findings are also scanner evidence, not silently suppressed.
`skills/anatomy/SKILL.md` passes Aeon’s `scripts/skill-scan.sh` with zero warnings
or failures. The repository integrity policy fails only on new reach or critical
findings; this addition has no new egress and no critical finding.

## live harness attempt

Attempted through `scripts/dry-run.sh` with the existing Claude dispatcher and
OpenRouter-backed environment. The run reached the real harness but failed before
model execution:

`api_error_status: 429`, `usage_limit_reached`, weekly limit resets 2026-10-14
03:00 Africa/Lagos.

No generated model output was claimed or retained.

## repair-loop attempt

The existing repair path is `skill-repair` → `skill-health` / issue state →
model diagnosis → targeted patch → dry-run gate. A real repair experiment could
not start because the same live model provider is over its weekly limit. The
existing structural gate was exercised with:

```sh
bash scripts/dry-run.sh evaluate '{"exit":0,"output_len":42,"writes":["output/anatomy/latest.md"],"secrets_seen":[],"mode":"read-only","requires":[]}'
```

which returned `{"passed":true,"reasons":[]}`. No repair code was changed because
there is no reproduced integration defect; the blocker is provider quota.

## follow-up validation — 2026-10-12

The catalog was regenerated after the initial integration commit. The Anatomy
entry now reports `files: 137`, `sha: b6762e5`, and `updated: 2026-10-12`.
`bash scripts/tests/test_anatomy_integration.sh` and JSON parsing of
`catalog/skills.json` both pass.

Local generation and browser evidence:

- `node skills/anatomy/examples/dial-indicator/build.mjs --audit` passed and
  rebuilt both dark and light pages.
- `lines.mjs` on the light page reported `line ends: 0 of 367 ends on 23 lines
  float`; console clean.
- `capture.mjs` produced `/private/tmp/aeon-anatomy-capture.png` with clean
  console and no sideways scrolling.
- `drive.mjs` exercised ArrowRight/ArrowLeft, pointer move/click, screenshot,
  and line checks; it reported `line ends: 0` and a clean console.
- Native Chrome WebGL `turn-check.mjs --order --step 360` passed with one state,
  zero out-of-order live pairs, clean console, and the planted reversed-order
  control failing as expected.

The full upstream script suite, run from `skills/anatomy` with native Chrome,
produced 189 passes and 4 failures. The four failures are the React fixtures,
which stop at module loading because this vendored package has no declared
`typescript` or `esbuild` test dependency. No framework-free or WebGL audit
failure was observed in that run.

An attempted live anatomy generation through the Codex/OpenRouter path was
blocked before execution by the environment's external-model egress approval;
no model output or generated live artifact is claimed. The controlled repair
experiment therefore remains blocked after the local structural gate above.
