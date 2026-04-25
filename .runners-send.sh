#!/usr/bin/env bash
set -euo pipefail
cd /home/runner/work/aeon/aeon
MSG=$(cat /home/runner/work/aeon/aeon/.runners-msg.txt)
./notify "$MSG"
