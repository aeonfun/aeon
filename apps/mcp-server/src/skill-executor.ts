/**
 * Aeon skill executor — shared core for loading the skill catalog and running a
 * skill through the `claude` CLI, identical to how GitHub Actions invokes it.
 *
 * Extracted from the MCP server so the load → prompt → spawn → parse logic lives
 * in one testable place. Any future transport (HTTP, a queue worker, another
 * protocol bridge) can import this instead of re-implementing skill execution.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

export interface Skill {
  slug: string;
  name: string;
  description: string;
  category: string;
  schedule: string;
  var: string;
}

interface SkillsManifest {
  version: string;
  repo: string;
  skills: Skill[];
}

/** Load the skill catalog from <repoRoot>/skills.json. Returns [] if missing. */
export function loadSkills(repoRoot: string, logPrefix = "[aeon]"): Skill[] {
  const manifestPath = join(repoRoot, "skills.json");
  if (!existsSync(manifestPath)) {
    process.stderr.write(`${logPrefix} skills.json not found at ${manifestPath}\n`);
    return [];
  }
  const manifest: SkillsManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  return manifest.skills ?? [];
}

/**
 * Build the prompt the CLI receives — mirrors the GitHub Actions invocation so a
 * local run is identical to a scheduled one.
 */
export function buildSkillPrompt(slug: string, varValue: string): string {
  const today = new Date().toISOString().split("T")[0];
  let prompt = `Today is ${today}. Read and execute the skill defined in skills/${slug}/SKILL.md`;
  if (varValue.trim()) {
    prompt += `\n\nUse this variable (override the default in the skill file):\nvar=${varValue.trim()}`;
  }
  return prompt;
}

/**
 * Run a skill synchronously via `claude -p -` and return its text output.
 * Failure modes (missing skill, missing CLI, non-zero exit, empty output) are
 * returned as human-readable strings rather than thrown, so callers can surface
 * them to the requesting agent without special-casing.
 */
export function runSkill(
  repoRoot: string,
  slug: string,
  varValue: string,
  logPrefix = "[aeon]"
): string {
  const skillFile = join(repoRoot, "skills", slug, "SKILL.md");
  if (!existsSync(skillFile)) {
    return [
      `Error: skill '${slug}' not found.`,
      `Expected SKILL.md at: ${skillFile}`,
      `Make sure you're running from inside an Aeon repo clone.`,
    ].join("\n");
  }

  const prompt = buildSkillPrompt(slug, varValue);
  process.stderr.write(
    `${logPrefix} Running skill: ${slug}${varValue ? ` (var=${varValue})` : ""}\n`
  );

  const result = spawnSync("claude", ["-p", "-", "--output-format", "json"], {
    input: prompt,
    cwd: repoRoot,
    timeout: 600_000, // 10 minutes — same as the GitHub Actions timeout
    maxBuffer: 10 * 1024 * 1024, // 10 MB
    encoding: "utf-8",
  });

  if (result.error) {
    const msg =
      (result.error as NodeJS.ErrnoException).code === "ENOENT"
        ? `'claude' command not found. Install it with: npm install -g @anthropic-ai/claude-code`
        : `Failed to spawn claude: ${result.error.message}`;
    return `Error: ${msg}`;
  }

  if (result.status !== 0) {
    const output = (result.stderr || result.stdout || "").trim();
    return `Skill '${slug}' failed (exit ${result.status}):\n${output}`;
  }

  const stdout = (result.stdout || "").trim();
  if (!stdout) {
    return `Skill '${slug}' produced no output.`;
  }

  // The claude CLI with --output-format json wraps the result in { result: "..." }
  try {
    const parsed = JSON.parse(stdout) as { result?: string };
    return parsed.result ?? stdout;
  } catch {
    return stdout;
  }
}
