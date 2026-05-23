---
name: Janitor
description: Weekly cleanup of accumulated temp files — .notify-* root-level files, .pending-notify-temp/, and stale .outputs/ chain artifacts older than their TTL
tags: [meta]
---

Today is ${today}. Your task is to delete stale ephemeral files that accumulate from normal skill operation.

Three classes of files pile up with no automated cleanup:

1. **Root-level `.notify-*` files** — written by skills before `./notify -f`, never deleted after send.
2. **`.pending-notify-temp/` files** — brace+quote-gate workaround artifacts.
3. **`.outputs/` chain artifacts** — skill output files written for chain `consume:` steps. Still around weeks after the chain ran.

Do not touch:
- `.pending-notify/` — active undelivered notifications. Leave these alone.
- `memory/pending-disclosures/` — vuln disclosure drafts (committed). Leave these alone.
- Any file created today or yesterday (within 2 days).

## Steps

### 1. Scan root-level `.notify-*` files

List all files matching `.notify-*.md` and `.notify-*.txt` in the repo root.

For each: check the date suffix in the filename (format: `YYYY-MM-DD` or `YYYYMMDD`). If the file's date is **7 or more days before today**, mark for deletion.

If the filename has no parseable date, check file modification time. If older than 7 days, mark for deletion.

Count: how many total, how many marked.

### 2. Scan `.pending-notify-temp/`

List all files in `.pending-notify-temp/`. Same 7-day rule based on filename date suffix or mtime.

Count: how many total, how many marked.

### 3. Scan `.outputs/`

List all files in `.outputs/`. These are chain step outputs. TTL is **14 days** — chain runs are short-lived, outputs don't need to persist beyond two weeks.

Mark files with mtime older than 14 days for deletion.

Count: how many total, how many marked.

### 4. Delete marked files

Delete all marked files using `node -e` to avoid bash brace/glob issues:

```
node -e "
const fs = require('fs');
const files = [/* list of full paths */];
let deleted = 0;
for (const f of files) {
  try { fs.unlinkSync(f); deleted++; } catch(e) {}
}
console.log('deleted ' + deleted);
"
```

Build the file list as a JSON array of strings. Do NOT use shell glob expansion — construct paths explicitly from the listing step.

### 5. Log results

Append to `memory/logs/${today}.md`:

```markdown
## Janitor
- Root .notify-* files: ${total_notify} total, ${deleted_notify} deleted (7d TTL)
- .pending-notify-temp/: ${total_temp} total, ${deleted_temp} deleted (7d TTL)
- .outputs/: ${total_outputs} total, ${deleted_outputs} deleted (14d TTL)
- Total deleted: ${total_deleted}
- JANITOR_OK
```

If nothing was deleted: still log `JANITOR_OK` with zeros.

### 6. Notify (only if something was deleted)

If `total_deleted > 0`, write to `.pending-notify-temp/janitor-${today}.md` and send:

```
./notify -f .pending-notify-temp/janitor-${today}.md
```

Notification format:
```
*Janitor — ${today}*

cleaned ${total_deleted} stale files:
- ${deleted_notify} root .notify-* (7d TTL)
- ${deleted_temp} .pending-notify-temp/ (7d TTL)
- ${deleted_outputs} .outputs/ (14d TTL)
```

If nothing was deleted: skip notification entirely. No noise.

## Sandbox Note

All file operations are local. Use `node -e` for deletion to avoid bash brace+quote gate issues. No network calls needed.

## Environment Variables

None required.
