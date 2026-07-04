#!/usr/bin/env bash
# Unit test for scripts/validate-pack.sh — duplicate-slug detection and clean-pack pass.
# No network, no GitHub auth required. Creates throwaway pack dirs under /tmp.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

V="scripts/validate-pack.sh"
fail=0
pass(){ echo "ok   - $1"; }
bad(){ echo "FAIL - $1"; fail=1; }

# ── Setup: a minimal pack with two skills ────────────────────────────────────
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/skills/foo" "$TMP/skills/bar"
cat > "$TMP/skills/foo/SKILL.md" <<'EOF'
---
name: foo
description: Test skill foo
---
# Foo
EOF
cat > "$TMP/skills/bar/SKILL.md" <<'EOF'
---
name: bar
description: Test skill bar
---
# Bar
EOF

# ── Test 1: duplicate slugs → ERROR, exit 1 ──────────────────────────────────
cat > "$TMP/skills-pack.json" <<'EOF'
{
  "name": "test-pack",
  "version": "1.0",
  "skills": [
    { "slug": "foo", "path": "skills/foo" },
    { "slug": "foo", "path": "skills/bar" }
  ]
}
EOF

out=$(bash "$V" "$TMP" 2>&1)
rc=$?
if [[ "$rc" -ne 1 ]]; then
  bad "duplicate slug should exit 1 (got $rc)"
else
  if echo "$out" | grep -q "duplicate slug 'foo'"; then
    pass "duplicate slug detected with correct message"
  else
    bad "duplicate slug not mentioned in output: $out"
  fi
fi

# ── Test 2: unique slugs → pass, exit 0 ──────────────────────────────────────
cat > "$TMP/skills-pack.json" <<'EOF'
{
  "name": "test-pack",
  "version": "1.0",
  "description": "Test pack",
  "author": "test",
  "license": "MIT",
  "skills": [
    { "slug": "foo", "path": "skills/foo" },
    { "slug": "bar", "path": "skills/bar" }
  ]
}
EOF

out=$(bash "$V" "$TMP" 2>&1)
rc=$?
if [[ "$rc" -ne 0 ]]; then
  bad "clean pack should exit 0 (got $rc): $out"
else
  if echo "$out" | grep -q "pack is valid"; then
    pass "clean pack passes validation"
  else
    bad "clean pack did not report valid: $out"
  fi
fi

# ── Test 3: triple duplicate → ERROR, reports the slug ───────────────────────
cat > "$TMP/skills-pack.json" <<'EOF'
{
  "name": "test-pack",
  "version": "1.0",
  "skills": [
    { "slug": "foo", "path": "skills/foo" },
    { "slug": "bar", "path": "skills/bar" },
    { "slug": "foo", "path": "skills/foo" }
  ]
}
EOF

out=$(bash "$V" "$TMP" 2>&1)
rc=$?
if [[ "$rc" -ne 1 ]]; then
  bad "triple duplicate should exit 1 (got $rc)"
else
  if echo "$out" | grep -q "duplicate slug 'foo'"; then
    pass "triple duplicate detected"
  else
    bad "triple duplicate not reported: $out"
  fi
fi

if [[ "$fail" -eq 0 ]]; then
  echo ""
  echo "All validate-pack tests passed."
else
  echo ""
  echo "SOME TESTS FAILED."
fi
exit "$fail"