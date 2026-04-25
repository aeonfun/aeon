#!/usr/bin/env bash
set -euo pipefail
MSG=$(cat /home/runner/work/aeon/aeon/.outputs/notify_msg.txt)
cd /home/runner/work/aeon/aeon
./notify "$MSG"
