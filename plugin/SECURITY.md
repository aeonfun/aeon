# Security Policy

This plugin is a self-contained copy of the Aeon operator-console skill. It ships
Markdown instructions plus one local helper script (`skills/aeon/scripts/mine-history.mjs`),
and drives your Aeon instance through the authenticated GitHub CLI (`gh`). It bundles
no credentials and no telemetry - secrets stay in your own GitHub instance.

From 0.2.0 the plugin also points at Aeon Connect's hosted MCP server,
`https://www.aeon.fun/connect/mcp`, which uses OAuth with GitHub sign-in. That server
reaches only the repos you allow. It can list the names of missing keys, but it never
reads or writes secret values.

## Reporting a vulnerability

Report security issues against the upstream repository rather than here:

- Full policy: https://github.com/aeonfun/aeon/security/policy
- Private report: https://github.com/aeonfun/aeon/security/advisories/new

Please do not open a public issue for a suspected vulnerability. We aim to
acknowledge reports within a few days.

## Scope notes

- `skills/aeon/scripts/mine-history.mjs` reads the operator's own local coding-agent
  transcript files (read-only, on the machine that runs it) to suggest new skills. It
  performs no network exfiltration.
- The `skills/aeon/references/*` files are documentation. Where they show tokens they
  use `${VAR}` placeholders and secret *names*, never real credentials.
