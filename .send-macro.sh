#!/usr/bin/env bash
set -euo pipefail
mkdir -p .pending-notify
exec ./notify --signal "$(cat .outputs/morning-macro.md)"
