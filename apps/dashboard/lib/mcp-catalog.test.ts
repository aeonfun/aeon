/**
 * Tests for the MCP catalog's deniedTools lists (lib/mcp-catalog.ts). The run
 * path cannot read this TypeScript file, so scripts/mcp-denied-tools.sh reads
 * the same lists from catalog/mcp-denied-tools.json, keyed by server URL. These
 * tests keep the two equal, so a tool blocked in the dashboard is blocked in
 * every run too.
 *
 * Run with:  node --import tsx --test apps/dashboard/lib/mcp-catalog.test.ts
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MCP_CATALOG } from "./mcp-catalog";

const DENY_FILE = join(__dirname, "..", "..", "..", "catalog", "mcp-denied-tools.json");
const norm = (u: string) => u.replace(/\/+$/, "");

describe("MCP_CATALOG deniedTools", () => {
  const fromJson = JSON.parse(readFileSync(DENY_FILE, "utf8")) as Record<string, string[]>;
  const json = Object.fromEntries(Object.entries(fromJson).map(([u, t]) => [norm(u), [...t].sort()]));
  const ts = Object.fromEntries(
    MCP_CATALOG.filter(e => e.deniedTools?.length).map(e => [norm(e.url), [...(e.deniedTools ?? [])].sort()]),
  );

  it("matches catalog/mcp-denied-tools.json exactly", () => {
    assert.deepEqual(ts, json);
  });

  it("blocks the ICP write tool", () => {
    const icp = MCP_CATALOG.find(e => e.slug === "icp");
    assert.ok(icp?.deniedTools?.includes("canister_update_call"));
  });

  it("uses bare tool names (no mcp__ prefix, no wildcards)", () => {
    for (const tools of Object.values(json)) for (const t of tools) assert.match(t, /^[A-Za-z0-9_-]+$/);
  });
});
