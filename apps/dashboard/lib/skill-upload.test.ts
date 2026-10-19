/**
 * Tests for apps/dashboard/lib/skill-upload.ts - naming an uploaded skill.
 *
 * Run with:  node --import tsx --test apps/dashboard/lib/skill-upload.test.ts
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { deriveSkillName } from "./skill-upload";

const file = (path: string, content = "---\nname: Fleet Scorecard\n---\n") => ({ path, content });

describe("deriveSkillName", () => {
  it("slugifies the folder holding SKILL.md", () => {
    assert.deepEqual(deriveSkillName([file("My Skill/SKILL.md")]), { name: "my-skill", prefix: "My Skill/" });
  });

  it("slugifies the innermost folder of a deep path and keeps the real prefix", () => {
    assert.deepEqual(
      deriveSkillName([file("export/Skills/Daily_Brief/SKILL.md"), file("export/Skills/Daily_Brief/a.md")]),
      {
        name: "daily-brief",
        prefix: "export/Skills/Daily_Brief/",
      },
    );
  });

  it("strips a .skill suffix from a folder name", () => {
    assert.equal(deriveSkillName([file("Market Pulse.skill/SKILL.md")]).name, "market-pulse");
  });

  it("names a bare SKILL.md from its frontmatter", () => {
    assert.deepEqual(deriveSkillName([file("SKILL.md")]), { name: "fleet-scorecard", prefix: "" });
  });

  it("names a .skill file from its file name or folder", () => {
    assert.deepEqual(deriveSkillName([file("Hello World.skill")]), { name: "hello-world", prefix: "" });
    assert.deepEqual(deriveSkillName([file("Some Folder/x.skill")]), { name: "some-folder", prefix: "Some Folder/" });
  });

  it("gives no name to a folder that slugifies to nothing", () => {
    assert.equal(deriveSkillName([file("???/SKILL.md")]).name, "");
  });

  it("finds no name without a skill file", () => {
    assert.deepEqual(deriveSkillName([file("README.md")]), { name: "", prefix: "" });
  });
});
