# Changelog

All notable changes to Aeon are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Aeon is a fork-and-configure template, so releases mark a stable point to fork
from or pin to; the template keeps serving latest `main` to new forks.

## [Unreleased]

## [0.1.0] - 2026-07-09

First tagged snapshot — a stable, fully documented point to fork from or pin to.
Pre-1.0: the architecture is settled and the core skill set is production-ready,
but interfaces may still shift before 1.0.

### Added

- **Skill system** — 60 core skills across 6 packs. Each is a self-contained
  `SKILL.md` prompt file with YAML frontmatter (schedule, capability mode,
  required keys, MCP servers); scheduled, chained, or fired by reactive triggers
  through `aeon.yml`.
- **Self-healing loop** — a health skill scores every run 1–5 and files issues on
  degradations; repair skills fix them by PR.
- **Capability modes** — `read-only` skills physically cannot mutate the repo;
  irreversible actions (email, deploy, on-chain transfer) run in-run and fail
  closed.
- **Multi-provider LLM gateway** — an 8-provider cascade
  (`claude → anthropic → openrouter → bankr → usepod → venice → surplus → grok`)
  resolved by priority, plus an optional Grok build harness.
- **Memory & knowledge** — a native OKF knowledge bundle in-place, with
  `memory/topics/` living knowledge, daily logs, and a structured issue tracker.
- **Interfaces** — a local dashboard (config → GitHub secrets/vars), a headless
  CLI, an MCP server exposing skills as Claude tools, a Telegram webhook for ~1s
  interactive control, and multi-channel `notify` (Telegram/Discord/Slack/email/feed).
- **Security** — external content treated as untrusted; secrets kept off the
  command line via `secretcurl` with `{ENV}` placeholders; every skill install is
  security-scanned.
- **Community** — a public template repo with 10 community skill packs listed in
  the registry, installable in one click.

[Unreleased]: https://github.com/aaronjmars/aeon/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aaronjmars/aeon/releases/tag/v0.1.0
