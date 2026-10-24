---
name: arxiv-radar
description: 扫 arXiv 新预印本，按话题词过滤，把命中的项目名推给我。只做发现，不做判断。
metadata:
  title: arXiv Radar
  category: crypto
  var: ""
  tags:
    - crypto
    - discovery
  capabilities:
    - external_api
    - sends_notifications
---

> **${var}** — 可选。`dry-run` 跳过 notify；`days:N` 换窗口（默认 7）；`names` 切到"名字扫"模式（只扫 `memory/universe-names.txt` 里的已知项目名）；`<domain>` 只扫该领域。

发现层的第一条通道。**词表在下面 `TERMS` 里，改词只改那一段。**

## 为什么用 arXiv

它是唯一"项目起源 + 有中心索引"的交叉点：论文先于主网、先于上市、先于叙事。PEARL 那篇 2026-06-03 的论文如果被扫到，提前量是 4 个月。

## 铁律

- **只用 `ti:`。** arXiv 的 `abs:` 是松散匹配（`abs:"MEV"` 会命中兆电子伏特）。
- **写长短语，不写单词。** 单词必然撞别的学科（MEV / SNARK / liquidation 都是这么死的）。
- **不做判断，不复述内容。** 只给名字 + 一句话 + 链接。
- **零命中不等于废词。** 可能是太前沿，也可能是没人写进标题——留观察，别删。

## Config

读：
- `memory/arxiv-seen.json` — 已见 arxiv id（跨 run 去重）
- `memory/MEMORY.md` — "Tracked Token" 与 Active Topics，用来标相关性
- 名字扫模式额外读：`memory/universe-names.txt`

写：
- `memory/arxiv-seen.json` — 由脚本更新
- `memory/logs/${today}.md` — 每次运行一条
- 通知：只在有幸存者时发

## Steps

### 1. 解析 var
`dry-run` → `DRY=1`；`days:N` → `DAYS=N`；`names` → 读 `memory/universe-names.txt` 当词表；其余当 domain 过滤。

### 2. 扫描

```bash
export DRY=$DRY DAYS=$DAYS
python3 - <<'PY' > /tmp/radar.json 2>/tmp/radar.log
import json, os, re, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

# ── 词表：改这里就是换领域 ──────────────────────────
TERMS = [t for t in """
proof-of-useful-work
verifiable inference
light client
proof of training
proof of learning
verifiable training
auditable training
data availability sampling
restaking
automated market maker
consensus protocol
cat:cs.CR AND ti:"MEV"
liquid staking
embodied data
robot manipulation data
robot data
embodied AI
zero-knowledge
""".strip().split("\n") if t.strip()]

CARRIER = ["deployed", "deployment", "mainnet", "testnet", "protocol",
           "production", "open-source", "released", "blockchain", "network",
           "token", "incentive", "marketplace", "validator", "miner"]
EXCL = ["survey", "tutorial", "benchmark"]
STOP = set("""a an the on of in for with from and or to at by as is are was were
towards toward via using based scalable efficient large language model models
learning deep neural network networks system systems new novel study analysis
empirical measurement framework approach method methods data theory practice
case real world beyond not all end how what why when where which that this""".split())

DAYS = int(os.environ.get("DAYS") or 7)
DRY  = os.environ.get("DRY") == "1"
SEEN = "memory/arxiv-seen.json"
API  = "https://export.arxiv.org/api/query"
NS   = {"a": "http://www.w3.org/2005/Atom"}

now = datetime.now(timezone.utc)
win = f"[{(now - timedelta(days=DAYS)):%Y%m%d%H%M} TO {now:%Y%m%d%H%M}]"

seen = {}
if os.path.exists(SEEN):
    try:
        seen = json.load(open(SEEN, encoding="utf-8"))
    except Exception:
        seen = {}

def guess_name(title, summ, known):
    for n in known:
        if re.search(rf"\b{re.escape(n)}\b", title + " " + summ, re.I):
            return n
    m = re.search(r"\b([A-Z][A-Za-z0-9\-]{2,})(?:'s|\u2019s)\b", title + " " + summ)
    if m:
        return m.group(1)
    for w in re.findall(r"\b[A-Z][A-Za-z0-9\-]{2,}\b", title):
        if w.lower() not in STOP:
            return w
    return ""

out, raw, drop = [], 0, {"seen": 0, "excl": 0, "carrier": 0, "fail": 0}
for term in TERMS:
    q = term if term.startswith("cat:") else f'ti:"{term}"'
    p = {"search_query": f"({q}) AND submittedDate:{win}",
         "start": 0, "max_results": 100,
         "sortBy": "submittedDate", "sortOrder": "descending"}
    url = API + "?" + urllib.parse.urlencode(p)
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            root = ET.fromstring(r.read())
    except Exception as ex:
        print(f"! {term}: {ex}", file=sys.stderr)
        drop["fail"] += 1
        time.sleep(3)
        continue
    for e in root.findall("a:entry", NS):
        raw += 1
        aid = e.find("a:id", NS).text.split("/abs/")[-1]
        title = " ".join(e.find("a:title", NS).text.split())
        summ = " ".join(e.find("a:summary", NS).text.split())
        blob = (title + " " + summ).lower()
        if aid in seen:
            drop["seen"] += 1
            continue
        if any(x in blob for x in EXCL):
            drop["excl"] += 1
            continue
        if not any(c in blob for c in CARRIER):
            drop["carrier"] += 1
            continue
        out.append({"term": term, "title": title,
                    "published": e.find("a:published", NS).text[:10],
                    "link": f"https://arxiv.org/abs/{aid}",
                    "carrier": next(c for c in CARRIER if c in blob)})
        seen[aid] = now.strftime("%Y-%m-%d")
    time.sleep(3)

out.sort(key=lambda c: c["published"], reverse=True)
print(f"扫 {len(TERMS)} 词 | 原始 {raw} | 幸存 {len(out)} | "
      f"丢弃 seen={drop['seen']} excl={drop['excl']} "
      f"carrier={drop['carrier']} fail={drop['fail']}", file=sys.stderr)
for c in out[:25]:
    print(f"  {c['published']} [{c['term']}] {c['title'][:85]}", file=sys.stderr)

if not DRY and out:
    json.dump(dict(list(seen.items())[-2000:]),
              open(SEEN, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
PY
cat /tmp/radar.log