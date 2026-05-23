#!/usr/bin/env bash
set -euo pipefail
SIGNAL=$(cat .outputs/morning-macro.md)
./notify --signal "$SIGNAL"
