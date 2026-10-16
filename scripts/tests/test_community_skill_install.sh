#!/usr/bin/env bash
# Unit tests for community skill installation:
#   bin/add-skill              — provenance lookup must use GET so GitHub's
#                                commits endpoint returns a real object name
#   bin/generate-packs-json   — a skills.lock skill must reach the "installed"
#                               pack even when its SKILL.md carries no category
#   bin/generate-skills-json  — a YAML block-scalar description must be folded,
#                               not recorded as the literal ">-" marker
#   skill_add_to_aeon_yml     - a pack schedule the scheduler cannot fire
#                               ("daily") is rewritten to 5 cron fields
# No network, no GitHub auth required. Builds throwaway repo roots under /tmp.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
ROOT="$PWD"

fail=0
pass(){ echo "ok   - $1"; }
bad(){ echo "FAIL - $1"; fail=1; }

# ── Helper: a minimal Aeon repo root that the two generators can run against ──
# Copies in the real scripts so the test exercises shipped code, not a copy.
make_root() {
  local d
  d=$(mktemp -d)
  mkdir -p "$d/bin" "$d/catalog" "$d/skills"
  cp "$ROOT/bin/generate-skills-json" "$ROOT/bin/generate-packs-json" "$d/bin/"
  cat > "$d/catalog/packs.config.json" <<'EOF'
{"version":"1.0","packs":[
  {"key":"crypto","name":"Crypto","description":"c","color":"#000","category":"crypto"}
]}
EOF
  printf '%s\n' "$d"
}

# Usage: write_skill <root> <slug> <frontmatter-body>
write_skill() {
  local root="$1" slug="$2" body="$3"
  mkdir -p "$root/skills/$slug"
  { echo "---"; printf '%s\n' "$body"; echo "---"; echo; echo "# $slug"; } \
    > "$root/skills/$slug/SKILL.md"
}

# ── 1. Block-scalar description is folded, not left as the marker ────────────
d=$(make_root)
write_skill "$d" "folded" 'type: Skill
name: Folded
category: crypto
description: >-
  First line of the description
  and its continuation.'
write_skill "$d" "plain" 'type: Skill
name: Plain
category: crypto
description: A single-line description.'
(cd "$d" && bin/generate-skills-json >/dev/null 2>&1)
desc=$(jq -r '.skills[] | select(.slug=="folded") | .description' "$d/catalog/skills.json")
if [[ "$desc" == "First line of the description and its continuation." ]]; then
  pass "block-scalar description folded into one line"
else
  bad "block-scalar description folded into one line (got: '$desc')"
fi
desc=$(jq -r '.skills[] | select(.slug=="plain") | .description' "$d/catalog/skills.json")
if [[ "$desc" == "A single-line description." ]]; then
  pass "single-line description unchanged"
else
  bad "single-line description unchanged (got: '$desc')"
fi
rm -rf "$d"

# ── 2. A lock-installed skill with no category lands in "installed" ──────────
# Community SKILL.md files are written to their author's conventions and often
# carry no `category:`. Before the fix the catch-all check ran first and aborted
# the whole catalog for a skill that was never going to join a first-party pack.
d=$(make_root)
write_skill "$d" "native" 'type: Skill
name: Native
category: crypto
description: A first-party skill.'
write_skill "$d" "from-pack" 'name: From Pack
description: A community skill with no category.'
cat > "$d/skills.lock" <<'EOF'
[{"skill_name":"from-pack","source_repo":"someone/their-pack","source_path":"skills/from-pack/SKILL.md","branch":"main","commit_sha":"unknown","imported_at":"2026-01-01T00:00:00Z","pack":"their-pack"}]
EOF
(cd "$d" && bin/generate-skills-json >/dev/null 2>&1)
out=$(cd "$d" && bin/generate-packs-json 2>&1)
rc=$?
if [[ $rc -eq 0 ]]; then
  pass "generate-packs-json succeeds with an uncategorised installed skill"
else
  bad "generate-packs-json succeeds with an uncategorised installed skill (exit $rc: $out)"
fi
if [[ -f "$d/catalog/packs.json" ]]; then
  key=$(jq -r '.packs[] | select(.skills[]?.slug=="from-pack") | .key' "$d/catalog/packs.json")
  [[ "$key" == "installed" ]] && pass "uncategorised installed skill lands in the 'installed' pack" \
    || bad "uncategorised installed skill lands in the 'installed' pack (got: '$key')"
  key=$(jq -r '.packs[] | select(.skills[]?.slug=="native") | .key' "$d/catalog/packs.json")
  [[ "$key" == "crypto" ]] && pass "first-party skill still claimed by its category pack" \
    || bad "first-party skill still claimed by its category pack (got: '$key')"
else
  # The exit-0 assertion above means packs.json must exist; without this else a
  # regression that stopped producing it would skip both checks and report green.
  bad "generate-packs-json exited 0 but produced no catalog/packs.json"
fi
rm -rf "$d"

# ── 3. An uncategorised skill that is NOT installed is still a hard error ─────
# The category gate must keep biting for skills authored in this repo.
d=$(make_root)
write_skill "$d" "sloppy" 'name: Sloppy
description: A local skill missing its category.'
(cd "$d" && bin/generate-skills-json >/dev/null 2>&1)
out=$(cd "$d" && bin/generate-packs-json 2>&1)
if [[ $? -ne 0 ]] && [[ "$out" == *"not assigned to any pack"* ]]; then
  pass "uncategorised local skill still fails the catalog build"
else
  bad "uncategorised local skill still fails the catalog build (got: $out)"
fi
rm -rf "$d"

# ── 4. add-skill records the source commit returned by GitHub ────────────────
# `gh api` changes to POST when a field is supplied unless the method is pinned.
# GitHub has no POST /repos/{owner}/{repo}/commits endpoint, so the old command
# failed and every imported skill was recorded with commit_sha "unknown".
d=$(mktemp -d)
mkdir -p "$d/bin" "$d/scripts/lib" "$d/skills/security" "$d/fakebin" \
  "$d/fixture/pack-main/skills/demo" "$d/fixture/pack-main/scripts"
cp "$ROOT/bin/add-skill" "$d/bin/"
cp "$ROOT/scripts/lib/skill-install.sh" "$d/scripts/lib/"
cat > "$d/fixture/pack-main/skills/demo/SKILL.md" <<'EOF'
---
name: demo
description: Installer provenance fixture.
---
EOF
printf '%s\n' '---' 'name: scripts' 'description: Not a skill name.' '---' \
  > "$d/fixture/pack-main/scripts/SKILL.md"
tar -czf "$d/fixture/repo.tar.gz" -C "$d/fixture" pack-main
cat > "$d/fakebin/curl" <<'EOF'
#!/usr/bin/env bash
set -eu
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-o" ]]; then out="$2"; shift 2; else shift; fi
done
cp "$FIXTURE_TARBALL" "$out"
EOF
cat > "$d/fakebin/gh" <<'EOF'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" > "$GH_ARGS_LOG"
case " $* " in
  *" -X GET "*) printf '%s\n' "$GH_SHA" ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$d/fakebin/curl" "$d/fakebin/gh"
printf '%s\n' "example/pack" > "$d/skills/security/trusted-sources.txt"
printf '%s\n' "skills:" "  # --- Fallback" > "$d/aeon.yml"
sha="0123456789abcdef0123456789abcdef01234567"
out=$(cd "$d" && PATH="$d/fakebin:$PATH" FIXTURE_TARBALL="$d/fixture/repo.tar.gz" \
  GH_ARGS_LOG="$d/gh-args" GH_SHA="$sha" bin/add-skill example/pack demo 2>&1)
rc=$?
if [[ $rc -eq 0 ]]; then
  pass "add-skill fixture installs successfully"
else
  bad "add-skill fixture installs successfully (exit $rc: $out)"
fi
recorded=$(jq -r '.[0].commit_sha' "$d/skills.lock" 2>/dev/null)
if [[ "$recorded" == "$sha" ]]; then
  pass "add-skill records the source commit sha"
else
  bad "add-skill records the source commit sha (got: '$recorded')"
fi
if grep -q -- '-X GET repos/example/pack/commits -f path=skills/demo/SKILL.md -f sha=main -f per_page=1' "$d/gh-args"; then
  pass "add-skill queries the commits endpoint with GET and the fetched ref"
else
  bad "add-skill queries the commits endpoint with GET and the fetched ref (got: '$(cat "$d/gh-args")')"
fi
# A name that is not a plain slug must not reach the rm -rf/cp of the destination.
# Install the real skill first (above), then ask for a path outside skills/.
for bad_name in ../scripts ../../etc .. scripts/x 'a b'; do
  out=$(cd "$d" && PATH="$d/fakebin:$PATH" FIXTURE_TARBALL="$d/fixture/repo.tar.gz" \
    GH_ARGS_LOG="$d/gh-args" GH_SHA="$sha" bin/add-skill example/pack "$bad_name" 2>&1)
  if [[ -f "$d/scripts/lib/skill-install.sh" ]] && [[ "$out" == *"not a valid skill name"* ]]; then
    pass "add-skill refuses the name '$bad_name'"
  else
    bad "add-skill refuses the name '$bad_name' (got: $out)"
  fi
done
rm -rf "$d"

# ── 5. aeon.yml schedules are rewritten to something cron-due.sh can fire ────
# A pack skill declaring schedule "daily" used to be written verbatim; cron-due.sh
# needs 5 fields, so the skill silently never ran (aeonfun/aeon#1085).
(
  # shellcheck source=scripts/lib/skill-install.sh
  . "$ROOT/scripts/lib/skill-install.sh"
  d=$(mktemp -d)
  printf '%s\n' "skills:" "  # --- Fallback" > "$d/aeon.yml"
  log=$(
    skill_add_to_aeon_yml "$d/aeon.yml" alias-daily false "daily"
    skill_add_to_aeon_yml "$d/aeon.yml" alias-weekly false "@weekly"
    skill_add_to_aeon_yml "$d/aeon.yml" real-cron false "0 12 * * *"
    skill_add_to_aeon_yml "$d/aeon.yml" junk false "garbage"
    skill_add_to_aeon_yml "$d/aeon.yml" manual false "workflow_dispatch"
  )
  rc=0
  expect() {
    if grep -qxF "  $1: { enabled: false, schedule: \"$2\" }" "$d/aeon.yml"; then
      echo "ok   - $1 written with schedule \"$2\""
    else
      echo "FAIL - $1 should be written with schedule \"$2\" (aeon.yml: $(cat "$d/aeon.yml"))"; rc=1
    fi
  }
  expect alias-daily "0 0 * * *"
  expect alias-weekly "0 0 * * 0"
  expect real-cron "0 12 * * *"
  expect junk "0 12 * * *"
  expect manual "workflow_dispatch"
  warnings=$(grep -c 'warning: schedule' <<<"$log")
  if [[ "$warnings" == "3" ]]; then
    echo "ok   - one warning per rewritten schedule (daily, @weekly, garbage)"
  else
    echo "FAIL - expected 3 schedule warnings, got $warnings: $log"; rc=1
  fi
  # The rewritten "daily" must actually be due: 2026-01-01 00:05 UTC, never run.
  if bash "$ROOT/scripts/cron-due.sh" "0 0 * * *" 1767225900 0 >/dev/null; then
    echo "ok   - rewritten daily schedule is due for cron-due.sh"
  else
    echo "FAIL - rewritten daily schedule should be due for cron-due.sh"; rc=1
  fi
  rm -rf "$d"
  exit $rc
) || fail=1

echo ""
[[ $fail -eq 0 ]] && echo "All community skill install tests passed." || echo "Some tests FAILED."
exit $fail
