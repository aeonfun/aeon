#!/usr/bin/env bash
set -euo pipefail
./notify --signal "$(cat .outputs/perps-brief.md)"
