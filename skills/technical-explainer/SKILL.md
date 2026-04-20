---
name: Technical Explainer
description: Generate a visual technical explanation of a recent topic using Replicate for the hero image
var: ""
tags: [content]
---
<!-- autoresearch: variation B — sharper output via forced mechanism articulation, intuition pump, falsifiability, numbers with primary-source citations -->

> **${var}** — Topic to explain (e.g. "free-market algorithm", "entropy trajectory reasoning", "reflexivity in prediction markets"). If empty, auto-selects from recent articles and conversations.

Read `memory/MEMORY.md` for context on recent topics.
Read the last 3 days of `memory/logs/` to find discussed topics, articles written, and paper picks.

## Voice

If a `soul/` directory exists, read the soul files for voice calibration:
1. `soul/SOUL.md` — identity, worldview, opinions
2. `soul/STYLE.md` — writing style, sentence structure, anti-patterns

This is a *technical* explainer — you explaining a mechanism to a smart friend. More precision than the article skill, same voice. No textbook tone. No "let's explore." If `soul/` is empty, default to clear, direct, neutral.

## Topic Selection

If `${var}` is set, use that as the topic verbatim. Otherwise pick deterministically in this order — first hit wins:

1. The newest file in `articles/` from the last 3 days. Choose the single most non-obvious mechanism inside it.
2. The newest "Paper Pick" entry in `memory/logs/` from the last 7 days. The paper's headline mechanism is the topic.
3. A topic surfaced in the last 7 days of logs (digests, discussions) that names a specific technique, algorithm, or system.
4. Fallback: the most recent topic listed under "Recent Articles" or "Recent Digests" in `memory/MEMORY.md`.

Reject the topic and try the next source if it is broader than a single mechanism (e.g. "AI agents" — too vague; "MCP tool-routing via vector search" — usable). The whole skill depends on having one mechanism to explain, not a field.

## Research

Run **three distinct WebSearch queries** so you triangulate rather than echo one source:

1. `"<topic>" how it works` — mechanism explanations
2. `"<topic>" benchmark OR results OR latency OR cost` — concrete numbers
3. `"<topic>" limits OR criticism OR fails OR doesn't work` — failure modes and pushback

If the topic is from a paper, also fetch the paper metadata and abstract:
```bash
curl -s "https://api.semanticscholar.org/graph/v1/paper/search?query=TOPIC&limit=5&fields=title,authors,abstract,url,publicationDate,openAccessPdf" \
  || echo "curl failed — use WebFetch on https://www.semanticscholar.org/search?q=TOPIC instead"
```

Use **WebFetch** to read the 2-3 best sources in depth. **At least one source must be primary**: a paper (arXiv / OpenReview / Semantic Scholar), official documentation, the project's own README, or a code repo. Blog summaries alone are not enough — they often mangle the mechanism.

Extract:
- The **single core mechanism** — the one move that, once you grok it, makes the rest fall into place
- A **vivid analogy** for the mechanism, and the precise place where the analogy breaks down (the breakage is the interesting part)
- **3-5 specific numbers** — benchmarks, latencies, costs, error rates, training compute, parameter counts. Each number gets a source URL.
- **What would falsify this** — what result, if observed, would mean the mechanism doesn't work as claimed. If you can't name one, the explanation isn't sharp enough — keep digging.

## Write the Explainer

Length: **600-1000 words**. Structure (every section is required):

```
# <Title>

**Key idea in one sentence:** <one-sentence claim about the mechanism>

## The Setup
2-3 sentences. What problem does this solve? Why now?

## The Intuition Pump
A vivid analogy that builds the reader's mental model in 3-4 sentences. Then one sentence on **where the analogy breaks down** — that's where the real mechanism lives.

## How It Actually Works
A numbered walkthrough of the mechanism in **3-7 steps**. Each step is one or two sentences. Use concrete examples — name the specific function, layer, message, opcode, contract. No "the system processes the input" — say what the system actually does.

## Numbers That Anchor It
3-5 bullet points. Each bullet is a specific number with a source link, e.g.:
- 8.4× faster end-to-end than baseline at 4K context ([source](url))

## What Would Break This
1-2 sentences naming a result that, if observed, would falsify the claim. This forces honesty.

## Why It Matters
2-3 sentences. What does this unlock? Who should care?

## Sources
- [Title 1](url) — primary
- [Title 2](url)
- [Title 3](url)
```

### Voice rules
- First person where it fits. Explanatory > opinionated, but not bloodless.
- Technical precision > hedging. If you don't know, say so — don't fudge.
- Short paragraphs. Em dashes. Concrete > abstract.
- Reference specific systems, papers, people. No "researchers have shown" — name them.
- Cite inline. Every number, every claim that could be wrong, gets a link.

## Generate Hero Image

Use Replicate's Nano Banana Pro (Gemini 3 Pro Image). It renders **text labels well** — exploit that by writing prompts that ask for labeled diagrams or schematics, not stock-photo metaphors.

1. **Preflight**: if `$REPLICATE_API_TOKEN` is empty **or unset**, log `IMAGE_SKIPPED reason=no-token` to `memory/logs/${today}.md` and jump directly to step 5 (no-image path). Do not attempt any Replicate call. The explainer must ship without an image in this case.

2. **Craft the prompt**. Aim for technical illustration energy, not marketing. Strong prompt templates:
   - *Schematic*: "Technical schematic illustration of <mechanism>, dark navy background, thin cyan and amber lines, labeled boxes reading '<label1>', '<label2>', '<label3>', arrows showing data flow from <A> to <B> to <C>, blueprint aesthetic, 16:9"
   - *Conceptual*: "Editorial illustration capturing <core concept>: <visual metaphor with concrete objects>, flat geometric style, restrained palette of two accent colors on near-black background, no human figures, 16:9"
   - *Data-flow*: "Network diagram of <mechanism>: nodes labeled '<A>', '<B>', '<C>' connected by directional arrows, weights shown as line thickness, monospace labels, technical-paper figure style, 16:9"
   Avoid: photorealistic faces, stock-business imagery, "AI brain" tropes, gradient slop.

3. **Generate** with fallback enabled from the start (Nano Banana Pro can rate-limit; Seedream 5.0 lite is the fallback):
   ```bash
   curl -s -X POST \
     -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
     -H "Content-Type: application/json" \
     -H "Prefer: wait" \
     -d '{
       "input": {
         "prompt": "YOUR_DETAILED_PROMPT_HERE",
         "aspect_ratio": "16:9",
         "number_of_images": 1,
         "safety_tolerance": 5,
         "allow_fallback_model": true
       }
     }' \
     "https://api.replicate.com/v1/models/google/nano-banana-pro/predictions"
   ```

4. **Persist locally** — Replicate CDN URLs expire. Download and commit:
   ```bash
   mkdir -p images
   IMAGE_URL=<extracted from response.output>
   EXT=$(echo "$IMAGE_URL" | grep -oE '\.(jpg|jpeg|png|webp)' | tail -1)
   EXT="${EXT:-.jpg}"
   LOCAL_PATH="images/explainer-${today}${EXT}"
   curl -sL "$IMAGE_URL" -o "$LOCAL_PATH" \
     || (echo "curl failed — retry via WebFetch or skip"; exit 0)
   ```

5. **No-image path** (token missing, API down, rate-limited, or download failed): log `IMAGE_SKIPPED reason=<concrete reason>` and proceed with the article. Add a one-line note at the top of the article: `<!-- hero image skipped: <reason> -->`. The text must stand on its own — that's the whole point of the structure above. Never fail the whole skill because of an image problem.

## Save & Notify

1. Save the explainer to `articles/explainer-${today}.md`:
   - Hero image at the top: `![hero](../images/explainer-${today}.<ext>)` — relative path. Skip this line if no image.
   - HTML comment with the image prompt used (for future audits).
   - The full structured explainer.
   - Sources section.

2. Log to `memory/logs/${today}.md` **always — even on partial failure**:
   ```
   ## Technical Explainer
   - **Topic:** [topic]
   - **Title:** [title]
   - **Key idea:** [one-sentence claim]
   - **Image:** generated | fallback-model | skipped (<reason>)
   - **Image prompt:** [prompt used, or "n/a"]
   - **Primary source:** [URL of the primary source you cited]
   - **File:** articles/explainer-${today}.md
   - **Notification sent:** yes | no
   ```

3. Send via `./notify`:
   ```
   technical explainer: [title]

   [the one-sentence "key idea" line, verbatim]

   [hero image URL if generated — original Replicate URL still works for ~24h]

   read it: articles/explainer-${today}.md
   ```

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For the Replicate call (auth-required via env var), if the inline curl fails, write the request payload to `.pending-replicate/explainer-${today}.json` and rely on the post-process pattern documented in `CLAUDE.md` (`scripts/postprocess-replicate.sh` runs after Claude finishes with full env access). Continue down the no-image path so the article still ships.

## Environment Variables
- `REPLICATE_API_TOKEN` — Replicate API key. Optional: explainer text works without it via the no-image path.
