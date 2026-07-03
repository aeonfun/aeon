/**
 * Aeon skill executor — shared core for loading the skill catalog and running a
 * skill through the configured harness (`claude` CLI or the Grok `run-grok.sh`),
 * identical to how GitHub Actions invokes it.
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

/** Load the skill catalog from <repoRoot>/catalog/skills.json. Returns [] if missing. */
export function loadSkills(repoRoot: string, logPrefix = "[aeon]"): Skill[] {
  const manifestPath = join(repoRoot, "catalog", "skills.json");
  if (!existsSync(manifestPath)) {
    process.stderr.write(`${logPrefix} catalog/skills.json not found at ${manifestPath}\n`);
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
 * Which agent harness runs the skill. Mirrors aeon.yml's resolution so a local
 * MCP run matches a scheduled one: the AEON_HARNESS env wins, else the repo's
 * global `harness:` in aeon.yml, else `claude`. Any unknown value → `claude`.
 */
export function resolveHarness(repoRoot: string): "claude" | "grok" {
  const envH = (process.env.AEON_HARNESS || "").trim().toLowerCase();
  if (envH === "grok" || envH === "claude") return envH;
  try {
    const cfg = readFileSync(join(repoRoot, "aeon.yml"), "utf-8");
    const m = cfg.match(/^harness:\s*["']?([A-Za-z]+)/m);
    if (m && m[1].toLowerCase() === "grok") return "grok";
  } catch {
    /* no aeon.yml → default */
  }
  return "claude";
}

/**
 * Run a skill synchronously and return its text output. Uses `claude -p -` on the
 * Claude harness and `scripts/run-grok.sh` on the Grok harness — both emit the
 * same `{ result }` JSON envelope, so parsing is shared. Failure modes (missing
 * skill, missing CLI, non-zero exit, empty output) are returned as human-readable
 * strings rather than thrown, so callers can surface them without special-casing.
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
  const harness = resolveHarness(repoRoot);
  process.stderr.write(
    `${logPrefix} Running skill: ${slug}${varValue ? ` (var=${varValue})` : ""} [harness: ${harness}]\n`
  );

  const [cmd, args, spawnEnv]: [string, string[], NodeJS.ProcessEnv] =
    harness === "grok"
      ? // run-grok.sh reads the prompt on stdin, discovers .mcp.json natively, and
        // maps SKILL_MODE to grok's permission flags. MODEL unset → grok's default.
        ["bash", [join(repoRoot, "scripts", "run-grok.sh")], { ...process.env, SKILL_MODE: "write" }]
      : ["claude", ["-p", "-", "--output-format", "json"], process.env];

  const result = spawnSync(cmd, args, {
    input: prompt,
    cwd: repoRoot,
    env: spawnEnv,
    timeout: 600_000, // 10 minutes — same as the GitHub Actions timeout
    maxBuffer: 10 * 1024 * 1024, // 10 MB
    encoding: "utf-8",
  });

  if (result.error) {
    const enoent =
      (result.error as NodeJS.ErrnoException).code === "ENOENT";
    const msg = enoent
      ? harness === "grok"
        ? `'bash' or scripts/run-grok.sh not found — run from inside an Aeon repo clone with the grok CLI installed (npm i -g @xai-official/grok).`
        : `'claude' command not found. Install it with: npm install -g @anthropic-ai/claude-code`
      : `Failed to spawn ${cmd}: ${result.error.message}`;
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

  // Both harnesses wrap the result as { result: "..." } (run-grok.sh normalizes
  // grok's envelope to match claude's --output-format json).
  try {
    const parsed = JSON.parse(stdout) as { result?: string };
    return parsed.result ?? stdout;
  } catch {
    return stdout;
  }
}
