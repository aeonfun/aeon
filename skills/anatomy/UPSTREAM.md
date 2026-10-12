# upstream provenance

This skill is vendored from [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy).

- pinned commit: `689dcf966e63d92be10a5d593c6e19e10acd4422`
- license: MIT (see `LICENSE`)
- upstream runtime: Node.js 20.10+ and Chrome or Chromium
- upstream validation: `evals/evals.json`, the example build scripts, geometry audits, and browser capture/drive scripts

## What Aeon changed

The remaining upstream files are kept byte-identical, except:

- `SKILL.md`: Aeon frontmatter (`metadata.title`, `category`, `var`, `capabilities`) and the `Aeon runtime integration` section at the top. That section overrides the upstream text below it on Aeon (headless runs, a Figure-scale size cap for the 50-minute job, building in a scratch copy, committing the figure under `output/anatomy/`, notify). The body from `# Anatomy` down is verbatim.
- `.gitignore`: one added line, `examples/**/*.html`, so a figure or example built in place is never committed by the run's `git add -A`.
- `UPSTREAM.md`: this file (Aeon only).

## Removed from the vendored copy

Dropped to keep the repo small and free of inert upstream project files. None of them is read by `SKILL.md`, `references/`, `kit/` or the build scripts.

| Removed | Why | Restore |
|---|---|---|
| `examples/*/*.html` (14 pages, about 10 MB: `arcade-cabinet`, `desk-computer`, `dial-indicator`, `raptor-engine`, `ripple-tank`, `turning-dial` incl. `turning-dial-verify-light.html` and `turning-stress-light.html`) | Generated output (`.gitattributes` marks them `linguist-generated`); rebuilt byte-identically from source | In a scratch copy: `node examples/<name>/build.mjs` and `--light`; `turning-dial` also `--light --verify` and `node examples/turning-dial/stress.mjs`. Or fetch them from upstream at the pinned commit |
| `.github/` (issue and PR templates, `workflows/ci.yml`, `assets/*.webp` README screenshots) | Upstream repo plumbing; a nested workflow never runs here | Upstream at the pinned commit, path `.github/` |
| `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md` | Upstream community files, not part of the skill | Upstream at the pinned commit |

To restore any of them: `git clone https://github.com/wheresryan22/anatomy && git -C anatomy checkout 689dcf966e63d92be10a5d593c6e19e10acd4422`, then copy the paths back. The upstream `README.md` and `CHANGELOG.md` are kept verbatim, so their links to `.github/assets/`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` and the committed example pages point at files that live only upstream.

## Known test gaps

- The upstream React fixture tests (`scripts/react-*.test.mjs`) need `typescript` and `esbuild`, which this repo does not install, so they fail here. No dependencies were added for them; Aeon runs use the framework-free path.
- `scripts/orbit-sampling.test.mjs` reads `examples/turning-dial/turning-dial-verify-light.html`; build it first with `node examples/turning-dial/build.mjs --light --verify`.
- Aeon CI runs `scripts/tests/test_anatomy_integration.sh`, which checks the integration (files, frontmatter, Aeon section, disabled by default, catalog entry, no committed example pages), not the upstream test suite.
