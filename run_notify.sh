#!/usr/bin/env bash
set -euo pipefail
MSG=$(cat .outputs/token-call.md)
./notify --signal "$MSG"
