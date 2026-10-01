#!/usr/bin/env bash
# Unit test for scripts/validate-readme-catalog.mjs — first-party catalog ↔ README
# table parity. No network, no GitHub auth. Each case runs against throwaway
# fixtures under /tmp; the last case runs the real committed catalog + README + docs so a
# drifted main is caught here too.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

V="scripts/validate-readme-catalog.mjs"
fail=0
pass(){ echo "ok   - $1"; }
bad(){ echo "FAIL - $1"; fail=1; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/validate-readme-catalog.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

# ── Fixture builders ────────────────────────────────────────────────────────
# A fixture is a packs.json + a README. The baseline pair is valid and passes;
# each case overwrites whichever one it is about.

# A 2-pack catalog: `alpha` (2 skills), `beta` (1 skill). total = 2 packs / 3 skills.
write_packs() {
  cat > "$1/packs.json" <<'EOF'
{
  "version": "1.0",
  "total_packs": 2,
  "total_skills": 3,
  "packs": [
    { "key": "alpha", "name": "Alpha", "skills": [ { "slug": "a-one" }, { "slug": "a-two" } ] },
    { "key": "beta",  "name": "Beta",  "skills": [ { "slug": "b-one" } ] }
  ]
}
EOF
}

# write_readme <dir> <hero-word> <all-N> <full-alpha-slugs>
# Everything else is held at the valid baseline; callers vary one argument.
write_readme() {
  cat > "$1/README.md" <<EOF
# Test README

**$2 packs ship in the box** - blah blah.

<details>
<summary><strong>Full catalog (all $3 skills by pack)</strong></summary>

| Pack | Skills |
|------|--------|
| **Alpha** (\`alpha\`, 2) | $4 |
| **Beta** (\`beta\`, 1) | \`b-one\` |

</details>
EOF
}

# new_fixture <name> → prints the dir; baseline is valid and passes.
new_fixture() {
  local d="$TMP/$1"
  mkdir -p "$d"
  write_packs "$d"
  write_readme "$d" Two 3 '`a-one`,`a-two`'
  echo "$d"
}

run() { node "$V" --packs "$1/packs.json" --readme "$1/README.md" 2>&1; }

expect_ok() {
  local out; out="$(run "$1")"
  if [[ $? -eq 0 ]]; then pass "$2"; else bad "$2 — expected exit 0, got:"; echo "$out" | sed 's/^/       /'; fi
}
expect_fail() {
  local out rc
  out="$(run "$1")"; rc=$?
  if [[ $rc -eq 0 ]]; then
    bad "$3 — expected a failure, got exit 0"
  elif [[ "$out" != *"$2"* ]]; then
    bad "$3 — failed as expected but message missing \"$2\":"; echo "$out" | sed 's/^/       /'
  else
    pass "$3"
  fi
}

# ── Baseline ────────────────────────────────────────────────────────────────
d=$(new_fixture baseline)
out="$(run "$d")"; rc=$?
if [[ $rc -eq 0 ]]; then pass "a matching catalog + README passes"
else bad "a matching catalog + README passes"; echo "$out" | sed 's/^/       /'; fi

# ── Full-catalog table (the finance-district bug class) ─────────────────────
d=$(new_fixture missing_skill)
write_readme "$d" Two 3 '`a-one`'          # a-two dropped from the full-catalog list
expect_fail "$d" "missing: a-two" "a skill missing from the full-catalog list is rejected"

d=$(new_fixture extra_skill)
write_readme "$d" Two 3 '`a-one`,`a-two`,`a-ghost`'
expect_fail "$d" "not in the pack: a-ghost" "a full-catalog skill that isn't in the pack is rejected"

# ── Headline counts (only enforced when present + parseable) ────────────────
d=$(new_fixture bad_all_n)
write_readme "$d" Two 7 '`a-one`,`a-two`'    # "all 7 skills" but catalog has 3
expect_fail "$d" "all 7 skills by pack" "a stale 'all N skills' caption is rejected"

d=$(new_fixture bad_hero)
write_readme "$d" Five 3 '`a-one`,`a-two`'   # "Five packs" but catalog has 2
expect_fail "$d" "Five packs ship in the box" "a stale pack-count hero line is rejected"

d=$(new_fixture bad_alt_pack_count)
echo '<img alt="Three skill packs, 3 skills total: Alpha and Beta.">' >> "$d/README.md"
expect_fail "$d" "Three skill packs, 3 skills total" "a stale pack count in image alt text is rejected"

d=$(new_fixture bad_packs_line)
echo 'Pack key = category. Four packs, no empties.' >> "$d/README.md"
expect_fail "$d" "Four packs, no empties" "a stale 'N packs, no empties' line is rejected"

d=$(new_fixture subset_pack_prose)
echo 'Three packs are shown by default.' >> "$d/README.md"
expect_ok "$d" "per-subset pack prose is not read as the total"

# ── A check with nothing to verify fails instead of passing silently ───────
d=$(new_fixture no_pack_count)
sed -i.bak '/packs ship in the box/d' "$d/README.md"
expect_fail "$d" "pack-count parity has nothing to check" "a missing pack-count phrase fails loudly"

d=$(new_fixture no_full_catalog)
sed -i.bak '/^|/d' "$d/README.md"
expect_fail "$d" "full-catalog parity has nothing to check" "a missing full-catalog table fails loudly"

# ── Whole-catalog skill counts (prose, alt text, anchors, extra docs) ───────
d=$(new_fixture rounded_count)
echo 'Aeon ships **60+ skills** across harnesses.' >> "$d/README.md"
expect_fail "$d" "\"60+ skills\" is a rounded count" "a rounded 'N+ skills' claim is rejected"

d=$(new_fixture stale_count)
echo '<img alt="AEON - 50 skills across 9 harnesses">' >> "$d/README.md"
expect_fail "$d" "\"50 skills\" but the catalog has 3 skills" "a stale whole-catalog 'N skills' claim is rejected"

d=$(new_fixture per_pack_count)
echo 'Alpha holds 2 skills; the catalog has 3 skills in total.' >> "$d/README.md"
expect_ok "$d" "per-pack counts and the exact total are accepted"

d=$(new_fixture stale_anchor)
echo '[catalog](docs/skill-packs.md#full-catalog-all-9-skills-by-pack)' >> "$d/README.md"
expect_fail "$d" "link anchor \"all-9-skills-by-pack\" is stale" "a stale 'all-N-skills-by-pack' anchor is rejected"

d=$(new_fixture extra_doc)
printf '# Packs\n\nAeon ships **40 skills**.\n' > "$d/doc.md"
out="$(node "$V" --packs "$d/packs.json" --readme "$d/README.md" --docs "$d/doc.md" 2>&1)"; rc=$?
if [[ $rc -ne 0 && "$out" == *"doc.md:3"* ]]; then pass "a stale count in a --docs file is rejected with its location"
else bad "a stale count in a --docs file is rejected with its location"; echo "$out" | sed 's/^/       /'; fi

# ── The committed catalog + README itself ───────────────────────────────────
out="$(node "$V" 2>&1)"; rc=$?
if [[ $rc -eq 0 ]]; then pass "the committed catalog/packs.json matches the committed README"
else bad "the committed catalog/packs.json matches the committed README"; echo "$out" | sed 's/^/       /'; fi

echo ""
if [[ $fail -eq 0 ]]; then echo "test_validate_readme_catalog: ALL PASS"; else echo "test_validate_readme_catalog: FAILURES"; fi
exit "$fail"
