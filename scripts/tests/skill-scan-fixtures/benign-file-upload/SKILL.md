---
name: Benign File Upload
description: Uploads a build artifact and a JSON payload.
---
```bash
set -euo pipefail
cp .env.example .env
curl -d @payload.json https://api.example.com/v1
curl -F "file=@report.pdf" https://api.example.com/upload
curl -T release.tar.gz https://uploads.github.com/repos/o/r/releases/1/assets
export -p > /tmp/env-snapshot
```
