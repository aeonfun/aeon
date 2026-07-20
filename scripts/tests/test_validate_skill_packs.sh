#!/usr/bin/env bash
# Unit test for scripts/validate-skill-packs.mjs — registry shape, README parity,
# and the trust/capability checks. No network, no GitHub auth required. Every
# case runs against throwaway fixtures under /tmp; the last case runs the real
# committed registry so a drifted main is caught here too.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

V="scripts/validate-skill-packs.mjs"
fail=0
pass(){ echo "ok   - $1"; }
bad(){ echo "FAIL - $1"; fail=1; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/validate-skill-packs.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

# ── Fixture builders ────────────────────────────────────────────────────────
# A fixture dir holds the four inputs the validator reads. Callers overwrite
# whichever one the case is about.

# write_registry <dir> <packs-json-array>
write_registry() {
  cat > "$1/skill-packs.json" <<EOF
{
  "version": "1.0",
  "updated": "2026-07-20",
  "description": "Test registry.",
  "packs": $2
}
EOF
}

# write_readme <dir> <count-claimed> <table-rows>
write_readme() {
  cat > "$1/README.md" <<EOF
# Test README

| **community** | **$2 community skill packs** published to the registry. |

## Community Packs

| Pack | Skills | Description |
|------|--------|-------------|
$3
EOF
}

# The locked taxonomy is read out of the installer; fixture it so the test
# doesn't depend on the real bin/install-skill-pack staying put.
write_installer() {
  cat > "$1/install-skill-pack" <<'EOF'
#!/usr/bin/env bash
ALLOWED_CAPABILITIES=(
  read_only
  external_api
  writes_external_host
  onchain_writes
  agent_messaging
  sends_notifications
)
EOF
}

write_trusted() {
  cat > "$1/trusted-sources.txt" <<'EOF'
# comment line
goodowner/good-pack
EOF
}

ONE_PACK='[{"repo":"goodowner/good-pack","name":"Good Pack","description":"A pack.","author":"goodowner","license":"MIT","homepage":"https://example.com","category":"dev","trust_level":"community","skills":["alpha","beta"]}]'
ONE_ROW='| [Good Pack](https://github.com/goodowner/good-pack) | 2 | A pack. |'

# new_fixture <name> → prints the dir; baseline is valid and passes.
new_fixture() {
  local d="$TMP/$1"
  mkdir -p "$d"
  write_registry "$d" "$ONE_PACK"
  write_readme "$d" 1 "$ONE_ROW"
  write_installer "$d"
  write_trusted "$d"
  echo "$d"
}

run() {
  node "$V" --registry "$1/skill-packs.json" --readme "$1/README.md" \
            --installer "$1/install-skill-pack" --trusted "$1/trusted-sources.txt" 2>&1
}

# expect_ok <fixture> <label>
expect_ok() {
  local out; out="$(run "$1")"
  if [[ $? -eq 0 ]]; then pass "$2"; else bad "$2 — expected exit 0, got:"; echo "$out" | sed 's/^/       /'; fi
}

# expect_fail <fixture> <expected-substring> <label>
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
if [[ $rc -eq 0 ]]; then pass "a valid registry + matching README passes"
else bad "a valid registry + matching README passes"; echo "$out" | sed 's/^/       /'; fi

# ── Registry shape ──────────────────────────────────────────────────────────
d=$(new_fixture badjson)
printf '{ "packs": [ { "repo": "a/b", } ] }\n' > "$d/skill-packs.json"
expect_fail "$d" "not valid JSON" "malformed JSON is rejected"

d=$(new_fixture nopacks)
printf '{ "version": "1.0" }\n' > "$d/skill-packs.json"
expect_fail "$d" "no \`packs\` array" "a registry with no packs array is rejected"

d=$(new_fixture norepo)
write_registry "$d" '[{"name":"x","skills":["alpha"]}]'
expect_fail "$d" "missing required \`repo\`" "a pack without \`repo\` is rejected"

d=$(new_fixture repourl)
write_registry "$d" '[{"repo":"https://github.com/goodowner/good-pack","skills":["alpha"]}]'
expect_fail "$d" 'must be "owner/repo"' "a \`repo\` given as a URL is rejected"

d=$(new_fixture reposubdir)
write_registry "$d" '[{"repo":"goodowner/good-pack/aeon-skills","skills":["alpha"]}]'
expect_fail "$d" 'must be "owner/repo"' "a \`repo\` with a trailing subdirectory is rejected"

d=$(new_fixture dupe)
write_registry "$d" '[{"repo":"goodowner/good-pack","skills":["alpha"]},{"repo":"goodowner/good-pack","skills":["beta"]}]'
expect_fail "$d" "duplicate entry" "a repo listed twice is rejected"

d=$(new_fixture noskills)
write_registry "$d" '[{"repo":"goodowner/good-pack","skills":[]}]'
expect_fail "$d" "non-empty array" "an empty \`skills\` array is rejected"

d=$(new_fixture badslug)
write_registry "$d" '[{"repo":"goodowner/good-pack","skills":["Alpha_One"]}]'
expect_fail "$d" "lowercase kebab-case" "a non-slug skill name is rejected"

d=$(new_fixture dupslug)
write_registry "$d" '[{"repo":"goodowner/good-pack","skills":["alpha","alpha"]}]'
expect_fail "$d" "listed twice" "a duplicated skill slug is rejected"

d=$(new_fixture badhomepage)
write_registry "$d" '[{"repo":"goodowner/good-pack","skills":["alpha","beta"],"homepage":"example.com"}]'
expect_fail "$d" "http(s) URL" "a non-URL \`homepage\` is rejected"

d=$(new_fixture badpath)
write_registry "$d" '[{"repo":"goodowner/good-pack","skills":["alpha","beta"],"path":"/abs/dir"}]'
expect_fail "$d" "repo-relative subdirectory" "an absolute \`path\` is rejected"

d=$(new_fixture badsecret)
write_registry "$d" '[{"repo":"goodowner/good-pack","skills":["alpha","beta"],"secrets_required":["lowercase_key"]}]'
expect_fail "$d" "UPPER_SNAKE" "a non-env-var \`secrets_required\` entry is rejected"

# ── Capability taxonomy (locked; read from the installer) ───────────────────
d=$(new_fixture badcap)
write_registry "$d" '[{"repo":"goodowner/good-pack","skills":["alpha","beta"],"capabilities":["reads_the_vibes"]}]'
expect_fail "$d" "unknown capability" "a capability outside the locked taxonomy is rejected"

d=$(new_fixture goodcap)
write_registry "$d" '[{"repo":"goodowner/good-pack","name":"Good Pack","description":"A pack.","author":"goodowner","skills":["alpha","beta"],"capabilities":["read_only","external_api"]}]'
expect_ok "$d" "capabilities inside the taxonomy pass"

# ── Trust model ─────────────────────────────────────────────────────────────
d=$(new_fixture untrusted)
write_registry "$d" '[{"repo":"randomowner/pack","name":"P","description":"d","author":"a","skills":["alpha","beta"],"trust_level":"trusted"}]'
write_readme "$d" 1 '| [P](https://github.com/randomowner/pack) | 2 | d |'
expect_fail "$d" "not in skills/security/trusted-sources.txt" "self-declared \`trusted\` without a trusted-sources entry is rejected"

d=$(new_fixture trusted)
write_registry "$d" '[{"repo":"goodowner/good-pack","name":"Good Pack","description":"A pack.","author":"goodowner","skills":["alpha","beta"],"trust_level":"trusted"}]'
expect_ok "$d" "\`trusted\` backed by trusted-sources.txt passes"

d=$(new_fixture badtrust)
write_registry "$d" '[{"repo":"goodowner/good-pack","skills":["alpha","beta"],"trust_level":"verified"}]'
expect_fail "$d" "trust_level\` must be one of" "an unknown \`trust_level\` is rejected"

# ── README parity ───────────────────────────────────────────────────────────
d=$(new_fixture noreadmerow)
write_readme "$d" 1 '| [Other](https://github.com/other/pack) | 1 | Other. |'
expect_fail "$d" "no row in the README" "a registry entry with no README row is rejected"

d=$(new_fixture noregentry)
write_readme "$d" 1 "$ONE_ROW
| [Ghost](https://github.com/ghost/pack) | 1 | Not in the registry. |"
expect_fail "$d" "no entry in catalog/skill-packs.json" "a README row with no registry entry is rejected"

d=$(new_fixture countmismatch)
write_readme "$d" 1 '| [Good Pack](https://github.com/goodowner/good-pack) | 7 | A pack. |'
expect_fail "$d" "README says 7 skill(s) but the registry lists 2" "a skill-count mismatch is rejected"

d=$(new_fixture missingpathflag)
write_registry "$d" '[{"repo":"goodowner/good-pack","name":"Good Pack","description":"A pack.","author":"goodowner","path":"aeon-skills","skills":["alpha","beta"]}]'
expect_fail "$d" "would install the wrong subtree" "a subdirectory pack whose README row omits \`--path\` is rejected"

d=$(new_fixture pathok)
write_registry "$d" '[{"repo":"goodowner/good-pack","name":"Good Pack","description":"A pack.","author":"goodowner","path":"aeon-skills","skills":["alpha","beta"]}]'
write_readme "$d" 1 '| [Good Pack](https://github.com/goodowner/good-pack/tree/main/aeon-skills) (`--path aeon-skills`) | 2 | A pack. |'
expect_ok "$d" "a subdirectory pack with a matching \`--path\` row passes"

d=$(new_fixture pathmismatch)
write_registry "$d" '[{"repo":"goodowner/good-pack","name":"Good Pack","description":"A pack.","author":"goodowner","path":"aeon-skills","skills":["alpha","beta"]}]'
write_readme "$d" 1 '| [Good Pack](https://github.com/goodowner/good-pack) (`--path other-dir`) | 2 | A pack. |'
expect_fail "$d" "registry \`path\` is" "a \`--path\` that disagrees with the registry is rejected"

# A monorepo may publish two packs from different subdirectories — two registry
# entries, two rows, matched on repo+path rather than repo alone.
d=$(new_fixture monorepo)
write_registry "$d" '[
  {"repo":"goodowner/good-pack","name":"One","description":"d","author":"a","path":"packs/one","skills":["alpha"]},
  {"repo":"goodowner/good-pack","name":"Two","description":"d","author":"a","path":"packs/two","skills":["beta","gamma"]}
]'
write_readme "$d" 2 '| [One](https://github.com/goodowner/good-pack) (`--path packs/one`) | 1 | d |
| [Two](https://github.com/goodowner/good-pack) (`--path packs/two`) | 2 | d |'
expect_ok "$d" "one repo publishing two packs from different paths passes"

d=$(new_fixture monorepo_unlisted)
write_registry "$d" '[{"repo":"goodowner/good-pack","name":"One","description":"d","author":"a","path":"packs/one","skills":["alpha"]}]'
write_readme "$d" 1 '| [One](https://github.com/goodowner/good-pack) (`--path packs/one`) | 1 | d |
| [Two](https://github.com/goodowner/good-pack) (`--path packs/two`) | 2 | d |'
expect_fail "$d" "no entry for this repo at path" "a second row from the same repo with no registry entry is rejected"

d=$(new_fixture duperow)
write_readme "$d" 1 "$ONE_ROW
$ONE_ROW"
expect_fail "$d" "listed twice in the README" "the same pack listed twice in the README is rejected"

d=$(new_fixture counter)
write_readme "$d" 9 "$ONE_ROW"
expect_fail "$d" "9 community skill packs" "a stale README pack counter is rejected"

# The first-party packs table earlier in the real README is also `| Pack | Skills |`;
# the parser must anchor on the Community Packs section, not the first match.
d=$(new_fixture twotables)
cat > "$d/README.md" <<EOF
# Test README

| **community** | **1 community skill packs** published to the registry. |

## Packs

| Pack | Skills |
|------|--------|
| **Core** (\`core\`, 11) | \`auto-merge\`,\`heartbeat\` |

## Community Packs

| Pack | Skills | Description |
|------|--------|-------------|
$ONE_ROW
EOF
expect_ok "$d" "the first-party two-column packs table is not mistaken for the registry table"

# ── Warnings do not fail the gate ───────────────────────────────────────────
d=$(new_fixture unknownfield)
write_registry "$d" '[{"repo":"goodowner/good-pack","name":"Good Pack","description":"A pack.","author":"goodowner","skills":["alpha","beta"],"secrets_optional":["TUNING_KEY"]}]'
out="$(run "$d")"; rc=$?
if [[ $rc -eq 0 && "$out" == *"unknown field \`secrets_optional\`"* ]]; then
  pass "an unknown field warns but does not fail"
else
  bad "an unknown field warns but does not fail (rc=$rc)"; echo "$out" | sed 's/^/       /'
fi

d=$(new_fixture missingname)
write_registry "$d" '[{"repo":"goodowner/good-pack","skills":["alpha","beta"]}]'
out="$(run "$d")"; rc=$?
if [[ $rc -eq 0 && "$out" == *"no \`description\`"* ]]; then
  pass "missing recommended fields warn but do not fail"
else
  bad "missing recommended fields warn but do not fail (rc=$rc)"; echo "$out" | sed 's/^/       /'
fi

# ── The committed registry itself ───────────────────────────────────────────
out="$(node "$V" 2>&1)"; rc=$?
if [[ $rc -eq 0 ]]; then pass "the committed catalog/skill-packs.json conforms and matches the README"
else bad "the committed catalog/skill-packs.json conforms and matches the README"; echo "$out" | sed 's/^/       /'; fi

echo ""
if [[ $fail -eq 0 ]]; then echo "test_validate_skill_packs: ALL PASS"; else echo "test_validate_skill_packs: FAILURES"; fi
exit "$fail"
