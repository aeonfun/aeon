#!/usr/bin/env python3
"""Chunk stdin into base64-encoded pieces sized for messaging-platform limits.

Usage:
    echo "$MESSAGE" | python3 .github/scripts/chunk-text.py <LIMIT>

Where LIMIT is the max characters per chunk INCLUDING the `[i/N]` suffix the
script appends when the message has to be split.

Each chunk is written to stdout on its own line, base64-encoded so embedded
newlines survive the line-oriented shell loop that reads the output.

Splitting strategy:
1. If the whole message fits in LIMIT, emit it as a single chunk (no suffix).
2. Otherwise, try paragraph boundaries (`\\n\\n`) first.
3. If any single paragraph still exceeds LIMIT, fall back to line boundaries.
4. If any single line still exceeds LIMIT, hard-split mid-text.

Used for both Telegram (4096-char limit, we use 3900 to leave room for suffix)
and Discord (2000-char limit, we use 1900). Centralised here to avoid two
copies of the chunking logic embedded inline in workflow heredocs.
"""

import base64
import sys


def pack(parts, sep, limit):
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
                out.extend(pack(p.split("\n"), "\n", limit))
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


def main():
    if len(sys.argv) != 2:
        sys.stderr.write("usage: chunk-text.py <LIMIT>\n")
        sys.exit(2)
    try:
        limit = int(sys.argv[1])
    except ValueError:
        sys.stderr.write("chunk-text.py: LIMIT must be an integer\n")
        sys.exit(2)

    text = sys.stdin.read()
    if len(text) <= limit:
        chunks = [text]
    else:
        chunks = pack(text.split("\n\n"), "\n\n", limit)

    n = len(chunks)
    for i, c in enumerate(chunks):
        suffix = f"\n\n[{i + 1}/{n}]" if n > 1 else ""
        sys.stdout.write(base64.b64encode((c + suffix).encode()).decode() + "\n")


if __name__ == "__main__":
    main()
