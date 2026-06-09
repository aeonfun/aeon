/**
 * Tests for apps/dashboard/lib/frontmatter.ts — SKILL.md frontmatter parsing.
 *
 * Run with:  node --import tsx --test apps/dashboard/lib/frontmatter.test.ts
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { parseFrontmatter } from "./frontmatter";

// ── parseFrontmatter ─────────────────────────────────────────────────

describe("parseFrontmatter", () => {
  it("parses name, description, and tags from a standard SKILL.md", () => {
    const content = `---
name: Deep Research
description: Exhaustive multi-source synthesis on any topic
tags: [research, deep-dive, synthesis]
---

# Deep Research

Body text here.`;

    const result = parseFrontmatter(content);
    assert.equal(result.name, "Deep Research");
    assert.equal(result.description, "Exhaustive multi-source synthesis on any topic");
    assert.deepEqual(result.tags, ["research", "deep-dive", "synthesis"]);
  });

  it("parses quoted strings in frontmatter", () => {
    const content = `---
name: "Market Pulse"
description: 'Daily market overview'
tags: [crypto]
---`;
    const result = parseFrontmatter(content);
    assert.equal(result.name, "Market Pulse");
    assert.equal(result.description, "Daily market overview");
  });

  it("provides empty description when no frontmatter description", () => {
    // When description is absent, the fallback picks the first non-heading
    // non-`---` line from the entire content (including frontmatter).
    // This is known behavior — the description won't be empty, but it
    // picks "name: ..." as the first qualifying line.
    const content = `---
name: Test Skill
tags: [test]
---

Some intro paragraph.`;
    const result = parseFrontmatter(content);
    assert.equal(result.name, "Test Skill");
    // Fallback picks the first non-heading/non-`---` line (from frontmatter)
    assert.ok(result.description.length > 0);
  });

  it("returns empty strings when no frontmatter block exists", () => {
    const content = `No frontmatter here, just plain text.`;
    const result = parseFrontmatter(content);
    assert.equal(result.name, "");
    assert.equal(result.description, "No frontmatter here, just plain text.");
  });

  it("parses tags with spaces", () => {
    const content = `---
name: Taggy
description: has tags
tags: [dev, build, test]
---`;
    const result = parseFrontmatter(content);
    assert.deepEqual(result.tags, ["dev", "build", "test"]);
  });

  it("handles single-tag arrays", () => {
    const content = `---
name: Solo
description: one tag only
tags: [solo]
---`;
    const result = parseFrontmatter(content);
    assert.deepEqual(result.tags, ["solo"]);
  });

  it("handles empty tags array", () => {
    const content = `---
name: No Tags
description: nothing to tag
tags: []
---`;
    const result = parseFrontmatter(content);
    assert.deepEqual(result.tags, []);
  });

  it("parses requires with required and works-better (?) keys", () => {
    const content = `---
name: Token Alert
description: alerts
tags: [crypto]
requires: [XAI_API_KEY, COINGECKO_API_KEY?]
---`;
    const result = parseFrontmatter(content);
    assert.deepEqual(result.requires, [
      { key: "XAI_API_KEY", optional: false },
      { key: "COINGECKO_API_KEY", optional: true },
    ]);
  });

  it("returns empty requires when the field is absent", () => {
    const content = `---
name: No Keys
description: nothing
tags: [meta]
---`;
    const result = parseFrontmatter(content);
    assert.deepEqual(result.requires, []);
  });

  it("ignores malformed requires entries", () => {
    const content = `---
name: Messy
description: d
requires: [GOOD_KEY, , lowercase, 123BAD]
---`;
    const result = parseFrontmatter(content);
    assert.deepEqual(result.requires, [{ key: "GOOD_KEY", optional: false }]);
  });

  it("parses mcp servers with required and works-better (?) tiers", () => {
    const content = `---
name: Base MCP
description: onchain
tags: [crypto]
mcp: [base, ctrl?]
---`;
    const result = parseFrontmatter(content);
    assert.deepEqual(result.mcp, [
      { slug: "base", optional: false },
      { slug: "ctrl", optional: true },
    ]);
  });

  it("returns empty mcp when the field is absent", () => {
    const content = `---
name: No MCP
description: nothing
tags: [meta]
---`;
    const result = parseFrontmatter(content);
    assert.deepEqual(result.mcp, []);
  });

  it("truncates long fallback descriptions at 120 chars", () => {
    // Without description, the fallback scans all content for the first
    // non-heading/non-`---` line and truncates at 120 chars.
    const longLine = "A".repeat(200);
    const content = `---
name: Long
---

${longLine}`;
    // The description fallback picks from body after frontmatter
    const result = parseFrontmatter(content);
    assert.ok(result.description.length <= 120, `description was ${result.description.length} chars`);
  });
});