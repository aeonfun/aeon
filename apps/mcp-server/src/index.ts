#!/usr/bin/env node
/**
 * Aeon MCP Server
 *
 * Exposes all Aeon skills as MCP tools so any Claude Desktop or Claude Code
 * user can invoke them directly from their Claude interface.
 *
 * Tool naming: aeon-{slug} (e.g. aeon-article, aeon-hn-digest)
 * Each tool accepts a single optional `var` argument (the skill's variable input).
 *
 * Skill execution: spawns `claude -p -` with the skill prompt, exactly as
 * GitHub Actions does, so local runs are identical to scheduled runs.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { type Skill, loadSkills, runSkill } from "./skill-executor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// apps/mcp-server/dist/index.js → apps/mcp-server/ → apps/ → repo root
const REPO_ROOT = join(__dirname, "..", "..", "..");

const LOG_PREFIX = "[aeon-mcp]";

function skillToToolName(slug: string): string {
  return `aeon-${slug}`;
}

function toolNameToSlug(toolName: string): string {
  return toolName.replace(/^aeon-/, "");
}

function buildTools(skills: Skill[]) {
  return skills.map((skill) => ({
    name: skillToToolName(skill.slug),
    description: buildDescription(skill),
    inputSchema: {
      type: "object" as const,
      properties: {
        var: {
          type: "string",
          description: buildVarDescription(skill),
        },
      },
      required: [],
    },
  }));
}

function buildDescription(skill: Skill): string {
  const categoryLabel = categoryName(skill.category);
  const scheduleLabel =
    skill.schedule === "on-demand"
      ? "on-demand"
      : `cron: ${skill.schedule}`;
  return `[Aeon · ${categoryLabel}] ${skill.description} (${scheduleLabel})`;
}

function buildVarDescription(skill: Skill): string {
  if (skill.var) return skill.var;
  const defaults: Record<string, string> = {
    core: "Skill-specific input (e.g. a skill name, owner/repo, or 'name: purpose'). See the skill's SKILL.md for its var contract.",
    research: "Topic or keyword to focus the skill on (e.g. 'AI agents'). Leave empty for auto-selection.",
    dev: "Repo in owner/repo format to narrow scope. Leave empty to scan all watched repos.",
    crypto: "Token symbol or contract address to focus on. Leave empty for all tracked tokens.",
    "onchain-security": "Address, transaction hash, or token contract to investigate.",
    social: "Topic, handle, or keyword. Leave empty to use configured defaults.",
    productivity: "Focus area or goal. Leave empty for general operation.",
    meta: "Skill slug or focus area to scope the run. Leave empty to operate across all skills.",
  };
  return (
    defaults[skill.category] ??
    `Optional variable input for the ${skill.name} skill.`
  );
}

function categoryName(category: string): string {
  const labels: Record<string, string> = {
    core: "Core",
    research: "Research",
    dev: "Dev",
    crypto: "Crypto",
    "onchain-security": "Onchain Security",
    social: "Social",
    productivity: "Productivity",
    meta: "Meta",
  };
  return labels[category] ?? category;
}

// ---- Server setup ----

const server = new Server(
  { name: "aeon-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const skills = loadSkills(REPO_ROOT, LOG_PREFIX);
const tools = buildTools(skills);

process.stderr.write(
  `${LOG_PREFIX} Loaded ${skills.length} skills from ${REPO_ROOT}\n`
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const slug = toolNameToSlug(toolName);
  const skill = skills.find((s) => s.slug === slug);

  if (!skill) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Unknown Aeon tool: ${toolName}\nAvailable tools: ${tools.map((t) => t.name).join(", ")}`,
        },
      ],
      isError: true,
    };
  }

  const varArg = request.params.arguments?.var;
  const varValue = typeof varArg === "string" ? varArg : "";
  const output = runSkill(REPO_ROOT, slug, varValue, LOG_PREFIX);

  return {
    content: [{ type: "text" as const, text: output }],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[aeon-mcp] Server running on stdio\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`[aeon-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});
