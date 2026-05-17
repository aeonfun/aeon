#!/usr/bin/env bash
set -euo pipefail
exec ./notify "$(cat .narrative-msg.txt)"
