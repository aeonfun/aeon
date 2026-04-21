#!/usr/bin/env python3
"""
Sanity-check the Aeon MCP server end-to-end.

What it does:
  1. Spawns `node mcp-server/dist/index.js` as a stdio MCP server.
  2. Sends `tools/list` and prints every aeon-* tool that is registered.
  3. Calls one tool (default: `aeon-cost-report`, fast and offline-safe)
     so you can confirm the full request/response cycle works.

Why a separate Python script: the MCP SDK ships the JSON-RPC framing,
but a hand-rolled client is the smallest possible reproduction. If this
script works, your Claude Desktop / Claude Code wiring will too.

Setup:
    cd /path/to/aeon
    ./add-mcp --build-only          # produce mcp-server/dist/index.js
    pip install mcp                 # official anthropic MCP client
    python examples/mcp/test_connection.py            # lists + calls default tool
    python examples/mcp/test_connection.py aeon-token-report AEON
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def repo_root() -> Path:
    """Walk up from this file until we find the Aeon repo root."""
    here = Path(__file__).resolve()
    for candidate in (here, *here.parents):
        if (candidate / "skills.json").exists() and (candidate / "mcp-server").is_dir():
            return candidate
    raise SystemExit(
        "Could not locate Aeon repo root (no skills.json + mcp-server/ above this file)."
    )


async def main(tool_name: str, var_value: str) -> int:
    root = repo_root()
    server_js = root / "mcp-server" / "dist" / "index.js"
    if not server_js.exists():
        print(f"✗ MCP server build missing at {server_js}")
        print("  Run `./add-mcp --build-only` from the repo root first.")
        return 1

    params = StdioServerParameters(
        command="node",
        args=[str(server_js)],
        env=os.environ.copy(),
    )

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = (await session.list_tools()).tools
            print(f"✓ MCP server connected. {len(tools)} tools advertised.\n")
            for t in tools[:10]:
                print(f"  • {t.name}")
            if len(tools) > 10:
                print(f"  … and {len(tools) - 10} more")

            print(f"\n→ Calling {tool_name}" + (f" (var={var_value!r})" if var_value else ""))
            result = await session.call_tool(
                tool_name,
                arguments={"var": var_value} if var_value else {},
            )
            for block in result.content:
                text = getattr(block, "text", None) or str(block)
                print(text[:2000])
                if len(text) > 2000:
                    print(f"\n… ({len(text) - 2000} more chars truncated)")
            print("\n✓ Round-trip succeeded.")
    return 0


if __name__ == "__main__":
    tool = sys.argv[1] if len(sys.argv) > 1 else "aeon-cost-report"
    var = sys.argv[2] if len(sys.argv) > 2 else ""
    sys.exit(asyncio.run(main(tool, var)))
