#!/usr/bin/env bash
# Pre-fetch for skills/fleet-scorecard — gathers all data OUTSIDE Claude's
# sandbox (network + gh API are blocked inside it) and computes an
# OpenRouter-style fleet scorecard into /tmp/fleet-scorecard/.
#
# General-purpose: the fleet is discovered at runtime, never hardcoded.
#   fleet = this repo ("self") + every non-archived entry in memory/instances.json
# (the same registry skills/fleet-control and skills/spawn-instance maintain).
# With zero managed instances it still works — it just reports the single
# self repo. Each instance's `.repo` field is a full "owner/name" slug.
#
# Produces:
#   /tmp/fleet-scorecard/runs.jsonl        one JSON per workflow run, all repos
#   /tmp/fleet-scorecard/all-tokens.csv    repo + each repo's token-usage.csv rows
#   /tmp/fleet-scorecard/scorecard-body.md computed markdown tables (the numbers)
#   /tmp/fleet-scorecard/metrics.json      key totals for delta tracking
#
# Runs on the GHA runner with GH_TOKEN/GITHUB_TOKEN in env. The token needs read
# access to every repo in the fleet (self is always readable; managed instances
# need a PAT with read scope if they are private).
#
# Token mapping (Anthropic CSV cols -> OpenRouter usage shape):
#   prompt_tokens = input + cache_read + cache_creation
#   cached_tokens = cache_read   (subset of prompt)
#   completion    = output ;  total = prompt + completion
#   cache_discount = (whole prompt billed uncached) - actual
#
# Pricing matches skills/cost-report (direct Anthropic list price).

set -uo pipefail

SKILL="${1:-}"
[ "$SKILL" != "fleet-scorecard" ] && exit 0   # only run when this skill is dispatched

DIR=/tmp/fleet-scorecard
mkdir -p "$DIR"
JSONL="$DIR/runs.jsonl"; : > "$JSONL"
ALLCSV="$DIR/all-tokens.csv"; : > "$ALLCSV"
BODY="$DIR/scorecard-body.md"; : > "$BODY"
METRICS="$DIR/metrics.json"
DEFINED_TSV="$DIR/defined.tsv"; : > "$DEFINED_TSV"

command -v gh >/dev/null 2>&1 || { echo "prefetch-fleet-scorecard: gh missing, skipping" >&2; exit 0; }
command -v jq >/dev/null 2>&1 || { echo "prefetch-fleet-scorecard: jq missing, skipping" >&2; exit 0; }

# ---- 0. discover the fleet (self + registry) -------------------------------
SELF="${GITHUB_REPOSITORY:-}"
if [ -z "$SELF" ]; then
  SELF=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
fi

REGISTRY_REPOS=""
if [ -f memory/instances.json ]; then
  REGISTRY_REPOS=$(jq -r '
    (.instances // [])[]
    | select((.archived // false) != true)
    | select((.status // "") != "archived")
    | .repo // empty
  ' memory/instances.json 2>/dev/null || echo "")
fi

# Combine self + registry, drop blanks, dedupe (preserve first-seen order: self first).
REPOS=()
seen_repos=""
for r in "$SELF" $REGISTRY_REPOS; do
  [ -z "$r" ] && continue
  case " $seen_repos " in *" $r "*) continue ;; esac
  seen_repos="$seen_repos $r"
  REPOS+=("$r")
done

if [ "${#REPOS[@]}" -eq 0 ]; then
  echo "prefetch-fleet-scorecard: no repos resolved (no GITHUB_REPOSITORY, no gh repo, empty registry) — skipping" >&2
  exit 0
fi
echo "prefetch-fleet-scorecard: fleet = ${REPOS[*]}"

# ---- 1. all workflow runs (paginated) + defined-skill counts ---------------
for repo in "${REPOS[@]}"; do
  gh api --paginate "repos/$repo/actions/runs?per_page=100" \
    --jq '.workflow_runs[] | {repo:"'"$repo"'", name:.name, conclusion:.conclusion, created_at:.created_at, head_branch:.head_branch} | @json' \
    >> "$JSONL" 2>/dev/null || echo "prefetch-fleet-scorecard: WARN runs fetch failed for $repo" >&2
  n=$(gh api "repos/$repo/contents/skills" --jq '[.[]|select(.type=="dir")]|length' 2>/dev/null || echo 0)
  printf '%s\t%s\n' "$repo" "$n" >> "$DEFINED_TSV"
done

# ---- 2. each repo's token-usage.csv (raw) into one combined file -----------
# Combined CSV cols: 1=repo("owner/name") 2date 3skill 4model 5input 6output 7cache_read 8cache_creation
for repo in "${REPOS[@]}"; do
  gh api -H "Accept: application/vnd.github.raw" \
    "repos/$repo/contents/memory/token-usage.csv" 2>/dev/null \
    | awk -F, -v repo="$repo" 'NR>1 && NF==7 {print repo","$0}' >> "$ALLCSV" \
    || echo "prefetch-fleet-scorecard: WARN token-usage.csv fetch failed for $repo" >&2
done

# ---- shared awk lib (pricing == skills/cost-report direct table) -----------
AWK_LIB='
function commafy(x,  s,out){ s=sprintf("%d",x); while(length(s)>3){out=","substr(s,length(s)-2)out; s=substr(s,1,length(s)-3)} return s out }
function hum(n){ if(n>=1e9)return sprintf("%.2fB",n/1e9); if(n>=1e6)return sprintf("%.1fM",n/1e6); if(n>=1e3)return sprintf("%.1fK",n/1e3); return sprintf("%d",n) }
function basename(p,  s){ s=p; sub(".*/","",s); return s }
function price(model,kind,  i,o,cw,cr){
  if(model~/opus/){i=15;o=75;cw=18.75;cr=1.50}
  else if(model~/sonnet/){i=3;o=15;cw=3.75;cr=0.30}
  else if(model~/haiku/){i=0.80;o=4;cw=1.00;cr=0.08}
  else{i=15;o=75;cw=18.75;cr=1.50}   # unknown -> conservative (Opus), matches cost-report
  if(kind=="in")return i/1e6; if(kind=="out")return o/1e6; if(kind=="cw")return cw/1e6; return cr/1e6 }
'

# ---- run-level aggregates via jq -------------------------------------------
read -r TR TS TF TC <<EOF
$(jq -rs '[ length,
  ([.[]|select(.conclusion=="success")]|length),
  ([.[]|select(.conclusion=="failure")]|length),
  ([.[]|select(.conclusion=="cancelled")]|length) ] | @tsv' "$JSONL")
EOF

# per-repo run stats: repo total succ fail skillsran  (skill: prefixed distinct)
RUN=$(jq -rs '
  def base: (.name//"(none)")|gsub(" \\(.*$";"");
  group_by(.repo)[] |
  [ .[0].repo, length,
    ([.[]|select(.conclusion=="success")]|length),
    ([.[]|select(.conclusion=="failure")]|length),
    ([.[]|select(.name|test("^skill:"))|(.name|sub("^skill: ";"")|sub(" \\(.*$";""))]|unique|length)
  ] | @tsv' "$JSONL")

DEF_TSV=$(cat "$DEFINED_TSV")
REPOS_ORDERED="${REPOS[*]}"

# ---- 3. compute markdown body ----------------------------------------------
{
  # Fleet totals
  echo "## Fleet totals"
  echo
  awk -F, -v tr="$TR" -v ts="$TS" -v tf="$TF" -v tc="$TC" "$AWK_LIB"'
    NF==8 { g++; un+=$5; out+=$6; cr+=$7; cw+=$8; prompt+=$5+$7+$8;
      actual+=$5*price($4,"in")+$6*price($4,"out")+$8*price($4,"cw")+$7*price($4,"cr");
      base  +=($5+$7+$8)*price($4,"in")+$6*price($4,"out") }
    END{
      printf "| Metric | Value |\n|---|---:|\n"
      printf "| Workflow runs (all-time) | %s |\n", commafy(tr)
      printf "| ├ success / failure / cancelled | %s / %s / %s |\n", commafy(ts), commafy(tf), commafy(tc)
      printf "| ├ success rate | %.1f%% |\n", (tr>0?ts*100/tr:0)
      printf "| Generations logged | %s |\n", commafy(g)
      printf "| **prompt_tokens** | **%s** (%s) |\n", commafy(prompt), hum(prompt)
      printf "| ├ cached_tokens | %s — %.1f%% of prompt |\n", commafy(cr), (prompt>0?cr*100/prompt:0)
      printf "| **completion_tokens** | **%s** (%s) |\n", commafy(out), hum(out)
      printf "| **total_tokens** | **%s** (%s) |\n", commafy(prompt+out), hum(prompt+out)
      printf "| **usage — est. cost** | **$%s** |\n", commafy(actual)
      printf "| cache_discount (saved vs uncached) | $%s |\n", commafy(base-actual)
    }' "$ALLCSV"
  echo
  echo "> \`cached_tokens\` ⊆ \`prompt_tokens\` (OpenRouter shape). Cost = Anthropic list price (estimate)."
  echo

  # Per-repo
  echo "## Per-repo"
  echo
  echo "| Repo | Runs | Success | Skills (ran/defined) | Gens | prompt_tokens | cached % | total_tokens | cost | cache_discount |"
  echo "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"
  { printf '%s\n' "$RUN" | sed 's/^/RUN\t/'
    printf '%s\n' "$DEF_TSV" | sed 's/^/DEF\t/'
    awk -F, "$AWK_LIB"'
      NF==8 { r=$1; g[r]++; prompt[r]+=$5+$7+$8; cr[r]+=$7; comp[r]+=$6;
        cost[r]+=$5*price($4,"in")+$6*price($4,"out")+$8*price($4,"cw")+$7*price($4,"cr");
        base[r]+=($5+$7+$8)*price($4,"in")+$6*price($4,"out") }
      END{ for(r in g) printf "TOK\t%s\t%d\t%d\t%d\t%d\t%.2f\t%.2f\n", r,g[r],prompt[r],cr[r],comp[r],cost[r],base[r]-cost[r] }' "$ALLCSV"
  } | awk -F'\t' -v ordered="$REPOS_ORDERED" "$AWK_LIB"'
      $1=="RUN"{r=$2; tot[r]=$3; succ[r]=$4; sk[r]=$6}
      $1=="DEF"{r=$2; def[r]=$3}
      $1=="TOK"{r=$2; g[r]=$3; prompt[r]=$4; cr[r]=$5; comp[r]=$6; cost[r]=$7; disc[r]=$8}
      END{ n=split(ordered, ord, " ")
        for(i=1;i<=n;i++){ r=ord[i];
          printf "| %s | %s | %.1f%% | %d / %d | %s | %s | %.1f%% | %s | $%s | $%s |\n",
            r, commafy(tot[r]), (tot[r]>0?succ[r]*100/tot[r]:0), sk[r], def[r]+0, commafy(g[r]),
            hum(prompt[r]), (prompt[r]>0?cr[r]*100/prompt[r]:0), hum(prompt[r]+comp[r]),
            commafy(cost[r]), commafy(disc[r]) } }'
  echo

  # Top skills by cost
  echo "## Top 12 skills by est. cost (fleet-wide)"
  echo
  echo "| Skill | Repo(s) | Gens | prompt_tokens | cached % | cost |"
  echo "|---|---|---:|---:|---:|---:|"
  awk -F, "$AWK_LIB"'
    { sk=$3; g[sk]++; prompt[sk]+=$5+$7+$8; cr[sk]+=$7;
      cost[sk]+=$5*price($4,"in")+$6*price($4,"out")+$8*price($4,"cw")+$7*price($4,"cr");
      tag=basename($1); if(index(seen[sk],tag)==0) seen[sk]=seen[sk] (seen[sk]==""?"":",") tag }
    END{ for(sk in g) printf "%.4f\t%s\t%s\t%d\t%d\t%d\n", cost[sk],sk,seen[sk],g[sk],prompt[sk],cr[sk] }' "$ALLCSV" \
  | sort -t$'\t' -k1,1gr | head -12 \
  | awk -F'\t' "$AWK_LIB"'{ printf "| %s | %s | %s | %s | %.1f%% | $%s |\n", $2,$3,commafy($4),hum($5),($5>0?$6*100/$5:0),commafy($1) }'
  echo

  # Least reliable — WINDOWED to the last 14 days so resolved incidents age out.
  # Default-branch only: branch/PR test dispatches are not fleet health.
  WINDOW_DAYS=14
  echo "## Least reliable skills (last ${WINDOW_DAYS}d, ≥3 runs)"
  echo
  echo "_Rolling ${WINDOW_DAYS}-day window — resolved incidents age out, so this reflects current health (not lifetime totals)._"
  echo
  echo "| Skill | Repo | Failures / Runs (${WINDOW_DAYS}d) | Fail % |"
  echo "|---|---|---:|---:|"
  jq -rs --argjson w "$WINDOW_DAYS" '
    def base: (.name//"(none)")|gsub(" \\(.*$";"");
    ([ .[] | select(.head_branch=="main")
           | select((.created_at|fromdateiso8601) >= (now - ($w*86400))) ]
     | group_by(.repo+"|"+base)
     | map({repo:.[0].repo, skill:(.[0]|base), total:length, fail:([.[]|select(.conclusion=="failure")]|length)})
     | map(select(.total>=3 and .fail>0))
     | sort_by(-(.fail/.total))) as $r
    | if ($r|length)==0 then "| ✅ none — no skill failed in the last \($w)d | — | — | — |"
      else ($r[:10][] | "| \(.skill) | \(.repo) | \(.fail) / \(.total) | \((.fail*1000/.total|round)/10)% |") end
  ' "$JSONL"
} > "$BODY"

# ---- 4. metrics.json (for day-over-day deltas) -----------------------------
awk -F, -v tr="$TR" -v tf="$TF" "$AWK_LIB"'
  NF==8 { g++; prompt+=$5+$7+$8; cr+=$7; out+=$6;
    actual+=$5*price($4,"in")+$6*price($4,"out")+$8*price($4,"cw")+$7*price($4,"cr");
    base  +=($5+$7+$8)*price($4,"in")+$6*price($4,"out") }
  END{ printf "{\"total_runs\":%d,\"total_failures\":%d,\"generations\":%d,\"prompt_tokens\":%d,\"cached_tokens\":%d,\"completion_tokens\":%d,\"total_tokens\":%d,\"est_cost_usd\":%.2f,\"cache_discount_usd\":%.2f}\n",
    tr,tf,g,prompt,cr,out,prompt+out,actual,base-actual }' "$ALLCSV" > "$METRICS"

echo "prefetch-fleet-scorecard: done — $(wc -l < "$JSONL") runs, $(wc -l < "$ALLCSV") token rows across ${#REPOS[@]} repos"
echo "prefetch-fleet-scorecard: metrics -> $(cat "$METRICS")"
exit 0
