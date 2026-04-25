#!/usr/bin/env bash
set -euo pipefail
MSG=$(cat .outputs/defi-overview.md)
./notify "$MSG"
