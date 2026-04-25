#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
MSG=$(cat .token-movers-tmp/message.md)
exec ./notify "$MSG"
