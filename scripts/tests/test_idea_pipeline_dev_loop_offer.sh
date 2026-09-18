#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SKILL="$ROOT/skills/idea-pipeline/SKILL.md"

grep -Fq -- '--context "dev-loop::ship"' "$SKILL"
grep -Fq -- '.permissions.push // false' "$SKILL"
grep -Fq 'FORCE_REPLY_OFFERED: dev-loop::ship target=' "$SKILL"
grep -Fq 'starts with `offer:`' "$SKILL"
grep -Fq 'explicit operator-invoked producer path' "$SKILL"
grep -Fq 'Describing or printing the command is not delivery' "$SKILL"
grep -Fq '${AEON_PENDING_DIR}/notify-queue/' "$SKILL"
grep -Fq 'FORCE_REPLY_MISSING: dev-loop::ship target=' "$SKILL"

# step 0's delivery check must verify the payload actually carries a live force-reply,
# not just that something got queued - notify.sh queues a payload with
# reply_markup:null when the inbound Messages workflow is disabled.
grep -Fq '.reply_markup.force_reply == true' "$SKILL"

# the pick: path must not try to infer a GitHub target from a backlog row - the row
# schema idea-forge actually writes has no such column, so that lookup can never match
# a real row. It must instead point the operator at the already-sound offer: path.
grep -Fq 'Do not try to infer a GitHub target from the row' "$SKILL"
grep -Fq 'reply with: offer:' "$SKILL"

if sed -n '/### 0\. Force-reply interception/,/### 1\. Load the idea backlog/p' "$SKILL" \
  | grep -Eq 'gh workflow run|dispatch_dev_loop'; then
  echo 'idea-pipeline pick handler must not dispatch the chain itself' >&2
  exit 1
fi

# the pick: path must not independently send its own force-reply prompt any more -
# offer: (checked above) already owns that, gated and delivery-verified.
if sed -n '/^Otherwise, if `\${var}` starts with `pick:`/,/^### 1\. Load the idea backlog/p' "$SKILL" \
  | grep -Fq -- '--force-reply'; then
  echo 'pick: must not send its own force-reply prompt - it should point to offer: instead' >&2
  exit 1
fi

echo 'idea-pipeline dev-loop offer contract tests passed'
