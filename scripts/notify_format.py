#!/usr/bin/env python3
"""
notify_format — pure formatting/chunking core for ./notify.

No network, no env, no deps (stdlib only) so it is unit-testable in isolation.
`notify.sh` shells out to this to build per-channel payloads; the channel POSTs
stay in bash.

Channels & limits:
  - telegram : text chunks <= 3900 (4096 cap, room for "[i/N]"); base64 per line
  - discord  : embeds, description <= 4096; one JSON POST body per line
  - slack    : Block Kit, section text <= 3000; one JSON POST body (stdout)

Two correctness properties this guarantees and the tests pin:
  1. No chunk exceeds its channel limit.
  2. No chunk ever ends inside an unbalanced ``` code fence — if a split lands
     mid-fence, the open fence is closed and reopened on the next chunk, so every
     chunk renders as valid Markdown on its own.
"""
import argparse
import base64
import json
import sys

SEVERITY = {
    "info":     {"emoji": "ℹ️",  "color": 0x3498DB},
    "success":  {"emoji": "✅",  "color": 0x2ECC71},
    "warn":     {"emoji": "⚠️",  "color": 0xF1C40F},
    "critical": {"emoji": "🚨",  "color": 0xE74C3C},
}
DEFAULT_SEVERITY = "info"


def _fence_count(s: str) -> int:
    """Number of ``` fence markers (line-leading) in s."""
    return sum(1 for ln in s.split("\n") if ln.lstrip().startswith("```"))


def _pack(parts, sep, limit):
    """Greedy-pack parts on `sep`, recursing paragraph -> line, hard-split last."""
    out, cur = [], ""
    for p in parts:
        glue = sep if cur else ""
        if len(cur) + len(glue) + len(p) <= limit:
            cur += glue + p
        else:
            if cur:
                out.append(cur)
                cur = ""
            if len(p) > limit and sep == "\n\n":
                out.extend(_pack(p.split("\n"), "\n", limit))
            elif len(p) > limit:
                while len(p) > limit:
                    out.append(p[:limit])
                    p = p[limit:]
                cur = p
            else:
                cur = p
    if cur:
        out.append(cur)
    return out


def _balance_fences(chunks):
    """Close a dangling ``` at a chunk end and reopen at the next chunk's start.

    Keeps each chunk individually valid Markdown. Reserves a little headroom so
    the added fence lines don't push a chunk back over the limit (the caller
    packs to limit-8 to leave room)."""
    out, carry_open = [], False
    for c in chunks:
        if carry_open:
            c = "```\n" + c
        opens = _fence_count(c) % 2 == 1
        if opens:
            c = c + "\n```"
            carry_open = True
        else:
            carry_open = False
        out.append(c)
    return out


def chunk(text: str, limit: int):
    """Split text into <=limit chunks on paragraph/line boundaries, fence-safe."""
    text = text.rstrip("\n")
    if not text:
        return []
    # leave headroom for the "\n```" / "```\n" a fence rebalance may add
    pack_limit = max(1, limit - 8)
    if len(text) <= pack_limit:
        raw = [text]
    else:
        raw = _pack(text.split("\n\n"), "\n\n", pack_limit)
    return _balance_fences(raw)


def _header(title, severity):
    meta = SEVERITY.get(severity, SEVERITY[DEFAULT_SEVERITY])
    if title:
        return f"{meta['emoji']} *{title}*"
    return None


# ---- per-channel payload builders -----------------------------------------

def telegram(text, title, severity, limit=3900):
    body = text
    head = _header(title, severity)
    if head:
        body = head + "\n\n" + body
    chunks = chunk(body, limit)
    n = len(chunks)
    out = []
    for i, c in enumerate(chunks):
        suffix = f"\n\n[{i + 1}/{n}]" if n > 1 else ""
        out.append(c + suffix)
    return out  # list[str]


def discord(text, title, severity, limit=4096):
    meta = SEVERITY.get(severity, SEVERITY[DEFAULT_SEVERITY])
    chunks = chunk(text, limit)
    payloads = []
    n = len(chunks)
    for i, c in enumerate(chunks):
        embed = {"description": c, "color": meta["color"]}
        if title and i == 0:
            embed["title"] = f"{meta['emoji']} {title}"
        if n > 1:
            embed["footer"] = {"text": f"{i + 1}/{n}"}
        payloads.append({"embeds": [embed]})
    return payloads  # list[dict]


def slack(text, title, severity, limit=3000):
    meta = SEVERITY.get(severity, SEVERITY[DEFAULT_SEVERITY])
    blocks = []
    if title:
        blocks.append({
            "type": "header",
            "text": {"type": "plain_text", "text": f"{meta['emoji']} {title}"[:150]},
        })
    for c in chunk(text, limit):
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": c}})
    return {"blocks": blocks}  # dict


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("channel", choices=["telegram", "discord", "slack"])
    ap.add_argument("--title", default="")
    ap.add_argument("--severity", default=DEFAULT_SEVERITY)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    text = sys.stdin.read()

    if args.channel == "telegram":
        lim = args.limit or 3900
        for c in telegram(text, args.title, args.severity, lim):
            sys.stdout.write(base64.b64encode(c.encode()).decode() + "\n")
    elif args.channel == "discord":
        lim = args.limit or 4096
        for p in discord(text, args.title, args.severity, lim):
            sys.stdout.write(json.dumps(p) + "\n")
    elif args.channel == "slack":
        lim = args.limit or 3000
        sys.stdout.write(json.dumps(slack(text, args.title, args.severity, lim)) + "\n")


if __name__ == "__main__":
    main()
